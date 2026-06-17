/**
 * Nexus-Dev MMFE — ZAI Provider Adapter
 *
 * Wraps the z-ai-web-dev-sdk as an LLMProvider using the shared
 * zai-loader for auto-config with coding-specific endpoints.
 *
 * Coding endpoints (with fallback):
 *   Primary:   https://open.bigmodel.cn/api/coding/paas/v4
 *   Fallback:  https://api.z.ai/api/coding/paas/v4
 *
 * @version 5.0.0
 */

import { loadZAIClient } from './zai-loader.js';
import {
  LLMProvider,
  ProviderId,
  ProviderConfig,
  ProviderMessage,
  ProviderCompletionOptions,
  ProviderCompletionResult,
} from './types.js';

const ZAI_CODING_BASE_PRIMARY = 'https://open.bigmodel.cn/api/coding/paas/v4';

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

  private client: Awaited<ReturnType<typeof loadZAIClient>> | null = null;
  private _isReady = false;
  private config: ProviderConfig | null = null;

  get isReady(): boolean {
    return this._isReady;
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    try {
      this.client = await loadZAIClient();
      this._isReady = true;
    } catch (error: any) {
      this._isReady = false;
      const msg = error?.message ?? 'Unknown error';
      if (msg.includes('Configuration file not found')) {
        throw new Error(
          `ZAI provider: No .z-ai-config found. Set ZAI_API_KEY env var or create ~/.z-ai-config with: ` +
          `{"baseUrl":"${ZAI_CODING_BASE_PRIMARY}","apiKey":"YOUR_KEY"}`
        );
      }
      throw new Error(`ZAI provider initialization failed: ${msg}`);
    }
  }

  private async ensureClient(): Promise<Awaited<ReturnType<typeof loadZAIClient>>> {
    if (!this.client) {
      this.client = await loadZAIClient();
      this._isReady = true;
    }
    return this.client;
  }

  async complete(
    model: string,
    messages: ProviderMessage[],
    options?: ProviderCompletionOptions
  ): Promise<ProviderCompletionResult> {
    const client = await this.ensureClient();

    const zaiMessages = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const requestOptions: Record<string, unknown> = {
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

    const response = (await client.chat.completions.create(requestOptions)) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      id?: string;
      created?: number;
      model?: string;
    };

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
      const client = await this.ensureClient();
      const response = (await client.chat.completions.create({
        model: 'glm-5',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      })) as { choices?: Array<{ message?: { content?: string } }> };
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
