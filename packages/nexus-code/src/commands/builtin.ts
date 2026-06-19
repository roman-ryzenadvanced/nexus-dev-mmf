// ============================================================
// Slash command registry + builtin commands
// ============================================================

import type { SlashCommand, SlashCommandContext } from '../types.js';
import { ALL_MODES, describeMode } from '../orchestrator/modes.js';

/**
 * Plugin commands registered at runtime. These are appended to REGISTRY
 * when plugins load (see plugins/loader.ts → App.tsx wiring).
 * Forward-declared here so the `help` command (defined below) can use
 * allCommands() before REGISTRY is initialized.
 */
export const PLUGIN_COMMANDS: SlashCommand[] = [];

/** Register a command from a plugin. Idempotent — skips if name already exists. */
export function registerPluginCommand(cmd: SlashCommand): boolean {
  const exists = REGISTRY.some(c => c.name === cmd.name) || PLUGIN_COMMANDS.some(c => c.name === cmd.name);
  if (exists) return false;
  PLUGIN_COMMANDS.push(cmd);
  return true;
}

/** Unregister a plugin command by name. */
export function unregisterPluginCommand(name: string): boolean {
  const idx = PLUGIN_COMMANDS.findIndex(c => c.name === name);
  if (idx === -1) return false;
  PLUGIN_COMMANDS.splice(idx, 1);
  return true;
}

/** Get all commands: builtin + plugin. */
export function allCommands(): SlashCommand[] {
  return [...REGISTRY, ...PLUGIN_COMMANDS];
}

/** Clear all plugin commands (used in tests). */
export function clearPluginCommands(): void {
  PLUGIN_COMMANDS.length = 0;
}

const help: SlashCommand = {
  name: 'help',
  aliases: ['?', 'h'],
  description: 'List all slash commands',
  usage: '/help [command]',
  examples: ['/help', '/help mode'],
  async run(args, _ctx) {
    if (args[0]) {
      const cmd = allCommands().find(c => c.name === args[0] || c.aliases?.includes(args[0]));
      if (!cmd) return `Unknown command: ${args[0]}`;
      return [
        `${cmd.name}  ${cmd.aliases?.length ? `(${cmd.aliases.join(', ')})` : ''}`,
        `  ${cmd.description}`,
        `  usage: ${cmd.usage}`,
        ...(cmd.examples ? [`  examples:`, ...cmd.examples.map(e => `    ${e}`)] : []),
      ].join('\n');
    }
    const lines = ['Available slash commands:', ''];
    for (const cmd of allCommands()) {
      const pluginMark = PLUGIN_COMMANDS.includes(cmd) ? ' (plugin)' : '';
      lines.push(`  ${cmd.name.padEnd(12)}  ${cmd.description}${pluginMark}`);
    }
    lines.push('', 'Type /help <command> for details on a specific command.');
    return lines.join('\n');
  },
};

const mode: SlashCommand = {
  name: 'mode',
  description: 'Set or display the MMFE execution mode',
  usage: '/mode [speed|balanced|quality|creative]',
  examples: ['/mode', '/mode quality'],
  async run(args, ctx) {
    if (!args[0]) {
      return `Current mode: ${describeMode(ctx.config.mode)}`;
    }
    if (!ALL_MODES.includes(args[0] as never)) {
      return `Invalid mode "${args[0]}". Valid: ${ALL_MODES.join(', ')}`;
    }
    ctx.setConfig({ mode: args[0] as never });
    return `Mode → ${describeMode(args[0] as never)}`;
  },
};

