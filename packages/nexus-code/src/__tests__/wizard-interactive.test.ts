import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { runWizard, configExists, ensureConfigDir } from '../wizard.js';

// Mock readline for interactive mode tests
vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((q: string, cb: (answer: string) => void) => {
      // Echo the question for assertion, then return canned answers
      const answers: Record<string, string> = {
        'Default provider [zai]: ': 'openai',
        'Default model [gpt-4o]: ': 'gpt-4o-mini',
        'MMFE mode (speed|balanced|quality|creative) [balanced]: ': 'quality',
        'Enable MMFE orchestrator? [Y/n]: ': 'n',
        'Theme (tech-dark|editorial-light|hacker-terminal) [tech-dark]: ': 'hacker-terminal',
        'Config already exists at': 'n', // overwrite prompt
      };
      cb(answers[q] || '');
    }),
    close: vi.fn(),
  })),
}));

describe('config wizard — interactive mode (mocked readline)', () => {
  let tmpConfigPath: string;

  beforeEach(async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'nexus-wizard-int-'));
    tmpConfigPath = join(tmp, 'config.json');
  });

  afterEach(async () => {
    const dir = require('node:path').dirname(tmpConfigPath);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  it('prompts the user and writes their choices', async () => {
    const summary = await runWizard({ configPath: tmpConfigPath });
    expect(summary).toContain('Config written');

    const raw = await readFile(tmpConfigPath, 'utf8');
    const cfg = JSON.parse(raw);
    // Should reflect the mocked answers
    expect(cfg.activeProviderId).toBe('openai');
    expect(cfg.activeModelId).toBe('gpt-4o-mini');
    expect(cfg.mode).toBe('quality');
    expect(cfg.useMMFE).toBe(false);
    expect(cfg.ui.theme).toBe('hacker-terminal');
  });

  it('refuses overwrite when user says no', async () => {
    // Create the file first
    await writeFile(tmpConfigPath, '{"existing":true}', 'utf8');
    const summary = await runWizard({ configPath: tmpConfigPath });
    // The mocked readline returns 'n' for the overwrite prompt
    // (key starts with 'Config already exists at')
    expect(summary).toMatch(/Aborted|already exists/);
    // File should be unchanged
    const raw = await readFile(tmpConfigPath, 'utf8');
    expect(raw).toBe('{"existing":true}');
  });
});

describe('config wizard — edge cases', () => {
  it('configExists returns a boolean', () => {
    expect(typeof configExists()).toBe('boolean');
  });

  it('ensureConfigDir does not throw', () => {
    expect(() => ensureConfigDir()).not.toThrow();
  });

  it('non-interactive mode writes valid JSON with all default providers', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'nexus-wizard-edge-'));
    const cfgPath = join(tmp, 'config.json');
    try {
      await runWizard({ nonInteractive: true, configPath: cfgPath });
      const raw = await readFile(cfgPath, 'utf8');
      const cfg = JSON.parse(raw);
      expect(cfg.providers.length).toBeGreaterThanOrEqual(3);
      const ids = cfg.providers.map((p: { id: string }) => p.id).sort();
      expect(ids).toEqual(['anthropic', 'freemodel', 'openai', 'zai']);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('non-interactive mode refuses to overwrite existing config', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'nexus-wizard-overwrite-'));
    const cfgPath = join(tmp, 'config.json');
    await writeFile(cfgPath, '{"existing":true}', 'utf8');
    try {
      const summary = await runWizard({
        nonInteractive: true,
        configPath: cfgPath,
      });
      expect(summary).toContain('already exists');
      const raw = await readFile(cfgPath, 'utf8');
      expect(raw).toBe('{"existing":true}');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('non-interactive mode does not write API keys', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'nexus-wizard-keys-'));
    const cfgPath = join(tmp, 'config.json');
    process.env.OPENAI_API_KEY = 'sk-test-do-not-leak';
    try {
      await runWizard({ nonInteractive: true, configPath: cfgPath });
      const raw = await readFile(cfgPath, 'utf8');
      expect(raw).not.toContain('sk-test-do-not-leak');
      const cfg = JSON.parse(raw);
      for (const p of cfg.providers) {
        expect(p.apiKey).toBeUndefined();
      }
    } finally {
      delete process.env.OPENAI_API_KEY;
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('non-interactive mode includes builtin GLM models for zai provider', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'nexus-wizard-builtin-'));
    const cfgPath = join(tmp, 'config.json');
    try {
      await runWizard({ nonInteractive: true, configPath: cfgPath });
      const cfg = JSON.parse(await readFile(cfgPath, 'utf8'));
      // Default provider is zai, model is glm-5.2
      expect(cfg.activeProviderId).toBe('zai');
      expect(cfg.activeModelId).toBe('glm-5.2');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

void existsSync;
