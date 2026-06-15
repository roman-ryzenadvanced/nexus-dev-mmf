/**
 * Nexus-Dev MMFE — The Orchestrator (v3.0)
 * Central coordination engine with:
 *   - Pipeline events (streaming)
 *   - Performance tracking
 *   - Budget-aware routing
 *   - Multi-turn conversations
 *   - Custom model registration
 *   - Embedding-based task similarity
 *   - MTP (Multi-Threaded Pipeline) hyperthreading
 */

import { uuidv4 } from './utils/uuid.js';
import { Decomposer } from '../decomposer/decomposer.js';
import { AdaptiveRouter } from '../router/adaptive-router.js';
import { ParallelExecutor } from './executor.js';
import { Synthesizer } from '../synthesis/synthesizer.js';
import { NexusEventEmitter } from './events.js';
import { PerformanceTracker } from './performance-tracker.js';
import { ConversationManager } from './conversation.js';
import { EmbeddingSimilarity } from './embedding-similarity.js';
import { optimizeForBudget, calculateTotalCost } from './budget-routing.js';
import { MODEL_REGISTRY } from './models.js';
import {
  OrchestrationRequest,
  OrchestrationResult,
  PipelineState,
  PipelineStage,
} from './types.js';
import { NexusDevConfig, DEFAULT_CONFIG, mergeConfig } from './config.js';
import { MTPEngine } from './mtp-engine.js';

export class Orchestrator {
  private config: NexusDevConfig;
  private decomposer: Decomposer;
  private router: AdaptiveRouter;
  private executor: ParallelExecutor;
  private synthesizer: Synthesizer;
  private pipelines: Map<string, PipelineState>;
  private events: NexusEventEmitter;
  private perfTracker: PerformanceTracker;
  private conversations: ConversationManager;
  private embeddings: EmbeddingSimilarity;
  private mtpEngine: MTPEngine | null = null;

  constructor(config?: Partial<NexusDevConfig>) {
    this.config = mergeConfig(config);
    this.decomposer = new Decomposer(this.config);
    this.router = new AdaptiveRouter(this.config);
    this.executor = new ParallelExecutor(this.config);
    this.synthesizer = new Synthesizer(this.config);
    this.pipelines = new Map();
    this.events = new NexusEventEmitter();
    this.perfTracker = new PerformanceTracker();
    this.conversations = new ConversationManager();
    this.embeddings = new EmbeddingSimilarity();

    // Initialize MTP engine if enabled
    if (this.config.enableMTP) {
      this.mtpEngine = new MTPEngine(this.config, {
        enableSpeculativeDecomposition: this.config.mtp.speculativeDecomposition,
        enableSpeculativeExecution: this.config.mtp.speculativeExecution,
        enableIncrementalSynthesis: this.config.mtp.incrementalSynthesis,
        enableConcurrentQuality: this.config.mtp.concurrentQuality,
        maxConcurrentThreads: this.config.mtp.maxConcurrentThreads,
        overlapDelayMs: this.config.mtp.overlapDelayMs,
        maxSpeculativeThreads: this.config.mtp.maxSpeculativeThreads,
      });
    }
  }

