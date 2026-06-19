import { describe, it, expect } from 'vitest';
import { validateProviderId, validateBaseURL } from '../components/ProviderManager.js';
import { REGISTRY, runSlash } from '../commands/builtin.js';
import type { SlashCommandContext } from '../types.js';
import { newSession } from '../session/store.js';
import type { AppConfig } from '../types.js';

function makeCtx(): SlashCommandContext {
  const config: AppConfig = {
    version: '1.1.0',
    activeProviderId: 'zai',
    activeModelId: 'glm-5.2',
    mode: 'balanced',
    useMMFE: true,
    providers: [
      { id: 'zai', kind: 'zai', name: 'Z.ai', mmfe: true, defaultModel: 'glm-5.2' },
      { id: 'freemodel', kind: 'openai', name: 'FreeModel', baseURL: 'https://api.freemodel.dev/v1', mmfe: false, defaultModel: 'gpt-5.4-mini' },
    ],
    manualModels: [],
    mcpServers: [],
    ui: { theme: 'tech-dark', showRouting: true, showTokens: true, showTimestamps: false },
  };
  return {
    config,
    session: newSession({ providerId: 'zai', modelId: 'glm-5.2', mode: 'balanced', useMMFE: true }),
    setConfig: () => {},
    setSession: () => {},
    pushMessage: () => {},
    clearMessages: () => {},
    saveSession: async () => {},
    loadSession: async () => false,
    fetchModels: async () => [],
    addModel: () => {},
    quit: () => {},
  };
}

describe('validateProviderId', () => {
  const existing = [
    { id: 'zai', kind: 'zai' as const, name: 'Z.ai' },
    { id: 'freemodel', kind: 'openai' as const, name: 'FreeModel' },
  ];

  it('accepts a fresh lowercase id', () => {
    expect(validateProviderId('my-gateway', existing)).toBeNull();
  });
  it('rejects empty input', () => {
    expect(validateProviderId('   ', existing)).not.toBeNull();
  });
  it('normalizes case and rejects structurally-invalid ids', () => {
    // uppercase is normalized to lowercase before validation, so 'My_Gw' → 'my_gw' (valid)
    expect(validateProviderId('My_Gw', existing)).toBeNull();
    // but a leading dash is structurally invalid (must start with [a-z0-9])
    expect(validateProviderId('-bad', existing)).not.toBeNull();
    // a space breaks the char class
    expect(validateProviderId('bad id', existing)).not.toBeNull();
    // a clean id is accepted
    expect(validateProviderId('good-id_2', existing)).toBeNull();
  });
  it('rejects duplicates case-insensitively', () => {
    expect(validateProviderId('FreeModel', existing)).not.toBeNull();
    expect(validateProviderId('zai', existing)).not.toBeNull();
  });
});

describe('validateBaseURL', () => {
  it('accepts a well-formed URL', () => {
    expect(validateBaseURL('https://api.freemodel.dev/v1')).toBeNull();
  });
  it('rejects empty', () => {
    expect(validateBaseURL('')).not.toBeNull();
  });
  it('rejects a non-URL string', () => {
    expect(validateBaseURL('not a url')).not.toBeNull();
    expect(validateBaseURL('api.example.com')).not.toBeNull();
  });
});

describe('provider management — command surface', () => {
  it('provider command is documented with add/remove/edit examples', () => {
    const cmd = REGISTRY.find(c => c.name === 'provider');
    expect(cmd).toBeDefined();
    expect(cmd!.examples).toEqual(expect.arrayContaining(['/provider add', '/provider remove', '/provider edit']));
    expect(cmd!.usage).toContain('add');
    expect(cmd!.usage).toContain('edit');
  });

  it('/provider add|remove|edit surfaces an overlay hint when run directly', async () => {
    for (const sub of ['add', 'remove', 'edit']) {
      const out = await runSlash(`/provider ${sub}`, makeCtx());
      expect(out).toContain('interactive overlay');
    }
  });
});
