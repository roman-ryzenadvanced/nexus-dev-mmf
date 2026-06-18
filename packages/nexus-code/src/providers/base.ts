// ============================================================
// Provider base — unified interface for chat + model fetching
// ============================================================

import type { ChatMessage, ChatRequestOptions, ChatResponse, ModelDescriptor } from '../types.js';

export interface Provider {
  readonly id: string;
  readonly kind: 'openai' | 'anthropic' | 'zai';
  readonly name: string;

  /** List models advertised by this provider's /v1/models endpoint. */
  fetchModels(): Promise<ModelDescriptor[]>;

  /** Send a chat completion request (streaming or one-shot). */
  chat(messages: ChatMessage[], opts?: ChatRequestOptions): Promise<ChatResponse>;

  /** Stream an async generator of token deltas. Returns the full ChatResponse as the generator's return value. */
  streamChat?(messages: ChatMessage[], opts?: ChatRequestOptions): AsyncGenerator<string, ChatResponse, unknown>;

  /** Quick health check — used by /status. */
  ping?(): Promise<{ ok: boolean; latencyMs?: number; detail?: string }>;
}

export abstract class BaseProvider implements Provider {
  abstract readonly id: string;
  abstract readonly kind: 'openai' | 'anthropic' | 'zai';
  abstract readonly name: string;

  protected baseURL?: string;
  protected apiKey?: string;

  constructor(opts: { baseURL?: string; apiKey?: string }) {
    this.baseURL = opts.baseURL;
    this.apiKey = opts.apiKey;
  }

  abstract fetchModels(): Promise<ModelDescriptor[]>;
  abstract chat(messages: ChatMessage[], opts?: ChatRequestOptions): Promise<ChatResponse>;

  protected assertKey(): void {
    if (!this.apiKey) {
      throw new Error(`Provider "${this.id}" is missing an API key. ` + `Set it in ~/.nexus/config.json or via the matching env var.`);
    }
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly statusCode?: number,
    public readonly detail?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
