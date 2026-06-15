/**
 * Nexus-Dev MMFE — Configuration
 * Updated for v4.0.0 with multi-provider support.
 */

import { MultiProviderConfig, DEFAULT_MULTI_PROVIDER_CONFIG } from '../providers/types.js';

export interface NexusDevConfig {
  /** Default execution mode */
  defaultMode: 'speed' | 'quality' | 'balanced' | 'creative';

  /** Maximum parallel subtask executions */
  maxParallelSubTasks: number;

  /** Whether to enable thinking mode by default */
  enableThinking: boolean;

  /** Default timeout per subtask in ms */
  subTaskTimeout: number;

  /** Whether to include routing metadata in responses */
  verboseRouting: boolean;

  /** Maximum decomposition depth */
  maxDecompositionDepth: number;

  /** Minimum quality score threshold (0-100) for re-synthesis */
  qualityThreshold: number;

  /** Retry failed subtasks with alternative models */
  enableRetry: boolean;

  /** Maximum retry attempts per subtask */
  maxRetries: number;

  /** Maximum total cost weight per request (budget constraint) */
  maxTotalCostWeight: number;

  /** Enable performance tracking across requests */
  enablePerformanceTracking: boolean;

  /** Enable pipeline event streaming */
  enableEvents: boolean;

  /** Enable MTP (Multi-Threaded Pipeline) hyperthreading mode */
  enableMTP: boolean;

  /** MTP-specific configuration */
  mtp: {
    /** Enable speculative decomposition (fast model runs ahead) */
    speculativeDecomposition: boolean;
    /** Enable speculative execution (fast models draft answers early) */
    speculativeExecution: boolean;
    /** Enable incremental synthesis (start synthesizing before all results) */
    incrementalSynthesis: boolean;
    /** Enable concurrent quality scoring */
    concurrentQuality: boolean;
    /** Maximum concurrent MTP threads */
    maxConcurrentThreads: number;
    /** Overlap delay in ms before starting next phase */
    overlapDelayMs: number;
    /** Maximum speculative threads per pipeline */
    maxSpeculativeThreads: number;
  };

  /** Multi-provider configuration */
  providers: MultiProviderConfig;
}

export const DEFAULT_CONFIG: NexusDevConfig = {
  defaultMode: 'balanced',
  maxParallelSubTasks: 6,
  enableThinking: true,
  subTaskTimeout: 120_000,
  verboseRouting: true,
  maxDecompositionDepth: 3,
  qualityThreshold: 70,
  enableRetry: true,
  maxRetries: 2,
  maxTotalCostWeight: Infinity,
  enablePerformanceTracking: true,
  enableEvents: true,
  enableMTP: false,
  mtp: {
    speculativeDecomposition: true,
    speculativeExecution: true,
    incrementalSynthesis: true,
    concurrentQuality: true,
    maxConcurrentThreads: 8,
    overlapDelayMs: 200,
    maxSpeculativeThreads: 4,
  },
  providers: {
    ...DEFAULT_MULTI_PROVIDER_CONFIG,
    providers: {
      zai: { provider: 'zai' },
    },
  },
};

/**
 * Merge a partial config with defaults.
 */
export function mergeConfig(partial?: Partial<NexusDevConfig>): NexusDevConfig {
  if (!partial) return { ...DEFAULT_CONFIG };
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    mtp: { ...DEFAULT_CONFIG.mtp, ...partial.mtp },
    providers: {
      ...DEFAULT_CONFIG.providers,
      ...partial.providers,
      providers: {
        ...DEFAULT_CONFIG.providers.providers,
        ...partial.providers?.providers,
      },
    },
  };
}
