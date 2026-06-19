import { describe, expect, it } from 'vitest';
import { buildSettingsOptions } from '../components/settings-options.js';
import type { AppConfig } from '../types.js';

const config: AppConfig = {
  version: '1.1.0',
  activeProviderId: 'freemodel',
  activeModelId: 'gpt-5.4-mini',
  mode: 'quality',
  useMMFE: true,
  providers: [
    { id: 'zai', kind: 'zai', name: 'Z.ai', mmfe: true, defaultModel: 'glm-5.2' },
    { id: 'freemodel', kind: 'openai', name: 'FreeModel', baseURL: 'https://api.freemodel.dev/v1', defaultModel: 'gpt-5.4-mini' },
  ],
  manualModels: [],
  ui: { theme: 'tech-dark', showRouting: true, showTokens: true },
};

describe('buildSettingsOptions', () => {
  it('surfaces all scrollable settings actions', () => {
    const options = buildSettingsOptions(config);
    expect(options.map(o => o.id)).toEqual([
      'provider-switch',
      'provider-manage',
      'model',
      'mode',
      'theme',
    ]);
  });

  it('includes current values in option details', () => {
    const options = buildSettingsOptions(config);
    expect(options.find(o => o.id === 'provider-switch')?.detail).toContain('freemodel');
    expect(options.find(o => o.id === 'model')?.detail).toContain('gpt-5.4-mini');
    expect(options.find(o => o.id === 'mode')?.detail).toContain('quality');
    expect(options.find(o => o.id === 'theme')?.detail).toContain('tech-dark');
  });
});
