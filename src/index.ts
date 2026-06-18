/**
 * Nexus-Dev MMFE — Main Entry Point (v4.0.0)
 * Exports the full public API of the Multi-Model Fusion Engine.
 * Now with multi-provider support (ZAI, OpenAI, Anthropic, Google).
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

// v3.0 modules — MTP (Multi-Threaded Pipeline)
export { MTPEngine } from './core/mtp-engine.js';

// v3.1 modules — Code Review (adapted from Alibaba Open Code Review)
export { CodeReviewEngine, createCodeReviewEngine } from './code-review/review-engine.js';
export { getReviewRule, getReviewRuleForFile, detectLanguage, getSupportedLanguages } from './code-review/rules.js';
export { parseDiff, getChangedFiles, findCodeInDiff } from './code-review/diff-parser.js';
export { fillTemplate } from './code-review/prompts.js';

// v4.0 modules — Multi-Provider Support
export { ProviderRouter, createProviderRouter } from './providers/provider-router.js';
export { ZAIProvider } from './providers/zai-provider.js';
export { ZAIAnthropicProvider } from './providers/zai-anthropic-provider.js';
export { OpenAIProvider } from './providers/openai-provider.js';
export { AnthropicProvider } from './providers/anthropic-provider.js';
export { GoogleProvider } from './providers/google-provider.js';

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

export type {
  MTPThread,
  MTPThreadType,
  MTPThreadState,
  MTPThreadResult,
  MTPDecomposedSubtask,
  MTPPipelineSnapshot,
  MTPPipelinePhase,
  MTPMetrics,
  MTPConfig,
} from './core/mtp-types.js';

export { DEFAULT_MTP_CONFIG } from './core/mtp-types.js';

// Code Review types
export type {
  ReviewComment,
  DiffHunk,
  DiffLine,
  CodeReviewRequest,
  CodeReviewResult,
  ReviewPlan,
  ReviewPlanIssue,
  ToolGuidanceItem,
  ReviewLanguage,
  CodeReviewConfig,
} from './code-review/types.js';

export { DEFAULT_CODE_REVIEW_CONFIG } from './code-review/types.js';

// v3.2 modules — Design Skill (adapted from UI/UX Pro Max Skill with AI SLOPE elimination)
export { DesignSkillEngine, createDesignSkillEngine } from './design-skill/design-engine.js';
export {
  searchDomain,
  searchStack,
  multiDomainSearch,
  detectDomain as detectDesignDomain,
  getAvailableDomains as getAvailableDesignDomains,
  getAvailableStacks as getAvailableDesignStacks,
} from './design-skill/search-engine.js';

// Design Skill types
export type {
  DesignSkillRequest,
  DesignSkillResult,
  DesignSystemRecommendation,
  DesignSystemColors,
  DesignSystemTypography,
  DesignRoutingDecision,
  DesignSubDomain,
  AISlopeReport,
  AISlopeIssue,
  AISlopeCategory,
  DesignSkillConfig,
} from './design-skill/types.js';

export { AI_SLOPE_PATTERNS, DEFAULT_DESIGN_SKILL_CONFIG } from './design-skill/types.js';

// Multi-Provider types
export type {
  LLMProvider,
  ProviderId,
  ProviderConfig,
  ProviderMessage,
  ProviderCompletionOptions,
  ProviderCompletionResult,
  ProviderTokenUsage,
  MultiProviderConfig,
} from './providers/types.js';

export { DEFAULT_MULTI_PROVIDER_CONFIG } from './providers/types.js';

export {
  MODEL_REGISTRY,
  getModelIds,
  getModelsWithCapability,
  getModelsSortedBy,
  getModelsByProvider,
  resolveModel,
  getModelProvider,
} from './core/models.js';

// Config
export type { NexusDevConfig } from './core/config.js';
export { DEFAULT_CONFIG, mergeConfig } from './core/config.js';
