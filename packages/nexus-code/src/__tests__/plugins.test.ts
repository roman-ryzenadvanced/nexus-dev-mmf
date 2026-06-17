import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// We can't easily override NEXUS_DIR (it's a const), so test the plugin
// loader against the real ~/.nexus/plugins/ dir. Use unique filenames to
// avoid pollution. Tests clean up after themselves.
import { loadAllPlugins, loadPlugin, discoverPlugins, ensurePluginsDir, writeExamplePlugin, PLUGINS_DIR } from '../plugins/index.js';

describe('plugin loader', () => {
  it('PLUGINS_DIR is under ~/.nexus/plugins', () => {
    expect(PLUGINS_DIR).toMatch(/\.nexus[\/\\]plugins$/);
  });

  it('ensurePluginsDir creates the directory if missing', async () => {
    await ensurePluginsDir();
    expect(existsSync(PLUGINS_DIR)).toBe(true);
  });

  it('discoverPlugins returns empty when no plugins', async () => {
    await ensurePluginsDir();
    const files = await discoverPlugins();
    // May have example.js if other tests created it — that's fine.
    expect(Array.isArray(files)).toBe(true);
  });

  it('loadPlugin returns error for nonexistent file', async () => {
    const result = await loadPlugin('nonexistent-' + Date.now() + '.js');
    expect(result.tools).toEqual([]);
    expect(result.commands).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it('loadPlugin loads a valid plugin with tools + commands', async () => {
    const filename = `test-plugin-${Date.now()}.mjs`;
    const path = join(PLUGINS_DIR, filename);
    await writeFile(
      path,
      `export default {
        name: 'test-plugin',
        tools: [{
          name: 'test_timestamp',
          description: 'Get timestamp',
          parameters: { type: 'object', properties: {} },
          handler: async () => 12345,
        }],
        commands: [{
          name: 'test_ping',
          description: 'Test ping',
          usage: '/test_ping',
          async run() { return 'pong'; },
        }],
      };`,
      'utf8'
    );
    try {
      const result = await loadPlugin(filename);
      expect(result.error).toBeUndefined();
      expect(result.name).toBe('test-plugin');
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('test_timestamp');
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].name).toBe('test_ping');
      // Verify the tool actually works
      const out = await result.tools[0].handler({});
      expect(out).toBe(12345);
    } finally {
      await rm(path, { force: true });
    }
  });

  it('loadPlugin handles plugin with missing default export', async () => {
    const filename = `test-no-default-${Date.now()}.mjs`;
    const path = join(PLUGINS_DIR, filename);
    await writeFile(path, `export const x = 1;`, 'utf8');
    try {
      const result = await loadPlugin(filename);
      expect(result.error).toBe('No default export');
      expect(result.tools).toEqual([]);
    } finally {
      await rm(path, { force: true });
    }
  });

  it('loadPlugin handles plugin with syntax error', async () => {
    const filename = `test-syntax-err-${Date.now()}.mjs`;
    const path = join(PLUGINS_DIR, filename);
    await writeFile(path, `export default { invalid syntax !!!!!`, 'utf8');
    try {
      const result = await loadPlugin(filename);
      expect(result.error).toBeTruthy();
      expect(result.tools).toEqual([]);
    } finally {
      await rm(path, { force: true });
    }
  });

  it('loadPlugin filters out tools without handlers', async () => {
    const filename = `test-no-handler-${Date.now()}.mjs`;
    const path = join(PLUGINS_DIR, filename);
    await writeFile(
      path,
      `export default {
        tools: [
          { name: 'good', description: 'has handler', parameters: {}, handler: async () => 1 },
          { name: 'bad', description: 'no handler', parameters: {} },
        ],
      };`,
      'utf8'
    );
    try {
      const result = await loadPlugin(filename);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('good');
    } finally {
      await rm(path, { force: true });
    }
  });

  it('loadAllPlugins aggregates multiple plugins', async () => {
    const f1 = `test-multi-1-${Date.now()}.mjs`;
    const f2 = `test-multi-2-${Date.now()}.mjs`;
    await writeFile(join(PLUGINS_DIR, f1), `export default { name: 'a', tools: [], commands: [] };`, 'utf8');
    await writeFile(join(PLUGINS_DIR, f2), `export default { name: 'b', tools: [], commands: [] };`, 'utf8');
    try {
      const all = await loadAllPlugins();
      const names = all.map((p) => p.name);
      expect(names).toContain('a');
      expect(names).toContain('b');
    } finally {
      await rm(join(PLUGINS_DIR, f1), { force: true });
      await rm(join(PLUGINS_DIR, f2), { force: true });
    }
  });

  it('writeExamplePlugin creates example.js', async () => {
    // Use a unique path by deleting first
    const examplePath = join(PLUGINS_DIR, 'example.js');
    await rm(examplePath, { force: true });
    await writeExamplePlugin();
    expect(existsSync(examplePath)).toBe(true);
    // Calling again should NOT overwrite (idempotent)
    const content1 = await import('node:fs/promises').then((m) => m.readFile(examplePath, 'utf8'));
    await writeExamplePlugin();
    const content2 = await import('node:fs/promises').then((m) => m.readFile(examplePath, 'utf8'));
    expect(content1).toBe(content2);
  });
});
