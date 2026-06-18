/**
 * Nexus-Dev MMFE — Code Review Engine
 *
 * Multi-model code review engine that integrates Alibaba Open Code Review
 * concepts into the Nexus multi-model fusion pipeline.
 *
 * Pipeline:
 * 1. [PLAN]    Fast model analyzes risks → structured review plan
 * 2. [REVIEW]  Multiple models review the diff in parallel with different specializations
 * 3. [SYNTH]   Flagship model merges & deduplicates comments from all reviewers
 * 4. [FILTER]  Independent model fact-checks comments against the diff
 * 5. [RE-LOC]  Fast model re-locates any comments that failed line matching
 *
 * With MTP enabled, these phases overlap:
 * - Plan + Review run concurrently (speculative review starts before plan completes)
 * - Synthesis begins as soon as first reviews arrive (incremental)
 * - Filter runs concurrently with synthesis
 */

import { loadZAIClient } from '../providers/zai-loader.js';
import type { ZAIClient } from '../providers/zai-loader.js';
import {
  CodeReviewRequest,
  CodeReviewResult,
  CodeReviewConfig,
  ReviewComment,
  ReviewPlan,
  DEFAULT_CODE_REVIEW_CONFIG,
} from './types.js';
import { fillTemplate, MAIN_REVIEW_SYSTEM, MAIN_REVIEW_USER, PLAN_REVIEW_SYSTEM, PLAN_REVIEW_USER, REVIEW_FILTER_SYSTEM, REVIEW_FILTER_USER, RE_LOCATION_SYSTEM, RE_LOCATION_USER, SYNTHESIS_PROMPT } from './prompts.js';
import { getReviewRuleForFile } from './rules.js';
import { parseDiff, getChangedFiles, getTotalChangedLines, findCodeInDiff, getFileDiff, getHunksForFile } from './diff-parser.js';
import type { DiffHunk } from './types.js';

/**
 * Model assignments for code review pipeline.
 * Uses Nexus routing logic: flagship for main analysis, fast for plan/spec,
 * standard for synthesis, independent for filtering.
 */
const REVIEW_MODEL_ASSIGNMENTS = {
  plan: 'glm-5',           // Fast model for risk analysis
  review: {
    speed: ['glm-5', 'glm-5v-turbo'],
    quality: ['glm-5.2-1m', 'glm-5.2'],
    balanced: ['glm-5.2', 'glm-5.1', 'glm-5'],
  },
  synthesis: 'glm-5.2',    // Flagship for merging reviews
  filter: 'glm-5.1',       // Independent model for fact-checking
  relocation: 'glm-5',     // Fast model for re-location
} as const;

export class CodeReviewEngine {
  private zai: Awaited<ReturnType<typeof loadZAIClient>> | null = null;
  private config: CodeReviewConfig;

  constructor(config?: Partial<CodeReviewConfig>) {
    this.config = { ...DEFAULT_CODE_REVIEW_CONFIG, ...config };
  }

  private async getClient() {
    if (!this.zai) {
      this.zai = await loadZAIClient();
    }
    return this.zai;
  }

