import { describe, it, expect } from 'vitest';
import { REGISTRY, findCommand } from '../commands/builtin.js';

describe('new slash commands', () => {
  it('REGISTRY includes /diff, /branch, /init, /plugins', () => {
    const names = REGISTRY.map(c => c.name);
    expect(names).toContain('diff');
    expect(names).toContain('branch');
    expect(names).toContain('init');
    expect(names).toContain('plugins');
  });

  it('findCommand locates /diff', () => {
    const { cmd, args } = findCommand('/diff src/index.ts');
    expect(cmd?.name).toBe('diff');
    expect(args).toEqual(['src/index.ts']);
  });

  it('findCommand locates /branch', () => {
    const { cmd, args } = findCommand('/branch msg_123');
    expect(cmd?.name).toBe('branch');
    expect(args).toEqual(['msg_123']);
  });

  it('findCommand locates /plugins', () => {
    const { cmd } = findCommand('/plugins');
    expect(cmd?.name).toBe('plugins');
  });

  it('findCommand locates /init', () => {
    const { cmd } = findCommand('/init');
    expect(cmd?.name).toBe('init');
  });

  it('every new command has run() function', () => {
    const newCmds = REGISTRY.filter(c => ['diff', 'branch', 'init', 'plugins'].includes(c.name));
    for (const cmd of newCmds) {
      expect(typeof cmd.run).toBe('function');
      expect(cmd.description).toBeTruthy();
      expect(cmd.usage).toBeTruthy();
    }
  });
});

describe('/diff command', () => {
  it('shows usage when no path given', async () => {
    const { cmd } = findCommand('/diff');
    const result = await cmd!.run([], makeCtx());
    expect(result).toContain('Usage');
  });

  it('reports file not found for nonexistent path', async () => {
    const { cmd } = findCommand('/diff');
    const result = await cmd!.run(['/nonexistent/path/xyz'], makeCtx());
    expect(result).toContain('not found');
  });

  it('shows git diff when file exists', async () => {
    const { cmd } = findCommand('/diff');
    // Use a known file in the project
    const result = await cmd!.run(['package.json'], makeCtx());
    // Either a git diff is shown, or "no git diff available" with file stats
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('/branch command', () => {
  it('shows usage when no target given', async () => {
    const { cmd } = findCommand('/branch');
    const result = await cmd!.run([], makeCtx());
    expect(result).toContain('Usage');
  });

  it('reports not found for unknown message id', async () => {
    const { cmd } = findCommand('/branch');
    const result = await cmd!.run(['nonexistent-id'], makeCtx());
    expect(result).toContain('not found');
  });

  it('branches by numeric index (1-based)', async () => {
    const ctx = makeCtxWithMessages([
      { id: 'm1', role: 'user', content: 'first', ts: 1 },
      { id: 'm2', role: 'assistant', content: 'reply', ts: 2 },
      { id: 'm3', role: 'user', content: 'second', ts: 3 },
    ]);
    const { cmd } = findCommand('/branch');
    const result = await cmd!.run(['2'], ctx);
    expect(result).toContain('Branched');
    expect(result).toContain('Kept 1');
    expect(result).toContain('dropped 2');
  });

  it('branches by message id', async () => {
    const ctx = makeCtxWithMessages([
      { id: 'm1', role: 'user', content: 'first', ts: 1 },
      { id: 'm2', role: 'assistant', content: 'reply', ts: 2 },
    ]);
    const { cmd } = findCommand('/branch');
    const result = await cmd!.run(['m2'], ctx);
    expect(result).toContain('Branched');
  });
});

function makeCtx() {
  return makeCtxWithMessages([]);
}

function makeCtxWithMessages(
  msgs: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    ts: number;
  }>
) {
  const session = {
    id: 'test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: msgs,
    providerId: 'zai',
    modelId: 'glm-5.2',
    mode: 'balanced' as const,
    useMMFE: true,
  };
  return {
    config: {
      version: '1.1.5',
      activeProviderId: 'zai',
      activeModelId: 'glm-5.2',
      mode: 'balanced' as const,
      useMMFE: true,
      providers: [],
      manualModels: [],
      mcpServers: [],
    },
    session,
    setConfig: () => {},
    setSession: () => {},
    pushMessage: () => {},
    clearMessages: () => {
      session.messages = [];
    },
    saveSession: async () => {},
    loadSession: async () => false,
    fetchModels: async () => [],
    addModel: () => {},
    quit: () => {},
  };
}
