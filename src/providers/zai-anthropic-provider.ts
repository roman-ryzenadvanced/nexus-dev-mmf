/**
 * Nexus-Dev MMFE — ZAI Anthropic Provider Adapter
 *
 * Wraps Z.AI's Anthropic-compatible endpoint as an LLMProvider.
 * Z.AI exposes GLM models (glm-5.2, glm-4.7, ...) through an Anthropic
 * Messages-compatible surface at https://api.z.ai/api/anthropic, primarily
 * designed to drop GLM into Claude Code and other Anthropic-API clients.
 *
 * Unlike the default `zai` provider (which uses the z-ai-web-dev-sdk against
 * the OpenAI-compatible coding endpoint), this adapter talks the Anthropic
 * Messages protocol directly via fetch.
 *
 * Auth: `Authorization: Bearer <key>` (Z.AI convention, as documented under
 * ANTHROPIC_AUTH_TOKEN). Not `x-api-key`.
 *
 * Requires ZAI_API_KEY (or ZAI_ANTHROPIC_API_KEY) in the environment, or
 * `apiKey` in config.
 *
 * @version 5.1.0
 */

import type { LLMProvider, ProviderCompletionOptions, ProviderCompletionResult, ProviderConfig, ProviderId, ProviderMessage } from './types.js';

/**
 * User-Agent sent to identify as a Claude Code client.
 *
 * Z.AI's Anthropic endpoint is built for Claude Code consumption, and mirrors
 * what the bundled `kimi-coding` provider does (see OpenClaw's
 * extensions/kimi-coding/provider-catalog.ts: `User-Agent: claude-code/0.1.0`).
 * Endpoints of this kind (Anthropic-compatible translators) recognize this UA.
 */
const CLAUDE_CODE_USER_AGENT = 'claude-code/0.1.0';

/**
 * Default base URL for Z.AI's Anthropic-compatible endpoint.
 * The Messages path is appended as `/v1/messages`.
 */
const DEFAULT_ZAI_ANTHROPIC_BASE_URL = 'https://api.z.ai/api/anthropic';

/**
 * GLM model ids exposed through the Anthropic-compatible endpoint.
 * Mirrors the catalog from the OpenAI-compatible `zai` provider.
 */
const ZAI_ANTHROPIC_MODELS = ['glm-5.2', 'glm-5.2-1m', 'glm-5.1', 'glm-5', 'glm-5v-turbo', 'glm-4.7', 'glm-4.6'] as const;

export class ZAIAnthropicProvider implements LLMProvider {
  readonly providerId: ProviderId = 'zai-anthropic';
  readonly name = 'ZAI (Anthropic endpoint)';
  readonly supportedModels: string[] = [...ZAI_ANTHROPIC_MODELS];

  private apiKey: string = '';
  private baseURL: string = DEFAULT_ZAI_ANTHROPIC_BASE_URL;
  private _isReady = false;

  get isReady(): boolean {
    return this._isReady;
  }

  async initialize(config: ProviderConfig): Promise<void> {
    // Prefer a dedicated ZAI_ANTHROPIC_API_KEY so the same process can carry a
    // distinct key for this endpoint vs. the OpenAI-compatible `zai` provider,
    // but fall back to the shared ZAI_API_KEY.
    this.apiKey = config.apiKey ?? process.env.ZAI_ANTHROPIC_API_KEY ?? process.env.ZAI_API_KEY ?? '';

    this.baseURL = config.baseURL ?? process.env.ZAI_ANTHROPIC_BASE_URL ?? DEFAULT_ZAI_ANTHROPIC_BASE_URL;

    if (!this.apiKey) {
      throw new Error('ZAI Anthropic provider requires ZAI_ANTHROPIC_API_KEY (or ZAI_API_KEY) env var, or apiKey in config.');
    }

    this._isReady = true;
  }

  /**
   * Build the absolute Messages URL from the configured base URL.
   * Z.AI's documented base is `https://api.z.ai/api/anthropic` (no `/v1`),
   * and the Messages route lives at `/v1/messages`.
   */
  private get messagesUrl(): string {
    const trimmed = this.baseURL.replace(/\/+$/, '');
    return `${trimmed}/v1/messages`;
  }

  async complete(model: string, messages: ProviderMessage[], options?: ProviderCompletionOptions): Promise<ProviderCompletionResult> {
    if (!this._isReady) {
      throw new Error('ZAI Anthropic provider not initialized');
    }

    // Anthropic Messages API uses a separate top-level `system` parameter
    // instead of a system message in the messages array.
    let systemPrompt: string | undefined;
    const nonSystemMessages: { role: string; content: string }[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${msg.content}` : msg.content;
      } else {
        nonSystemMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const body: Record<string, unknown> = {
      model,
      messages: nonSystemMessages,
      max_tokens: options?.maxTokens ?? 8192,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    } else {
      body.temperature = 0.4;
    }

    if (options?.topP !== undefined) {
      body.top_p = options.topP;
    }

    if (options?.stopSequences) {
      body.stop_sequences = options.stopSequences;
    }

    // Extended thinking for GLM reasoning models (glm-5.2, glm-4.7, ...)
    if (options?.enableThinking) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: 10000,
      };
    }

    if (options?.providerOptions) {
      Object.assign(body, options.providerOptions);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Z.AI's Anthropic endpoint authenticates with a Bearer token (the
      // official Claude Code setup uses ANTHROPIC_AUTH_TOKEN), not x-api-key.
      Authorization: `Bearer ${this.apiKey}`,
      'anthropic-version': '2023-06-01',
      'User-Agent': CLAUDE_CODE_USER_AGENT,
    };

    const response = await fetch(this.messagesUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ZAI Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Extract text from Anthropic-style content blocks.
    let content = '';
    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'text') {
          content += block.text;
        }
      }
    } else if (typeof data.content === 'string') {
      content = data.content;
    }

    return {
      content,
      model: data.model ?? model,
      provider: 'zai-anthropic',
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens ?? 0,
            completionTokens: data.usage.output_tokens ?? 0,
            totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          }
        : undefined,
      thinkingUsed: options?.enableThinking,
      metadata: {
        id: data.id,
        stopReason: data.stop_reason,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'User-Agent': CLAUDE_CODE_USER_AGENT,
      };
      // Minimal request to verify auth + connectivity.
      const response = await fetch(this.messagesUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'glm-4.7',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
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