  /**
   * Run a code review on the given diff.
   */
  async review(request: CodeReviewRequest): Promise<CodeReviewResult> {
    const startTime = Date.now();
    const client = await this.getClient();
    const mode = request.mode ?? this.config.mode;

    // Parse the diff
    const hunks = parseDiff(request.diff);
    const changedFiles = request.changedFiles.length > 0
      ? request.changedFiles
      : getChangedFiles(request.diff);

    // Determine if plan phase should run
    const totalLines = getTotalChangedLines(hunks);
    const enablePlan = request.enablePlanPhase ??
      (totalLines > this.config.planLineThreshold);

    // ═══ PHASE 1: PLAN (optional) ═══
    let plan: ReviewPlan | undefined;
    let planPromise: Promise<ReviewPlan | undefined> | undefined;

    if (enablePlan) {
      const currentFile = request.currentFilePath ?? changedFiles[0] ?? '';
      const rule = request.customRule ?? getReviewRuleForFile(currentFile);

      planPromise = this.runPlanPhase(client, request.diff, changedFiles, currentFile, rule, request.requirementBackground);

      if (!this.config.enableMTP) {
        plan = await planPromise;
      }
    }

    // ═══ PHASE 2: PARALLEL REVIEW ═══
    const reviewModels = REVIEW_MODEL_ASSIGNMENTS.review[mode] ??
      REVIEW_MODEL_ASSIGNMENTS.review.balanced;

    // Build review tasks — one per model, each reviews the full diff
    const reviewPromises: Promise<ReviewComment[]>[] = [];

    for (const modelId of reviewModels) {
      const currentFile = request.currentFilePath ?? changedFiles[0] ?? '';
      const rule = request.customRule ?? getReviewRuleForFile(currentFile);

      // In MTP mode, start reviews before plan completes
      const planGuidance = this.config.enableMTP && planPromise
        ? 'Review in progress. Plan phase running concurrently — focus on the most critical issues.'
        : (plan ? plan.issues.map(i => `[${i.severity}] ${i.description}`).join('\n') : '');

      reviewPromises.push(
        this.runReviewPhase(client, modelId, request.diff, changedFiles, currentFile, rule, planGuidance, request.requirementBackground)
      );
    }

    // Wait for all reviews
    const allReviewComments = await Promise.allSettled(reviewPromises);
    const rawComments: ReviewComment[] = [];

    for (const result of allReviewComments) {
      if (result.status === 'fulfilled') {
        rawComments.push(...result.value);
      }
    }

    // Wait for plan if MTP was enabled
    if (this.config.enableMTP && planPromise) {
      plan = await planPromise;
    }

    // ═══ PHASE 3: SYNTHESIS ═══
    const synthesizedComments = await this.runSynthesisPhase(
      client, request.diff, rawComments, changedFiles
    );

    // ═══ PHASE 4: FILTER (fact-check) ═══
    let finalComments = synthesizedComments;
    let filteredCount = 0;

    if (this.config.enableFilterPhase && synthesizedComments.length > 0) {
      const filterResult = await this.runFilterPhase(
        client, request.diff, request.currentFilePath ?? changedFiles[0] ?? '', synthesizedComments
      );
      finalComments = filterResult.kept;
      filteredCount = filterResult.filtered;
    }

    // ═══ PHASE 5: RE-LOCATION ═══
    // Resolve line numbers for comments that don't have them
    for (const comment of finalComments) {
      if (comment.startLine === 0 && comment.existingCode) {
        const located = findCodeInDiff(hunks, comment.path, comment.existingCode);
        if (located) {
          comment.startLine = located.startLine;
          comment.endLine = located.endLine;
        } else {
          // Try re-location via LLM
          const relocated = await this.runRelocationPhase(
            client, request.diff, comment.existingCode, comment.content
          );
          if (relocated) {
            comment.existingCode = relocated;
            const located2 = findCodeInDiff(hunks, comment.path, relocated);
            if (located2) {
              comment.startLine = located2.startLine;
              comment.endLine = located2.endLine;
            }
          }
        }
      }
    }

    // ═══ BUILD RESULT ═══
    const totalTime = Date.now() - startTime;
    const modelsUsed = [...new Set([...reviewModels, REVIEW_MODEL_ASSIGNMENTS.synthesis])];

    const highSeverity = finalComments.filter(c => c.severity === 'high').length;
    const mediumSeverity = finalComments.filter(c => c.severity === 'medium').length;
    const lowSeverity = finalComments.filter(c => c.severity === 'low').length;

    return {
      requestId: request.id,
      allComments: rawComments,
      comments: finalComments,
      plan,
      modelsUsed,
      totalExecutionTimeMs: totalTime,
      summary: {
        filesReviewed: changedFiles.length,
        totalComments: finalComments.length,
        highSeverity,
        mediumSeverity,
        lowSeverity,
        filteredOut: filteredCount,
      },
      metadata: {
        mode,
        enableMTP: this.config.enableMTP,
        enablePlan: enablePlan,
        enableFilter: this.config.enableFilterPhase,
        totalDiffLines: totalLines,
      },
    };
  }

