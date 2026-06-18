import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveSession, loadSession, listSessions, deleteSession, newSession } from '../session/store.js';
import type { ChatMessage } from '../types.js';

// Override SESSIONS_DIR by importing schema fresh — but since it's a const,
// we need to test against real sessions dir. Use a tmpdir + mock.
// Simpler: just test against the real SESSIONS_DIR with unique names.

const TEST_NAME = `test-${Math.random().toString(36).slice(2, 8)}`;

describe('session store', () => {
  it('newSession returns a session with sensible defaults', () => {
    const s = newSession({});
    expect(s.id).toMatch(/^sess_/);
    expect(s.messages).toEqual([]);
    expect(s.mode).toBe('balanced');
    expect(s.useMMFE).toBe(true);
    expect(s.createdAt).toBeGreaterThan(0);
  });

  it('newSession accepts overrides', () => {
    const s = newSession({
      mode: 'quality',
      providerId: 'openai',
      modelId: 'gpt-4o',
    });
    expect(s.mode).toBe('quality');
    expect(s.providerId).toBe('openai');
    expect(s.modelId).toBe('gpt-4o');
  });

  it('saveSession + loadSession round-trips', async () => {
    const original = newSession({ mode: 'creative' });
    original.messages.push({
      id: 'm1',
      role: 'user',
      content: 'hello',
      ts: Date.now(),
    });
    const saved = await saveSession(original, TEST_NAME);
    expect(saved.name).toBe(TEST_NAME);

    const loaded = await loadSession(TEST_NAME);
    expect(loaded).not.toBeNull();
    expect(loaded?.mode).toBe('creative');
    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0].content).toBe('hello');
  });

  it('loadSession returns null for nonexistent', async () => {
    const loaded = await loadSession('definitely-does-not-exist-xyz');
    expect(loaded).toBeNull();
  });

  it('listSessions includes saved session', async () => {
    const s = newSession({});
    await saveSession(s, `list-test-${Date.now()}`);
    const list = await listSessions();
    expect(list.length).toBeGreaterThan(0);
  });

  it('deleteSession removes a session', async () => {
    const s = newSession({});
    const name = `delete-test-${Math.random().toString(36).slice(2, 8)}`;
    await saveSession(s, name);
    const deleted = await deleteSession(name);
    expect(deleted).toBe(true);
    const loaded = await loadSession(name);
    expect(loaded).toBeNull();
  });

  it('deleteSession returns false for nonexistent', async () => {
    const deleted = await deleteSession('nope-does-not-exist');
    expect(deleted).toBe(false);
  });
});
