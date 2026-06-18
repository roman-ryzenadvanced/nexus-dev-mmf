/**
 * Nexus-Dev MMFE — Model Registry
 * Defines all available models across all providers, their capabilities,
 * and routing weights. Updated for v4.0.0 with multi-provider support.
 */

import type { ProviderId } from '../providers/types.js';

export interface ModelProfile {
  id: string;
  name: string;
  /** The provider that serves this model */
  provider: ProviderId;
  tier: 'flagship' | 'standard' | 'fast' | 'creative' | 'vision';
  capabilities: ModelCapability[];
  contextWindow: number;
  speedRank: number; // 1 = fastest, 5 = slowest
  qualityRank: number; // 1 = highest quality, 5 = lowest
  costWeight: number; // relative cost multiplier
  maxTokens: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  description: string;
}

export type ModelCapability =
  | 'reasoning'
  | 'math'
  | 'code'
  | 'creative-writing'
  | 'analysis'
  | 'summarization'
  | 'translation'
  | 'extraction'
  | 'planning'
  | 'debugging'
  | 'refactoring'
  | 'documentation'
  | 'conversation'
  | 'long-context'
  | 'vision'
  | 'rapid-iteration'
  | 'code-review'
  | 'design'
  | 'slope-detection'
  | 'design-system';

/**
 * The canonical model registry for Nexus-Dev MMFE.
 * Each model is profiled across multiple dimensions to enable
 * intelligent routing decisions by the Adaptive Routing Layer.
 *
 * Models from different providers can be mixed in the same pipeline.
 * The provider field tells the ProviderRouter which adapter to use.
 */
