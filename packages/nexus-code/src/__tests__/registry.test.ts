import { describe, it, expect } from 'vitest';
import { buildRegistry, addManualModel, removeManualModel, findModel } from '../models/registry.js';
import { BUILTIN_MODELS } from '../config/schema.js';
import type { AppConfig, ModelDescriptor } from '../types.js';

const BASE_CONFIG: AppConfig = {
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
  ],
  manualModels: [],
  mcpServers: [],
  ui: {
    theme: 'tech-dark',
    showRouting: true,
    showTokens: true,
    showTimestamps: false,
  },
};

describe('model registry', () => {
  it('buildRegistry returns builtin models when no manual/auto', () => {
    const reg = buildRegistry(BASE_CONFIG, []);
    expect(reg.flat.length).toBeGreaterThanOrEqual(6); // 6 builtin GLMs
    expect(reg.byProvider['zai'].length).toBe(6);
  });

  it('buildRegistry merges auto-fetched models with builtin', () => {
    const autoFetched: ModelDescriptor[] = [
      { id: 'gpt-4o', providerId: 'openai', label: 'GPT-4o', source: 'auto' },
      { id: 'glm-5.2', providerId: 'zai', label: 'GLM 5.2', source: 'auto' },
    ];
    const reg = buildRegistry(BASE_CONFIG, autoFetched);
    const ids = reg.flat.map(m => m.id).sort();
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('glm-5.2');
    // glm-5.2 should appear once (auto wins over builtin, no dupes)
    const glm52 = reg.flat.filter(m => m.id === 'glm-5.2');
    expect(glm52).toHaveLength(1);
    expect(glm52[0].source).toBe('auto');
  });

  it('addManualModel adds new model', () => {
    const next = addManualModel(BASE_CONFIG, 'openai', 'gpt-4o-mini', 'GPT-4o mini');
    expect(next.manualModels).toHaveLength(1);
    expect(next.manualModels[0].id).toBe('gpt-4o-mini');
    expect(next.manualModels[0].source).toBe('manual');
  });

  it('addManualModel is idempotent (no duplicate)', () => {
    const once = addManualModel(BASE_CONFIG, 'openai', 'gpt-4o-mini');
    const twice = addManualModel(once, 'openai', 'gpt-4o-mini');
    expect(twice.manualModels).toHaveLength(1);
  });

  it('removeManualModel removes a model', () => {
    const withModel = addManualModel(BASE_CONFIG, 'openai', 'gpt-4o-mini');
    const removed = removeManualModel(withModel, 'openai', 'gpt-4o-mini');
    expect(removed.manualModels).toHaveLength(0);
  });

  it('findModel locates a model by provider + id', () => {
    const reg = buildRegistry(BASE_CONFIG, []);
    const found = findModel(reg, 'zai', 'glm-5.2');
    expect(found).toBeDefined();
    expect(found?.id).toBe('glm-5.2');
  });

  it('findModel returns undefined for nonexistent', () => {
    const reg = buildRegistry(BASE_CONFIG, []);
    expect(findModel(reg, 'zai', 'nonexistent')).toBeUndefined();
  });

  it('BUILTIN_MODELS all belong to a known provider', () => {
    for (const m of BUILTIN_MODELS) {
      expect(['zai', 'freemodel']).toContain(m.providerId);
    }
  });
});
