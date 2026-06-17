/**
 * Shared ZAI SDK loader with auto-config.
 *
 * The z-ai-web-dev-sdk requires a .z-ai-config file with baseUrl + apiKey
 * before ZAI.create() can succeed. This helper:
 *   1. Checks if a valid config already exists
 *   2. If not, auto-creates ~/.z-ai-config using the Z.ai coding endpoints
 *      with ZAI_API_KEY from the environment
 *   3. Dynamically imports the SDK and calls ZAI.create()
 *
 * Coding endpoints (with fallback):
 *   Primary:   https://open.bigmodel.cn/api/coding/paas/v4
 *   Fallback:  https://api.z.ai/api/coding/paas/v4
 */

const ZAI_CODING_BASE_PRIMARY = 'https://open.bigmodel.cn/api/coding/paas/v4';
const ZAI_CODING_BASE_FALLBACK = 'https://api.z.ai/api/coding/paas/v4';

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

let _cachedClient: ZAIClient | null = null;

async function ensureSDKConfig(): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const os = await import('node:os');

  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
  ];

  for (const filePath of configPaths) {
    try {
      const configStr = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(configStr);
      if (config.baseUrl && config.apiKey) return;
    } catch {
      // continue
    }
  }

  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) return;

  let baseUrl = ZAI_CODING_BASE_PRIMARY;
  try {
    const probe = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    // 401/403 means the endpoint exists but requires auth — still valid.
    // Only fall back on 5xx (server error) or network failures.
    if (probe.status >= 500) baseUrl = ZAI_CODING_BASE_FALLBACK;
  } catch {
    baseUrl = ZAI_CODING_BASE_FALLBACK;
  }

  const configPath = path.join(os.homedir(), '.z-ai-config');
  await fs.writeFile(configPath, JSON.stringify({ baseUrl, apiKey }, null, 2), 'utf-8');
}

/**
 * Load and create a ZAI SDK client with auto-config.
 * Caches the client for reuse across calls.
 */
export async function loadZAIClient(): Promise<ZAIClient> {
  if (_cachedClient) return _cachedClient;
  await ensureSDKConfig();
  const mod = (await import('z-ai-web-dev-sdk')) as unknown as ZAISDKModule;
  _cachedClient = await mod.default.create();
  return _cachedClient;
}

/**
 * Clear the cached ZAI client (useful for testing or re-initialization).
 */
export function clearZAIClientCache(): void {
  _cachedClient = null;
}