const provider: SlashCommand = {
  name: 'provider',
  description: 'Open the settings hub or switch, list, add, remove, or edit providers',
  usage: '/provider [id | add | remove | edit]',
  examples: ['/provider', '/provider openai', '/provider add', '/provider remove', '/provider edit'],
  async run(args, ctx) {
    // `/provider add|remove|edit` are intercepted in App.tsx to open the
    // ProviderManager overlay; reaching here means an unknown subcommand.
    if (args[0] && ['add', 'remove', 'edit'].includes(args[0])) {
      return `Use /provider ${args[0]} (interactive overlay) — it opens automatically in the TUI.`;
    }
    if (!args[0]) {
      const lines = ['Providers:'];
      for (const p of ctx.config.providers) {
        const active = p.id === ctx.config.activeProviderId ? ' (active)' : '';
        const mmfe = p.mmfe ? ' [mmfe]' : ' [direct]';
        lines.push(`  ${p.id.padEnd(12)} ${p.name}${mmfe}${active}`);
      }
      return lines.join('\n');
    }
    const p = ctx.config.providers.find(x => x.id === args[0]);
    if (!p) return `Unknown provider: ${args[0]}`;
    ctx.setConfig({
      activeProviderId: p.id,
      activeModelId: p.defaultModel || '',
    });
    return `Provider → ${p.id} (${p.name})`;
  },
};

const model: SlashCommand = {
  name: 'model',
  description: 'Switch or list models for the active provider',
  usage: '/model [id]',
  examples: ['/model', '/model glm-5.2'],
  async run(args, ctx) {
    if (!args[0]) {
      const lines = [`Models for provider "${ctx.config.activeProviderId}":`];
      const all = ctx.config.providers.flatMap(p => (p.id === ctx.config.activeProviderId ? ctx.config.manualModels : []).filter(m => m.providerId === p.id));
      if (!all.length) {
        lines.push('  (no models registered — use /fetch or /add)');
      } else {
        for (const m of all) {
          const active = m.id === ctx.config.activeModelId ? ' (active)' : '';
          lines.push(`  ${m.id.padEnd(24)} [${m.source}]${active}`);
        }
      }
      return lines.join('\n');
    }
    ctx.setConfig({ activeModelId: args[0] });
    return `Model → ${args[0]}`;
  },
};

const fetch: SlashCommand = {
  name: 'fetch',
  description: 'Re-fetch models from /v1/models on each provider',
  usage: '/fetch [providerId]',
  examples: ['/fetch', '/fetch openai'],
  async run(args, ctx) {
    const models = await ctx.fetchModels(args[0]);
    return `Fetched ${models.length} models ${args[0] ? `from ${args[0]}` : 'across all providers'}.`;
  },
};

const add: SlashCommand = {
  name: 'add',
  description: 'Manually register a model for a provider',
  usage: '/add <providerId> <modelId> [label]',
  examples: ['/add openai gpt-4o-mini', '/add anthropic claude-3-opus-20240229 Claude 3 Opus'],
  async run(args, ctx) {
    if (args.length < 2) return 'Usage: /add <providerId> <modelId> [label]';
    const [providerId, modelId, ...labelParts] = args;
    const provider = ctx.config.providers.find(p => p.id === providerId);
    if (!provider) return `Unknown provider: ${providerId}`;
    ctx.addModel(providerId, modelId, labelParts.join(' ') || undefined);
    return `Added model "${modelId}" to provider "${providerId}".`;
  },
};

const clear: SlashCommand = {
  name: 'clear',
  description: 'Clear the chat transcript',
  usage: '/clear',
  async run(_args, _ctx) {
    _ctx.clearMessages();
    return 'Transcript cleared.';
  },
};

const save: SlashCommand = {
  name: 'save',
  description: 'Save the current session',
  usage: '/save [name]',
  examples: ['/save', '/save debug-run'],
  async run(args, ctx) {
    await ctx.saveSession(args[0]);
    return `Session saved${args[0] ? ` as "${args[0]}"` : ''}.`;
  },
};

const load: SlashCommand = {
  name: 'load',
  description: 'Load a saved session',
  usage: '/load <name>',
  examples: ['/load debug-run'],
  async run(args, ctx) {
    if (!args[0]) return 'Usage: /load <name>';
    const ok = await ctx.loadSession(args[0]);
    return ok ? `Loaded session "${args[0]}".` : `No session named "${args[0]}".`;
  },
};

