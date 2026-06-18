import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, getActiveProvider, getAllModels } from '../config/index.js';
import { appConfigSchema, DEFAULT_PROVIDERS, BUILTIN_MODELS } from '../config/schema.js';
import type { AppConfig } from '../types.js';

const SAMPLE_CONFIG: AppConfig = {
  version: '1.1.0',
  activeProviderId: 'zai',
  activeModelId: 'glm-5.2',
  mode: 'balanced',
  useMMFE: true,
  providers: [
    {
      id: 'zai',
      kind: 'zai',
      name: 'Z.ai',
      mmfe: true,
      defaultModel: 'glm-5.2',
    },
    {
      id: 'openai',
      kind: 'openai',
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      mmfe: false,
      defaultModel: 'gpt-4o',
    },
    {
      id: 'anthropic',
      kind: 'anthropic',
      name: 'Anthropic',
      baseURL: 'https://api.anthropic.com',
      mmfe: false,
      defaultModel: 'claude-3-5-sonnet-20241022',
    },
  ],
  manualModels: [
    {
      id: 'custom-model',
      providerId: 'openai',
      label: 'Custom',
      source: 'manual',
    },
  ],
  mcpServers: [],
  ui: {
    theme: 'tech-dark',
    showRouting: true,
    showTokens: true,
    showTimestamps: false,
  },
};

describe('config schema', () => {
  it('parses a valid config', () => {
    const parsed = appConfigSchema.parse(SAMPLE_CONFIG);
    expect(parsed.version).toBe('1.1.0');
    expect(parsed.mode).toBe('balanced');
    expect(parsed.useMMFE).toBe(true);
  });

  it('fills defaults for missing fields', () => {
    const parsed = appConfigSchema.parse({});
    expect(parsed.version).toBe('1.1.0');
    expect(parsed.mode).toBe('balanced');
    expect(parsed.useMMFE).toBe(true);
    expect(parsed.providers).toEqual([]);
    expect(parsed.manualModels).toEqual([]);
    expect(parsed.ui.theme).toBe('tech-dark');
  });

  it('rejects an invalid mode', () => {
    expect(() => appConfigSchema.parse({ mode: 'turbo' })).toThrow();
  });

  it('rejects an invalid provider kind', () => {
    expect(() =>
      appConfigSchema.parse({
        providers: [{ id: 'x', kind: 'gemini', name: 'Gemini' }],
      })
    ).toThrow();
  });

  it('DEFAULT_PROVIDERS has the expected entries', () => {
    expect(DEFAULT_PROVIDERS.length).toBeGreaterThanOrEqual(3);
    const ids = DEFAULT_PROVIDERS.map(p => p.id).sort();
    expect(ids).toEqual(['anthropic', 'freemodel', 'openai', 'zai']);
  });

  it('BUILTIN_MODELS has 6 GLM models', () => {
    expect(BUILTIN_MODELS).toHaveLength(6);
    for (const m of BUILTIN_MODELS) {
      expect(m.providerId).toBe('zai');
      expect(m.id).toMatch(/^glm-/);
    }
  });
});

describe('config load/save', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'nexus-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', async () => {
    const configPath = join(tmpDir, 'config.json');
    const config = await loadConfig(configPath);
    expect(config.activeProviderId).toBe('zai');
    expect(config.mode).toBe('balanced');
    expect(config.providers.length).toBeGreaterThanOrEqual(3);
  });

  it('round-trips save → load', async () => {
    const configPath = join(tmpDir, 'config.json');
    await saveConfig(SAMPLE_CONFIG, configPath);
    const loaded = await loadConfig(configPath);
    expect(loaded.activeProviderId).toBe('zai');
    expect(loaded.activeModelId).toBe('glm-5.2');
    expect(loaded.manualModels).toHaveLength(1);
    expect(loaded.manualModels[0].id).toBe('custom-model');
  });

  it('strips API keys when saving', async () => {
    const configPath = join(tmpDir, 'config.json');
    const withKeys: AppConfig = {
      ...SAMPLE_CONFIG,
      providers: SAMPLE_CONFIG.providers.map(p => ({
        ...p,
        apiKey: 'sk-secret-must-not-persist',
      })),
    };
    await saveConfig(withKeys, configPath);
    const raw = JSON.parse(await readFile(configPath, 'utf8')) as AppConfig;
    for (const p of raw.providers) {
      expect(p.apiKey).toBeUndefined();
    }
  });

  it('falls back to defaults on corrupt JSON', async () => {
    const configPath = join(tmpDir, 'config.json');
    await writeFile(configPath, '{ not valid json', 'utf8');
    const config = await loadConfig(configPath);
    expect(config.activeProviderId).toBe('zai');
  });

  it('merges env vars for API keys', async () => {
    process.env.OPENAI_API_KEY = 'sk-from-env';
    const configPath = join(tmpDir, 'config.json');
    await saveConfig(SAMPLE_CONFIG, configPath);
    const loaded = await loadConfig(configPath);
    const openai = loaded.providers.find(p => p.id === 'openai');
    expect(openai?.apiKey).toBe('sk-from-env');
    delete process.env.OPENAI_API_KEY;
  });
});

describe('config helpers', () => {
  it('getActiveProvider returns the active one', () => {
    const p = getActiveProvider(SAMPLE_CONFIG);
    expect(p.id).toBe('zai');
    expect(p.kind).toBe('zai');
  });

  it('getActiveProvider throws for unknown id', () => {
    const bad: AppConfig = {
      ...SAMPLE_CONFIG,
      activeProviderId: 'nonexistent',
    };
    expect(() => getActiveProvider(bad)).toThrow();
  });

  it('getAllModels merges manual + builtin', () => {
    const all = getAllModels(SAMPLE_CONFIG);
    const ids = all.map(m => m.id).sort();
    expect(ids).toContain('custom-model');
    expect(ids).toContain('glm-5.2');
    expect(ids).toContain('glm-4.7');
  });
});
