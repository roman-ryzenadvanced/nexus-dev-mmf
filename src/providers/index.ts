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
  MultiProviderConfig,
  ProviderCompletionOptions,
  ProviderCompletionResult,
  ProviderConfig,
  ProviderId,
  ProviderMessage,
  ProviderTokenUsage,
} from './types.js';
export { DEFAULT_MULTI_PROVIDER_CONFIG } from './types.js';

// Provider implementations
export { AnthropicProvider } from './anthropic-provider.js';
export { GoogleProvider } from './google-provider.js';
export { OpenAIProvider } from './openai-provider.js';
export { ZAIAnthropicProvider } from './zai-anthropic-provider.js';
export { ZAIProvider } from './zai-provider.js';

// Provider router
export { createProviderRouter, ProviderRouter } from './provider-router.js';
