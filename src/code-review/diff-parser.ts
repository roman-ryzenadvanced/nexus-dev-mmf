/**
 * Nexus-Dev MMFE — Unified Diff Parser
 *
 * Parses unified diff format into structured DiffHunk objects.
 * Handles standard git diff output with file headers and hunk markers.
 *
 * Adapted from Alibaba Open Code Review's diff/parser.go.
 */

import type { DiffHunk, DiffLine } from './types.js';

/**
 * Parse a unified diff string into an array of DiffHunk objects.
 * Supports standard git diff output format.
 */
export function parseDiff(diffText: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = diffText.split('\n');
  let currentPath = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect file path from diff header
    if (line.startsWith('--- a/') || line.startsWith('--- /dev/null')) {
      // Next line should be +++ b/path
      if (i + 1 < lines.length) {
        const plusLine = lines[i + 1];
        if (plusLine.startsWith('+++ b/')) {
          currentPath = plusLine.slice(6);
        } else if (plusLine.startsWith('+++ /dev/null')) {
          currentPath = '';
        }
      }
      i++;
      continue;
    }

    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (hunkMatch) {
      const oldStart = parseInt(hunkMatch[1], 10);
      const oldCount = parseInt(hunkMatch[2] ?? '1', 10);
      const newStart = parseInt(hunkMatch[3], 10);
      const newCount = parseInt(hunkMatch[4] ?? '1', 10);

      const hunkLines: DiffLine[] = [];
      let oldLineNo = oldStart;
      let newLineNo = newStart;
      i++;

      // Parse hunk body
      while (i < lines.length) {
        const hline = lines[i];
        // Stop at next hunk header or file header
        if (hline.startsWith('@@') || hline.startsWith('diff --git') || hline.startsWith('--- ') || hline.startsWith('+++ ')) {
          break;
        }

        if (hline.startsWith('+')) {
          hunkLines.push({
            type: 'added',
            content: hline.slice(1),
            newLineNo,
          });
          newLineNo++;
        } else if (hline.startsWith('-')) {
          hunkLines.push({
            type: 'removed',
            content: hline.slice(1),
            oldLineNo,
          });
          oldLineNo++;
        } else if (hline.startsWith(' ') || hline === '') {
          // Context line (or empty line at end of hunk)
          if (hline === '' && i === lines.length - 1) break;
          hunkLines.push({
            type: 'context',
            content: hline.startsWith(' ') ? hline.slice(1) : '',
            newLineNo,
            oldLineNo,
          });
          oldLineNo++;
          newLineNo++;
        } else if (hline.startsWith('\\')) {
          // "\ No newline at end of file" — skip
        } else {
          break;
        }
        i++;
      }

      hunks.push({
        path: currentPath,
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: hunkLines,
      });
      continue;
    }

    i++;
  }

  return hunks;
}

/**
 * Extract the list of changed file paths from a diff.
 */
export function getChangedFiles(diffText: string): string[] {
  const files: string[] = [];
  const lines = diffText.split('\n');

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      const path = line.slice(6).trim();
      if (path && path !== '/dev/null') {
        files.push(path);
      }
    }
  }

  return [...new Set(files)];
}

/**
 * Get hunks for a specific file path.
 */
export function getHunksForFile(hunks: DiffHunk[], filePath: string): DiffHunk[] {
  return hunks.filter(h => h.path === filePath);
}

/**
 * Get the added lines from a hunk (new code only).
 */
export function getAddedLines(hunk: DiffHunk): DiffLine[] {
  return hunk.lines.filter(l => l.type === 'added');
}

/**
 * Get the total number of changed lines (added + removed) across all hunks.
 */
export function getTotalChangedLines(hunks: DiffHunk[]): number {
  return hunks.reduce((sum, h) => sum + h.lines.filter(l => l.type === 'added' || l.type === 'removed').length, 0);
}

/**
 * Find the line number of a code snippet in the diff.
 * Tries to match against new-file lines first, then falls back to old-file lines.
 * Returns { startLine, endLine } or null if not found.
 */
export function findCodeInDiff(hunks: DiffHunk[], filePath: string, codeSnippet: string): { startLine: number; endLine: number } | null {
  const fileHunks = getHunksForFile(hunks, filePath);
  const snippetLines = codeSnippet.split('\n').map(l => l.trim());

  for (const hunk of fileHunks) {
    // Try matching against new-file lines (added + context)
    const newLines = hunk.lines.filter(l => l.type !== 'removed');
    for (let i = 0; i <= newLines.length - snippetLines.length; i++) {
      let match = true;
      for (let j = 0; j < snippetLines.length; j++) {
        if (newLines[i + j].content.trim() !== snippetLines[j]) {
          match = false;
          break;
        }
      }
      if (match && newLines[i].newLineNo !== undefined) {
        const startLine = newLines[i].newLineNo!;
        const lastMatchedLine = newLines[i + snippetLines.length - 1];
        const endLine = lastMatchedLine.newLineNo ?? startLine;
        return { startLine, endLine };
      }
    }
  }

  return null;
}

/**
 * Get a diff for a specific file (reconstructed from hunks).
 */
export function getFileDiff(hunks: DiffHunk[], filePath: string): string {
  const fileHunks = getHunksForFile(hunks, filePath);
  if (fileHunks.length === 0) return '';

  let output = `--- a/${filePath}\n+++ b/${filePath}\n`;
  for (const hunk of fileHunks) {
    output += `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
    for (const line of hunk.lines) {
      const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
      output += `${prefix}${line.content}\n`;
    }
  }

  return output;
}
