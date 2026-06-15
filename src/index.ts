/**
 * Nexus-Dev MMFE — Main Entry Point
 * Exports the full public API of the Multi-Model Fusion Engine.
 */

// Core
export { Orchestrator, createOrchestrator } from './core/orchestrator.js';
export { Decomposer } from './decomposer/decomposer.js';
export { AdaptiveRouter } from './router/adaptive-router.js';
export { ParallelExecutor } from './core/executor.js';
export { Synthesizer } from './synthesis/synthesizer.js';

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
