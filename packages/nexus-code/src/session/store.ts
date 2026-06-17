// ============================================================
// Session store — persistence to ~/.nexus/sessions/
// ============================================================

import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { SESSIONS_DIR } from '../config/schema.js';
import type { Session } from '../types.js';

function sessionPath(name: string): string {
  return join(SESSIONS_DIR, `${name.replace(/[^\w-]+/g, '_')}.json`);
}

export async function saveSession(session: Session, name?: string): Promise<Session> {
  const named = name ? { ...session, name, updatedAt: Date.now() } : session;
  await writeFile(sessionPath(named.name || named.id), JSON.stringify(named, null, 2), 'utf8');
  return named;
}

export async function loadSession(name: string): Promise<Session | null> {
  try {
    const raw = await readFile(sessionPath(name), 'utf8');
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<Array<{ name: string; updatedAt: number }>> {
  const files = await readdir(SESSIONS_DIR).catch(() => []);
  const out: Array<{ name: string; updatedAt: number }> = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await readFile(join(SESSIONS_DIR, f), 'utf8');
      const s = JSON.parse(raw) as Session;
      out.push({ name: s.name || s.id, updatedAt: s.updatedAt });
    } catch {
      // skip corrupted
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteSession(name: string): Promise<boolean> {
  try {
    await unlink(sessionPath(name));
    return true;
  } catch {
    return false;
  }
}

export function newSession(opts: Partial<Session>): Session {
  return {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    providerId: 'zai',
    modelId: 'glm-5.2',
    mode: 'balanced',
    useMMFE: true,
    ...opts,
  };
}
