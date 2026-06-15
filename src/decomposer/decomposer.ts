/**
 * Nexus-Dev MMFE — Decomposer
 * Breaks down complex requests into logically independent subtasks.
 * Uses the flagship model (glm-5.2) for intelligent decomposition.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { SubTask, OrchestrationRequest } from '../core/types.js';
import { MODEL_REGISTRY } from '../core/models.js';
import { NexusDevConfig } from '../core/config.js';

const DECOMPOSER_SYSTEM_PROMPT = `You are a task decomposition specialist. Your job is to break down complex requests into smaller, independent subtasks that can be processed in parallel by specialized AI models.

RULES:
1. Break the request into the SMALLEST logically independent units.
2. Each subtask should be self-contained and produce a meaningful intermediate result.
3. Specify dependencies between subtasks ONLY when truly necessary (task B needs output of task A).
4. Assign capability requirements based on what the subtask actually needs.
5. Estimate complexity realistically.
6. Prefer MORE subtasks over FEWER when it enables parallelism.

OUTPUT FORMAT — Return a JSON array of subtask objects:
[
  {
    "description": "Brief description of this subtask",
    "input": "The specific input/prompt for this subtask",
    "requiredCapabilities": ["reasoning", "code", ...],
    "priority": "critical" | "high" | "medium" | "low",
    "dependencies": [],
    "estimatedComplexity": "trivial" | "simple" | "moderate" | "complex" | "expert",
    "preferredModels": ["model-id", ...]
  }
]

AVAILABLE MODELS AND THEIR STRENGTHS:
- glm-5.2-1m: Advanced reasoning, 1M context, complex decomposition, long-document analysis
- glm-5.2: Baseline high-performance, robust execution, balanced quality-speed
- glm-5.1: Nuanced language, context sensitivity, summarization, translation
- glm-5: Speed specialist, rapid drafts, high-throughput, boilerplate
- glm-5v-turbo: Accelerated feedback, vision support, quick iteration
- glm-4.7: Creative generation, deep knowledge, sophisticated code synthesis

CAPABILITY OPTIONS: reasoning, math, code, creative-writing, analysis, summarization, translation, extraction, planning, debugging, refactoring, documentation, conversation, long-context, vision, rapid-iteration, code-review

Return ONLY the JSON array. No markdown, no explanation.`;

export class Decomposer {
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
   * Decompose an orchestration request into subtasks.
   */
  async decompose(request: OrchestrationRequest): Promise<SubTask[]> {
    const client = await this.getClient();

    const userPrompt = `DECOMPOSE THE FOLLOWING REQUEST:
${request.query}

${request.context ? `ADDITIONAL CONTEXT:\n${request.context}\n` : ''}
MODE: ${request.preferredMode ?? this.config.defaultMode}
MAX PARALLEL: ${request.maxParallelSubTasks ?? this.config.maxParallelSubTasks}

Produce the subtask decomposition now.`;

    const response = await client.chat.completions.create({
      model: 'glm-5.2',
      messages: [
        { role: 'system', content: DECOMPOSER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'enabled' },
      temperature: 0.3,
    });

    const content = response.choices?.[0]?.message?.content ?? '[]';

    try {
      const parsed = this.parseSubtasks(content, request.id);
      return parsed;
    } catch {
      // Fallback: treat the entire request as a single subtask
      return [this.createFallbackSubtask(request)];
    }
  }

  /**
   * Parse the LLM response into SubTask objects.
   */
  private parseSubtasks(raw: string, parentId: string): SubTask[] {
    // Extract JSON from potential markdown code blocks
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find a JSON array
    const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrMatch) {
      throw new Error('No JSON array found in decomposition response');
    }

    const rawTasks = JSON.parse(arrMatch[0]);
    if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
      throw new Error('Empty or invalid subtask array');
    }

    return rawTasks.map((task: any, index: number) => ({
      id: `${parentId}-sub-${index}`,
      parentTaskId: parentId,
      index,
      description: task.description ?? `Subtask ${index}`,
      input: task.input ?? task.description ?? '',
      requiredCapabilities: Array.isArray(task.requiredCapabilities)
        ? task.requiredCapabilities
        : ['reasoning'],
      preferredModels: Array.isArray(task.preferredModels)
        ? task.preferredModels
        : [],
      priority: task.priority ?? 'medium',
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      estimatedComplexity: task.estimatedComplexity ?? 'moderate',
      timeout: this.config.subTaskTimeout,
      metadata: {},
    }));
  }

  /**
   * Create a single fallback subtask when decomposition fails.
   */
  private createFallbackSubtask(request: OrchestrationRequest): SubTask {
    return {
      id: `${request.id}-sub-0`,
      parentTaskId: request.id,
      index: 0,
      description: 'Complete task (undecomposed)',
      input: request.query,
      requiredCapabilities: ['reasoning', 'analysis'],
      preferredModels: ['glm-5.2'],
      priority: 'critical',
      dependencies: [],
      estimatedComplexity: 'complex',
      timeout: this.config.subTaskTimeout * 2,
      metadata: { fallback: true },
    };
  }
}
