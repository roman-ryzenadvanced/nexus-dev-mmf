/**
 * Nexus-Dev MMFE — Provider Abstraction Layer Types
 *
 * Defines the unified interface that all LLM providers must implement.
 * This allows Nexus to route tasks across any provider (ZAI, OpenAI,
 * Anthropic, Google, etc.) using the same orchestration pipeline.
 *
 * @version 4.0.0
 */

/**
 * Supported LLM provider identifiers.
 */
export type ProviderId =
  | 'zai' // z-ai-web-dev-sdk, OpenAI-compatible coding endpoint (GLM models)
  | 'zai-anthropic' // ZAI Anthropic-compatible endpoint (https://api.z.ai/api/anthropic) — GLM via Messages API
  | 'openai' // OpenAI API (GPT-4o, o3, o4-mini, etc.)
  | 'freemodel' // FreeModel OpenAI-compatible endpoint (https://api.freemodel.dev/v1) — gpt-5.x / codex
  | 'anthropic' // Anthropic API (Claude 4, Sonnet 4, Haiku 3.5, etc.)
  | 'google'; // Google AI / Vertex AI (Gemini 2.5 Pro/Flash, etc.)

/**
 * A single message in a chat completion request.
 */
export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Options for a chat completion request.
 */
export interface ProviderCompletionOptions {
  /** Temperature (0-2). Default: 0.4 */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Enable thinking/reasoning mode if the model supports it */
  enableThinking?: boolean;
  /** Top-p sampling */
  topP?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Any provider-specific options */
  providerOptions?: Record<string, unknown>;
}

/**
 * Token usage statistics.
 */
export interface ProviderTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * The result of a chat completion.
 */
export interface ProviderCompletionResult {
  /** The generated text content */
  content: string;
  /** The model ID that actually processed the request */
  model: string;
  /** The provider that handled the request */
  provider: ProviderId;
  /** Token usage statistics (if available) */
  usage?: ProviderTokenUsage;
  /** Whether thinking/reasoning was used */
  thinkingUsed?: boolean;
  /** Any provider-specific metadata */
  metadata: Record<string, unknown>;
}

/**
 * Provider configuration for initialization.
 */
export interface ProviderConfig {
  /** The provider identifier */
  provider: ProviderId;
  /** API key (if required by the provider) */
  apiKey?: string;
  /** Base URL override (for proxies, enterprise endpoints, etc.) */
  baseURL?: string;
  /** Organization ID (for OpenAI) */
  organization?: string;
  /** Project ID (for Google Cloud) */
  project?: string;
  /** Region (for Vertex AI, etc.) */
  region?: string;
  /** Default timeout in ms */
  timeout?: number;
  /** Maximum concurrent requests */
  maxConcurrent?: number;
  /** Any provider-specific configuration */
  providerConfig?: Record<string, unknown>;
}

/**
 * The core LLM Provider interface.
 * Every provider adapter must implement this interface to be usable
 * by the Nexus orchestration pipeline.
 */
export interface LLMProvider {
  /** The provider identifier */
  readonly providerId: ProviderId;

  /** Human-readable provider name */
  readonly name: string;

  /** List of model IDs supported by this provider */
  readonly supportedModels: string[];

  /** Whether the provider is initialized and ready */
  readonly isReady: boolean;

  /**
   * Initialize the provider (authenticate, validate credentials, etc.).
   * Called once before any completions.
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Execute a chat completion request.
   */
  complete(model: string, messages: ProviderMessage[], options?: ProviderCompletionOptions): Promise<ProviderCompletionResult>;

  /**
   * Test connectivity and authentication.
   * Returns true if the provider can successfully make requests.
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get the list of models currently available from this provider.
   * May refresh from the provider's API if supported.
   */
  listModels(): string[];

  /**
   * Check if a specific model is available from this provider.
   */
  supportsModel(modelId: string): boolean;

  /**
   * Gracefully shut down the provider (cleanup, close connections, etc.).
   */
  shutdown(): Promise<void>;
}

/**
 * Multi-provider configuration for Nexus-Dev.
 */
export interface MultiProviderConfig {
  /** Provider configurations keyed by provider ID */
  providers: Partial<Record<ProviderId, ProviderConfig>>;
  /** Which provider to use as the default (resolves model IDs without provider prefix) */
  defaultProvider: ProviderId;
  /** Whether to allow fallback to other providers when a model fails */
  enableFallback: boolean;
  /** Whether to load providers lazily (on first use) vs eagerly (at startup) */
  lazyLoad: boolean;
  /** Maximum time to wait for a provider to initialize (ms) */
  initTimeout: number;
}

export const DEFAULT_MULTI_PROVIDER_CONFIG: MultiProviderConfig = {
  providers: {},
  defaultProvider: 'zai',
  enableFallback: true,
  lazyLoad: true,
  initTimeout: 30_000,
};
