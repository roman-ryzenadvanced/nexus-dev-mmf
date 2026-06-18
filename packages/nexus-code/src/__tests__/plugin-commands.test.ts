import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadPlugin, loadAllPlugins, discoverPlugins, ensurePluginsDir, PLUGINS_DIR } from '../plugins/index.js';
import { registerPluginCommand, unregisterPluginCommand, allCommands, clearPluginCommands, runSlash, REGISTRY } from '../commands/index.js';
import type { SlashCommandContext, AppConfig, Session } from '../types.js';
import { newSession } from '../session/store.js';

function makeCtx(): SlashCommandContext {
  const config: AppConfig = {
    version: '1.1.6',
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
  const session: Session = newSession({
    providerId: 'zai',
    modelId: 'glm-5.2',
    mode: 'balanced',
    useMMFE: true,
  });
  return {
    config,
    session,
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

describe('plugin command registration', () => {
  beforeEach(() => {
    clearPluginCommands();
  });

  afterEach(async () => {
    clearPluginCommands();
  });

  it('registerPluginCommand adds a command to allCommands()', () => {
    const before = allCommands().length;
    const ok = registerPluginCommand({
      name: 'test_plugin_cmd',
      description: 'test',
      usage: '/test_plugin_cmd',
      async run() {
        return 'ok';
      },
    });
    expect(ok).toBe(true);
    expect(allCommands().length).toBe(before + 1);
    expect(allCommands().map(c => c.name)).toContain('test_plugin_cmd');
  });

  it('registerPluginCommand refuses duplicate name', () => {
    registerPluginCommand({
      name: 'dup',
      description: 'first',
      usage: '/dup',
      async run() {
        return '1';
      },
    });
    const ok = registerPluginCommand({
      name: 'dup',
      description: 'second',
      usage: '/dup',
      async run() {
        return '2';
      },
    });
    expect(ok).toBe(false);
  });

  it('registerPluginCommand refuses names that collide with builtin commands', () => {
    const ok = registerPluginCommand({
      name: 'mode',
      description: 'should not override builtin',
      usage: '/mode',
      async run() {
        return 'nope';
      },
    });
    expect(ok).toBe(false);
  });

  it('unregisterPluginCommand removes by name', () => {
    registerPluginCommand({
      name: 'temp',
      description: 'temp',
      usage: '/temp',
      async run() {
        return '';
      },
    });
    expect(allCommands().some(c => c.name === 'temp')).toBe(true);
    const ok = unregisterPluginCommand('temp');
    expect(ok).toBe(true);
    expect(allCommands().some(c => c.name === 'temp')).toBe(false);
  });

  it('unregisterPluginCommand returns false for unknown name', () => {
    expect(unregisterPluginCommand('nonexistent')).toBe(false);
  });

  it('clearPluginCommands removes all plugin commands', () => {
    registerPluginCommand({
      name: 'a',
      description: 'a',
      usage: '/a',
      async run() {
        return '';
      },
    });
    registerPluginCommand({
      name: 'b',
      description: 'b',
      usage: '/b',
      async run() {
        return '';
      },
    });
    expect(allCommands().length).toBeGreaterThan(REGISTRY.length);
    clearPluginCommands();
    expect(allCommands().length).toBe(REGISTRY.length);
  });
});

describe('plugin commands via runSlash', () => {
  beforeEach(() => {
    clearPluginCommands();
  });

  afterEach(() => {
    clearPluginCommands();
  });

  it('runSlash executes a registered plugin command', async () => {
    registerPluginCommand({
      name: 'greet',
      description: 'Greet someone',
      usage: '/greet [name]',
      async run(args) {
        return `Hello, ${args[0] || 'world'}!`;
      },
    });
    const result = await runSlash('/greet Alice', makeCtx());
    expect(result).toBe('Hello, Alice!');
  });

  it('runSlash finds plugin commands with no args', async () => {
    registerPluginCommand({
      name: 'ping',
      description: 'Pong',
      usage: '/ping',
      async run() {
        return 'pong';
      },
    });
    const result = await runSlash('/ping', makeCtx());
    expect(result).toBe('pong');
  });

  it('runSlash returns "Unknown command" for unregistered plugin command', async () => {
    const result = await runSlash('/nonexistent_plugin_cmd', makeCtx());
    expect(result).toContain('Unknown command');
  });

  it('/help lists plugin commands with (plugin) marker', async () => {
    registerPluginCommand({
      name: 'special_plugin_cmd',
      description: 'A special plugin command',
      usage: '/special_plugin_cmd',
      async run() {
        return '';
      },
    });
    const result = await runSlash('/help', makeCtx());
    expect(result).toContain('special_plugin_cmd');
    expect(result).toContain('(plugin)');
  });

  it('/help <plugin-cmd> shows detail for plugin command', async () => {
    registerPluginCommand({
      name: 'detailed',
      description: 'A detailed plugin command',
      usage: '/detailed <arg>',
      async run() {
        return '';
      },
    });
    const result = await runSlash('/help detailed', makeCtx());
    expect(result).toContain('detailed');
    expect(result).toContain('A detailed plugin command');
    expect(result).toContain('/detailed <arg>');
  });
});

describe('plugin loader → command integration', () => {
  beforeEach(() => {
    clearPluginCommands();
  });

  afterEach(async () => {
    clearPluginCommands();
    // Clean up any test plugin files
    const filename = 'test-integration-cmd.mjs';
    await rm(join(PLUGINS_DIR, filename), { force: true });
  });

  it('loading a plugin with commands makes them executable via runSlash', async () => {
    await ensurePluginsDir();
    const filename = 'test-integration-cmd.mjs';
    const path = join(PLUGINS_DIR, filename);
    await writeFile(
      path,
      `export default {
        name: 'integration-test',
        commands: [{
          name: 'plugin_echo',
          description: 'Echo the argument',
          usage: '/plugin_echo [text]',
          async run(args) { return 'ECHO: ' + (args[0] || 'nothing'); },
        }],
      };`,
      'utf8'
    );

    const loaded = await loadPlugin(filename);
    expect(loaded.commands).toHaveLength(1);
    expect(loaded.commands[0].name).toBe('plugin_echo');

    // Register the command
    const registered = registerPluginCommand(loaded.commands[0]);
    expect(registered).toBe(true);

    // Execute via runSlash
    const result = await runSlash('/plugin_echo hello', makeCtx());
    expect(result).toBe('ECHO: hello');
  });

  it('loading a plugin with tools registers them via the handler', async () => {
    await ensurePluginsDir();
    const filename = 'test-integration-tool.mjs';
    const path = join(PLUGINS_DIR, filename);
    await writeFile(
      path,
      `export default {
        name: 'tool-test',
        tools: [{
          name: 'plugin_calculate',
          description: 'Multiply two numbers',
          parameters: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } },
          handler: async (args) => (Number(args.a) || 0) * (Number(args.b) || 0),
        }],
      };`,
      'utf8'
    );

    try {
      const loaded = await loadPlugin(filename);
      expect(loaded.tools).toHaveLength(1);
      const result = await loaded.tools[0].handler({ a: 6, b: 7 });
      expect(result).toBe(42);
    } finally {
      await rm(path, { force: true });
    }
  });
});

describe('discoverPlugins + loadAllPlugins integration', () => {
  it('loadAllPlugins loads multiple plugins with mixed content', async () => {
    await ensurePluginsDir();
    const f1 = `test-multi-a-${Date.now()}.mjs`;
    const f2 = `test-multi-b-${Date.now()}.mjs`;
    const f3 = `test-multi-c-${Date.now()}.mjs`;
    await writeFile(
      join(PLUGINS_DIR, f1),
      `export default { name: 'a', tools: [{ name: 'a_t', description: 'x', parameters: {}, handler: async () => 1 }], commands: [] };`,
      'utf8'
    );
    await writeFile(
      join(PLUGINS_DIR, f2),
      `export default { name: 'b', tools: [], commands: [{ name: 'b_c', description: 'y', usage: '/b_c', async run() { return 'b'; } }] };`,
      'utf8'
    );
    await writeFile(join(PLUGINS_DIR, f3), `export default { name: 'c', tools: [], commands: [] };`, 'utf8');
    try {
      const all = await loadAllPlugins();
      const names = all.map(p => p.name);
      expect(names).toContain('a');
      expect(names).toContain('b');
      expect(names).toContain('c');
      const totalTools = all.reduce((sum, p) => sum + p.tools.length, 0);
      const totalCmds = all.reduce((sum, p) => sum + p.commands.length, 0);
      expect(totalTools).toBeGreaterThanOrEqual(1);
      expect(totalCmds).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(join(PLUGINS_DIR, f1), { force: true });
      await rm(join(PLUGINS_DIR, f2), { force: true });
      await rm(join(PLUGINS_DIR, f3), { force: true });
    }
  });

  it('discoverPlugins only returns .js and .mjs files', async () => {
    await ensurePluginsDir();
    // Drop a .txt file that should be ignored
    await writeFile(join(PLUGINS_DIR, 'ignore-me.txt'), 'not a plugin', 'utf8');
    const files = await discoverPlugins();
    expect(files.every(f => f.endsWith('.js') || f.endsWith('.mjs'))).toBe(true);
    await rm(join(PLUGINS_DIR, 'ignore-me.txt'), { force: true });
  });
});