const mmfe: SlashCommand = {
  name: 'mmfe',
  description: 'Toggle MMFE on/off (provider-unlocked mode)',
  usage: '/mmfe [on|off]',
  examples: ['/mmfe', '/mmfe off'],
  async run(args, ctx) {
    if (!args[0]) return `MMFE is ${ctx.config.useMMFE ? 'ON' : 'OFF'}.`;
    const next = args[0] === 'on';
    ctx.setConfig({ useMMFE: next });
    return `MMFE ${next ? 'ON' : 'OFF'} — ${next ? 'calls route through the orchestrator' : 'direct provider calls (unlocked)'}.`;
  },
};

const exit: SlashCommand = {
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Quit the TUI',
  usage: '/exit',
  async run(_args, ctx) {
    ctx.quit();
  },
};

const status: SlashCommand = {
  name: 'status',
  description: 'Show provider health, active model, MCP servers, and session info',
  usage: '/status',
  async run(_args, ctx) {
    const lines: string[] = [
      '=== nexus-code status ===',
      '',
      `Version:     ${ctx.config.version}`,
      `MMFE:        ${ctx.config.useMMFE ? 'ON' : 'OFF'}`,
      `Mode:        ${ctx.config.mode}`,
      `Session:     ${ctx.session.name || ctx.session.id}  (${ctx.session.messages.length} messages)`,
      '',
      '--- Providers ---',
    ];
    for (const p of ctx.config.providers) {
      const active = p.id === ctx.config.activeProviderId ? ' (active)' : '';
      const mmfe = p.mmfe ? ' [mmfe]' : ' [direct]';
      const hasKey = p.apiKey ? ' key✓' : ' key✗';
      lines.push(`  ${p.id.padEnd(14)} ${p.name}${mmfe}${hasKey}${active}`);
    }

    if (ctx.getProviderInfo) {
      const info = ctx.getProviderInfo();
      lines.push('', '--- Active provider ---');
      lines.push(`  ${info.providerName} (${info.providerKind})  mmfe=${info.mmfe}`);
      lines.push(`  Models registered: ${info.models.length}`);
      const activeModel = ctx.config.activeModelId;
      for (const m of info.models.slice(0, 12)) {
        const mark = m.id === activeModel ? ' ●' : '  ';
        const src = m.source.padEnd(7);
        lines.push(`${mark} ${m.id.padEnd(28)} [${src}]  ${(m.label || '').slice(0, 30)}`);
      }
      if (info.models.length > 12) {
        lines.push(`  … and ${info.models.length - 12} more`);
      }
    }

    if (ctx.getMcpStatuses) {
      const statuses = ctx.getMcpStatuses();
      if (statuses.length) {
        lines.push('', '--- MCP servers ---');
        for (const s of statuses) {
          const mark = s.connected ? '✓' : '✗';
          const err = s.lastError ? `  (${s.lastError.slice(0, 60)})` : '';
          lines.push(`  ${mark} ${s.id.padEnd(16)} ${s.toolCount} tools${err}`);
        }
      } else {
        lines.push('', '--- MCP servers ---', '  (none configured)');
      }
    }

    lines.push('', `Config:  ~/.nexus/config.json`);
    lines.push(`Session: ~/.nexus/sessions/`);
    return lines.join('\n');
  },
};

const tools: SlashCommand = {
  name: 'tools',
  description: 'List all registered tools (builtin + MCP)',
  usage: '/tools',
  async run(_args, _ctx) {
    // Placeholder — the App.tsx handleSlash() intercepts /tools inline.
    // This entry exists so /help lists it.
    return 'Use /tools in the TUI to list registered tools.';
  },
};

const mcp: SlashCommand = {
  name: 'mcp',
  description: 'List MCP server connection statuses',
  usage: '/mcp',
  async run(_args, ctx) {
    if (!ctx.getMcpStatuses) return 'MCP not available in this context.';
    const statuses = ctx.getMcpStatuses();
    if (!statuses.length) return 'No MCP servers configured.';
    return statuses.map(s => `  ${s.id.padEnd(16)} ${s.connected ? '✓' : '✗'}  ${s.toolCount} tools${s.lastError ? `  (${s.lastError})` : ''}`).join('\n');
  },
};

