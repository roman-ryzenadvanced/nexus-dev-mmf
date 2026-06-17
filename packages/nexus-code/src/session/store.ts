// ============================================================
// Session store — persistence to ~/.nexus/sessions/
// ============================================================

import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SESSIONS_DIR } from '../config/schema.js';
import type { Session } from '../types.js';

function sessionPath(name: string): string {
  return join(SESSIONS_DIR, `${name.replace(/[^\w-]+/g, '_')}.json`);
}

// Auto-persist slot — the "current" conversation that survives restarts.
// koda/mimo-style: we continuously save the in-flight session here and
// auto-resume it on the next boot (unless the user passes --new).
const CURRENT_SESSION_NAME = '__current__';
function currentSessionPath(): string {
  return sessionPath(CURRENT_SESSION_NAME);
}

async function ensureSessionsDir(): Promise<void> {
  await mkdir(SESSIONS_DIR, { recursive: true }).catch(() => undefined);
}

/** Persist the live session to the auto-restore slot. Safe to call often. */
export async function saveCurrentSession(session: Session): Promise<void> {
  await ensureSessionsDir();
  const toWrite: Session = { ...session, name: session.name || CURRENT_SESSION_NAME, updatedAt: Date.now() };
  try {
    await writeFile(currentSessionPath(), JSON.stringify(toWrite, null, 2), 'utf8');
  } catch {
    // Non-fatal — auto-save must never crash the TUI.
  }
}

/** Load the auto-restore slot, or null if none / explicitly cleared. */
export async function loadCurrentSession(): Promise<Session | null> {
  try {
    const raw = await readFile(currentSessionPath(), 'utf8');
    const s = JSON.parse(raw) as Session;
    if (!s || !Array.isArray(s.messages)) return null;
    return s;
  } catch {
    return null;
  }
}

/** Drop the auto-restore slot (used by /clear and --new). */
export async function clearCurrentSession(): Promise<void> {
  await unlink(currentSessionPath()).catch(() => undefined);
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
