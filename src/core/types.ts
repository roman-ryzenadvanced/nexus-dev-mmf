/**
 * Nexus-Dev MMFE — Task Types
 * Defines the core data structures for task decomposition and orchestration.
 */

import { ModelCapability } from './models.js';

/**
 * A subtask produced by the Decomposition Phase.
 */
export interface SubTask {
  id: string;
  parentTaskId: string;
  index: number;
  description: string;
  input: string;
  requiredCapabilities: ModelCapability[];
  preferredModels: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];        // IDs of subtasks that must complete first
  estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';
  timeout: number;               // ms
  metadata: Record<string, unknown>;
}

/**
 * The result of executing a subtask against a specific model.
 */
export interface SubTaskResult {
  subTaskId: string;
  modelId: string;
  success: boolean;
  output: string;
  executionTimeMs: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  error?: string;
  metadata: Record<string, unknown>;
}

/**
 * The full orchestration request.
 */
export interface OrchestrationRequest {
  id: string;
  query: string;
  context?: string;
  preferredMode?: 'speed' | 'quality' | 'balanced' | 'creative';
  maxParallelSubTasks?: number;
  enableThinking?: boolean;
  customSystemPrompt?: string;
  conversationId?: string;           // For multi-turn conversations
  maxCostWeight?: number;            // Budget constraint per request
  metadata: Record<string, unknown>;
}

/**
 * The final synthesized result.
 */
export interface OrchestrationResult {
  requestId: string;
  answer: string;
  subTaskResults: SubTaskResult[];
  routingDecisions: RoutingDecision[];
  totalExecutionTimeMs: number;
  modelsUsed: string[];
  decompositionStrategy: string;
  synthesisStrategy: string;
  qualityScore: number;          // 0-100 self-assessed quality
  totalCostWeight: number;       // Sum of costWeight for all models used
  conversationId?: string;       // If part of a multi-turn conversation
  metadata: Record<string, unknown>;
}

/**
 * A routing decision made by the Adaptive Routing Layer.
 */
export interface RoutingDecision {
  subTaskId: string;
  selectedModel: string;
  reason: string;
  alternativeModels: string[];
  confidence: number;            // 0-1
}

/**
 * Pipeline stage tracking.
 */
export type PipelineStage =
  | 'received'
  | 'decomposing'
  | 'routing'
  | 'executing'
  | 'synthesizing'
  | 'completed'
  | 'failed';

/**
 * Pipeline state for monitoring.
 */
export interface PipelineState {
  requestId: string;
  stage: PipelineStage;
  subTaskCount: number;
  completedSubTasks: number;
  startedAt: number;
  updatedAt: number;
  errors: string[];
}
