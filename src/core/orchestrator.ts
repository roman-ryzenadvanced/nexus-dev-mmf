/**
 * Nexus-Dev MMFE — The Orchestrator
 * Central coordination engine that manages the full pipeline:
 *   Receive → Decompose → Route → Execute (Parallel) → Synthesize
 */

import { uuidv4 } from './utils/uuid.js';
import { Decomposer } from '../decomposer/decomposer.js';
import { AdaptiveRouter } from '../router/adaptive-router.js';
import { ParallelExecutor } from './executor.js';
import { Synthesizer } from '../synthesis/synthesizer.js';
import {
  OrchestrationRequest,
  OrchestrationResult,
  PipelineState,
  PipelineStage,
} from './types.js';
import { NexusDevConfig, DEFAULT_CONFIG, mergeConfig } from './config.js';

export class Orchestrator {
  private config: NexusDevConfig;
  private decomposer: Decomposer;
  private router: AdaptiveRouter;
  private executor: ParallelExecutor;
  private synthesizer: Synthesizer;
  private pipelines: Map<string, PipelineState>;

  constructor(config?: Partial<NexusDevConfig>) {
    this.config = mergeConfig(config);
    this.decomposer = new Decomposer(this.config);
    this.router = new AdaptiveRouter(this.config);
    this.executor = new ParallelExecutor(this.config);
    this.synthesizer = new Synthesizer(this.config);
    this.pipelines = new Map();
  }

  /**
   * Process a request through the full orchestration pipeline.
   */
  async process(query: string, options?: Partial<OrchestrationRequest>): Promise<OrchestrationResult> {
    const requestId = uuidv4();
    const startTime = Date.now();

    // Build the orchestration request
    const request: OrchestrationRequest = {
      id: requestId,
      query,
      context: options?.context,
      preferredMode: options?.preferredMode ?? this.config.defaultMode,
      maxParallelSubTasks: options?.maxParallelSubTasks ?? this.config.maxParallelSubTasks,
      enableThinking: options?.enableThinking ?? this.config.enableThinking,
      customSystemPrompt: options?.customSystemPrompt,
      metadata: options?.metadata ?? {},
    };

    // Initialize pipeline tracking
    this.updatePipeline(requestId, 'received', 0, 0);

    try {
      // Phase 1: Decomposition
      this.updatePipeline(requestId, 'decomposing', 0, 0);
      const subtasks = await this.decomposer.decompose(request);

      this.updatePipeline(requestId, 'routing', subtasks.length, 0);

      // Phase 2: Adaptive Routing
      const routingDecisions = this.router.route(subtasks, request);

      this.updatePipeline(requestId, 'executing', subtasks.length, 0);

      // Phase 3: Parallel Execution
      const subTaskResults = await this.executor.execute(
        subtasks,
        routingDecisions,
        request.customSystemPrompt
      );

      const completedCount = Array.from(subTaskResults.values()).filter(r => r.success).length;
      this.updatePipeline(requestId, 'synthesizing', subtasks.length, completedCount);

      // Phase 4: Synthesis
      const result = await this.synthesizer.synthesize(
        request,
        subTaskResults,
        routingDecisions,
        Date.now() - startTime
      );

      this.updatePipeline(requestId, 'completed', subtasks.length, completedCount);
      return result;

    } catch (error: any) {
      this.updatePipeline(requestId, 'failed', 0, 0, error?.message);
      throw error;
    }
  }

  /**
   * Get the current state of a pipeline.
   */
  getPipelineState(requestId: string): PipelineState | undefined {
    return this.pipelines.get(requestId);
  }

  /**
   * Get the current configuration.
   */
  getConfig(): NexusDevConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime.
   */
  updateConfig(updates: Partial<NexusDevConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Update pipeline state.
   */
  private updatePipeline(
    requestId: string,
    stage: PipelineStage,
    subTaskCount: number,
    completedSubTasks: number,
    error?: string
  ): void {
    const existing = this.pipelines.get(requestId);
    this.pipelines.set(requestId, {
      requestId,
      stage,
      subTaskCount,
      completedSubTasks,
      startedAt: existing?.startedAt ?? Date.now(),
      updatedAt: Date.now(),
      errors: error ? [...(existing?.errors ?? []), error] : (existing?.errors ?? []),
    });
  }
}

/**
 * Create a new Orchestrator with optional config.
 */
export function createOrchestrator(config?: Partial<NexusDevConfig>): Orchestrator {
  return new Orchestrator(config);
}
