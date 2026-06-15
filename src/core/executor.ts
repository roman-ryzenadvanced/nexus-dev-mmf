/**
 * Nexus-Dev MMFE — Parallel Executor
 * Executes subtasks in parallel against selected models via z-ai-web-dev-sdk.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { SubTask, SubTaskResult, RoutingDecision } from '../core/types.js';
import { MODEL_REGISTRY } from '../core/models.js';
import { NexusDevConfig } from '../core/config.js';

export class ParallelExecutor {
  private zai: ZAI | null = null;
  private config: NexusDevConfig;

  constructor(config: NexusDevConfig) {
    this.config = config;
  }

  private async getClient(): Promise<ZAI> {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
    return this.zai;
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
    const client = await this.getClient();
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
      const batchResults = await this.executeWave(client, ready, routingMap, systemPrompt);

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
    client: ZAI,
    tasks: SubTask[],
    routingMap: Map<string, RoutingDecision>,
    systemPrompt?: string
  ): Promise<Map<string, SubTaskResult>> {
    const maxConcurrent = this.config.maxParallelSubTasks;
    const results = new Map<string, SubTaskResult>();

    // Process in batches to respect concurrency limits
    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      const promises = batch.map(task => this.executeOne(client, task, routingMap, systemPrompt));
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
   * Execute a single subtask against its assigned model.
   */
  private async executeOne(
    client: ZAI,
    task: SubTask,
    routingMap: Map<string, RoutingDecision>,
    systemPrompt?: string
  ): Promise<SubTaskResult> {
    const decision = routingMap.get(task.id);
    const modelId = decision?.selectedModel ?? 'glm-5.2';
    const profile = MODEL_REGISTRY[modelId];
    const startTime = Date.now();

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system' as const, content: systemPrompt });
    } else {
      messages.push({
        role: 'system' as const,
        content: `You are a specialized AI assistant handling subtask "${task.description}". Focus on producing a precise, self-contained result for this specific subtask. Be thorough but concise.`,
      });
    }
    messages.push({ role: 'user' as const, content: task.input });

    const requestOptions: any = {
      model: modelId,
      messages,
      temperature: 0.4,
    };

    // Enable thinking for models that support it and when config allows
    if (profile?.supportsThinking && this.config.enableThinking) {
      requestOptions.thinking = { type: 'enabled' };
    }

    try {
      const response = await Promise.race([
        client.chat.completions.create(requestOptions),
        this.createTimeout(task.timeout),
      ]);

      const output = response.choices?.[0]?.message?.content ?? '';
      const executionTimeMs = Date.now() - startTime;

      // Retry with alternative model if output is suspiciously empty
      if (!output.trim() && this.config.enableRetry && decision?.alternativeModels?.length) {
        return this.retryWithAlternative(client, task, decision.alternativeModels[0], startTime);
      }

      return {
        subTaskId: task.id,
        modelId,
        success: true,
        output,
        executionTimeMs,
        tokenUsage: response.usage ? {
          prompt: response.usage.prompt_tokens ?? 0,
          completion: response.usage.completion_tokens ?? 0,
          total: response.usage.total_tokens ?? 0,
        } : undefined,
        metadata: {
          routingConfidence: decision?.confidence,
          modelProfile: profile?.tier,
        },
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;

      // Retry with alternative model
      if (this.config.enableRetry && decision?.alternativeModels?.length) {
        return this.retryWithAlternative(client, task, decision.alternativeModels[0], startTime);
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
    client: ZAI,
    task: SubTask,
    alternativeModelId: string,
    originalStartTime: number
  ): Promise<SubTaskResult> {
    const profile = MODEL_REGISTRY[alternativeModelId];

    try {
      const response = await client.chat.completions.create({
        model: alternativeModelId,
        messages: [
          {
            role: 'system',
            content: `You are a specialized AI assistant handling subtask "${task.description}". Produce a precise, self-contained result.`,
          },
          { role: 'user', content: task.input },
        ],
        temperature: 0.4,
      });

      return {
        subTaskId: task.id,
        modelId: alternativeModelId,
        success: true,
        output: response.choices?.[0]?.message?.content ?? '',
        executionTimeMs: Date.now() - originalStartTime,
        metadata: { retry: true, originalModel: task.preferredModels[0] },
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
