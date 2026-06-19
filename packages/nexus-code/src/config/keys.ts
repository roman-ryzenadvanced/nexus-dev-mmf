// ============================================================
// keys.ts — on-disk API-key store for Nexus Code providers.
//
// API keys are NEVER written to config.json (saveConfig strips them). Instead
// we keep them here, in ~/.nexus/keys.json, created with mode 0600 so only the
// owner can read them. Keys are loaded at startup and merged into each
// provider's config (lowest priority: explicit config > env var > key store).
//
// The file shape is `{ "<providerId>": "<apiKey>", ... }`.
// ============================================================

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { NEXUS_DIR } from './schema.js';

export const KEYS_PATH = join(NEXUS_DIR, 'keys.json');

/** Read every saved key. Returns {} if the store doesn't exist / is corrupt. */
export function loadKeys(): Record<string, string> {
  try {
    if (!existsSync(KEYS_PATH)) return {};
    const raw = readFileSync(KEYS_PATH, 'utf8').trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
    return {};
  } catch {
    return {};
  }
}

/** Read a single provider's key, or undefined. */
export function getKey(providerId: string): string | undefined {
  return loadKeys()[providerId];
}

export function hasKey(providerId: string): boolean {
  const k = getKey(providerId);
  return !!(k && k.trim().length > 0);
}

/**
 * Persist a key for a provider. Writes with mode 0600 (owner-only). Safe to
 * call repeatedly; overwrites the single entry for that provider. Trims
 * whitespace because users paste keys with trailing newlines.
 */
export function saveKey(providerId: string, apiKey: string): void {
  if (!existsSync(NEXUS_DIR)) mkdirSync(NEXUS_DIR, { recursive: true });
  const keys = loadKeys();
  keys[providerId] = apiKey.trim();
  writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2) + '\n', 'utf8');
  try {
    chmodSync(KEYS_PATH, 0o600);
  } catch {
    // chmod can fail on some filesystems / when running as non-owner; the file
    // still exists and is usable. Best-effort only.
  }
}

/** Remove a single provider's key (e.g. when the user invalidates it). */
export function clearKey(providerId: string): void {
  const keys = loadKeys();
  if (!(providerId in keys)) return;
  delete keys[providerId];
  writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2) + '\n', 'utf8');
  try {
    chmodSync(KEYS_PATH, 0o600);
  } catch {
    /* best-effort */
  }
}

// NOTE: NEXUS_DIR import keeps the store path consistent with config.json.
void homedir;
