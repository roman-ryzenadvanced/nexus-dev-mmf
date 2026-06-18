// ============================================================
// Plugin loader — discovers and loads custom tools + commands
// from ~/.nexus/plugins/*.js (or *.mjs).
//
// Each plugin file default-exports an object with optional arrays:
//   export default {
//     tools: [{ name, description, parameters, handler }],
//     commands: [{ name, description, usage, run }],
//   }
//
// Plugin files are loaded via dynamic import. Failures (syntax errors,
// missing default export, etc.) are logged but don't crash the TUI.
// ============================================================

import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { NEXUS_DIR } from '../config/schema.js';
import type { ToolDefinition } from '../tools/protocol/index.js';
import type { SlashCommand } from '../types.js';

export const PLUGINS_DIR = join(NEXUS_DIR, 'plugins');

export interface LoadedPlugin {
  filename: string;
  name: string;
  tools: ToolDefinition[];
  commands: SlashCommand[];
  error?: string;
}

interface PluginModule {
  default?: {
    name?: string;
    tools?: Array<Omit<ToolDefinition, 'handler'> & { handler?: ToolDefinition['handler'] }>;
    commands?: SlashCommand[];
  };
}

export async function discoverPlugins(): Promise<string[]> {
  if (!existsSync(PLUGINS_DIR)) return [];
  const files = await readdir(PLUGINS_DIR);
  return files.filter(f => f.endsWith('.js') || f.endsWith('.mjs'));
}

export async function loadPlugin(filename: string): Promise<LoadedPlugin> {
  const path = join(PLUGINS_DIR, filename);
  try {
    const mod = (await import(path)) as PluginModule;
    if (!mod.default) {
      return {
        filename,
        name: filename,
        tools: [],
        commands: [],
        error: 'No default export',
      };
    }
    const def = mod.default;
    const tools: ToolDefinition[] = (def.tools || [])
      .filter(t => t.name && t.handler)
      .map(t => ({
        name: t.name,
        description: t.description || `Plugin tool: ${t.name}`,
        parameters: t.parameters || { type: 'object', properties: {} },
        handler: t.handler!,
      }));
    const commands: SlashCommand[] = (def.commands || []).filter(c => c.name && typeof c.run === 'function');
    return {
      filename,
      name: def.name || filename,
      tools,
      commands,
    };
  } catch (err) {
    return {
      filename,
      name: filename,
      tools: [],
      commands: [],
      error: (err as Error).message,
    };
  }
}

export async function loadAllPlugins(): Promise<LoadedPlugin[]> {
  const files = await discoverPlugins();
  return Promise.all(files.map(loadPlugin));
}

/** Create the plugins directory if it doesn't exist. */
export async function ensurePluginsDir(): Promise<void> {
  if (!existsSync(PLUGINS_DIR)) {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(PLUGINS_DIR, { recursive: true });
  }
}

/** Write a sample plugin to ~/.nexus/plugins/example.js for users to learn from. */
export async function writeExamplePlugin(): Promise<void> {
  await ensurePluginsDir();
  const { writeFile } = await import('node:fs/promises');
  const examplePath = join(PLUGINS_DIR, 'example.js');
  if (existsSync(examplePath)) return;
  await writeFile(
    examplePath,
    `// Example nexus-code plugin
// Place in ~/.nexus/plugins/ and restart the TUI to load.
export default {
  name: 'example-plugin',
  tools: [
    {
      name: 'timestamp',
      description: 'Get the current Unix timestamp',
      parameters: { type: 'object', properties: {} },
      handler: async () => Math.floor(Date.now() / 1000),
    },
  ],
  commands: [
    {
      name: 'ping',
      description: 'Test command — prints pong',
      usage: '/ping',
      async run() {
        return 'pong';
      },
    },
  ],
};
`,
    'utf8'
  );
}

// Suppress unused import warning
void homedir;
