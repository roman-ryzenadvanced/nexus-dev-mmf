/**
 * Nexus-Dev MMFE — Budget-Aware Routing Extension
 * Adds cost constraint logic to the Adaptive Routing Layer.
 */

import { MODEL_REGISTRY, ModelProfile } from './models.js';
import type { RoutingDecision, SubTask } from './types.js';

export interface BudgetConstraint {
  /** Maximum total cost weight allowed for the entire request */
  maxTotalCost: number;
  /** Maximum cost weight per single subtask */
  maxCostPerTask: number;
  /** Whether to prefer cheaper models when quality difference is small */
  preferCheaper: boolean;
  /** Quality threshold below which cost optimization kicks in */
  costOptimizationThreshold: number; // 0-100 quality score
}

export const DEFAULT_BUDGET: BudgetConstraint = {
  maxTotalCost: Infinity,
  maxCostPerTask: Infinity,
  preferCheaper: false,
  costOptimizationThreshold: 50,
};

/**
 * Check if a model selection fits within budget constraints.
 */
export function isWithinBudget(modelId: string, currentTotalCost: number, budget: BudgetConstraint): boolean {
  const model = MODEL_REGISTRY[modelId];
  if (!model) return false;

  const newTotal = currentTotalCost + model.costWeight;
  if (newTotal > budget.maxTotalCost) return false;
  if (model.costWeight > budget.maxCostPerTask) return false;

  return true;
}

/**
 * Find the cheapest model that satisfies the required capabilities.
 */
export function findCheapestModel(requiredCapabilities: string[], exclude: string[] = []): string | null {
  const candidates = Object.values(MODEL_REGISTRY)
    .filter(m => !exclude.includes(m.id))
    .filter(m => {
      const matchRatio = requiredCapabilities.filter(c => m.capabilities.includes(c as any)).length / Math.max(requiredCapabilities.length, 1);
      return matchRatio >= 0.5; // At least 50% capability match
    })
    .sort((a, b) => a.costWeight - b.costWeight);

  return candidates[0]?.id ?? null;
}

/**
 * Calculate the total cost of a set of routing decisions.
 */
export function calculateTotalCost(decisions: RoutingDecision[]): number {
  return decisions.reduce((total, d) => {
    const model = MODEL_REGISTRY[d.selectedModel];
    return total + (model?.costWeight ?? 1);
  }, 0);
}

/**
 * Optimize routing decisions to fit within a budget constraint.
 * Replaces the most expensive decisions with cheaper alternatives.
 */
export function optimizeForBudget(decisions: RoutingDecision[], subtasks: SubTask[], budget: BudgetConstraint): RoutingDecision[] {
  const currentCost = calculateTotalCost(decisions);
  if (currentCost <= budget.maxTotalCost) return decisions;

  const optimized = [...decisions];
  const subtaskMap = new Map(subtasks.map(s => [s.id, s]));

  // Sort decisions by cost (most expensive first) for replacement
  const sortedByCost = optimized
    .map((d, i) => ({
      decision: d,
      index: i,
      cost: MODEL_REGISTRY[d.selectedModel]?.costWeight ?? 1,
    }))
    .sort((a, b) => b.cost - a.cost);

  let totalCost = currentCost;

  for (const item of sortedByCost) {
    if (totalCost <= budget.maxTotalCost) break;

    const subtask = subtaskMap.get(item.decision.subTaskId);
    if (!subtask) continue;

    // Try alternatives (cheaper models)
    const alternatives = item.decision.alternativeModels.map(id => ({ id, cost: MODEL_REGISTRY[id]?.costWeight ?? 1 })).sort((a, b) => a.cost - b.cost);

    for (const alt of alternatives) {
      if (alt.cost < item.cost && isWithinBudget(alt.id, totalCost - item.cost, budget)) {
        optimized[item.index] = {
          ...item.decision,
          selectedModel: alt.id,
          reason: `${item.decision.reason} [budget-optimized: replaced ${item.decision.selectedModel} (cost ${item.cost}) with ${alt.id} (cost ${alt.cost})]`,
          confidence: item.decision.confidence * 0.85, // Slightly reduced confidence for budget choice
        };
        totalCost = totalCost - item.cost + alt.cost;
        break;
      }
    }
  }

  return optimized;
}
