/**
 * Nexus-Dev MMFE — FreeModel Provider Adapter
 *
 * Wraps the FreeModel OpenAI-compatible endpoint
 * (https://api.freemodel.dev/v1) as an LLMProvider. FreeModel exposes the
 * GPT-5.x family and a Codex-tuned model through a standard OpenAI Chat
 * Completions surface, authenticated with a Bearer API key (FREEMODEL_API_KEY).
 *
 * Unlike the generic `openai` provider, this one ships the FreeModel model
 * catalog (gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex) so model-id
 * resolution and `supportsModel()` work out of the box.
 *
 * Auth: `Authorization: Bearer <key>` (OpenAI convention).
 *
 * @version 5.2.0
 */

import type { LLMProvider, ProviderCompletionOptions, ProviderCompletionResult,ProviderConfig, ProviderId, ProviderMessage } from './types.js';

/**
 * Default base URL for the FreeModel OpenAI-compatible endpoint.
 * The chat completions route is `${baseURL}/chat/completions`.
 */
const DEFAULT_FREEMODEL_BASE_URL = 'https://api.freemodel.dev/v1';

/**
 * Models exposed by FreeModel's `/v1/models` endpoint.
 * All are OpenAI-wire (`supported_endpoint_types: ["openai"]`).
 */
const FREEMODEL_MODELS = ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex'] as const;

export class FreeModelProvider implements LLMProvider {
  readonly providerId: ProviderId = 'freemodel';
  readonly name = 'FreeModel';
  readonly supportedModels: string[] = [...FREEMODEL_MODELS];

  private apiKey = '';
  private baseURL = DEFAULT_FREEMODEL_BASE_URL;
  private _isReady = false;

  get isReady(): boolean {
    return this._isReady;
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.apiKey = config.apiKey ?? process.env.FREEMODEL_API_KEY ?? process.env.OPENAI_API_KEY ?? '';

    this.baseURL = config.baseURL ?? process.env.FREEMODEL_BASE_URL ?? DEFAULT_FREEMODEL_BASE_URL;

    if (!this.apiKey) {
      throw new Error('FreeModel provider requires FREEMODEL_API_KEY (or OPENAI_API_KEY) env var, or apiKey in config.');
    }

    this._isReady = true;
  }

  async complete(model: string, messages: ProviderMessage[], options?: ProviderCompletionOptions): Promise<ProviderCompletionResult> {
    if (!this._isReady) {
      throw new Error('FreeModel provider not initialized');
    }

    const oaiMessages = messages.map(m => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model,
      messages: oaiMessages,
      temperature: options?.temperature ?? 0.4,
    };

    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    }
    if (options?.topP !== undefined) {
      body.top_p = options.topP;
    }
    if (options?.stopSequences) {
      body.stop = options.stopSequences;
    }
    if (options?.providerOptions) {
      Object.assign(body, options.providerOptions);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    const response = await fetch(`${this.baseURL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FreeModel API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json());

    const content = data.choices?.[0]?.message?.content ?? '';

    return {
      content,
      model: data.model ?? model,
      provider: 'freemodel',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
      thinkingUsed: options?.enableThinking,
      metadata: {
        id: data.id,
        created: data.created,
        // FreeModel surfaces cached prompt tokens (prompt_tokens_details.cached_tokens)
        cachedPromptTokens: data.usage?.prompt_tokens_details?.cached_tokens,
        systemFingerprint: data.system_fingerprint,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Hit /v1/models with the Bearer token — cheap, no generation cost.
      const response = await fetch(`${this.baseURL.replace(/\/+$/, '')}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  listModels(): string[] {
    return [...this.supportedModels];
  }

  supportsModel(modelId: string): boolean {
    return this.supportedModels.includes(modelId);
  }

  async shutdown(): Promise<void> {
    this._isReady = false;
  }
}
