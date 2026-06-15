/**
 * Nexus-Dev MMFE — OpenAI Provider Adapter
 *
 * Wraps the OpenAI API as an LLMProvider, supporting GPT-4o, o3,
 * o4-mini, and other OpenAI models.
 *
 * Requires the OPENAI_API_KEY environment variable or apiKey in config.
 *
 * @version 4.0.0
 */

import {
  LLMProvider,
  ProviderId,
  ProviderConfig,
  ProviderMessage,
  ProviderCompletionOptions,
  ProviderCompletionResult,
} from './types.js';

export class OpenAIProvider implements LLMProvider {
  readonly providerId: ProviderId = 'openai';
  readonly name = 'OpenAI';
  readonly supportedModels: string[] = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'o3',
    'o3-mini',
    'o4-mini',
  ];

  private apiKey: string = '';
  private baseURL: string = 'https://api.openai.com/v1';
  private organization: string = '';
  private _isReady = false;

  get isReady(): boolean {
    return this._isReady;
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.baseURL = config.baseURL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    this.organization = config.organization ?? process.env.OPENAI_ORG_ID ?? '';

    if (!this.apiKey) {
      throw new Error('OpenAI provider requires OPENAI_API_KEY or apiKey in config');
    }

    this._isReady = true;
  }

  async complete(
    model: string,
    messages: ProviderMessage[],
    options?: ProviderCompletionOptions
  ): Promise<ProviderCompletionResult> {
    if (!this._isReady) {
      throw new Error('OpenAI provider not initialized');
    }

    const oaiMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Build request body — handle reasoning models (o3, o4-mini) differently
    const isReasoningModel = model.startsWith('o3') || model.startsWith('o4');
    const body: any = {
      model,
      messages: oaiMessages,
    };

    if (isReasoningModel) {
      // Reasoning models use max_completion_tokens instead of max_tokens
      // and don't support temperature
      if (options?.maxTokens) {
        body.max_completion_tokens = options.maxTokens;
      }
      if (options?.enableThinking) {
        body.reasoning_effort = 'high';
      }
    } else {
      body.temperature = options?.temperature ?? 0.4;
      if (options?.maxTokens) {
        body.max_tokens = options.maxTokens;
      }
      if (options?.topP !== undefined) {
        body.top_p = options.topP;
      }
      if (options?.stopSequences) {
        body.stop = options.stopSequences;
      }
    }

    // Merge provider-specific options
    if (options?.providerOptions) {
      Object.assign(body, options.providerOptions);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as any;

    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model ?? model,
      provider: 'openai',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      } : undefined,
      thinkingUsed: isReasoningModel && options?.enableThinking,
      metadata: {
        id: data.id,
        created: data.created,
        systemFingerprint: data.system_fingerprint,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.apiKey}`,
      };
      const response = await fetch(`${this.baseURL}/models`, {
        headers,
        signal: AbortSignal.timeout(10_000),
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
