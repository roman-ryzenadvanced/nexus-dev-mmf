/**
 * Nexus-Dev MMFE — MTP (Multi-Threaded Pipeline) Types
 *
 * MTP is a speculative execution engine that overlaps pipeline stages
 * like CPU hyperthreading — while one model is generating, the next
 * stage is already being prepared and started.
 *
 * Key innovations:
 * 1. Speculative Decomposition — fast model pre-decomposes while flagship decomposes
 * 2. Pipeline Overlapping — execute wave N while routing wave N+1
 * 3. Speculative Execution — fast models draft answers before routing completes
 * 4. Incremental Synthesis — build the answer progressively as results arrive
 * 5. Concurrent Quality Scoring — score quality in parallel with ongoing synthesis
 */

/**
 * MTP Pipeline Thread — represents an independent execution lane
 * that can run concurrently with other lanes.
 */
export interface MTPThread {
  /** Unique thread ID */
  id: string;
  /** Thread type — what pipeline stage this thread handles */
  type: MTPThreadType;
  /** Current state of the thread */
  state: MTPThreadState;
  /** Model assigned to this thread */
  modelId: string;
  /** The subtask this thread is processing (if any) */
  subtaskId?: string;
  /** When this thread was created */
  createdAt: number;
  /** When this thread started executing */
  startedAt?: number;
  /** When this thread completed */
  completedAt?: number;
  /** Thread result (if completed) */
  result?: MTPThreadResult;
  /** Error (if failed) */
  error?: string;
  /** Speculative thread? (draft that may be discarded) */
  speculative: boolean;
}

/**
 * Types of MTP threads.
 */
export type MTPThreadType =
  | 'decompose-flagship'   // Full decomposition via glm-5.2
  | 'decompose-fast'       // Speculative fast decomposition via glm-5
  | 'route'                // Adaptive routing computation
  | 'execute-primary'      // Primary subtask execution
  | 'execute-speculative'  // Speculative pre-execution by fast model
  | 'synthesize-partial'   // Incremental partial synthesis
  | 'synthesize-final'     // Final full synthesis
  | 'quality-score'        // Quality scoring pass
  | 'quality-refine';      // Quality refinement pass

/**
 * State of an MTP thread.
 */
export type MTPThreadState =
  | 'pending'     // Waiting to be scheduled
  | 'running'     // Currently executing
  | 'completed'   // Successfully finished
  | 'failed'      // Execution failed
  | 'cancelled'   // Cancelled (e.g., speculative draft discarded)
  | 'superseded'; // A better result replaced this one

/**
 * Result from an MTP thread.
 */
export interface MTPThreadResult {
  /** The output content */
  output: string;
  /** Execution time in ms */
  executionTimeMs: number;
  /** Token usage if available */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Quality score (for synthesis/quality threads) */
  qualityScore?: number;
  /** Subtask decomposition (for decompose threads) */
  decomposedSubtasks?: MTPDecomposedSubtask[];
  /** Routing decisions (for route threads) */
  routingDecisions?: import('./types.js').RoutingDecision[];
}

/**
 * A subtask produced by speculative or primary decomposition.
 */
export interface MTPDecomposedSubtask {
  /** Description of the subtask */
  description: string;
  /** Input prompt for the subtask */
  input: string;
  /** Required capabilities */
  requiredCapabilities: string[];
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Dependencies (indices of other subtasks) */
  dependencies: number[];
  /** Estimated complexity */
  estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';
  /** Source of this decomposition */
  source: 'flagship' | 'speculative-fast';
  /** Confidence in this decomposition (0-1) */
  confidence: number;
}

/**
 * MTP Pipeline Snapshot — captures the state of all threads at a point in time.
 */
export interface MTPPipelineSnapshot {
  /** Pipeline ID */
  pipelineId: string;
  /** All active and completed threads */
  threads: MTPThread[];
  /** Pipeline phase */
  phase: MTPPipelinePhase;
  /** Started at */
  startedAt: number;
  /** Current time */
  updatedAt: number;
  /** Overlap metrics */
  metrics: MTPMetrics;
}

/**
 * MTP Pipeline phases — note these overlap, unlike the sequential pipeline.
 */
export type MTPPipelinePhase =
  | 'initializing'       // Setting up threads
  | 'dual-decomposing'   // Both flagship and fast decomposers running
  | 'routing-executing'  // Routing and executing overlap
  | 'incremental-synth'  // Results arriving + incremental synthesis
  | 'final-synthesis'    // All results in, final synthesis
  | 'quality-pass'       // Quality scoring in progress
  | 'completed'          // Pipeline complete
  | 'failed';            // Pipeline failed

/**
 * MTP Performance Metrics — measures the hyperthreading efficiency.
 */
export interface MTPMetrics {
  /** Wall-clock time saved by overlapping (ms) */
  overlapTimeSavedMs: number;
  /** Number of threads that ran concurrently at peak */
  peakConcurrency: number;
  /** Number of speculative threads that were used (not discarded) */
  speculativeHits: number;
  /** Number of speculative threads that were discarded */
  speculativeMisses: number;
  /** Speculative hit rate (0-1) */
  speculativeHitRate: number;
  /** Time spent in each phase */
  phaseTimings: Record<MTPPipelinePhase, number>;
  /** Speedup factor vs sequential pipeline */
  speedupFactor: number;
  /** Thread utilization (0-1) — fraction of time threads were active */
  threadUtilization: number;
}

/**
 * MTP Configuration — controls the hyperthreading behavior.
 */
export interface MTPConfig {
  /** Enable speculative decomposition (fast model runs ahead) */
  enableSpeculativeDecomposition: boolean;
  /** Enable speculative execution (fast models draft answers early) */
  enableSpeculativeExecution: boolean;
  /** Enable incremental synthesis (start synthesizing before all results are in) */
  enableIncrementalSynthesis: boolean;
  /** Enable concurrent quality scoring */
  enableConcurrentQuality: boolean;
  /** Maximum concurrent MTP threads */
  maxConcurrentThreads: number;
  /** Model to use for speculative decomposition */
  speculativeDecomposeModel: string;
  /** Model to use for speculative execution */
  speculativeExecuteModel: string;
  /** Model to use for incremental synthesis */
  incrementalSynthModel: string;
  /** Minimum subtask confidence to trigger speculative execution */
  speculativeConfidenceThreshold: number;
  /** Maximum number of speculative threads per pipeline */
  maxSpeculativeThreads: number;
  /** Overlap delay — how long to wait before starting the next phase overlap (ms) */
  overlapDelayMs: number;
}

/**
 * Default MTP configuration.
 */
export const DEFAULT_MTP_CONFIG: MTPConfig = {
  enableSpeculativeDecomposition: true,
  enableSpeculativeExecution: true,
  enableIncrementalSynthesis: true,
  enableConcurrentQuality: true,
  maxConcurrentThreads: 8,
  speculativeDecomposeModel: 'glm-5',
  speculativeExecuteModel: 'glm-5v-turbo',
  incrementalSynthModel: 'glm-5.1',
  speculativeConfidenceThreshold: 0.6,
  maxSpeculativeThreads: 4,
  overlapDelayMs: 200,
};
