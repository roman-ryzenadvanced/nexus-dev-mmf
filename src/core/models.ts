/**
 * Nexus-Dev MMFE — Model Registry
 * Defines all available GLM models, their capabilities, and routing weights.
 */

export interface ModelProfile {
  id: string;
  name: string;
  tier: 'flagship' | 'standard' | 'fast' | 'creative' | 'vision';
  capabilities: ModelCapability[];
  contextWindow: number;
  speedRank: number;       // 1 = fastest, 5 = slowest
  qualityRank: number;     // 1 = highest quality, 5 = lowest
  costWeight: number;      // relative cost multiplier
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
 */
export const MODEL_REGISTRY: Record<string, ModelProfile> = {
  'glm-5.2-1m': {
    id: 'glm-5.2-1m',
    name: 'GLM 5.2 (1M Context)',
    tier: 'flagship',
    capabilities: ['reasoning', 'math', 'code', 'analysis', 'long-context', 'planning', 'code-review', 'design', 'slope-detection', 'design-system'],
    contextWindow: 1_000_000,
    speedRank: 5,
    qualityRank: 1,
    costWeight: 3.0,
    maxTokens: 8192,
    supportsThinking: true,
    supportsVision: false,
    description: 'Advanced reasoning model with 1M token context window. Best for complex problem decomposition, long-document analysis, deep multi-step reasoning, and AI SLOPE detection/elimination.',
  },
  'glm-5.2': {
    id: 'glm-5.2',
    name: 'GLM 5.2',
    tier: 'flagship',
    capabilities: ['reasoning', 'math', 'code', 'analysis', 'planning', 'debugging', 'code-review', 'design', 'slope-detection', 'design-system'],
    contextWindow: 128_000,
    speedRank: 3,
    qualityRank: 1,
    costWeight: 2.0,
    maxTokens: 8192,
    supportsThinking: true,
    supportsVision: false,
    description: 'Baseline high-performance model. Excellent for robust task execution, complex reasoning, design generation, and balanced quality-speed tradeoffs.',
  },
  'glm-5.1': {
    id: 'glm-5.1',
    name: 'GLM 5.1',
    tier: 'standard',
    capabilities: ['conversation', 'translation', 'summarization', 'extraction', 'creative-writing', 'code-review', 'design'],
    contextWindow: 128_000,
    speedRank: 3,
    qualityRank: 2,
    costWeight: 1.5,
    maxTokens: 4096,
    supportsThinking: true,
    supportsVision: false,
    description: 'Nuanced language understanding and context sensitivity. Ideal for content refinement, summarization, design copy, and contextual awareness tasks.',
  },
  'glm-5': {
    id: 'glm-5',
    name: 'GLM 5',
    tier: 'fast',
    capabilities: ['code', 'debugging', 'rapid-iteration', 'summarization', 'extraction', 'code-review', 'design'],
    contextWindow: 32_000,
    speedRank: 1,
    qualityRank: 3,
    costWeight: 0.5,
    maxTokens: 4096,
    supportsThinking: false,
    supportsVision: false,
    description: 'Speed and efficiency specialist. Best for rapid drafts, quick iterations, boilerplate generation, and high-throughput tasks where latency matters.',
  },
  'glm-5v-turbo': {
    id: 'glm-5v-turbo',
    name: 'GLM 5V Turbo',
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
    tier: 'creative',
    capabilities: ['creative-writing', 'code', 'documentation', 'refactoring', 'analysis', 'code-review', 'design', 'design-system'],
    contextWindow: 128_000,
    speedRank: 4,
    qualityRank: 2,
    costWeight: 2.0,
    maxTokens: 8192,
    supportsThinking: true,
    supportsVision: false,
    description: 'State-of-the-art creative generation, deep knowledge retrieval, and sophisticated code synthesis. Excels at producing elegant, well-structured outputs.',
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
 * Resolve a model ID, falling back to glm-5.2 if not found.
 */
export function resolveModel(modelId: string): ModelProfile {
  return MODEL_REGISTRY[modelId] ?? MODEL_REGISTRY['glm-5.2'];
}
