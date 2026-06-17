// ============================================================
// Filesystem tools — read/write context files
// ============================================================

import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { existsSync } from 'node:fs';

export async function readContextFile(path: string, maxBytes = 200_000): Promise<string> {
  const abs = resolve(path);
  if (!existsSync(abs)) throw new Error(`File not found: ${path}`);
  const s = await stat(abs);
  if (s.size > maxBytes) {
    throw new Error(`File too large (${s.size} bytes > ${maxBytes} max): ${path}`);
  }
  return readFile(abs, 'utf8');
}

export async function writeContextFile(path: string, content: string): Promise<void> {
  const abs = resolve(path);
  await writeFile(abs, content, 'utf8');
}

export function summarizePath(rootDir: string, path: string): string {
  return relative(rootDir, path) || path;
}
