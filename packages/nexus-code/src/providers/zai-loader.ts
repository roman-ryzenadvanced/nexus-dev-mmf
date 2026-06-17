// ============================================================
// z-ai-web-dev-sdk loader — shared config + endpoint-probing helper
//
// Centralizes the fixes that make the ZAI provider actually boot:
//   #1 Correct endpoint URL with primary + fallback
//   #2 Auto-create ~/.z-ai-config when missing/invalid
//   #3 Dynamic SDK import (no top-level static import crash)
//   #4 Endpoint probe: 401/403 means "endpoint is up, needs auth",
//      NOT "endpoint down" — only fall back on 5xx / network failure
//   #6 Reusable loader with client caching
//
// The z-ai-web-dev-sdk reads `.z-ai-config` from (cwd, home, /etc) and
// requires `{ baseUrl, apiKey }`. It then POSTs to `${baseUrl}/chat/completions`.
// ============================================================

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

/** Primary coding endpoint (Fix #1). */
export const ZAI_PRIMARY_BASE_URL = 'https://open.bigmodel.cn/api/coding/paas/v4';

/** Fallback coding endpoint (Fix #1). */
export const ZAI_FALLBACK_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

/** Where the SDK looks for config. We write the home-dir copy. */
export const ZAI_CONFIG_PATH = join(homedir(), '.z-ai-config');

interface ZAIConfigFile {
  baseUrl?: string;
  apiKey?: string;
  // Informational only — the SDK has no built-in failover, but we keep the
  // fallback URL around so humans reading the file know it exists.
  _fallbackBaseUrl?: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

/** Minimal shape of the SDK instance we depend on. */
interface ZAIClient {
  chat: {
    completions: {
      create: (body: Record<string, unknown>) => Promise<unknown>;
    };
  };
}
interface ZAISDKModule {
  default: { create: () => Promise<ZAIClient> };
}

let cachedClient: ZAIClient | null = null;
let cachedBaseUrl: string | null = null;

/** Drop the cached client (useful when switching keys/endpoints or in tests). */
export function clearZAIClientCache(): void {
  cachedClient = null;
  cachedBaseUrl = null;
}

/** The baseUrl used by the most recent successful loadZAIClient() call. */
export function getActiveBaseUrl(): string | null {
  return cachedBaseUrl;
}

/**
 * Resolve an API key from: explicit arg → ZAI_API_KEY env → existing config.
 * Throws if none is available (the SDK would otherwise crash opaquely).
 */
export function resolveApiKey(explicit?: string): string {
  if (explicit) return explicit;
  const env = process.env.ZAI_API_KEY;
  if (env) return env;
  const existing = readExistingConfig();
  if (existing?.apiKey) return existing.apiKey;
  throw new Error(
    'No ZAI API key found. Set ZAI_API_KEY, pass an apiKey, or put ' +
      '"apiKey" in ~/.z-ai-config.'
  );
}

function readExistingConfig(): ZAIConfigFile | null {
  if (!existsSync(ZAI_CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(ZAI_CONFIG_PATH, 'utf8')) as ZAIConfigFile;
  } catch {
    return null;
  }
}

/**
 * Ensure ~/.z-ai-config exists with a valid baseUrl + apiKey (Fix #2).
 * Writes only when missing, or when baseUrl/apiKey are absent/blank.
 * Never throws on an existing valid file.
 */
export function ensureZAIConfig(opts: { apiKey: string; baseUrl: string }): void {
  const existing = readExistingConfig();
  const needsWrite =
    !existing ||
    !existing.baseUrl ||
    !existing.apiKey ||
    existing.baseUrl !== opts.baseUrl;

  if (!needsWrite) return;

  const next: ZAIConfigFile = {
    ...(existing || {}),
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    _fallbackBaseUrl: ZAI_FALLBACK_BASE_URL,
  };
  writeFileSync(ZAI_CONFIG_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
  try {
    chmodSync(ZAI_CONFIG_PATH, 0o600);
  } catch {
    // chmod can fail on some platforms/permission setups — non-fatal.
  }
}

/**
 * Probe an endpoint (Fix #4). Returns the HTTP status, or null on a network
 * failure / non-HTTP error. We send an intentionally-bad tiny request; ANY
 * HTTP response (even 400/401/403) means the endpoint is reachable and alive.
 */
export async function probeEndpoint(
  baseUrl: string,
  apiKey: string,
  timeoutMs = 4000
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4.5-flash',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
    return res.status;
  } catch {
    // Network failure, DNS, abort, TLS — treat as "endpoint unreachable".
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pick the working baseUrl (Fix #1 + #4). Probe the primary; only fall back
 * to the secondary on a 5xx response or a network failure. 401/403/400 mean
 * the endpoint is up (just needs valid auth/payload) → keep primary.
 */
export async function selectBaseUrl(apiKey: string): Promise<string> {
  const primaryStatus = await probeEndpoint(ZAI_PRIMARY_BASE_URL, apiKey);
  // Any HTTP status < 500 means the server responded → primary is alive.
  if (primaryStatus !== null && primaryStatus < 500) {
    return ZAI_PRIMARY_BASE_URL;
  }
  // Primary returned 5xx or was unreachable → try fallback.
  const fallbackStatus = await probeEndpoint(ZAI_FALLBACK_BASE_URL, apiKey);
  if (fallbackStatus !== null && fallbackStatus < 500) {
    return ZAI_FALLBACK_BASE_URL;
  }
  // Both unreachable/5xx — default to primary so a later call surfaces a real
  // auth/connectivity error rather than silently switching.
  return ZAI_PRIMARY_BASE_URL;
}

/**
 * Load (and cache) a configured ZAI SDK client (Fix #3 + #6).
 * Ensures config exists, selects a healthy endpoint, and dynamically imports
 * the SDK so a missing/unconfigured SDK never crashes the process at load.
 */
export async function loadZAIClient(explicitApiKey?: string): Promise<ZAIClient> {
  if (cachedClient) return cachedClient;

  const apiKey = resolveApiKey(explicitApiKey);
  const baseUrl = await selectBaseUrl(apiKey);
  ensureZAIConfig({ apiKey, baseUrl });

  try {
    const mod = (await import('z-ai-web-dev-sdk')) as unknown as ZAISDKModule;
    cachedClient = await mod.default.create();
    cachedBaseUrl = baseUrl;
    return cachedClient;
  } catch (err) {
    throw new Error(
      `Failed to load z-ai-web-dev-sdk against ${baseUrl}: ` +
        `${(err as Error).message}. Run: npm install z-ai-web-dev-sdk`
    );
  }
}
