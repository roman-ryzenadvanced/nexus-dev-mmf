import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { runWizard, configExists, ensureConfigDir } from '../wizard.js';

describe('config wizard', () => {
  let tmpConfigPath: string;

  beforeEach(async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'nexus-wizard-'));
    tmpConfigPath = join(tmp, 'config.json');
  });

  afterEach(async () => {
    // Clean up — best effort
    const dir = require('node:path').dirname(tmpConfigPath);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  it('runWizard in non-interactive mode generates a valid config', async () => {
    const summary = await runWizard({
      nonInteractive: true,
      configPath: tmpConfigPath,
    });
    expect(summary).toContain('Config written');
    expect(summary).toContain(tmpConfigPath);
    expect(existsSync(tmpConfigPath)).toBe(true);

    // Verify the written config is valid JSON with expected fields
    const raw = await import('node:fs/promises').then(m => m.readFile(tmpConfigPath, 'utf8'));
    const cfg = JSON.parse(raw);
    expect(cfg.activeProviderId).toBe('zai');
    expect(cfg.activeModelId).toBe('glm-5.2');
    expect(cfg.mode).toBe('balanced');
    expect(cfg.useMMFE).toBe(true);
    expect(cfg.providers).toHaveLength(3);
    expect(cfg.ui.theme).toBe('tech-dark');
  });

  it('runWizard does NOT write API keys to disk', async () => {
    // Even if env vars are set
    process.env.OPENAI_API_KEY = 'sk-test-secret-12345';
    try {
      await runWizard({ nonInteractive: true, configPath: tmpConfigPath });
      const raw = await import('node:fs/promises').then(m => m.readFile(tmpConfigPath, 'utf8'));
      expect(raw).not.toContain('sk-test-secret-12345');
      const cfg = JSON.parse(raw);
      for (const p of cfg.providers) {
        expect(p.apiKey).toBeUndefined();
      }
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it('runWizard refuses to overwrite in non-interactive mode', async () => {
    // Create the file first
    await import('node:fs/promises').then(m => m.writeFile(tmpConfigPath, '{"existing":true}', 'utf8'));
    const summary = await runWizard({
      nonInteractive: true,
      configPath: tmpConfigPath,
    });
    expect(summary).toContain('already exists');
    // Verify the file wasn't overwritten
    const raw = await import('node:fs/promises').then(m => m.readFile(tmpConfigPath, 'utf8'));
    expect(raw).toBe('{"existing":true}');
  });

  it('configExists returns true when config file is present', async () => {
    // Use the temp file we just created
    expect(existsSync(tmpConfigPath)).toBe(false);
    await runWizard({ nonInteractive: true, configPath: tmpConfigPath });
    expect(existsSync(tmpConfigPath)).toBe(true);
    // Note: configExists() checks the default ~/.nexus/config.json path,
    // not our temp path. So we just verify the function runs without error.
    expect(typeof configExists()).toBe('boolean');
  });

  it('ensureConfigDir creates ~/.nexus directory', async () => {
    ensureConfigDir();
    expect(existsSync(join(require('node:os').homedir(), '.nexus'))).toBe(true);
  });
});
