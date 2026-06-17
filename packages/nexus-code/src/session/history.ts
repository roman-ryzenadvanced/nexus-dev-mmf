// ============================================================
// Input history — persisted to ~/.nexus/history.json
// Survives across sessions. Capped at HISTORY_MAX entries.
// ============================================================

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NEXUS_DIR } from '../config/schema.js';

const HISTORY_PATH = join(NEXUS_DIR, 'history.json');
const HISTORY_MAX = 500;

export interface HistoryEntry {
  text: string;
  ts: number;
  providerId?: string;
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  if (!existsSync(HISTORY_PATH)) return [];
  try {
    const raw = await readFile(HISTORY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as HistoryEntry[];
    return [];
  } catch {
    return [];
  }
}

export async function appendHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const current = await loadHistory();
  // Skip if duplicate of the most recent entry
  if (current.length && current[current.length - 1].text === entry.text) {
    return current;
  }
  const next = [...current, entry].slice(-HISTORY_MAX);
  await writeFile(HISTORY_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export async function clearHistory(): Promise<void> {
  await writeFile(HISTORY_PATH, JSON.stringify([], null, 2), 'utf8');
}

export async function searchHistory(query: string): Promise<HistoryEntry[]> {
  const all = await loadHistory();
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter((e) => e.text.toLowerCase().includes(q));
}