  /**
   * Phase 1: Run the plan phase to analyze risks.
   */
  private async runPlanPhase(
    client: ZAIClient,
    diff: string,
    changedFiles: string[],
    currentFilePath: string,
    rule: string,
    background?: string,
  ): Promise<ReviewPlan | undefined> {
    try {
      const userMsg = fillTemplate(PLAN_REVIEW_USER, {
        change_files: changedFiles.join('\n'),
        current_file_path: currentFilePath,
        diff: diff.slice(0, 30000), // Limit diff size
        current_system_date_time: new Date().toISOString(),
        requirement_background: background ?? 'None provided',
        system_rule: rule,
      });

      const response = await client.chat.completions.create({
        model: REVIEW_MODEL_ASSIGNMENTS.plan,
        messages: [
          { role: 'system', content: PLAN_REVIEW_SYSTEM },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.4,
      });

      const content = response.choices?.[0]?.message?.content ?? '';
      return this.parsePlan(content);
    } catch {
      return undefined;
    }
  }

  /**
   * Phase 2: Run a single model's review of the diff.
   */
  private async runReviewPhase(
    client: ZAIClient,
    modelId: string,
    diff: string,
    changedFiles: string[],
    currentFilePath: string,
    rule: string,
    planGuidance: string,
    background?: string,
  ): Promise<ReviewComment[]> {
    try {
      const userMsg = fillTemplate(MAIN_REVIEW_USER, {
        change_files: changedFiles.join('\n'),
        current_file_path: currentFilePath,
        diff: diff.slice(0, 30000),
        current_system_date_time: new Date().toISOString(),
        requirement_background: background ?? 'None provided',
        system_rule: rule,
        plan_guidance: planGuidance || 'No plan guidance available.',
      });

      const useThinking = modelId === 'glm-5.2' || modelId === 'glm-5.2-1m' || modelId === 'glm-4.7';
      const opts: Record<string, unknown> = {
        model: modelId,
        messages: [
          { role: 'system', content: MAIN_REVIEW_SYSTEM },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.3,
      };
      if (useThinking) {
        opts.thinking = { type: 'enabled' };
      }

      const response = await client.chat.completions.create(opts as any);
      const content = response.choices?.[0]?.message?.content ?? '';

      return this.parseComments(content, currentFilePath, modelId);
    } catch {
      return [];
    }
  }

  /**
   * Phase 3: Synthesize comments from multiple models.
   */
  private async runSynthesisPhase(
    client: ZAIClient,
    diff: string,
    rawComments: ReviewComment[],
    changedFiles: string[],
  ): Promise<ReviewComment[]> {
    if (rawComments.length === 0) return [];
    if (rawComments.length === 1) return rawComments;

    try {
      const commentsText = rawComments.map((c, i) =>
        `[ID: ${c.id}] [Model: ${c.modelId}] [Severity: ${c.severity}]\n` +
        `Path: ${c.path}\n` +
        `Content: ${c.content}\n` +
        `Existing Code: ${c.existingCode}\n` +
        (c.suggestionCode ? `Suggestion: ${c.suggestionCode}\n` : '')
      ).join('\n---\n\n');

      const response = await client.chat.completions.create({
        model: REVIEW_MODEL_ASSIGNMENTS.synthesis,
        messages: [
          { role: 'system', content: SYNTHESIS_PROMPT },
          {
            role: 'user',
            content: `### Code Diff\n\`\`\`diff\n${diff.slice(0, 20000)}\n\`\`\`\n\n### Review Comments from Multiple Models\n${commentsText}\n\nSynthesize these review comments now.`,
          },
        ],
        thinking: { type: 'enabled' },
        temperature: 0.3,
      });

      const content = response.choices?.[0]?.message?.content ?? '';
      return this.parseSynthesizedComments(content, changedFiles[0] ?? '');
    } catch {
      // Fallback: deduplicate by content similarity
      return this.deduplicateComments(rawComments);
    }
  }

  /**
   * Phase 4: Filter (fact-check) comments against the diff.
   */
  private async runFilterPhase(
    client: ZAIClient,
    diff: string,
    filePath: string,
    comments: ReviewComment[],
  ): Promise<{ kept: ReviewComment[]; filtered: number }> {
    if (comments.length === 0) return { kept: [], filtered: 0 };

    try {
      const commentsText = comments.map(c =>
        `[ID: ${c.id}] Path: ${c.path}\nContent: ${c.content}\nExisting Code: ${c.existingCode}\n` +
        (c.suggestionCode ? `Suggestion: ${c.suggestionCode}` : '')
      ).join('\n---\n\n');

      const userMsg = fillTemplate(REVIEW_FILTER_USER, {
        path: filePath,
        diff: diff.slice(0, 20000),
        comments: commentsText,
      });

      const response = await client.chat.completions.create({
        model: REVIEW_MODEL_ASSIGNMENTS.filter,
        messages: [
          { role: 'system', content: REVIEW_FILTER_SYSTEM },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.1,
      });

      const content = response.choices?.[0]?.message?.content ?? '';
      const incorrectIds = this.parseFilterResult(content);

      const kept = comments.filter(c => !incorrectIds.includes(c.id));
      return { kept, filtered: comments.length - kept.length };
    } catch {
      return { kept: comments, filtered: 0 };
    }
  }

  /**
   * Phase 5: Re-locate a comment's existing_code via LLM.
   */
  private async runRelocationPhase(
    client: ZAIClient,
    diff: string,
    existingCode: string,
    commentContent: string,
  ): Promise<string | null> {
    try {
      const userMsg = fillTemplate(RE_LOCATION_USER, {
        diff: diff.slice(0, 20000),
        existing_code: existingCode,
        suggestion_content: commentContent,
      });

      const response = await client.chat.completions.create({
        model: REVIEW_MODEL_ASSIGNMENTS.relocation,
        messages: [
          { role: 'system', content: RE_LOCATION_SYSTEM },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.1,
      });

      const content = response.choices?.[0]?.message?.content ?? '';
      // Extract code from fenced block
      const codeMatch = content.match(/```(?:\w*)\s*([\s\S]*?)```/);
      return codeMatch ? codeMatch[1].trim() : null;
    } catch {
      return null;
    }
  }

  // ──────────── PARSERS ────────────

  private parsePlan(raw: string): ReviewPlan | undefined {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return undefined;
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        changeSummary: parsed.change_summary ?? parsed.changeSummary ?? '',
        issues: Array.isArray(parsed.issues) ? parsed.issues.map((i: any) => ({
          severity: i.severity ?? 'medium',
          description: i.description ?? '',
          toolGuidance: Array.isArray(i.tool_guidance ?? i.toolGuidance)
            ? (i.tool_guidance ?? i.toolGuidance).map((g: any) => ({
                name: g.name ?? '',
                reason: g.reason ?? '',
                arguments: g.arguments ?? '',
              }))
            : [],
        })) : [],
      };
    } catch {
      return undefined;
    }
  }

  private parseComments(raw: string, filePath: string, modelId: string): ReviewComment[] {
    try {
      // Try to find JSON comments array
      const jsonMatch = raw.match(/\{[\s\S]*"comments"[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      const comments = parsed.comments ?? parsed;

      if (!Array.isArray(comments)) return [];

      return comments.map((c: any, idx: number) => ({
        id: `review-${modelId}-${idx}`,
        path: filePath,
        content: c.content ?? '',
        existingCode: c.existing_code ?? c.existingCode ?? '',
        suggestionCode: c.suggestion_code ?? c.suggestionCode,
        startLine: 0,
        endLine: 0,
        severity: 'medium' as const,
        modelId,
        speculative: modelId === 'glm-5v-turbo' || modelId === 'glm-5',
        filtered: false,
      }));
    } catch {
      return [];
    }
  }

  private parseSynthesizedComments(raw: string, defaultPath: string): ReviewComment[] {
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((c: any, idx: number) => ({
        id: `synth-${idx}`,
        path: defaultPath,
        content: c.content ?? '',
        existingCode: c.existing_code ?? c.existingCode ?? '',
        suggestionCode: c.suggestion_code ?? c.suggestionCode,
        startLine: 0,
        endLine: 0,
        severity: c.severity ?? 'medium',
        modelId: REVIEW_MODEL_ASSIGNMENTS.synthesis,
        speculative: false,
        filtered: false,
      }));
    } catch {
      return [];
    }
  }

  private parseFilterResult(raw: string): string[] {
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Simple deduplication by content similarity.
   */
  private deduplicateComments(comments: ReviewComment[]): ReviewComment[] {
    const seen = new Set<string>();
    return comments.filter(c => {
      const key = c.content.toLowerCase().trim().slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

/**
 * Create a code review engine with optional config.
 */
export function createCodeReviewEngine(config?: Partial<CodeReviewConfig>): CodeReviewEngine {
  return new CodeReviewEngine(config);
}
