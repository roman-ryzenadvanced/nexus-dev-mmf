/**
 * Nexus-Dev MMFE — Configuration
 */

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
};

/**
 * Merge a partial config with defaults.
 */
export function mergeConfig(partial?: Partial<NexusDevConfig>): NexusDevConfig {
  if (!partial) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...partial };
}
