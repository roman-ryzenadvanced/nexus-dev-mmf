import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendChat } from '../orchestrator/index.js';
import { ToolRegistry } from '../tools/protocol/index.js';
import type { Provider } from '../providers/base.js';
import type { AppConfig, ChatMessage, ChatResponse, ToolCall } from '../types.js';

class FakeToolCallingProvider implements Provider {
  readonly id = 'fake';
  readonly kind = 'openai' as const;
  readonly name = 'Fake';
  calls = 0;
  // Scripted responses — first emits a tool call, second is the final answer.
  script: Array<{
    content: string;
    toolCalls?: ToolCall[];
  }>;

  constructor(script: Array<{ content: string; toolCalls?: ToolCall[] }>) {
    this.script = script;
  }

  async fetchModels() {
    return [];
  }

  async chat(messages: ChatMessage[], opts = {}): Promise<ChatResponse> {
    this.calls++;
    const step = this.script[Math.min(this.calls - 1, this.script.length - 1)];
    // Make tool call IDs unique per round so we can track them
    const toolCalls = step.toolCalls?.map((tc, idx) => ({
      ...tc,
      id: `${tc.id}_r${this.calls}_${idx}`,
      status: 'pending' as const,
    }));
    const msg: ChatMessage = {
      id: `msg_${this.calls}`,
      role: 'assistant',
      content: step.content,
      ts: Date.now(),
      toolCalls,
    };
    // If tools are provided and the script step has tool calls, mirror them
    void opts;
    return { message: msg };
  }
}