const history: SlashCommand = {
  name: 'history',
  description: 'Show recent input history (last 20 entries)',
  usage: '/history [query]',
  examples: ['/history', '/history deploy'],
  async run(args, _ctx) {
    // Lazy-load so this command works even from non-TUI contexts.
    const { loadHistory } = await import('../session/history.js');
    const all = await loadHistory();
    if (!all.length) return 'No history yet.';
    const filtered = args[0] ? all.filter(e => e.text.toLowerCase().includes(args[0].toLowerCase())) : all;
    if (!filtered.length) return `No history matching "${args[0]}".`;
    const recent = filtered.slice(-20);
    const lines = [`Last ${recent.length} entr${recent.length === 1 ? 'y' : 'ies'}${args[0] ? ` matching "${args[0]}"` : ''}:`, ''];
    for (let i = 0; i < recent.length; i++) {
      const e = recent[i];
      const time = new Date(e.ts).toLocaleString();
      const prov = e.providerId ? ` [${e.providerId}]` : '';
      const idx = String(filtered.length - recent.length + i + 1).padStart(3, ' ');
      lines.push(`${idx}  ${time}${prov}`);
      lines.push(`     ${e.text.slice(0, 100)}`);
    }
    return lines.join('\n');
  },
};

const theme: SlashCommand = {
  name: 'theme',
  description: 'Show or switch the TUI color theme',
  usage: '/theme [tech-dark|editorial-light|hacker-terminal]',
  examples: ['/theme', '/theme hacker-terminal'],
  async run(args, ctx) {
    const { setTheme, getThemeName, listThemes } = await import('../tui/theme.js');
    if (!args[0]) {
      const current = getThemeName();
      const all = listThemes();
      const lines = ['Available themes:', ''];
      for (const t of all) {
        const mark = t === current ? ' (active)' : '';
        lines.push(`  ${t.padEnd(20)}${mark}`);
      }
      lines.push('', 'Switch with: /theme <name>');
      return lines.join('\n');
    }
    const valid = listThemes() as string[];
    if (!valid.includes(args[0])) {
      return `Unknown theme: ${args[0]}. Valid: ${valid.join(', ')}`;
    }
    setTheme(args[0] as never);
    // Also persist to config so it survives restarts.
    ctx.setConfig({
      ui: { ...(ctx.config.ui || {}), theme: args[0] as never },
    });
    return `Theme → ${args[0]}`;
  },
};

const diff: SlashCommand = {
  name: 'diff',
  description: 'Show a diff for a file (against HEAD if git-tracked, else against empty)',
  usage: '/diff <path> [against]',
  examples: ['/diff src/index.ts', '/diff src/index.ts HEAD~1'],
  async run(args, _ctx) {
    if (!args[0]) return 'Usage: /diff <path> [against]';
    const path = args[0];
    const against = args[1] || 'HEAD';
    const { execShell } = await import('../tools/shell.js');
    const { existsSync } = await import('node:fs');
    if (!existsSync(path)) {
      return `File not found: ${path}`;
    }
    // Try git diff first
    try {
      const res = await execShell(`git diff ${against} -- ${path}`, {
        timeoutMs: 10_000,
      });
      if (res.exitCode === 0 && res.stdout.trim()) {
        return `diff for ${path} (vs ${against}):\n\n${res.stdout}`;
      }
      // No git diff available — show file content summary
      const stat = await import('node:fs/promises');
      const stats = await stat.stat(path);
      const lines = [
        `No git diff available for ${path} (against ${against}).`,
        `File: ${stats.size} bytes, modified ${new Date(stats.mtimeMs).toISOString()}`,
        '',
      ];
      if (res.stderr) lines.push(`git stderr: ${res.stderr}`);
      return lines.join('\n');
    } catch (err) {
      return `Failed to diff ${path}: ${(err as Error).message}`;
    }
  },
};