  /**
   * Process a request through the full orchestration pipeline.
   */
  async process(query: string, options?: Partial<OrchestrationRequest>): Promise<OrchestrationResult> {
    // ── MTP Fast Path ──
    // If MTP is enabled, use the hyperthreaded pipeline for dramatically faster processing
    if (this.config.enableMTP && this.mtpEngine) {
      // Wire up MTP events to the orchestrator event system
      this.mtpEngine.setEventCallback((type, data) => {
        if (this.config.enableEvents) {
          this.events.emitNexusEvent(type, data.pipelineId as string, data);
        }
      });

      const result = await this.mtpEngine.process(query, options);

      // Track performance from MTP result
      for (const subResult of result.subTaskResults) {
        if (subResult.success) {
          this.perfTracker.recordSuccess(subResult.modelId, subResult.executionTimeMs, result.qualityScore, subResult.tokenUsage?.total);
        } else {
          this.perfTracker.recordFailure(subResult.modelId, subResult.executionTimeMs);
        }
      }

      // Add to conversation if applicable
      if (options?.conversationId) {
        this.conversations.addTurn(options.conversationId, result, query);
      }

      return result;
    }

    // ── Standard 4-Phase Pipeline ──
    const requestId = uuidv4();
    const startTime = Date.now();

    const request: OrchestrationRequest = {
      id: requestId,
      query,
      context: options?.context,
      preferredMode: options?.preferredMode ?? this.config.defaultMode,
      maxParallelSubTasks: options?.maxParallelSubTasks ?? this.config.maxParallelSubTasks,
      enableThinking: options?.enableThinking ?? this.config.enableThinking,
      customSystemPrompt: options?.customSystemPrompt,
      conversationId: options?.conversationId,
      maxCostWeight: options?.maxCostWeight ?? this.config.maxTotalCostWeight,
      metadata: options?.metadata ?? {},
    };

    // If part of a conversation, inject conversation context
    if (request.conversationId && this.conversations.hasConversation(request.conversationId)) {
      const convContext = this.conversations.buildContext(request.conversationId);
      request.context = request.context
        ? `${convContext}\n\nADDITIONAL CONTEXT:\n${request.context}`
        : convContext;
    }

    this.updatePipeline(requestId, 'received', 0, 0);
    this.emitEvent('pipeline:started', requestId, { query });

    try {
      // Phase 1: Decomposition
      this.updatePipeline(requestId, 'decomposing', 0, 0);
      this.emitEvent('pipeline:stage', requestId, { stage: 'decomposing' });
      const subtasks = await this.decomposer.decompose(request);

      this.updatePipeline(requestId, 'routing', subtasks.length, 0);
      this.emitEvent('pipeline:stage', requestId, { stage: 'routing', subtaskCount: subtasks.length });

      // Phase 2: Adaptive Routing
      let routingDecisions = this.router.route(subtasks, request);

      // Emit routing events
      for (const decision of routingDecisions) {
        this.emitEvent('subtask:routed', requestId, {
          subTaskId: decision.subTaskId,
          model: decision.selectedModel,
          confidence: decision.confidence,
        });
      }

      // Budget optimization
      const budgetLimit = request.maxCostWeight ?? this.config.maxTotalCostWeight;
      if (budgetLimit < Infinity) {
        const currentCost = calculateTotalCost(routingDecisions);
        if (currentCost > budgetLimit) {
          routingDecisions = optimizeForBudget(routingDecisions, subtasks, {
            maxTotalCost: budgetLimit,
            maxCostPerTask: Infinity,
            preferCheaper: true,
            costOptimizationThreshold: 50,
          });
          this.emitEvent('pipeline:stage', requestId, { stage: 'budget-optimized', originalCost: currentCost, optimizedCost: calculateTotalCost(routingDecisions) });
        }
      }

      this.updatePipeline(requestId, 'executing', subtasks.length, 0);
      this.emitEvent('pipeline:stage', requestId, { stage: 'executing' });

      // Phase 3: Parallel Execution
      const subTaskResults = await this.executor.execute(
        subtasks,
        routingDecisions,
        request.customSystemPrompt
      );

      // Track performance, embeddings, and emit events
      const subtaskMap = new Map(subtasks.map(s => [s.id, s]));
      for (const result of subTaskResults.values()) {
        if (result.success) {
          this.perfTracker.recordSuccess(
            result.modelId,
            result.executionTimeMs,
            undefined,
            result.tokenUsage?.total,
          );
          // Record embedding for similarity matching
          const subtask = subtaskMap.get(result.subTaskId);
          if (subtask) {
            this.embeddings.addRecord(
              subtask.description,
              result.modelId,
              50, // Default quality; will be updated after synthesis
              subtask.requiredCapabilities.map(c => c as string),
              result.executionTimeMs,
            );
          }
          this.emitEvent('subtask:completed', requestId, {
            subTaskId: result.subTaskId,
            model: result.modelId,
            time: result.executionTimeMs,
          });
        } else {
          this.perfTracker.recordFailure(result.modelId, result.executionTimeMs);
          this.emitEvent('subtask:failed', requestId, {
            subTaskId: result.subTaskId,
            model: result.modelId,
            error: result.error,
          });
        }
      }

      const completedCount = Array.from(subTaskResults.values()).filter(r => r.success).length;
      this.updatePipeline(requestId, 'synthesizing', subtasks.length, completedCount);
      this.emitEvent('pipeline:stage', requestId, { stage: 'synthesizing' });

      // Phase 4: Synthesis
      const result = await this.synthesizer.synthesize(
        request,
        subTaskResults,
        routingDecisions,
        Date.now() - startTime
      );

      // Add cost calculation
      const totalCostWeight = calculateTotalCost(routingDecisions);

      const finalResult: OrchestrationResult = {
        ...result,
        totalCostWeight,
        conversationId: request.conversationId,
        qualityScore: result.qualityScore,
      };

      // Record quality score in performance tracker
      for (const modelId of finalResult.modelsUsed) {
        this.perfTracker.recordSuccess(modelId, 0, finalResult.qualityScore);
      }

      // Add to conversation if applicable
      if (request.conversationId) {
        this.conversations.addTurn(request.conversationId, finalResult, query);
      }

      this.updatePipeline(requestId, 'completed', subtasks.length, completedCount);
      this.emitEvent('pipeline:completed', requestId, {
        qualityScore: finalResult.qualityScore,
        totalCostWeight,
        modelsUsed: finalResult.modelsUsed,
        totalExecutionTimeMs: finalResult.totalExecutionTimeMs,
      });

      return finalResult;

    } catch (error: any) {
      this.updatePipeline(requestId, 'failed', 0, 0, error?.message);
      this.emitEvent('pipeline:failed', requestId, { error: error?.message });
      throw error;
    }
  }