function makeConfig(): AppConfig {
  return {
    version: '1.1.2',
    activeProviderId: 'fake',
    activeModelId: 'gpt-test',
    mode: 'balanced',
    useMMFE: false,
    providers: [
      {
        id: 'fake',
        kind: 'openai',
        name: 'Fake',
        mmfe: false,
        defaultModel: 'gpt-test',
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
}

describe('orchestrator tool-call execution loop', () => {
  let toolRegistry: ToolRegistry;
  let onToolCall: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    onToolCall = vi.fn();
  });

  it('returns response immediately when no tool calls', async () => {
    const provider = new FakeToolCallingProvider([{ content: 'Hello, world!' }]);
    const providers = new Map([['fake', provider as unknown as Provider]]);
    const messages: ChatMessage[] = [{ id: 'u1', role: 'user', content: 'hi', ts: Date.now() }];
    const res = await sendChat(makeConfig(), providers, messages, {
      toolRegistry,
      onToolCall,
    });
    expect(provider.calls).toBe(1);
    expect(res.message.content).toBe('Hello, world!');
    expect(res.message.toolCalls).toBeUndefined();
    expect(onToolCall).not.toHaveBeenCalled();
  });

  it('executes a single tool call and continues', async () => {
    toolRegistry.register({
      name: 'get_weather',
      description: 'Get weather',
      parameters: { type: 'object', properties: { city: { type: 'string' } } },
      handler: async args => ({ weather: `sunny in ${args.city}` }),
    });

    const provider = new FakeToolCallingProvider([
      {
        content: '',
        toolCalls: [
          {
            id: 'tc1',
            name: 'get_weather',
            args: { city: 'NYC' },
            status: 'pending',
          },
        ],
      },
      { content: 'The weather in NYC is sunny.' },
    ]);

    const providers = new Map([['fake', provider as unknown as Provider]]);
    const messages: ChatMessage[] = [
      {
        id: 'u1',
        role: 'user',
        content: "What's the weather in NYC?",
        ts: Date.now(),
      },
    ];

    const res = await sendChat(makeConfig(), providers, messages, {
      toolRegistry,
      onToolCall,
    });

    expect(provider.calls).toBe(2); // initial + 1 follow-up after tool result
    expect(res.message.content).toBe('The weather in NYC is sunny.');
    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'get_weather',
        status: 'ok',
        result: { weather: 'sunny in NYC' },
      })
    );
  });

  it('chains multiple tool rounds', async () => {
    let getCount = 0;
    toolRegistry.register({
      name: 'next',
      description: 'Advance counter',
      parameters: { type: 'object', properties: {} },
      handler: async () => {
        getCount++;
        return { count: getCount };
      },
    });

    const provider = new FakeToolCallingProvider([
      {
        content: '',
        toolCalls: [{ id: 'a', name: 'next', args: {}, status: 'pending' }],
      },
      {
        content: '',
        toolCalls: [{ id: 'b', name: 'next', args: {}, status: 'pending' }],
      },
      {
        content: '',
        toolCalls: [{ id: 'c', name: 'next', args: {}, status: 'pending' }],
      },
      { content: 'Done. Counted to 3.' },
    ]);

    const providers = new Map([['fake', provider as unknown as Provider]]);
    const messages: ChatMessage[] = [{ id: 'u1', role: 'user', content: 'count to 3', ts: Date.now() }];

    const res = await sendChat(makeConfig(), providers, messages, {
      toolRegistry,
      onToolCall,
    });

    expect(provider.calls).toBe(4); // initial + 3 follow-ups
    expect(getCount).toBe(3);
    expect(res.message.content).toBe('Done. Counted to 3.');
    expect(onToolCall).toHaveBeenCalledTimes(3);
  });

  it('stops at maxToolRounds even if the model keeps calling tools', async () => {
    toolRegistry.register({
      name: 'loop',
      description: 'Always calls itself',
      parameters: { type: 'object', properties: {} },
      handler: async () => ({ loop: true }),
    });

    // Every response emits a tool call — never terminates.
    const provider = new FakeToolCallingProvider(
      Array.from({ length: 20 }, () => ({
        content: '',
        toolCalls: [{ id: 'x', name: 'loop', args: {}, status: 'pending' as const }],
      }))
    );

    const providers = new Map([['fake', provider as unknown as Provider]]);
    const messages: ChatMessage[] = [{ id: 'u1', role: 'user', content: 'go', ts: Date.now() }];

    const res = await sendChat(makeConfig(), providers, messages, {
      toolRegistry,
      onToolCall,
      maxToolRounds: 3,
    });

    // initial + 3 follow-ups = 4 total
    expect(provider.calls).toBe(4);
    expect(onToolCall).toHaveBeenCalledTimes(3);
    // The final message still has tool calls (we hit the cap)
    expect(res.message.toolCalls?.length).toBeGreaterThan(0);
  });

  it('surfaces tool handler errors as status=error', async () => {
    toolRegistry.register({
      name: 'boom',
      description: 'Always fails',
      parameters: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('kaboom');
      },
    });

    const provider = new FakeToolCallingProvider([
      {
        content: '',
        toolCalls: [{ id: 'b1', name: 'boom', args: {}, status: 'pending' }],
      },
      { content: 'Sorry, the tool failed.' },
    ]);

    const providers = new Map([['fake', provider as unknown as Provider]]);
    const messages: ChatMessage[] = [{ id: 'u1', role: 'user', content: 'run boom', ts: Date.now() }];

    const res = await sendChat(makeConfig(), providers, messages, {
      toolRegistry,
      onToolCall,
    });

    expect(provider.calls).toBe(2);
    expect(onToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'boom',
        status: 'error',
        result: { error: 'kaboom' },
      })
    );
    expect(res.message.content).toBe('Sorry, the tool failed.');
  });

  it('does not execute tools when no toolRegistry is provided', async () => {
    const provider = new FakeToolCallingProvider([
      {
        content: '',
        toolCalls: [{ id: 'x', name: 'unreachable', args: {}, status: 'pending' }],
      },
    ]);

    const providers = new Map([['fake', provider as unknown as Provider]]);
    const messages: ChatMessage[] = [{ id: 'u1', role: 'user', content: 'hi', ts: Date.now() }];

    // No toolRegistry → tool calls stay in the response, no execution.
    const res = await sendChat(makeConfig(), providers, messages);
    expect(provider.calls).toBe(1);
    expect(res.message.toolCalls?.length).toBe(1);
    expect(onToolCall).not.toHaveBeenCalled();
  });
});
