/**
 * Nexus-Dev MMFE — Parallel Executor
 * Executes subtasks in parallel against selected models via the Provider Router.
 * Supports multi-provider execution (ZAI, OpenAI, Anthropic, Google).
 */

import { SubTask, SubTaskResult, RoutingDecision } from '../core/types.js';
import { MODEL_REGISTRY } from '../core/models.js';
import { NexusDevConfig } from '../core/config.js';
import { ProviderRouter } from '../providers/provider-router.js';
import { ProviderMessage, ProviderCompletionOptions } from '../providers/types.js';

export class ParallelExecutor {
  private providerRouter: ProviderRouter;
  private config: NexusDevConfig;

  constructor(config: NexusDevConfig, providerRouter: ProviderRouter) {
    this.config = config;
    this.providerRouter = providerRouter;
  }

  /**
   * Execute all subtasks in parallel, respecting dependency ordering.
   * Returns results keyed by subtask ID.
   */
  async execute(
    subtasks: SubTask[],
    routingDecisions: RoutingDecision[],
    systemPrompt?: string
  ): Promise<Map<string, SubTaskResult>> {
    const results = new Map<string, SubTaskResult>();
    const routingMap = new Map(routingDecisions.map(r => [r.subTaskId, r]));

    // Build dependency graph
    const pending = new Set(subtasks.map(s => s.id));
    const taskMap = new Map(subtasks.map(s => [s.id, s]));
    const completed = new Set<string>();

    // Execute in waves: each wave runs all tasks whose dependencies are met
    let wave = 0;
    while (pending.size > 0) {
      wave++;
      const ready: SubTask[] = [];

      for (const id of pending) {
        const task = taskMap.get(id)!;
        const depsMet = task.dependencies.every(dep => completed.has(dep));
        if (depsMet) {
          ready.push(task);
        }
      }

      if (ready.length === 0 && pending.size > 0) {
        // Circular dependency or deadlock — mark remaining as failed
        for (const id of pending) {
          results.set(id, {
            subTaskId: id,
            modelId: 'none',
            success: false,
            output: '',
            executionTimeMs: 0,
            error: 'Deadlock: unresolved dependencies',
            metadata: {},
          });
        }
        break;
      }

      // Execute this wave in parallel (limited concurrency)
      const batchResults = await this.executeWave(ready, routingMap, systemPrompt);

      for (const [id, result] of batchResults) {
        results.set(id, result);
        completed.add(id);
        pending.delete(id);
      }
    }

    return results;
  }

  /**
   * Execute a wave of independent subtasks in parallel.
   */
  private async executeWave(
    tasks: SubTask[],
    routingMap: Map<string, RoutingDecision>,
    systemPrompt?: string
  ): Promise<Map<string, SubTaskResult>> {
    const maxConcurrent = this.config.maxParallelSubTasks;
    const results = new Map<string, SubTaskResult>();

    // Process in batches to respect concurrency limits
    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      const promises = batch.map(task => this.executeOne(task, routingMap, systemPrompt));
      const batchResults = await Promise.allSettled(promises);

      for (let j = 0; j < batchResults.length; j++) {
        const settled = batchResults[j];
        const task = batch[j];

        if (settled.status === 'fulfilled') {
          results.set(task.id, settled.value);
        } else {
          results.set(task.id, {
            subTaskId: task.id,
            modelId: routingMap.get(task.id)?.selectedModel ?? 'unknown',
            success: false,
            output: '',
            executionTimeMs: 0,
            error: settled.reason?.message ?? 'Unknown execution error',
            metadata: {},
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute a single subtask against its assigned model via the provider router.
   */
  private async executeOne(
    task: SubTask,
    routingMap: Map<string, RoutingDecision>,
    systemPrompt?: string
  ): Promise<SubTaskResult> {
    const decision = routingMap.get(task.id);
    const modelId = decision?.selectedModel ?? 'glm-5.2';
    const profile = MODEL_REGISTRY[modelId];
    const startTime = Date.now();

    const messages: ProviderMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    } else {
      messages.push({
        role: 'system',
        content: `You are a specialized AI assistant handling subtask "${task.description}". Focus on producing a precise, self-contained result for this specific subtask. Be thorough but concise.`,
      });
    }
    messages.push({ role: 'user', content: task.input });

    const options: ProviderCompletionOptions = {
      temperature: 0.4,
      enableThinking: profile?.supportsThinking && this.config.enableThinking,
    };

    try {
      const result = await Promise.race([
        this.providerRouter.completeWithFallback(
          modelId,
          messages,
          options,
          decision?.alternativeModels
        ),
        this.createTimeout(task.timeout),
      ]);

      const output = result.content;
      const executionTimeMs = Date.now() - startTime;

      // Retry with alternative model if output is suspiciously empty
      if (!output.trim() && this.config.enableRetry && decision?.alternativeModels?.length) {
        return this.retryWithAlternative(task, decision.alternativeModels[0], startTime);
      }

      return {
        subTaskId: task.id,
        modelId: result.model ?? modelId,
        success: true,
        output,
        executionTimeMs,
        tokenUsage: result.usage ? {
          prompt: result.usage.promptTokens,
          completion: result.usage.completionTokens,
          total: result.usage.totalTokens,
        } : undefined,
        metadata: {
          routingConfidence: decision?.confidence,
          modelProfile: profile?.tier,
          provider: result.provider,
        },
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;

      // Retry with alternative model
      if (this.config.enableRetry && decision?.alternativeModels?.length) {
        return this.retryWithAlternative(task, decision.alternativeModels[0], startTime);
      }

      return {
        subTaskId: task.id,
        modelId,
        success: false,
        output: '',
        executionTimeMs,
        error: error?.message ?? 'Execution failed',
        metadata: {},
      };
    }
  }

  /**
   * Retry a failed subtask with an alternative model.
   */
  private async retryWithAlternative(
    task: SubTask,
    alternativeModelId: string,
    originalStartTime: number
  ): Promise<SubTaskResult> {
    const messages: ProviderMessage[] = [
      {
        role: 'system',
        content: `You are a specialized AI assistant handling subtask "${task.description}". Produce a precise, self-contained result.`,
      },
      { role: 'user', content: task.input },
    ];

    try {
      const result = await this.providerRouter.complete(
        alternativeModelId,
        messages,
        { temperature: 0.4 }
      );

      return {
        subTaskId: task.id,
        modelId: result.model ?? alternativeModelId,
        success: true,
        output: result.content,
        executionTimeMs: Date.now() - originalStartTime,
        metadata: { retry: true, originalModel: task.preferredModels[0], provider: result.provider },
      };
    } catch (error: any) {
      return {
        subTaskId: task.id,
        modelId: alternativeModelId,
        success: false,
        output: '',
        executionTimeMs: Date.now() - originalStartTime,
        error: `Retry failed: ${error?.message ?? 'Unknown error'}`,
        metadata: { retry: true },
      };
    }
  }

  /**
   * Create a timeout promise.
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Subtask timed out after ${ms}ms`)), ms);
    });
  }
}
