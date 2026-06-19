// ============================================================
// Config load / save / merge
// ============================================================

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { appConfigSchema, DEFAULT_PROVIDERS, BUILTIN_MODELS, DEFAULT_CONFIG_PATH, ensureDirs } from './schema.js';
import { loadKeys } from './keys.js';
import type { AppConfig, ModelDescriptor, ProviderConfig } from '../types.js';

const ENV_KEYS: Record<string, { env: string; field: 'apiKey' }> = {
  openai: { env: 'OPENAI_API_KEY', field: 'apiKey' },
  anthropic: { env: 'ANTHROPIC_API_KEY', field: 'apiKey' },
  zai: { env: 'ZAI_API_KEY', field: 'apiKey' },
  // FreeModel (https://api.freemodel.dev) — OpenAI-compatible gateway.
  freemodel: { env: 'FREEMODEL_API_KEY', field: 'apiKey' },
};

function applyEnv(config: AppConfig): AppConfig {
  const providers = config.providers.map(p => {
    const envKey = ENV_KEYS[p.id]?.env;
    if (envKey && process.env[envKey] && !p.apiKey) {
      return { ...p, apiKey: process.env[envKey] };
    }
    return p;
  });
  return { ...config, providers };
}

// Lowest-priority fallback: inject keys saved in the on-disk key store
// (~/.nexus/keys.json, mode 0600). Runs AFTER applyEnv so an explicit env var
// or in-config key always wins, but a previously-entered key is restored on
// every boot even though config.json strips keys at save time.
function applyKeyStore(config: AppConfig): AppConfig {
  const store = loadKeys();
  if (!store || Object.keys(store).length === 0) return config;
  const providers = config.providers.map(p => {
    if (p.apiKey) return p;
    const saved = store[p.id];
    return saved ? { ...p, apiKey: saved } : p;
  });
  return { ...config, providers };
}

function providerHasKey(p: AppConfig['providers'][number]): boolean {
  if (p.kind === 'zai') return true;
  return !!(p.apiKey && p.apiKey.trim().length > 0);
}

function autoDetectActiveProvider(config: AppConfig): AppConfig {
  if (process.env.NEXUS_DEFAULT_PROVIDER) return config;
  const active = config.providers.find(p => p.id === config.activeProviderId);
  if (active && providerHasKey(active)) return config;
  const fallback = config.providers.find(p => providerHasKey(p));
  if (fallback) {
    return {
      ...config,
      activeProviderId: fallback.id,
      activeModelId: config.activeModelId || fallback.defaultModel || '',
    };
  }
  return config;
}

export async function loadConfig(path?: string): Promise<AppConfig> {
  ensureDirs();
  const configPath = path || process.env.NEXUS_CONFIG || DEFAULT_CONFIG_PATH;

  let raw: Partial<AppConfig> = {};
  if (existsSync(configPath)) {
    try {
      raw = JSON.parse(await readFile(configPath, 'utf8'));
    } catch (err) {
      console.error(`Failed to parse config at ${configPath}:`, (err as Error).message);
      console.error('Falling back to defaults.');
    }
  }

  const merged = {
    ...appConfigSchema.parse(raw),
    providers: raw.providers?.length ? raw.providers : DEFAULT_PROVIDERS,
  };
  const withEnvKeys = applyEnv(merged as AppConfig);
  const withKeyStore = applyKeyStore(withEnvKeys);
  return autoDetectActiveProvider(withKeyStore);
}

export async function saveConfig(config: AppConfig, path?: string): Promise<void> {
  ensureDirs();
  const configPath = path || process.env.NEXUS_CONFIG || DEFAULT_CONFIG_PATH;
  // Strip API keys before persisting — never write secrets to disk.
  const safe: AppConfig = {
    ...config,
    providers: config.providers.map(p => ({ ...p, apiKey: undefined })),
  };
  await writeFile(configPath, JSON.stringify(safe, null, 2), 'utf8');
}

export function getActiveProvider(config: AppConfig): ProviderConfig {
  const p = config.providers.find(x => x.id === config.activeProviderId);
  if (!p) throw new Error(`No provider with id "${config.activeProviderId}"`);
  return p;
}

export function getAllModels(config: AppConfig): ModelDescriptor[] {
  const manual = config.manualModels;
  const builtin = BUILTIN_MODELS;
  // Merge: manual wins over builtin, both retained separately for source tracking.
  const seen = new Set<string>();
  const out: ModelDescriptor[] = [];
  for (const m of [...manual, ...builtin]) {
    const key = `${m.providerId}::${m.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m as ModelDescriptor);
  }
  return out;
}