export const MODEL_REGISTRY: Record<string, ModelProfile> = {
  // ========================================================================
  // ZAI (z-ai-web-dev-sdk) — GLM Models
  // ========================================================================
  'glm-5.2-1m': {
    id: 'glm-5.2-1m',
    name: 'GLM 5.2 (1M Context)',
    provider: 'zai',
    tier: 'flagship',
    capabilities: ['reasoning', 'math', 'code', 'analysis', 'long-context', 'planning', 'code-review', 'design', 'slope-detection', 'design-system'],
    contextWindow: 1_000_000,
    speedRank: 5,
    qualityRank: 1,
    costWeight: 3.0,
    maxTokens: 8192,
    supportsThinking: true,
    supportsVision: false,
    description:
      'Advanced reasoning model with 1M token context window. Best for complex problem decomposition, long-document analysis, deep multi-step reasoning, and AI SLOPE detection/elimination.',
  },
  'glm-5.2': {
    id: 'glm-5.2',
    name: 'GLM 5.2',
    provider: 'zai',
    tier: 'flagship',
    capabilities: ['reasoning', 'math', 'code', 'analysis', 'planning', 'debugging', 'code-review', 'design', 'slope-detection', 'design-system'],
    contextWindow: 128_000,
    speedRank: 3,
    qualityRank: 1,
    costWeight: 2.0,
    maxTokens: 8192,
    supportsThinking: true,
    supportsVision: false,
    description:
      'Baseline high-performance model. Excellent for robust task execution, complex reasoning, design generation, and balanced quality-speed tradeoffs.',
  },
  'glm-5.1': {
    id: 'glm-5.1',
    name: 'GLM 5.1',
    provider: 'zai',
    tier: 'standard',
    capabilities: ['conversation', 'translation', 'summarization', 'extraction', 'creative-writing', 'code-review', 'design'],
    contextWindow: 128_000,
    speedRank: 3,
    qualityRank: 2,
    costWeight: 1.5,
    maxTokens: 4096,
    supportsThinking: true,
    supportsVision: false,
    description:
      'Nuanced language understanding and context sensitivity. Ideal for content refinement, summarization, design copy, and contextual awareness tasks.',
  },
  'glm-5': {
    id: 'glm-5',
    name: 'GLM 5',
    provider: 'zai',
    tier: 'fast',
    capabilities: ['code', 'debugging', 'rapid-iteration', 'summarization', 'extraction', 'code-review', 'design'],
    contextWindow: 32_000,
    speedRank: 1,
    qualityRank: 3,
    costWeight: 0.5,
    maxTokens: 4096,
    supportsThinking: false,
    supportsVision: false,
    description:
      'Speed and efficiency specialist. Best for rapid drafts, quick iterations, boilerplate generation, and high-throughput tasks where latency matters.',
  },
  'glm-5v-turbo': {
    id: 'glm-5v-turbo',
    name: 'GLM 5V Turbo',
    provider: 'zai',
    tier: 'fast',
    capabilities: ['rapid-iteration', 'code', 'debugging', 'vision', 'code-review', 'design'],
    contextWindow: 32_000,
    speedRank: 1,
    qualityRank: 3,
    costWeight: 0.5,
    maxTokens: 4096,
    supportsThinking: false,
    supportsVision: true,
    description: 'Accelerated response model for quick, iterative feedback loops. Also supports vision inputs for image-based analysis at high speed.',
  },
  'glm-4.7': {
    id: 'glm-4.7',
    name: 'GLM 4.7',
    provider: 'zai',
    tier: 'creative',
    capabilities: ['creative-writing', 'code', 'documentation', 'refactoring', 'analysis', 'code-review', 'design', 'design-system'],
    contextWindow: 128_000,
    speedRank: 4,
    qualityRank: 2,
    costWeight: 2.0,
    maxTokens: 8192,
    supportsThinking: true,
    supportsVision: false,
    description:
      'State-of-the-art creative generation, deep knowledge retrieval, and sophisticated code synthesis. Excels at producing elegant, well-structured outputs.',
  },

  // ========================================================================
  // OpenAI Models
  // ========================================================================
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    tier: 'flagship',
    capabilities: ['reasoning', 'code', 'analysis', 'planning', 'creative-writing', 'vision', 'code-review', 'design'],
    contextWindow: 128_000,
    speedRank: 3,
    qualityRank: 1,
    costWeight: 2.5,
    maxTokens: 16384,
    supportsThinking: false,
    supportsVision: true,
    description: 'OpenAI flagship multimodal model. Strong across reasoning, code, vision, and creative tasks. Excellent general-purpose model.',
  },
  'gpt-4.1': {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    tier: 'flagship',
    capabilities: ['reasoning', 'code', 'analysis', 'planning', 'code-review', 'long-context', 'design'],
    contextWindow: 1_047_576,
    speedRank: 3,
    qualityRank: 1,
    costWeight: 2.0,
    maxTokens: 32768,
    supportsThinking: false,
    supportsVision: false,
    description: 'OpenAI high-intelligence model with 1M context. Excels at complex instruction following, coding, and long-document analysis.',
  },
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    tier: 'standard',
    capabilities: ['reasoning', 'code', 'analysis', 'summarization', 'code-review', 'design'],
    contextWindow: 1_047_576,
    speedRank: 2,
    qualityRank: 2,
    costWeight: 1.0,
    maxTokens: 32768,
    supportsThinking: false,
    supportsVision: false,
    description: 'Balanced intelligence and speed with 1M context. Good for most tasks at lower cost than flagship models.',
  },
  o3: {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    tier: 'flagship',
    capabilities: ['reasoning', 'math', 'analysis', 'planning', 'long-context', 'code-review', 'slope-detection'],
    contextWindow: 200_000,
    speedRank: 5,
    qualityRank: 1,
    costWeight: 4.0,
    maxTokens: 100000,
    supportsThinking: true,
    supportsVision: false,
    description: 'OpenAI reasoning model with deep chain-of-thought. Best for math, science, coding, and complex multi-step reasoning.',
  },
  'o4-mini': {
    id: 'o4-mini',
    name: 'o4-mini',
    provider: 'openai',
    tier: 'standard',
    capabilities: ['reasoning', 'code', 'math', 'analysis', 'code-review'],
    contextWindow: 200_000,
    speedRank: 3,
    qualityRank: 2,
    costWeight: 1.5,
    maxTokens: 100000,
    supportsThinking: true,
    supportsVision: false,
    description: 'Fast reasoning model. Good balance of reasoning capability and cost for most analytical tasks.',
  },

  // ========================================================================
  // Anthropic Models (Claude)
  // ========================================================================
  'claude-opus-4': {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    tier: 'flagship',
    capabilities: [
      'reasoning',
      'code',
      'creative-writing',
      'analysis',
      'planning',
      'long-context',
      'code-review',
      'design',
      'slope-detection',
      'design-system',
    ],
    contextWindow: 200_000,
    speedRank: 5,
    qualityRank: 1,
    costWeight: 5.0,
    maxTokens: 16384,
    supportsThinking: true,
    supportsVision: false,
    description:
      'Anthropic most capable model. Exceptional at complex reasoning, nuanced analysis, creative writing, and code review. Best quality but highest cost.',
  },
  'claude-sonnet-4': {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    tier: 'flagship',
    capabilities: ['reasoning', 'code', 'analysis', 'creative-writing', 'code-review', 'design', 'slope-detection'],
    contextWindow: 200_000,
    speedRank: 3,
    qualityRank: 1,
    costWeight: 3.0,
    maxTokens: 16384,
    supportsThinking: true,
    supportsVision: false,
    description:
      'Balanced performance and intelligence. Excellent for code, reasoning, and creative tasks at moderate cost. The go-to Claude model for most uses.',
  },
  'claude-haiku-3.5': {
    id: 'claude-haiku-3.5',
    name: 'Claude Haiku 3.5',
    provider: 'anthropic',
    tier: 'fast',
    capabilities: ['rapid-iteration', 'code', 'summarization', 'extraction', 'code-review', 'design'],
    contextWindow: 200_000,
    speedRank: 1,
    qualityRank: 3,
    costWeight: 0.8,
    maxTokens: 8192,
    supportsThinking: false,
    supportsVision: false,
    description: 'Fast and affordable Claude model. Best for high-throughput tasks, quick iterations, and lightweight operations.',
  },

  // ========================================================================
  // Google Models (Gemini)
  // ========================================================================
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    tier: 'flagship',
    capabilities: ['reasoning', 'code', 'math', 'analysis', 'planning', 'long-context', 'vision', 'code-review', 'design', 'slope-detection'],
    contextWindow: 1_048_576,
    speedRank: 4,
    qualityRank: 1,
    costWeight: 3.0,
    maxTokens: 65536,
    supportsThinking: true,
    supportsVision: true,
    description: 'Google flagship model with 1M context and thinking mode. Best for complex reasoning, code, multimodal tasks, and long-document analysis.',
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    tier: 'fast',
    capabilities: ['rapid-iteration', 'code', 'summarization', 'extraction', 'vision', 'code-review', 'design'],
    contextWindow: 1_048_576,
    speedRank: 1,
    qualityRank: 2,
    costWeight: 0.5,
    maxTokens: 65536,
    supportsThinking: true,
    supportsVision: true,
    description: 'Fast and efficient Gemini model with 1M context and thinking mode. Best for high-throughput tasks where speed matters.',
  },
  'gemini-2-flash': {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    tier: 'fast',
    capabilities: ['rapid-iteration', 'code', 'summarization', 'vision', 'design'],
    contextWindow: 1_048_576,
    speedRank: 1,
    qualityRank: 3,
    costWeight: 0.3,
    maxTokens: 8192,
    supportsThinking: false,
    supportsVision: true,
    description: 'Ultra-fast Gemini model. Best for simple tasks, quick lookups, and vision tasks at minimal cost.',
  },
};

