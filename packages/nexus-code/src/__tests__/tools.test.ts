import { describe, it, expect } from 'vitest';
import { ToolRegistry, toOpenAITools, toAnthropicTools, type ToolDefinition } from '../tools/protocol/index.js';
import { BUILTIN_TOOLS } from '../tools/builtin.js';

describe('ToolRegistry', () => {
  it('starts empty', () => {
    const reg = new ToolRegistry();
    expect(reg.list()).toHaveLength(0);
  });

  it('registers and retrieves a tool', () => {
    const reg = new ToolRegistry();
    const tool: ToolDefinition = {
      name: 'echo',
      description: 'Echoes input',
      parameters: { type: 'object', properties: { msg: { type: 'string' } } },
      handler: async (args) => args.msg,
    };
    reg.register(tool);
    expect(reg.get('echo')).toBe(tool);
    expect(reg.list()).toHaveLength(1);
  });

  it('rejects duplicate registration', () => {
    const reg = new ToolRegistry();
    const tool: ToolDefinition = {
      name: 'dup',
      description: 'x',
      parameters: { type: 'object', properties: {} },
      handler: async () => null,
    };
    reg.register(tool);
    expect(() => reg.register(tool)).toThrow();
  });

  it('unregisters a tool', () => {
    const reg = new ToolRegistry();
    const tool: ToolDefinition = {
      name: 'temp',
      description: 'x',
      parameters: { type: 'object', properties: {} },
      handler: async () => null,
    };
    reg.register(tool);
    expect(reg.unregister('temp')).toBe(true);
    expect(reg.get('temp')).toBeUndefined();
  });

  it('execute calls handler and returns ok status', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'add',
      description: 'Add two numbers',
      parameters: { type: 'object', properties: {} },
      handler: async (args) => (Number(args.a) || 0) + (Number(args.b) || 0),
    });
    const call = await reg.execute('add', { a: 2, b: 3 });
    expect(call.status).toBe('ok');
    expect(call.result).toBe(5);
    expect(call.id).toMatch(/^tc_/);
  });

  it('execute returns error for unknown tool', async () => {
    const reg = new ToolRegistry();
    const call = await reg.execute('nonexistent', {});
    expect(call.status).toBe('error');
    expect(call.result).toEqual({ error: 'Unknown tool: nonexistent' });
  });

  it('execute catches handler errors', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'boom',
      description: 'Always fails',
      parameters: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('boom!');
      },
    });
    const call = await reg.execute('boom', {});
    expect(call.status).toBe('error');
    expect(call.result).toEqual({ error: 'boom!' });
  });

  it('toToolMessage converts a tool call to a ChatMessage', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'echo',
      description: 'echo',
      parameters: { type: 'object', properties: {} },
      handler: async (args) => args.msg,
    });
    const call = await reg.execute('echo', { msg: 'hi' });
    const msg = reg.toToolMessage(call);
    expect(msg.role).toBe('tool');
    expect(msg.content).toBe('hi');
    expect(msg.toolCalls).toHaveLength(1);
  });

  it('clear empties the registry', () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'a',
      description: 'x',
      parameters: { type: 'object', properties: {} },
      handler: async () => null,
    });
    reg.clear();
    expect(reg.list()).toHaveLength(0);
  });
});

describe('tool schema converters', () => {
  const sampleTools: ToolDefinition[] = [
    {
      name: 'read_file',
      description: 'Reads a file',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      handler: async () => null,
    },
  ];

  it('toOpenAITools wraps in function format', () => {
    const out = toOpenAITools(sampleTools);
    expect(out).toHaveLength(1);
    const tool = out[0] as { type: string; function: { name: string; description: string; parameters: unknown } };
    expect(tool.type).toBe('function');
    expect(tool.function.name).toBe('read_file');
    expect(tool.function.description).toBe('Reads a file');
  });

  it('toAnthropicTools uses input_schema format', () => {
    const out = toAnthropicTools(sampleTools);
    expect(out).toHaveLength(1);
    const tool = out[0] as { name: string; description: string; input_schema: unknown };
    expect(tool.name).toBe('read_file');
    expect(tool.description).toBe('Reads a file');
    expect(tool.input_schema).toBeDefined();
  });
});

describe('BUILTIN_TOOLS', () => {
  it('has 5 builtin tools', () => {
    expect(BUILTIN_TOOLS).toHaveLength(5);
  });

  it('every builtin has a unique name', () => {
    const names = BUILTIN_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every builtin has a handler function', () => {
    for (const t of BUILTIN_TOOLS) {
      expect(typeof t.handler).toBe('function');
    }
  });

  it('includes read_file, write_file, shell, diff, apply_diff', () => {
    const names = BUILTIN_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(['apply_diff', 'diff', 'read_file', 'shell', 'write_file']);
  });
});
