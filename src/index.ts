/**
 * Nexus-Dev MMFE — Main Entry Point (v2.1.0)
 * Exports the full public API of the Multi-Model Fusion Engine.
 */

// Core
export { Orchestrator, createOrchestrator } from './core/orchestrator.js';
export { Decomposer } from './decomposer/decomposer.js';
export { AdaptiveRouter } from './router/adaptive-router.js';
export { ParallelExecutor } from './core/executor.js';
export { Synthesizer } from './synthesis/synthesizer.js';

// v2.0 modules
export { NexusEventEmitter } from './core/events.js';
export { PerformanceTracker } from './core/performance-tracker.js';
export { ConversationManager } from './core/conversation.js';
export { registerModel, registerModels, unregisterModel, getRegistrySnapshot } from './core/model-registry.js';
export { optimizeForBudget, calculateTotalCost, findCheapestModel, isWithinBudget } from './core/budget-routing.js';

// v2.1 modules
export { EmbeddingSimilarity } from './core/embedding-similarity.js';

// Types
export type {
  OrchestrationRequest,
  OrchestrationResult,
  SubTask,
  SubTaskResult,
  RoutingDecision,
  PipelineState,
  PipelineStage,
} from './core/types.js';

export type {
  ModelProfile,
  ModelCapability,
} from './core/models.js';

export type {
  NexusEvent,
  NexusEventType,
} from './core/events.js';

export type {
  ModelPerformanceRecord,
} from './core/performance-tracker.js';

export type {
  ConversationTurn,
  ConversationContext,
} from './core/conversation.js';

export type {
  BudgetConstraint,
} from './core/budget-routing.js';

export type {
  EmbeddingRecord,
  SimilarityResult,
} from './core/embedding-similarity.js';

export {
  MODEL_REGISTRY,
  getModelIds,
  getModelsWithCapability,
  getModelsSortedBy,
  resolveModel,
} from './core/models.js';

// Config
export type { NexusDevConfig } from './core/config.js';
export { DEFAULT_CONFIG, mergeConfig } from './core/config.js';
