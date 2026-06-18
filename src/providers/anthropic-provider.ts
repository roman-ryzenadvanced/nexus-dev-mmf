/**
 * Nexus-Dev MMFE — Anthropic Provider Adapter
 *
 * Wraps the Anthropic API as an LLMProvider, supporting Claude 4,
 * Claude Sonnet 4, Claude Haiku 3.5, and other Anthropic models.
 *
 * Requires the ANTHROPIC_API_KEY environment variable or apiKey in config.
 *
 * @version 4.0.0
 */

import type { LLMProvider, ProviderCompletionOptions, ProviderCompletionResult, ProviderConfig, ProviderId, ProviderMessage } from './types.js';

export class AnthropicProvider implements LLMProvider {
  readonly providerId: ProviderId = 'anthropic';
  readonly name = 'Anthropic';
  readonly supportedModels: string[] = [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-haiku-3-5-20241022',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ];

  // Friendly aliases
  private static readonly MODEL_ALIASES: Record<string, string> = {
    'claude-opus-4': 'claude-opus-4-20250514',
    'claude-sonnet-4': 'claude-sonnet-4-20250514',
    'claude-haiku-3.5': 'claude-haiku-3-5-20241022',
    'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
    'claude-3.5-haiku': 'claude-3-5-haiku-20241022',
  };

  private apiKey: string = '';
  private baseURL: string = 'https://api.anthropic.com';
  private _isReady = false;

  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Build the absolute Messages URL from the configured base URL.
   *
   * Per the Anthropic convention (official SDK + Claude Code), the base URL
   * must NOT include `/v1` — e.g. `ANTHROPIC_BASE_URL=https://api.anthropic.com`
   * or a proxy like `https://cc.freemodel.dev`. The `/v1/messages` route is
   * appended here. Trailing slashes on the base are tolerated.
   */
  private get messagesUrl(): string {
    const trimmed = this.baseURL.replace(/\/+$/, '');
    return `${trimmed}/v1/messages`;
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this.baseURL = config.baseURL ?? process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';

    if (!this.apiKey) {
      throw new Error('Anthropic provider requires ANTHROPIC_API_KEY or apiKey in config');
    }

    this._isReady = true;
  }

  /**
   * Resolve model aliases to full model IDs.
   */
  private resolveModel(modelId: string): string {
    return AnthropicProvider.MODEL_ALIASES[modelId] ?? modelId;
  }

  async complete(model: string, messages: ProviderMessage[], options?: ProviderCompletionOptions): Promise<ProviderCompletionResult> {
    if (!this._isReady) {
      throw new Error('Anthropic provider not initialized');
    }

    const resolvedModel = this.resolveModel(model);

    // Anthropic uses a separate 'system' parameter instead of a system message
    let systemPrompt: string | undefined;
    const nonSystemMessages: { role: string; content: string }[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${msg.content}` : msg.content;
      } else {
        nonSystemMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const body: any = {
      model: resolvedModel,
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

    // Extended thinking for Claude 4 models
    if (options?.enableThinking) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: 10000,
      };
    }

    // Merge provider-specific options
    if (options?.providerOptions) {
      Object.assign(body, options.providerOptions);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      // Identify as a Claude Code client. Anthropic-compatible proxies /
      // gateways (and the official endpoint) recognize this UA, same
      // convention as the ZAI Anthropic provider and OpenClaw's kimi-coding.
      'User-Agent': 'claude-code/0.1.0',
    };

    const response = await fetch(this.messagesUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Extract text content from Anthropic's content block format
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
      model: data.model ?? resolvedModel,
      provider: 'anthropic',
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
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'User-Agent': 'claude-code/0.1.0',
      };
      // Anthropic doesn't have a simple health endpoint, so try a minimal request
      const response = await fetch(this.messagesUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-3-5-20241022',
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
    return [...this.supportedModels, ...Object.keys(AnthropicProvider.MODEL_ALIASES)];
  }

  supportsModel(modelId: string): boolean {
    return this.supportedModels.includes(modelId) || modelId in AnthropicProvider.MODEL_ALIASES;
  }

  async shutdown(): Promise<void> {
    this._isReady = false;
  }
}
