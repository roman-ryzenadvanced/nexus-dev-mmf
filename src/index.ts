/**
 * Nexus-Dev MMFE — Main Entry Point (v4.0.0)
 * Exports the full public API of the Multi-Model Fusion Engine.
 * Now with multi-provider support (ZAI, OpenAI, Anthropic, Google).
 */

// Core
export { ParallelExecutor } from './core/executor.js';
export { createOrchestrator, Orchestrator } from './core/orchestrator.js';
export { Decomposer } from './decomposer/decomposer.js';
export { AdaptiveRouter } from './router/adaptive-router.js';
export { Synthesizer } from './synthesis/synthesizer.js';

// v2.0 modules
export { calculateTotalCost, findCheapestModel, isWithinBudget, optimizeForBudget } from './core/budget-routing.js';
export { ConversationManager } from './core/conversation.js';
export { NexusEventEmitter } from './core/events.js';
export { getRegistrySnapshot, registerModel, registerModels, unregisterModel } from './core/model-registry.js';
export { PerformanceTracker } from './core/performance-tracker.js';

// v2.1 modules
export { EmbeddingSimilarity } from './core/embedding-similarity.js';

// v3.0 modules — MTP (Multi-Threaded Pipeline)
export { MTPEngine } from './core/mtp-engine.js';

// v3.1 modules — Code Review (adapted from Alibaba Open Code Review)
export { findCodeInDiff, getChangedFiles, parseDiff } from './code-review/diff-parser.js';
export { fillTemplate } from './code-review/prompts.js';
export { CodeReviewEngine, createCodeReviewEngine } from './code-review/review-engine.js';
export { detectLanguage, getReviewRule, getReviewRuleForFile, getSupportedLanguages } from './code-review/rules.js';

// v4.0 modules — Multi-Provider Support
export { AnthropicProvider } from './providers/anthropic-provider.js';
export { GoogleProvider } from './providers/google-provider.js';
export { OpenAIProvider } from './providers/openai-provider.js';
export { createProviderRouter, ProviderRouter } from './providers/provider-router.js';
export { ZAIAnthropicProvider } from './providers/zai-anthropic-provider.js';
export { ZAIProvider } from './providers/zai-provider.js';

// Types
export type { BudgetConstraint } from './core/budget-routing.js';
export type { ConversationContext, ConversationTurn } from './core/conversation.js';
export type { EmbeddingRecord, SimilarityResult } from './core/embedding-similarity.js';
export type { NexusEvent, NexusEventType } from './core/events.js';
export type { ModelCapability, ModelProfile } from './core/models.js';
export type {
  MTPConfig,
  MTPDecomposedSubtask,
  MTPMetrics,
  MTPPipelinePhase,
  MTPPipelineSnapshot,
  MTPThread,
  MTPThreadResult,
  MTPThreadState,
  MTPThreadType,
} from './core/mtp-types.js';
export { DEFAULT_MTP_CONFIG } from './core/mtp-types.js';
export type { ModelPerformanceRecord } from './core/performance-tracker.js';
export type { OrchestrationRequest, OrchestrationResult, PipelineStage, PipelineState, RoutingDecision, SubTask, SubTaskResult } from './core/types.js';

// Code Review types
export type {
  CodeReviewConfig,
  CodeReviewRequest,
  CodeReviewResult,
  DiffHunk,
  DiffLine,
  ReviewComment,
  ReviewLanguage,
  ReviewPlan,
  ReviewPlanIssue,
  ToolGuidanceItem,
} from './code-review/types.js';
export { DEFAULT_CODE_REVIEW_CONFIG } from './code-review/types.js';

// v3.2 modules — Design Skill (adapted from UI/UX Pro Max Skill with AI SLOPE elimination)
export { createDesignSkillEngine, DesignSkillEngine } from './design-skill/design-engine.js';
export {
  detectDomain as detectDesignDomain,
  getAvailableDomains as getAvailableDesignDomains,
  getAvailableStacks as getAvailableDesignStacks,
  multiDomainSearch,
  searchDomain,
  searchStack,
} from './design-skill/search-engine.js';

// Design Skill types
export type {
  AISlopeCategory,
  AISlopeIssue,
  AISlopeReport,
  DesignRoutingDecision,
  DesignSkillConfig,
  DesignSkillRequest,
  DesignSkillResult,
  DesignSubDomain,
  DesignSystemColors,
  DesignSystemRecommendation,
  DesignSystemTypography,
} from './design-skill/types.js';
export { AI_SLOPE_PATTERNS, DEFAULT_DESIGN_SKILL_CONFIG } from './design-skill/types.js';

// Multi-Provider types
export { getModelIds, getModelProvider, getModelsByProvider, getModelsSortedBy, getModelsWithCapability, MODEL_REGISTRY, resolveModel } from './core/models.js';
export type {
  LLMProvider,
  MultiProviderConfig,
  ProviderCompletionOptions,
  ProviderCompletionResult,
  ProviderConfig,
  ProviderId,
  ProviderMessage,
  ProviderTokenUsage,
} from './providers/types.js';
export { DEFAULT_MULTI_PROVIDER_CONFIG } from './providers/types.js';

// Config
export type { NexusDevConfig } from './core/config.js';
export { DEFAULT_CONFIG, mergeConfig } from './core/config.js';
