/**
 * Nexus-Dev MMFE — Providers Module Entry Point
 *
 * Exports the provider abstraction layer for multi-provider LLM access.
 *
 * @version 4.0.0
 */

// Types
export type {
  LLMProvider,
  ProviderId,
  ProviderConfig,
  ProviderMessage,
  ProviderCompletionOptions,
  ProviderCompletionResult,
  ProviderTokenUsage,
  MultiProviderConfig,
} from './types.js';

export {
  DEFAULT_MULTI_PROVIDER_CONFIG,
} from './types.js';

// Provider implementations
export { ZAIProvider } from './zai-provider.js';
export { ZAIAnthropicProvider } from './zai-anthropic-provider.js';
export { OpenAIProvider } from './openai-provider.js';
export { AnthropicProvider } from './anthropic-provider.js';
export { GoogleProvider } from './google-provider.js';

// Provider router
export { ProviderRouter, createProviderRouter } from './provider-router.js';
