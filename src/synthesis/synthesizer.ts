/**
 * Nexus-Dev MMFE — Synthesizer
 * Merges all subtask results into a unified, coherent final answer.
 * Uses a composite of multiple models for cross-validation and assembly.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { SubTaskResult, OrchestrationRequest, OrchestrationResult, RoutingDecision } from '../core/types.js';
import { NexusDevConfig } from '../core/config.js';

const SYNTHESIZER_SYSTEM_PROMPT = `You are a master synthesis engine. Your role is to combine the outputs of multiple specialized AI subtask processors into a single, coherent, and comprehensive final answer.

PRINCIPLES:
1. UNIFY, don't stitch — the final answer must read as a single, coherent perspective, not a patchwork.
2. RESOLVE conflicts — if subtask results disagree, use your judgment to determine the most accurate view and explain briefly if needed.
3. ELEVATE quality — improve clarity, structure, and precision beyond what individual subtasks produced.
4. PRESERVE depth — don't lose important details from subtask results in the pursuit of brevity.
5. MAINTAIN flow — ensure logical transitions between sections that were produced by different models.
6. CREDIT substance — prioritize the most substantive, accurate content regardless of which model produced it.

OUTPUT: Produce a single, polished, comprehensive answer to the original query.`;

const QUALITY_SCORER_PROMPT = `You are a quality assessment engine. Score the following synthesized response on a scale of 0-100 based on:
- Completeness (does it fully address the query?)
- Accuracy (is the information correct and precise?)
- Coherence (does it flow logically?)
- Depth (does it provide substantial, non-superficial content?)
- Clarity (is it well-structured and easy to understand?)

Return ONLY a number between 0 and 100.`;

export class Synthesizer {
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
   * Synthesize subtask results into a final, unified answer.
   */
  async synthesize(
    request: OrchestrationRequest,
    subTaskResults: Map<string, SubTaskResult>,
    routingDecisions: RoutingDecision[],
    totalExecutionTimeMs: number
  ): Promise<OrchestrationResult> {
    const client = await this.getClient();

    // Collect successful results
    const successfulResults = Array.from(subTaskResults.values()).filter(r => r.success);
    const failedResults = Array.from(subTaskResults.values()).filter(r => !r.success);

    // If no results succeeded, return an error result
    if (successfulResults.length === 0) {
      return {
        requestId: request.id,
        answer: 'Unable to produce a result: all subtask executions failed.',
        subTaskResults: Array.from(subTaskResults.values()),
        routingDecisions,
        totalExecutionTimeMs,
        modelsUsed: [...new Set(routingDecisions.map(r => r.selectedModel))],
        decompositionStrategy: 'multi-model-parallel',
        synthesisStrategy: 'none-failed',
        qualityScore: 0,
        metadata: { error: 'all-subtasks-failed' },
      };
    }

    // Build the synthesis input
    const subtaskOutputs = successfulResults.map((r, i) => ({
      subTaskId: r.subTaskId,
      model: r.modelId,
      output: r.output,
    }));

    const synthesisInput = this.buildSynthesisInput(request, subtaskOutputs, failedResults);

    // Primary synthesis
    const startTime = Date.now();
    const synthesisResponse = await client.chat.completions.create({
      model: 'glm-5.2',
      messages: [
        { role: 'system', content: SYNTHESIZER_SYSTEM_PROMPT },
        { role: 'user', content: synthesisInput },
      ],
      thinking: { type: 'enabled' },
      temperature: 0.5,
    });

    let answer = synthesisResponse.choices?.[0]?.message?.content ?? '';

    // Quality scoring pass
    const qualityScore = await this.scoreQuality(client, request.query, answer);

    // Re-synthesis if quality is below threshold
    if (qualityScore < this.config.qualityThreshold && this.config.enableRetry) {
      const refinedAnswer = await this.refineSynthesis(client, request.query, answer, qualityScore);
      if (refinedAnswer) {
        answer = refinedAnswer;
      }
    }

    return {
      requestId: request.id,
      answer,
      subTaskResults: Array.from(subTaskResults.values()),
      routingDecisions,
      totalExecutionTimeMs: totalExecutionTimeMs + (Date.now() - startTime),
      modelsUsed: [...new Set([
        ...routingDecisions.map(r => r.selectedModel),
        'glm-5.2', // synthesis model
      ])],
      decompositionStrategy: 'multi-model-parallel',
      synthesisStrategy: qualityScore < this.config.qualityThreshold ? 'refined' : 'primary',
      qualityScore,
      metadata: {
        successfulSubTasks: successfulResults.length,
        failedSubTasks: failedResults.length,
      },
    };
  }

  /**
   * Build the input for the synthesis model.
   */
  private buildSynthesisInput(
    request: OrchestrationRequest,
    outputs: Array<{ subTaskId: string; model: string; output: string }>,
    failures: SubTaskResult[]
  ): string {
    let input = `ORIGINAL QUERY:\n${request.query}\n\n`;

    if (request.context) {
      input += `CONTEXT:\n${request.context}\n\n`;
    }

    input += `SUBTASK RESULTS (from multiple specialized models):\n`;
    input += `${'='.repeat(60)}\n\n`;

    for (const out of outputs) {
      input += `[Subtask: ${out.subTaskId} | Model: ${out.model}]\n`;
      input += `${out.output}\n\n`;
      input += `${'-'.repeat(40)}\n\n`;
    }

    if (failures.length > 0) {
      input += `NOTE: ${failures.length} subtask(s) failed and their results are not included.\n`;
      input += `Failed subtasks: ${failures.map(f => `${f.subTaskId} (${f.error})`).join(', ')}\n\n`;
    }

    input += `SYNTHESIZE the above into a single, comprehensive answer to the original query.`;
    return input;
  }

  /**
   * Score the quality of the synthesized answer.
   */
  private async scoreQuality(client: ZAI, query: string, answer: string): Promise<number> {
    try {
      const response = await client.chat.completions.create({
        model: 'glm-5',
        messages: [
          { role: 'system', content: QUALITY_SCORER_PROMPT },
          {
            role: 'user',
            content: `QUERY: ${query}\n\nRESPONSE:\n${answer}\n\nScore:`,
          },
        ],
        temperature: 0.1,
        max_tokens: 10,
      });

      const scoreStr = response.choices?.[0]?.message?.content?.trim() ?? '50';
      const score = parseInt(scoreStr.replace(/[^0-9]/g, ''), 10);
      return isNaN(score) ? 50 : Math.max(0, Math.min(100, score));
    } catch {
      return 50; // Default score on error
    }
  }

  /**
   * Attempt to refine the synthesis if quality is below threshold.
   */
  private async refineSynthesis(
    client: ZAI,
    query: string,
    currentAnswer: string,
    currentScore: number
  ): Promise<string | null> {
    try {
      const response = await client.chat.completions.create({
        model: 'glm-4.7',
        messages: [
          {
            role: 'system',
            content: `You are a refinement specialist. The following answer scored ${currentScore}/100 on quality. Improve it by adding depth, fixing any gaps, and enhancing clarity and structure.`,
          },
          {
            role: 'user',
            content: `QUERY: ${query}\n\nCURRENT ANSWER (score ${currentScore}/100):\n${currentAnswer}\n\nProduce an improved version:`,
          },
        ],
        temperature: 0.6,
      });

      return response.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }
}
