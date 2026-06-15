/**
 * Nexus-Dev MMFE — Code Review Types
 *
 * Adapted from Alibaba Open Code Review (https://github.com/alibaba/open-code-review)
 * Integrated into the Nexus multi-model fusion pipeline.
 *
 * Key concepts:
 * - ReviewComment: A single code review finding (adapted from LlmComment)
 * - CodeReviewRequest: Input to the review engine (diff + context)
 * - CodeReviewResult: Output from the review engine (comments + metrics)
 * - DiffHunk: Parsed unified diff segment
 * - ReviewPlan: Risk analysis produced by the plan phase
 */

/**
 * A single code review comment/finding.
 * Adapted from open-code-review's LlmComment model.
 */
export interface ReviewComment {
  /** Unique comment ID */
  id: string;
  /** File path being commented on */
  path: string;
  /** The review feedback content */
  content: string;
  /** The code snippet that the comment refers to (from the diff) */
  existingCode: string;
  /** Suggested replacement code (optional) */
  suggestionCode?: string;
  /** Start line in the new file */
  startLine: number;
  /** End line in the new file */
  endLine: number;
  /** Severity: high (security/crash), medium (performance/maintainability), low (style) */
  severity: 'high' | 'medium' | 'low';
  /** The model that produced this comment */
  modelId: string;
  /** Whether this comment was produced by a speculative/draft model */
  speculative: boolean;
  /** Whether this comment passed the review filter */
  filtered: boolean;
  /** Internal thinking/reasoning (if available) */
  thinking?: string;
}

/**
 * A parsed unified diff hunk.
 */
export interface DiffHunk {
  /** File path */
  path: string;
  /** Old file start line */
  oldStart: number;
  /** Old file line count */
  oldCount: number;
  /** New file start line */
  newStart: number;
  /** New file line count */
  newCount: number;
  /** The raw hunk content (lines with +, -, space prefixes) */
  lines: DiffLine[];
}

/**
 * A single line in a diff hunk.
 */
export interface DiffLine {
  /** Line type: added, removed, or context */
  type: 'added' | 'removed' | 'context';
  /** Line content (without the +/- prefix) */
  content: string;
  /** Line number in the new file (for added/context lines) */
  newLineNo?: number;
  /** Line number in the old file (for removed/context lines) */
  oldLineNo?: number;
}

/**
 * Input to the code review engine.
 */
export interface CodeReviewRequest {
  /** Unique request ID */
  id: string;
  /** The unified diff to review (raw string) */
  diff: string;
  /** List of changed file paths */
  changedFiles: string[];
  /** Current file path (for focused review) */
  currentFilePath?: string;
  /** Optional requirement/business background */
  requirementBackground?: string;
  /** Language-specific rule override */
  customRule?: string;
  /** Whether to enable the plan phase (auto-enabled for diffs > 50 lines) */
  enablePlanPhase?: boolean;
  /** Whether to enable the review filter (fact-check comments against diff) */
  enableFilterPhase?: boolean;
  /** Execution mode */
  mode?: 'speed' | 'quality' | 'balanced';
  /** Whether to use MTP hyperthreading */
  enableMTP?: boolean;
  /** Maximum tool-calling rounds per file */
  maxToolRounds?: number;
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Result of a code review.
 */
export interface CodeReviewResult {
  /** Request ID */
  requestId: string;
  /** All review comments (before filtering) */
  allComments: ReviewComment[];
  /** Filtered review comments (after fact-checking) */
  comments: ReviewComment[];
  /** Review plan (if plan phase was executed) */
  plan?: ReviewPlan;
  /** Models used for review */
  modelsUsed: string[];
  /** Total execution time in ms */
  totalExecutionTimeMs: number;
  /** Token usage */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Summary statistics */
  summary: {
    filesReviewed: number;
    totalComments: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    filteredOut: number;
  };
  /** MTP metrics (if MTP was enabled) */
  mtpMetrics?: {
    speedupFactor: number;
    speculativeHits: number;
    speculativeMisses: number;
    peakConcurrency: number;
  };
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * A risk analysis plan produced by the plan phase.
 * Adapted from open-code-review's PLAN_TASK output format.
 */
export interface ReviewPlan {
  /** Summary of the code changes */
  changeSummary: string;
  /** Identified risk points */
  issues: ReviewPlanIssue[];
}

/**
 * A single risk point in the review plan.
 */
export interface ReviewPlanIssue {
  /** Severity level */
  severity: 'high' | 'medium' | 'low';
  /** Description of the risk */
  description: string;
  /** Tool-calling strategy for investigating this risk */
  toolGuidance: ToolGuidanceItem[];
}

/**
 * A tool guidance item in the review plan.
 */
export interface ToolGuidanceItem {
  /** Tool name */
  name: string;
  /** Why this tool should be called */
  reason: string;
  /** Suggested arguments */
  arguments: string;
}

/**
 * Supported programming languages for review rules.
 */
export type ReviewLanguage =
  | 'default'
  | 'typescript'
  | 'javascript'
  | 'java'
  | 'kotlin'
  | 'rust'
  | 'cpp'
  | 'c'
  | 'go'
  | 'python'
  | 'properties'
  | 'json'
  | 'yaml'
  | 'xml'
  | 'arkts';

/**
 * Code review configuration.
 */
export interface CodeReviewConfig {
  /** Enable plan phase (auto-detect if undefined) */
  enablePlanPhase?: boolean;
  /** Enable review filter phase */
  enableFilterPhase: boolean;
  /** Plan phase line threshold (default: 50) */
  planLineThreshold: number;
  /** Maximum tool-calling rounds (default: 30) */
  maxToolRounds: number;
  /** Maximum file read lines (default: 500) */
  maxFileReadLines: number;
  /** Maximum code search results (default: 100) */
  maxSearchResults: number;
  /** Diff context lines (default: 3) */
  diffContextLines: number;
  /** Review mode */
  mode: 'speed' | 'quality' | 'balanced';
  /** Enable MTP hyperthreading */
  enableMTP: boolean;
}

/**
 * Default code review configuration.
 */
export const DEFAULT_CODE_REVIEW_CONFIG: CodeReviewConfig = {
  enableFilterPhase: true,
  planLineThreshold: 50,
  maxToolRounds: 30,
  maxFileReadLines: 500,
  maxSearchResults: 100,
  diffContextLines: 3,
  mode: 'balanced',
  enableMTP: false,
};
