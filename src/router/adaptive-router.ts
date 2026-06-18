/**
 * Nexus-Dev MMFE — Adaptive Routing Layer (ARL)
 * Dynamically selects the optimal model for each subtask based on
 * capabilities, speed/quality preferences, and current load.
 */

import type { NexusDevConfig } from '../core/config.js';
import { getModelsWithCapability, MODEL_REGISTRY, ModelProfile } from '../core/models.js';
import type { OrchestrationRequest, RoutingDecision, SubTask } from '../core/types.js';

export interface RoutingContext {
  mode: 'speed' | 'quality' | 'balanced' | 'creative';
  usedModels: Map<string, number>; // modelId -> count of assignments
  maxParallel: number;
}

export class AdaptiveRouter {
  private readonly config: NexusDevConfig;

  constructor(config: NexusDevConfig) {
    this.config = config;
  }

  /**
   * Route all subtasks, returning a routing decision for each.
   */
  route(subtasks: SubTask[], request: OrchestrationRequest): RoutingDecision[] {
    const ctx: RoutingContext = {
      mode: request.preferredMode ?? this.config.defaultMode,
      usedModels: new Map(),
      maxParallel: request.maxParallelSubTasks ?? this.config.maxParallelSubTasks,
    };

    // Topologically sort subtasks respecting dependencies
    const sorted = this.topologicalSort(subtasks);

    return sorted.map(subtask => this.routeOne(subtask, ctx));
  }

  /**
   * Route a single subtask to the best model.
   */
  private routeOne(subtask: SubTask, ctx: RoutingContext): RoutingDecision {
    // 1. If the subtask explicitly requests a model and it's valid, prefer it
    if (subtask.preferredModels.length > 0) {
      const preferred = subtask.preferredModels.find(id => MODEL_REGISTRY[id]);
      if (preferred) {
        this.trackAssignment(ctx, preferred);
        return {
          subTaskId: subtask.id,
          selectedModel: preferred,
          reason: `Explicitly preferred model for subtask "${subtask.description}"`,
          alternativeModels: this.getAlternatives(subtask, preferred),
          confidence: 0.95,
        };
      }
    }

    // 2. Score all candidate models
    const candidates = this.scoreCandidates(subtask, ctx);

    // 3. Select the top candidate
    const best = candidates[0];
    if (!best) {
      // Ultimate fallback
      this.trackAssignment(ctx, 'glm-5.2');
      return {
        subTaskId: subtask.id,
        selectedModel: 'glm-5.2',
        reason: 'Fallback to baseline model (no suitable candidates found)',
        alternativeModels: [],
        confidence: 0.3,
      };
    }

    this.trackAssignment(ctx, best.modelId);
    return {
      subTaskId: subtask.id,
      selectedModel: best.modelId,
      reason: best.reason,
      alternativeModels: candidates.slice(1, 4).map(c => c.modelId),
      confidence: best.confidence,
    };
  }

  /**
   * Score all models for a given subtask.
   */
  private scoreCandidates(
    subtask: SubTask,
    ctx: RoutingContext
  ): Array<{
    modelId: string;
    score: number;
    confidence: number;
    reason: string;
  }> {
    const scores: Array<{
      modelId: string;
      score: number;
      confidence: number;
      reason: string;
    }> = [];

    for (const [modelId, profile] of Object.entries(MODEL_REGISTRY)) {
      let score = 0;
      const reasons: string[] = [];

      // Capability match (most important factor)
      const capabilityMatch = subtask.requiredCapabilities.filter(c => profile.capabilities.includes(c)).length;
      const capabilityRatio = subtask.requiredCapabilities.length > 0 ? capabilityMatch / subtask.requiredCapabilities.length : 0.5;

      if (capabilityRatio >= 1.0) {
        score += 40;
        reasons.push('full capability match');
      } else if (capabilityRatio >= 0.5) {
        score += 20;
        reasons.push('partial capability match');
      } else {
        score -= 10;
        reasons.push('poor capability match');
      }

      // Mode preference
      switch (ctx.mode) {
        case 'speed':
          score += (6 - profile.speedRank) * 10;
          reasons.push(`speed mode (rank ${profile.speedRank})`);
          break;
        case 'quality':
          score += (6 - profile.qualityRank) * 10;
          reasons.push(`quality mode (rank ${profile.qualityRank})`);
          break;
        case 'balanced':
          score += (6 - profile.speedRank) * 5 + (6 - profile.qualityRank) * 5;
          reasons.push(`balanced mode (speed:${profile.speedRank} quality:${profile.qualityRank})`);
          break;
        case 'creative':
          if (profile.tier === 'creative') {
            score += 30;
            reasons.push('creative tier bonus');
          }
          score += (6 - profile.qualityRank) * 8;
          reasons.push(`creative mode (quality rank ${profile.qualityRank})`);
          break;
      }

      // Complexity alignment
      const complexityScores: Record<string, number> = {
        trivial: profile.speedRank <= 2 ? 10 : 0,
        simple: profile.speedRank <= 2 ? 10 : 5,
        moderate: 5,
        complex: profile.qualityRank <= 2 ? 15 : 5,
        expert: profile.qualityRank === 1 ? 20 : 10,
      };
      const cScore = complexityScores[subtask.estimatedComplexity] ?? 5;
      score += cScore;

      // Load balancing: slightly penalize already-loaded models
      const currentLoad = ctx.usedModels.get(modelId) ?? 0;
      score -= currentLoad * 3;

      // Priority boost
      if (subtask.priority === 'critical') {
        score += profile.qualityRank <= 2 ? 10 : 0;
      }

      const confidence = Math.min(1.0, capabilityRatio * 0.5 + (score / 100) * 0.5);

      scores.push({
        modelId,
        score,
        confidence,
        reason: reasons.join('; '),
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Get alternative models for a subtask (excluding the selected one).
   */
  private getAlternatives(subtask: SubTask, selectedId: string): string[] {
    return getModelsWithCapability(subtask.requiredCapabilities[0])
      .map(m => m.id)
      .filter(id => id !== selectedId)
      .slice(0, 3);
  }

  /**
   * Track model assignment for load balancing.
   */
  private trackAssignment(ctx: RoutingContext, modelId: string): void {
    ctx.usedModels.set(modelId, (ctx.usedModels.get(modelId) ?? 0) + 1);
  }

  /**
   * Topological sort of subtasks respecting dependency chains.
   */
  private topologicalSort(subtasks: SubTask[]): SubTask[] {
    const taskMap = new Map(subtasks.map(s => [s.id, s]));
    const visited = new Set<string>();
    const result: SubTask[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const task = taskMap.get(id);
      if (task) {
        for (const dep of task.dependencies) {
          visit(dep);
        }
        result.push(task);
      }
    };

    for (const subtask of subtasks) {
      visit(subtask.id);
    }

    return result;
  }
}
