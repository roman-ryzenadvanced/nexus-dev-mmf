// ============================================================
// Diff view — apply + render diffs
// ============================================================

import { diffLines, createPatch } from 'diff';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface DiffResult {
  path: string;
  added: number;
  removed: number;
  patch: string;
  applied: boolean;
}

export async function diffFile(path: string, newContent: string): Promise<DiffResult> {
  const abs = resolve(path);
  const oldContent = await readFile(abs, 'utf8').catch(() => '');
  const patch = createPatch(abs, oldContent, newContent, '', '', {
    context: 3,
  });
  const changes = diffLines(oldContent, newContent);
  let added = 0,
    removed = 0;
  for (const c of changes) {
    if (c.added) added += c.count ?? 0;
    if (c.removed) removed += c.count ?? 0;
  }
  return { path: abs, added, removed, patch, applied: false };
}

export async function applyDiff(path: string, newContent: string): Promise<DiffResult> {
  const diff = await diffFile(path, newContent);
  await writeFile(diff.path, newContent, 'utf8');
  return { ...diff, applied: true };
}
