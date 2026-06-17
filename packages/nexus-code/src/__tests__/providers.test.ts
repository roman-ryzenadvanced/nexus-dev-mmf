// ============================================================
// Provider integration tests — verify request construction and
// response parsing for OpenAI and Anthropic providers, using
// mocked HTTP endpoints (no real API calls).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '../providers/openai.js';
import { AnthropicProvider } from '../providers/anthropic.js';
import type { ChatMessage } from '../types.js';

// Mock the global fetch for Anthropic tests
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof global.fetch;

describe('OpenAIProvider — request construction + response parsing', () => {
  let provider: OpenAIProvider;
  let chatCreateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    chatCreateMock = vi.fn();
    // Monkey-patch the OpenAI client's chat.completions.create
    provider = new OpenAIProvider({
      id: 'openai-test',
      name: 'OpenAI Test',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    });
    // Access the internal client and replace the create method
    (provider as unknown as { client: { chat: { completions: { create: typeof chatCreateMock } } } })
      .client.chat.completions.create = chatCreateMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a basic chat request with the right model + messages', async () => {
    chatCreateMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'Hello!' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'hi', ts: Date.now() },
    ];
    const res = await provider.chat(messages, { model: 'gpt-4o' });

    expect(chatCreateMock).toHaveBeenCalledTimes(1);
    const callArgs = chatCreateMock.mock.calls[0][0];
    expect(callArgs.model).toBe('gpt-4o');
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(callArgs.tools).toBeUndefined();
    expect(res.message.content).toBe('Hello!');
    expect(res.message.tokens).toEqual({ input: 10, output: 5 });
  });

  it('includes tools when provided', async () => {
    chatCreateMock.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
      usage: { prompt_tokens: 20, completion_tokens: 0 },
    });

    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'what time is it?', ts: Date.now() },
    ];
    await provider.chat(messages, {
      model: 'gpt-4o',
      tools: [
        {
          name: 'get_time',
          description: 'Get current time',
          parameters: { type: 'object', properties: { tz: { type: 'string' } } },
        },
      ],
    });

    const callArgs = chatCreateMock.mock.calls[0][0];
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.tools[0].type).toBe('function');
    expect(callArgs.tools[0].function.name).toBe('get_time');
  });

  it('parses tool_calls from response', async () => {
    chatCreateMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                id: 'call_abc',
                type: 'function',
                function: { name: 'get_time', arguments: '{"tz":"UTC"}' },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 15, completion_tokens: 10 },
    });

    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'what time is it in UTC?', ts: Date.now() },
    ];
    const res = await provider.chat(messages, { model: 'gpt-4o' });

    expect(res.message.toolCalls).toHaveLength(1);
    expect(res.message.toolCalls[0]).toEqual({
      id: 'call_abc',
      name: 'get_time',
      args: { tz: 'UTC' },
      status: 'pending',
    });
  });

  it('handles malformed tool_call arguments gracefully', async () => {
    chatCreateMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                id: 'call_xyz',
                type: 'function',
                function: { name: 'broken', arguments: 'not valid json{' },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 5 },
    });

    const res = await provider.chat([{ id: 'u', role: 'user', content: 'go', ts: Date.now() }], {
      model: 'gpt-4o',
    });

    expect(res.message.toolCalls).toHaveLength(1);
    expect(res.message.toolCalls[0].args).toEqual({ _raw: 'not valid json{' });
  });

  it('converts tool result messages correctly (role=tool → tool_call_id)', async () => {
    chatCreateMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'Time is noon' } }],
      usage: { prompt_tokens: 30, completion_tokens: 5 },
    });

    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'what time?', ts: Date.now() },
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        ts: Date.now(),
        toolCalls: [{ id: 'call_1', name: 'get_time', args: {}, status: 'ok' }],
      },
      {
        id: 't1',
        role: 'tool',
        content: 'noon',
        ts: Date.now(),
        toolCalls: [{ id: 'call_1', name: 'get_time', args: {}, status: 'ok', result: 'noon' }],
      },
    ];

    await provider.chat(messages, { model: 'gpt-4o' });

    const sent = chatCreateMock.mock.calls[0][0].messages;
    // user, assistant (with tool_calls), tool (with tool_call_id)
    expect(sent).toHaveLength(3);
    expect(sent[0]).toEqual({ role: 'user', content: 'what time?' });
    expect(sent[1].role).toBe('assistant');
    expect(sent[1].tool_calls).toHaveLength(1);
    expect(sent[1].tool_calls[0].id).toBe('call_1');
    expect(sent[2].role).toBe('tool');
    expect(sent[2].tool_call_id).toBe('call_1');
    expect(sent[2].content).toBe('noon');
  });

  it('throws ProviderError on API failure', async () => {
    chatCreateMock.mockRejectedValueOnce(
      Object.assign(new Error('Rate limited'), { status: 429 })
    );

    await expect(
      provider.chat([{ id: 'u', role: 'user', content: 'hi', ts: Date.now() }], {
        model: 'gpt-4o',
      })
    ).rejects.toThrow('Chat failed on OpenAI Test');
  });

  it('fetchModels calls /v1/models', async () => {
    const listMock = vi.fn().mockReturnValue({
      data: [
        { id: 'gpt-4o' },
        { id: 'gpt-4o-mini' },
        { id: 'o1-preview' },
      ],
    });
    (provider as unknown as { client: { models: { list: typeof listMock } } })
      .client.models.list = listMock;

    const models = await provider.fetchModels();

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(models).toHaveLength(3);
    expect(models[0].id).toBe('gpt-4o');
    expect(models[0].providerId).toBe('openai-test');
    expect(models[0].source).toBe('auto');
  });
});

