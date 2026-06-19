import { describe, it, expect, vi } from 'vitest';
import { REGISTRY, findCommand, runSlash } from '../commands/builtin.js';
import type { AppConfig, ChatMessage, Session, SlashCommandContext } from '../types.js';
import { newSession } from '../session/store.js';

function makeCtx(overrides: Partial<SlashCommandContext> = {}): SlashCommandContext {
  const config: AppConfig = {
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
    setConfig: vi.fn(),
    setSession: vi.fn(),
    pushMessage: vi.fn(),
    clearMessages: vi.fn(),
    saveSession: vi.fn().mockResolvedValue(undefined),
    loadSession: vi.fn().mockResolvedValue(true),
    fetchModels: vi.fn().mockResolvedValue([]),
    addModel: vi.fn(),
    quit: vi.fn(),
    ...overrides,
  };
}

describe('slash command registry', () => {
  it('has 20 builtin commands', () => {
    expect(REGISTRY).toHaveLength(20);
  });

  it('every command has name + description + usage', () => {
    for (const cmd of REGISTRY) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.usage).toBeTruthy();
      expect(typeof cmd.run).toBe('function');
    }
  });

  it('command names are unique', () => {
    const names = REGISTRY.map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('findCommand', () => {
  it('finds a command by name', () => {
    const { cmd, args } = findCommand('/mode quality');
    expect(cmd?.name).toBe('mode');
    expect(args).toEqual(['quality']);
  });

  it('finds a command by alias', () => {
    const { cmd } = findCommand('/? help-text');
    expect(cmd?.name).toBe('help');
  });

  it('returns undefined cmd for unknown command', () => {
    const { cmd } = findCommand('/nonexistent');
    expect(cmd).toBeUndefined();
  });

  it('handles commands with no args', () => {
    const { cmd, args } = findCommand('/clear');
    expect(cmd?.name).toBe('clear');
    expect(args).toEqual([]);
  });
});

describe('runSlash — mode command', () => {
  it('shows current mode with no args', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/mode', ctx);
    expect(out).toContain('balanced');
  });

  it('sets mode when given valid arg', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/mode quality', ctx);
    expect(out).toContain('quality');
    expect(ctx.setConfig).toHaveBeenCalledWith({ mode: 'quality' });
  });

  it('rejects invalid mode', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/mode turbo', ctx);
    expect(out).toContain('Invalid mode');
    expect(ctx.setConfig).not.toHaveBeenCalled();
  });
});

describe('runSlash — provider command', () => {
  it('lists providers with no args', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/provider', ctx);
    expect(out).toContain('zai');
    expect(out).toContain('openai');
  });

  it('switches provider when given valid id', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/provider openai', ctx);
    expect(out).toContain('openai');
    expect(ctx.setConfig).toHaveBeenCalledWith({
      activeProviderId: 'openai',
      activeModelId: 'gpt-4o',
    });
  });

  it('rejects unknown provider', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/provider gemini', ctx);
    expect(out).toContain('Unknown provider');
  });

  it('routes add/remove/edit to the interactive-overlay hint', async () => {
    for (const sub of ['add', 'remove', 'edit'] as const) {
      const ctx = makeCtx();
      const out = await runSlash(`/provider ${sub}`, ctx);
      expect(out).toContain('interactive overlay');
    }
  });
});

describe('runSlash — mmfe command', () => {
  it('shows current state with no args', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/mmfe', ctx);
    expect(out).toContain('ON');
  });

  it('toggles off', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/mmfe off', ctx);
    expect(out).toContain('OFF');
    expect(ctx.setConfig).toHaveBeenCalledWith({ useMMFE: false });
  });
});

describe('runSlash — add command', () => {
  it('adds a model with label', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/add openai gpt-4o-mini GPT-4o mini', ctx);
    expect(out).toContain('gpt-4o-mini');
    expect(ctx.addModel).toHaveBeenCalledWith('openai', 'gpt-4o-mini', 'GPT-4o mini');
  });

  it('rejects missing args', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/add openai', ctx);
    expect(out).toContain('Usage');
  });

  it('rejects unknown provider', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/add gemini gemini-1.5-pro', ctx);
    expect(out).toContain('Unknown provider');
  });
});

describe('runSlash — help command', () => {
  it('lists all commands with no args', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/help', ctx);
    expect(out).toContain('Available slash commands');
    expect(out).toContain('mode');
    expect(out).toContain('provider');
  });

  it('shows detail for a specific command', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/help mode', ctx);
    expect(out).toContain('mode');
    expect(out).toContain('usage');
  });

  it('rejects unknown command help', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/help nonexistent', ctx);
    expect(out).toContain('Unknown command');
  });
});

describe('runSlash — unknown command', () => {
  it('returns error for unknown command', async () => {
    const ctx = makeCtx();
    const out = await runSlash('/nonexistent arg1', ctx);
    expect(out).toContain('Unknown command');
  });
});
