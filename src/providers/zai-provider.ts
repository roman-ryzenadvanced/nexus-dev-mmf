/**
 * Nexus-Dev MMFE — ZAI Provider Adapter
 *
 * Wraps the z-ai-web-dev-sdk as an LLMProvider, maintaining full
 * backward compatibility with the existing Nexus implementation.
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
import { loadZAIClient } from './zai-loader.js';

// Minimal structural type for the SDK client we depend on.
interface ZAISDKClient {
  chat: {
    completions: {
      create: (body: Record<string, unknown>) => Promise<any>;
    };
  };
}

export class ZAIProvider implements LLMProvider {
  readonly providerId: ProviderId = 'zai';
  readonly name = 'ZAI (z-ai-web-dev-sdk)';
  readonly supportedModels: string[] = [
    'glm-5.2-1m',
    'glm-5.2',
    'glm-5.1',
    'glm-5',
    'glm-5v-turbo',
    'glm-4.7',
  ];

  private client: ZAISDKClient | null = null;
  private _isReady = false;
  private config: ProviderConfig | null = null;

  get isReady(): boolean {
    return this._isReady;
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    try {
      // Dynamic load via the shared loader: auto-creates ~/.z-ai-config,
      // probes the endpoint (401 ≠ down), and falls back to the secondary URL.
      this.client = (await loadZAIClient(config.apiKey)) as ZAISDKClient;
      this._isReady = true;
    } catch (error: any) {
      this._isReady = false;
      throw new Error(`ZAI provider initialization failed: ${error?.message ?? 'Unknown error'}`);
    }
  }

  async complete(
    model: string,
    messages: ProviderMessage[],
    options?: ProviderCompletionOptions
  ): Promise<ProviderCompletionResult> {
    if (!this.client) {
      this.client = (await loadZAIClient(this.config?.apiKey)) as ZAISDKClient;
      this._isReady = true;
    }

    const zaiMessages = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const requestOptions: any = {
      model,
      messages: zaiMessages,
      temperature: options?.temperature ?? 0.4,
    };

    if (options?.maxTokens) {
      requestOptions.max_tokens = options.maxTokens;
    }

    if (options?.enableThinking) {
      requestOptions.thinking = { type: 'enabled' };
    }

    if (options?.topP !== undefined) {
      requestOptions.top_p = options.topP;
    }

    if (options?.stopSequences) {
      requestOptions.stop = options.stopSequences;
    }

    // Merge any provider-specific options
    if (options?.providerOptions) {
      Object.assign(requestOptions, options.providerOptions);
    }

    const response = await this.client.chat.completions.create(requestOptions);

    const content = response.choices?.[0]?.message?.content ?? '';

    return {
      content,
      model,
      provider: 'zai',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens ?? 0,
        completionTokens: response.usage.completion_tokens ?? 0,
        totalTokens: response.usage.total_tokens ?? 0,
      } : undefined,
      metadata: {
        id: response.id,
        created: response.created,
        model: response.model,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        this.client = (await loadZAIClient(this.config?.apiKey)) as ZAISDKClient;
      }
      // Try a minimal request to verify connectivity
      const response = await this.client.chat.completions.create({
        model: 'glm-5',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
      return !!response.choices?.[0]?.message?.content;
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
    this.client = null;
    this._isReady = false;
  }
}