describe('AnthropicProvider — request construction + response parsing', () => {
  let provider: AnthropicProvider;
  let messagesCreateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    messagesCreateMock = vi.fn();
    provider = new AnthropicProvider({
      id: 'anthropic-test',
      name: 'Anthropic Test',
      baseURL: 'https://api.anthropic.com',
      apiKey: 'sk-ant-test',
    });
    (provider as unknown as { client: { messages: { create: typeof messagesCreateMock } } })
      .client.messages.create = messagesCreateMock;
    fetchMock.mockReset();
  });

  it('sends a basic chat request with system separated from turns', async () => {
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hello!' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const messages: ChatMessage[] = [
      { id: 's1', role: 'system', content: 'You are helpful.', ts: Date.now() },
      { id: 'u1', role: 'user', content: 'hi', ts: Date.now() },
    ];
    const res = await provider.chat(messages, { model: 'claude-3-5-sonnet-20241022' });

    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    const callArgs = messagesCreateMock.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-3-5-sonnet-20241022');
    expect(callArgs.system).toBe('You are helpful.');
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(res.message.content).toBe('Hello!');
    expect(res.message.tokens).toEqual({ input: 10, output: 5 });
  });

  it('includes tools with input_schema.type=object', async () => {
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: '' }],
      usage: { input_tokens: 10, output_tokens: 0 },
    });

    await provider.chat(
      [{ id: 'u', role: 'user', content: 'what time?', ts: Date.now() }],
      {
        model: 'claude-3-5-sonnet-20241022',
        tools: [
          {
            name: 'get_time',
            description: 'Get time',
            parameters: { properties: { tz: { type: 'string' } } },
          },
        ],
      }
    );

    const callArgs = messagesCreateMock.mock.calls[0][0];
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.tools[0].name).toBe('get_time');
    expect(callArgs.tools[0].input_schema.type).toBe('object');
    expect(callArgs.tools[0].input_schema.properties).toEqual({ tz: { type: 'string' } });
  });

  it('parses tool_use blocks from response', async () => {
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Let me check the time.' },
        {
          type: 'tool_use',
          id: 'toolu_abc',
          name: 'get_time',
          input: { tz: 'UTC' },
        },
      ],
      usage: { input_tokens: 20, output_tokens: 15 },
    });

    const res = await provider.chat(
      [{ id: 'u', role: 'user', content: 'time?', ts: Date.now() }],
      { model: 'claude-3-5-sonnet-20241022' }
    );

    expect(res.message.content).toBe('Let me check the time.');
    expect(res.message.toolCalls).toHaveLength(1);
    expect(res.message.toolCalls[0]).toEqual({
      id: 'toolu_abc',
      name: 'get_time',
      args: { tz: 'UTC' },
      status: 'pending',
    });
  });

  it('converts tool result messages to user/tool_result blocks', async () => {
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Time is noon' }],
      usage: { input_tokens: 30, output_tokens: 5 },
    });

    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'time?', ts: Date.now() },
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        ts: Date.now(),
        toolCalls: [{ id: 'toolu_1', name: 'get_time', args: { tz: 'UTC' }, status: 'pending' }],
      },
      {
        id: 't1',
        role: 'tool',
        content: 'noon',
        ts: Date.now(),
        toolCalls: [{ id: 'toolu_1', name: 'get_time', args: {}, status: 'ok', result: 'noon' }],
      },
    ];

    await provider.chat(messages, { model: 'claude-3-5-sonnet-20241022' });

    const sent = messagesCreateMock.mock.calls[0][0].messages;
    expect(sent).toHaveLength(3);
    expect(sent[0]).toEqual({ role: 'user', content: 'time?' });
    // Assistant message with tool_use block
    expect(sent[1].role).toBe('assistant');
    expect(sent[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool_use', id: 'toolu_1', name: 'get_time' }),
      ])
    );
    // Tool result as user message with tool_result block
    expect(sent[2].role).toBe('user');
    expect(sent[2].content[0].type).toBe('tool_result');
    expect(sent[2].content[0].tool_use_id).toBe('toolu_1');
    expect(sent[2].content[0].content).toBe('noon');
  });

  it('fetchModels calls /v1/models with x-api-key + anthropic-version headers', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: 'claude-3-5-sonnet-20241022' },
            { id: 'claude-3-opus-20240229', display_name: 'Claude 3 Opus' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const models = await provider.fetchModels();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('https://api.anthropic.com/v1/models?limit=100');
    expect(call[1].headers['x-api-key']).toBe('sk-ant-test');
    expect(call[1].headers['anthropic-version']).toBe('2023-06-01');

    expect(models).toHaveLength(2);
    expect(models[0].id).toBe('claude-3-5-sonnet-20241022');
    expect(models[1].label).toBe('Claude 3 Opus');
  });

  it('fetchModels throws ProviderError when API returns 404', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );

    await expect(provider.fetchModels()).rejects.toThrow('HTTP 404');
  });

  it('throws ProviderError when apiKey is missing', async () => {
    const noKey = new AnthropicProvider({
      id: 'no-key',
      name: 'No Key',
      baseURL: 'https://api.anthropic.com',
    });
    await expect(
      noKey.chat([{ id: 'u', role: 'user', content: 'hi', ts: Date.now() }])
    ).rejects.toThrow('missing an API key');
  });
});
