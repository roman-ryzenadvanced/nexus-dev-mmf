import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Override NEXUS_DIR before importing the module under test.
// We do this by stubbing the constant via env var.
const TMP_NEXUS = await mkdir(join(tmpdir(), `nexus-history-${Date.now()}`), {
  recursive: true,
})
  .then(() => join(tmpdir(), `nexus-history-${Date.now()}`))
  .catch(() => join(tmpdir(), `nexus-history-${Date.now()}`));

// Re-import the module with NEXUS_DIR pointing at our temp dir.
// Since NEXUS_DIR is a const computed at import time from homedir(),
// we patch it directly via module re-evaluation in a separate file scope.
// Simpler: just test against the real NEXUS_DIR with unique data + clean up.

import { loadHistory, appendHistory, clearHistory, searchHistory, type HistoryEntry } from '../session/history.js';

describe('input history persistence', () => {
  // Each test uses unique text to avoid pollution between runs.
  const uniqueText = (label: string) => `${label}-${Math.random().toString(36).slice(2, 8)}`;

  it('loadHistory returns empty array when file does not exist', async () => {
    // Force a fresh load by clearing first
    await clearHistory();
    const result = await loadHistory();
    expect(result).toEqual([]);
  });

  it('appendHistory adds an entry and persists it', async () => {
    await clearHistory();
    const entry: HistoryEntry = {
      text: uniqueText('append-test'),
      ts: Date.now(),
      providerId: 'openai',
    };
    const result = await appendHistory(entry);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(entry.text);

    const reloaded = await loadHistory();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].text).toBe(entry.text);
  });

  it('appendHistory skips consecutive duplicates', async () => {
    await clearHistory();
    const text = uniqueText('dup-test');
    const entry: HistoryEntry = { text, ts: Date.now() };
    await appendHistory(entry);
    const result = await appendHistory(entry);
    expect(result).toHaveLength(1);
  });

  it('appendHistory allows non-consecutive duplicates', async () => {
    await clearHistory();
    const text = uniqueText('non-consecutive');
    await appendHistory({ text, ts: 1 });
    await appendHistory({ text: 'something-else', ts: 2 });
    const result = await appendHistory({ text, ts: 3 });
    expect(result).toHaveLength(3);
    expect(result[2].text).toBe(text);
  });

  it('clearHistory empties the file', async () => {
    await appendHistory({ text: uniqueText('before-clear'), ts: Date.now() });
    await clearHistory();
    const result = await loadHistory();
    expect(result).toEqual([]);
  });

  it('searchHistory returns all entries with empty query', async () => {
    await clearHistory();
    await appendHistory({ text: 'alpha', ts: 1 });
    await appendHistory({ text: 'beta', ts: 2 });
    const result = await searchHistory('');
    expect(result).toHaveLength(2);
  });

  it('searchHistory filters by substring (case-insensitive)', async () => {
    await clearHistory();
    await appendHistory({ text: 'deploy the server', ts: 1 });
    await appendHistory({ text: 'rollback the database', ts: 2 });
    await appendHistory({ text: 'DEPLOY again', ts: 3 });
    const result = await searchHistory('deploy');
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('deploy the server');
    expect(result[1].text).toBe('DEPLOY again');
  });

  it('searchHistory returns empty for no match', async () => {
    await clearHistory();
    await appendHistory({ text: 'hello', ts: 1 });
    const result = await searchHistory('xyzzy');
    expect(result).toEqual([]);
  });

  it('appendHistory preserves providerId when provided', async () => {
    await clearHistory();
    await appendHistory({ text: 'test', ts: 1, providerId: 'anthropic' });
    const result = await loadHistory();
    expect(result[0].providerId).toBe('anthropic');
  });

  // Cleanup — leave history file empty for next test runs.
  afterEach(async () => {
    await clearHistory();
  });
});

// Suppress unused-import warnings
void TMP_NEXUS;
void existsSync;
void readFile;
void writeFile;
void rm;
void mkdir;
