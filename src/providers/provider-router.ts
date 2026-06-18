/**
 * Nexus-Dev MMFE — Provider Router
 *
 * Central registry and router for all LLM providers. Routes completion
 * requests to the correct provider based on the model ID, manages
 * provider lifecycle, and handles fallback logic.
 *
 * Model IDs are resolved to providers using one of:
 * 1. Provider prefix: "openai/gpt-4o", "anthropic/claude-sonnet-4"
 * 2. Model registry: ModelProfile.provider field
 * 3. Default provider: Falls back to the configured default
 *
 * @version 4.0.0
 */

import { AnthropicProvider } from './anthropic-provider.js';
import { FreeModelProvider } from './freemodel-provider.js';
import { GoogleProvider } from './google-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import type {
  LLMProvider,
  MultiProviderConfig,
  ProviderCompletionOptions,
  ProviderCompletionResult,
  ProviderConfig,
  ProviderId,
  ProviderMessage,
} from './types.js';
import { DEFAULT_MULTI_PROVIDER_CONFIG } from './types.js';
import { ZAIAnthropicProvider } from './zai-anthropic-provider.js';
import { ZAIProvider } from './zai-provider.js';

/**
 * Factory function to create a provider instance by ID.
 */
function createProviderInstance(providerId: ProviderId): LLMProvider {
  switch (providerId) {
    case 'zai':
      return new ZAIProvider();
    case 'zai-anthropic':
      return new ZAIAnthropicProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'freemodel':
      return new FreeModelProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'google':
      return new GoogleProvider();
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

/**
 * Parse a model ID that may include a provider prefix.
 * E.g., "openai/gpt-4o" → { provider: 'openai', model: 'gpt-4o' }
 */
function parseModelId(modelId: string): {
  provider?: ProviderId;
  model: string;
} {
  const slashIndex = modelId.indexOf('/');
  if (slashIndex === -1) {
    return { model: modelId };
  }

  const prefix = modelId.substring(0, slashIndex) as ProviderId;
  const model = modelId.substring(slashIndex + 1);

  const validProviders: ProviderId[] = ['zai', 'zai-anthropic', 'openai', 'freemodel', 'anthropic', 'google'];
  if (validProviders.includes(prefix)) {
    return { provider: prefix, model };
  }

  // Not a valid provider prefix — treat the whole thing as a model ID
  return { model: modelId };
}

export class ProviderRouter {
  private readonly providers: Map<ProviderId, LLMProvider> = new Map();
  private readonly config: MultiProviderConfig;
  private readonly initializing: Set<ProviderId> = new Set();

  constructor(config?: Partial<MultiProviderConfig>) {
    this.config = { ...DEFAULT_MULTI_PROVIDER_CONFIG, ...config };
  }

  /**
   * Initialize all configured providers.
   * Providers that fail initialization are logged but don't block others.
   *
   * If the configured default provider fails to initialize (e.g. its API key
   * is missing), the router cascades through the other known providers and
   * adopts the first one that initializes successfully as the effective
   * default. This keeps the CLI usable out-of-the-box when only a non-default
   * provider has credentials (e.g. the user has ZAI_ANTHROPIC_API_KEY but not
   * ZAI_API_KEY).
   */
  async initialize(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    // Always initialize the default provider
    const defaultConfig = this.config.providers[this.config.defaultProvider] ?? {
      provider: this.config.defaultProvider,
    };

    initPromises.push(this.initProvider(this.config.defaultProvider, defaultConfig));

    // Initialize other configured providers
    for (const [providerId, providerConfig] of Object.entries(this.config.providers)) {
      if (providerId === this.config.defaultProvider) continue;
      initPromises.push(this.initProvider(providerId as ProviderId, providerConfig));
    }

    await Promise.allSettled(initPromises);

    // If lazy loading is disabled, eagerly initialize ZAI (always available)
    if (!this.config.lazyLoad && !this.providers.has('zai')) {
      try {
        await this.initProvider('zai', { provider: 'zai' });
      } catch {
        // ZAI might not be available in all environments
      }
    }

    // Cascade fallback: if the default provider is not ready, try every other
    // known provider in priority order and adopt the first one that works.
    if (!this.providers.get(this.config.defaultProvider)?.isReady) {
      this.config.defaultProvider = await this.resolveFallbackDefaultProvider();
    }
  }

  /**
   * Find the first known provider (other than the failed default) that can be
   * initialized from environment variables. Returns the original default if
   * none can be initialized (so the error message stays meaningful).
   */
  private async resolveFallbackDefaultProvider(): Promise<ProviderId> {
    const original = this.config.defaultProvider;
    // Ordered preference: keep ZAI-family first (most "native"), then the rest.
    const candidates: ProviderId[] = ['zai-anthropic', 'zai', 'freemodel', 'anthropic', 'openai', 'google'];
    for (const candidate of candidates) {
      if (candidate === original) continue;
      // Already initialized successfully earlier?
      if (this.providers.get(candidate)?.isReady) {
        console.warn(`[ProviderRouter] Default provider '${original}' unavailable; falling back to '${candidate}'.`);
        return candidate;
      }
      // Try to initialize it now from env.
      try {
        await this.initProvider(candidate, { provider: candidate });
        if (this.providers.get(candidate)?.isReady) {
          console.warn(`[ProviderRouter] Default provider '${original}' unavailable; falling back to '${candidate}'.`);
          return candidate;
        }
      } catch {
        // continue to next candidate
      }
    }
    return original;
  }

  /**
   * Initialize a single provider.
   */
  private async initProvider(providerId: ProviderId, config: ProviderConfig): Promise<void> {
    if (this.providers.has(providerId) || this.initializing.has(providerId)) {
      return;
    }

    this.initializing.add(providerId);

    try {
      const provider = createProviderInstance(providerId);
      await Promise.race([
        provider.initialize(config),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Initialization timeout')), this.config.initTimeout)),
      ]);
      this.providers.set(providerId, provider);
    } catch (error: any) {
      console.warn(`[ProviderRouter] Failed to initialize ${providerId}: ${error?.message ?? error}`);
    } finally {
      this.initializing.delete(providerId);
    }
  }

  /**
   * Register a custom provider.
   */
  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  /**
   * Route a completion request to the correct provider.
   *
   * Resolution order:
   * 1. Explicit provider prefix in model ID ("openai/gpt-4o")
   * 2. Known model → provider mapping (from registry)
   * 3. Default provider
   */
  async complete(modelId: string, messages: ProviderMessage[], options?: ProviderCompletionOptions): Promise<ProviderCompletionResult> {
    const parsed = parseModelId(modelId);
    const provider = this.resolveProvider(parsed.provider, parsed.model);
    return provider.complete(parsed.model, messages, options);
  }

  /**
   * Route a completion request with fallback.
   * If the primary provider fails, try alternative providers that support the model.
   */
  async completeWithFallback(
    modelId: string,
    messages: ProviderMessage[],
    options?: ProviderCompletionOptions,
    fallbackModels?: string[]
  ): Promise<ProviderCompletionResult> {
    try {
      return await this.complete(modelId, messages, options);
    } catch (primaryError: any) {
      if (!this.config.enableFallback || !fallbackModels?.length) {
        throw primaryError;
      }

      // Try fallback models
      for (const fallbackModel of fallbackModels) {
        try {
          return await this.complete(fallbackModel, messages, options);
        } catch {
          continue;
        }
      }

      throw primaryError;
    }
  }

  /**
   * Resolve which provider should handle a given model.
   */
  private resolveProvider(hintProvider?: ProviderId, model?: string): LLMProvider {
    // 1. Explicit provider hint from model ID prefix
    if (hintProvider) {
      const provider = this.providers.get(hintProvider);
      if (provider?.isReady) {
        return provider;
      }
      throw new Error(`Provider '${hintProvider}' is not available. Ensure it is configured and initialized.`);
    }

    // 2. Try to find a provider that supports this model
    if (model) {
      for (const provider of this.providers.values()) {
        if (provider.isReady && provider.supportsModel(model)) {
          return provider;
        }
      }
    }

    // 3. Fall back to default provider
    const defaultProvider = this.providers.get(this.config.defaultProvider);
    if (defaultProvider?.isReady) {
      return defaultProvider;
    }

    // 4. Fall back to any available provider
    for (const provider of this.providers.values()) {
      if (provider.isReady) {
        return provider;
      }
    }

    throw new Error(
      `No provider available for model '${model ?? 'unknown'}'. ` +
        `Configured providers: [${Array.from(this.providers.keys()).join(', ')}]. ` +
        `Ensure at least one provider is initialized.`
    );
  }

  /**
   * Get a specific provider by ID.
   */
  getProvider(providerId: ProviderId): LLMProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all active (ready) providers.
   */
  getActiveProviders(): LLMProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isReady);
  }

  /**
   * Get all registered provider IDs.
   */
  getProviderIds(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a specific provider is available and ready.
   */
  isProviderAvailable(providerId: ProviderId): boolean {
    return this.providers.get(providerId)?.isReady ?? false;
  }

  /**
   * List all available models across all providers.
   */
  listAllModels(): { provider: ProviderId; models: string[] }[] {
    const result: { provider: ProviderId; models: string[] }[] = [];
    for (const [providerId, provider] of this.providers) {
      if (provider.isReady) {
        result.push({ provider: providerId, models: provider.listModels() });
      }
    }
    return result;
  }

  /**
   * Run health checks on all providers.
   */
  async healthCheckAll(): Promise<Record<ProviderId, boolean>> {
    const results: Record<string, boolean> = {};
    const checks = Array.from(this.providers.entries()).map(async ([id, provider]) => {
      try {
        results[id] = await provider.healthCheck();
      } catch {
        results[id] = false;
      }
    });
    await Promise.allSettled(checks);
    return results;
  }

  /**
   * Gracefully shut down all providers.
   */
  async shutdown(): Promise<void> {
    const shutdowns = Array.from(this.providers.values()).map(p => p.shutdown());
    await Promise.allSettled(shutdowns);
    this.providers.clear();
  }
}

/**
 * Create a ProviderRouter with the given configuration.
 */
export function createProviderRouter(config?: Partial<MultiProviderConfig>): ProviderRouter {
  return new ProviderRouter(config);
}