const branch: SlashCommand = {
  name: 'branch',
  description: 'Branch (fork) the conversation from a specific message id',
  usage: '/branch <messageId>',
  examples: ['/branch msg_123', '/branch 5'],
  async run(args, ctx) {
    if (!args[0]) {
      return 'Usage: /branch <messageId | index>\n\nTruncate the transcript to just before the given message, so you can take a different path. The original session is preserved if you /save first.';
    }
    const target = args[0];
    const messages = ctx.session.messages;
    let idx = -1;
    // Try as numeric index first (1-based for user friendliness)
    if (/^\d+$/.test(target)) {
      const n = parseInt(target, 10);
      if (n >= 1 && n <= messages.length) {
        idx = n - 1;
      }
    }
    // Fall back to message id match
    if (idx === -1) {
      idx = messages.findIndex(m => m.id === target);
    }
    if (idx === -1) {
      return `Message "${target}" not found. Available: ${messages
        .slice(0, 5)
        .map(m => m.id)
        .join(', ')}${messages.length > 5 ? ` ... (${messages.length} total)` : ''}`;
    }
    // Truncate to keep messages [0..idx-1] (everything before the target)
    const kept = messages.slice(0, idx);
    const dropped = messages.length - idx;
    ctx.setSession({ messages: kept, updatedAt: Date.now() });
    // The pushMessage/clearMessages flow goes through ctx.clearMessages + re-push
    // For simplicity, just clear and re-add:
    ctx.clearMessages();
    for (const m of kept) {
      ctx.pushMessage(m);
    }
    return `Branched from message ${target}. Kept ${kept.length} message(s), dropped ${dropped}.`;
  },
};

const init: SlashCommand = {
  name: 'init',
  description: 'Re-run the config wizard to (re)generate ~/.nexus/config.json',
  usage: '/init',
  async run(_args, _ctx) {
    const { runWizard } = await import('../wizard.js');
    const result = await runWizard();
    return result;
  },
};

const plugins: SlashCommand = {
  name: 'plugins',
  description: 'List loaded plugins from ~/.nexus/plugins/',
  usage: '/plugins',
  async run(_args, _ctx) {
    const { loadAllPlugins, ensurePluginsDir, writeExamplePlugin, PLUGINS_DIR } = await import('../plugins/index.js');
    await ensurePluginsDir();
    const loaded = await loadAllPlugins();
    if (!loaded.length) {
      await writeExamplePlugin();
      return ['No plugins found.', `Created an example plugin at ${PLUGINS_DIR}/example.js`, 'Edit it, then restart the TUI to load.'].join('\n');
    }
    const lines = [`Loaded ${loaded.length} plugin(s) from ${PLUGINS_DIR}:`, ''];
    for (const p of loaded) {
      const mark = p.error ? '✗' : '✓';
      const tools = p.tools.length ? `  ${p.tools.length} tool(s)` : '';
      const cmds = p.commands.length ? `  ${p.commands.length} command(s)` : '';
      const err = p.error ? `  error: ${p.error}` : '';
      lines.push(`${mark} ${p.name} (${p.filename})${tools}${cmds}${err}`);
    }
    return lines.join('\n');
  },
};

export const REGISTRY: SlashCommand[] = [
  help,
  mode,
  provider,
  model,
  fetch,
  add,
  clear,
  save,
  load,
  mmfe,
  status,
  tools,
  mcp,
  history,
  theme,
  diff,
  branch,
  init,
  plugins,
  exit,
];

export function findCommand(input: string): {
  cmd?: SlashCommand;
  args: string[];
} {
  const [name, ...args] = input.trim().replace(/^\//, '').split(/\s+/);
  const cmd = allCommands().find(c => c.name === name || c.aliases?.includes(name));
  return { cmd, args };
}

export async function runSlash(input: string, ctx: SlashCommandContext): Promise<string | void> {
  const { cmd, args } = findCommand(input);
  if (!cmd) return `Unknown command: /${input.split(/\s+/)[0]}. Type /help.`;
  return cmd.run(args, ctx);
}