/**
 * Get all model IDs in the registry.
 */
export function getModelIds(): string[] {
  return Object.keys(MODEL_REGISTRY);
}

/**
 * Get models that have a specific capability.
 */
export function getModelsWithCapability(capability: ModelCapability): ModelProfile[] {
  return Object.values(MODEL_REGISTRY).filter(m => m.capabilities.includes(capability));
}

/**
 * Get models sorted by a specific metric.
 */
export function getModelsSortedBy(metric: 'speedRank' | 'qualityRank' | 'costWeight', ascending = true): ModelProfile[] {
  return Object.values(MODEL_REGISTRY).sort((a, b) => {
    const diff = a[metric] - b[metric];
    return ascending ? diff : -diff;
  });
}

/**
 * Get models from a specific provider.
 */
export function getModelsByProvider(provider: ProviderId): ModelProfile[] {
  return Object.values(MODEL_REGISTRY).filter(m => m.provider === provider);
}

/**
 * Resolve a model ID, falling back to glm-5.2 if not found.
 */
export function resolveModel(modelId: string): ModelProfile {
  return MODEL_REGISTRY[modelId] ?? MODEL_REGISTRY['glm-5.2'];
}

/**
 * Get the provider for a given model ID.
 */
export function getModelProvider(modelId: string): ProviderId {
  return MODEL_REGISTRY[modelId]?.provider ?? 'zai';
}