  /**
   * Start a new multi-turn conversation. Returns the conversation ID.
   */
  startConversation(): string {
    return this.conversations.createConversation();
  }

  /**
   * Process a follow-up message within an existing conversation.
   */
  async continueConversation(conversationId: string, query: string, options?: Partial<OrchestrationRequest>): Promise<OrchestrationResult> {
    return this.process(query, {
      ...options,
      conversationId,
    });
  }

  /**
   * Get the conversation manager.
   */
  getConversations(): ConversationManager {
    return this.conversations;
  }

  /**
   * Get the performance tracker.
   */
  getPerformanceTracker(): PerformanceTracker {
    return this.perfTracker;
  }

  /**
   * Get the embedding similarity engine.
   */
  getEmbeddings(): EmbeddingSimilarity {
    return this.embeddings;
  }

  /**
   * Get the MTP engine (if enabled).
   */
  getMTPEngine(): MTPEngine | null {
    return this.mtpEngine;
  }

  /**
   * Enable MTP mode at runtime.
   */
  enableMTP(): void {
    this.config.enableMTP = true;
    if (!this.mtpEngine) {
      this.mtpEngine = new MTPEngine(this.config, {
        enableSpeculativeDecomposition: this.config.mtp.speculativeDecomposition,
        enableSpeculativeExecution: this.config.mtp.speculativeExecution,
        enableIncrementalSynthesis: this.config.mtp.incrementalSynthesis,
        enableConcurrentQuality: this.config.mtp.concurrentQuality,
        maxConcurrentThreads: this.config.mtp.maxConcurrentThreads,
        overlapDelayMs: this.config.mtp.overlapDelayMs,
        maxSpeculativeThreads: this.config.mtp.maxSpeculativeThreads,
      });
    }
  }

  /**
   * Disable MTP mode at runtime.
   */
  disableMTP(): void {
    this.config.enableMTP = false;
  }

  /**
   * Check if MTP mode is enabled.
   */
  isMTPEnabled(): boolean {
    return this.config.enableMTP;
  }

  /**
   * Get the event emitter.
   */
  getEvents(): NexusEventEmitter {
    return this.events;
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
   * Emit a pipeline event (if events are enabled).
   */
  private emitEvent(type: any, requestId: string, data: Record<string, unknown> = {}): void {
    if (this.config.enableEvents) {
      this.events.emitNexusEvent(type, requestId, data);
    }
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
