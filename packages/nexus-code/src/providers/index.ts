// ============================================================
// Provider registry + factory
// ============================================================

import type { ProviderConfig } from '../types.js';
import type { Provider } from './base.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { ZAIProvider } from './zai.js';

export { ProviderError } from './base.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { ZAIProvider } from './zai.js';
export type { Provider, BaseProvider } from './base.js';

export function createProvider(cfg: ProviderConfig): Provider {
  switch (cfg.kind) {
    case 'openai':
      return new OpenAIProvider({
        id: cfg.id,
        name: cfg.name,
        baseURL: cfg.baseURL,
        apiKey: cfg.apiKey,
      });
    case 'anthropic':
      return new AnthropicProvider({
        id: cfg.id,
        name: cfg.name,
        baseURL: cfg.baseURL,
        apiKey: cfg.apiKey,
      });
    case 'zai':
      return new ZAIProvider({ apiKey: cfg.apiKey });
    default: {
      const _exhaustive: never = cfg.kind;
      throw new Error(`Unknown provider kind: ${_exhaustive}`);
    }
  }
}

export function buildProviders(config: { providers: ProviderConfig[] }): Map<string, Provider> {
  const map = new Map<string, Provider>();
  for (const cfg of config.providers) {
    map.set(cfg.id, createProvider(cfg));
  }
  return map;
}
