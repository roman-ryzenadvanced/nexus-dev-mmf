// ============================================================
// OpenAI-compatible provider — works with OpenAI, Together, Groq,
// OpenRouter, Anyscale, local llama.cpp, vLLM, Ollama (with adapter), etc.
//
// Supports:
//   - Streaming responses (token-by-token via onDelta)
//   - Tool calling (OpenAI function-calling schema)
//   - /v1/models auto-fetch
// ============================================================

import OpenAI from 'openai';
import { BaseProvider, ProviderError } from './base.js';
import type {
  ChatMessage,
  ChatRequestOptions,
  ChatResponse,
  ModelDescriptor,
  ToolCall,
} from '../types.js';

type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type OpenAITool = OpenAI.Chat.Completions.ChatCompletionTool;

export class OpenAIProvider extends BaseProvider {
  readonly kind = 'openai' as const;
  readonly id: string;
  readonly name: string;
  private _client: OpenAI | null = null;
  private _clientOpts: { baseURL: string; apiKey?: string };

  constructor(opts: {
    id: string;
    name: string;
    baseURL?: string;
    apiKey?: string;
  }) {
    super(opts);
    this.id = opts.id;
    this.name = opts.name;
    // Defer OpenAI client construction until first use — if no API key
    // is set, we shouldn't crash on provider registry construction.
    this._clientOpts = {
      baseURL: opts.baseURL || 'https://api.openai.com/v1',
      apiKey: opts.apiKey || process.env.OPENAI_API_KEY,
    };
  }

  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI(this._clientOpts);
    }
    return this._client;
  }

  async fetchModels(): Promise<ModelDescriptor[]> {
    try {
      const list = await this.client.models.list();
      const now = Date.now();
      return Array.from(list.data).map((m) => ({
        id: m.id,
        providerId: this.id,
        label: m.id,
        source: 'auto' as const,
        fetchedAt: now,
        capabilities: { streaming: true, tools: true },
      }));
    } catch (err) {
      throw new ProviderError(
        `Failed to fetch models from ${this.name}: ${(err as Error).message}`,
        this.id,
        undefined,
        err
      );
    }
  }

  async chat(messages: ChatMessage[], opts: ChatRequestOptions = {}): Promise<ChatResponse> {
    this.assertKey();
    const model = opts.model || messages[0]?.model || 'gpt-4o';

    const payload: OpenAIMessage[] = this.toOpenAIMessages(messages);
    const tools: OpenAITool[] | undefined = opts.tools?.length
      ? opts.tools.map((t) => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters as Record<string, unknown>,
          },
        }))
      : undefined;

    try {
      if (opts.stream) {
        return await this.streamChatInternal(payload, model, opts, tools);
      }
      const start = Date.now();
      const completion = await this.client.chat.completions.create({
        model,
        messages: payload,
        tools,
      });
      const choice = completion.choices[0];
      const toolCalls = this.parseToolCalls(choice.message?.tool_calls);
      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content: choice.message?.content || '',
        model,
        provider: this.id,
        elapsedMs: Date.now() - start,
        tokens: completion.usage
          ? { input: completion.usage.prompt_tokens, output: completion.usage.completion_tokens }
          : undefined,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        ts: Date.now(),
      };
      return { message: assistantMsg, raw: completion };
    } catch (err) {
      throw new ProviderError(
        `Chat failed on ${this.name}: ${(err as Error).message}`,
        this.id,
        (err as { status?: number }).status,
        err
      );
    }
  }

  /** Stream tokens via onDelta. Returns the full message at the end. */
  async *streamChat(
    messages: ChatMessage[],
    opts: ChatRequestOptions = {}
  ): AsyncGenerator<string, ChatResponse, unknown> {
    this.assertKey();
    const model = opts.model || messages[0]?.model || 'gpt-4o';
    const payload = this.toOpenAIMessages(messages);
    const tools: OpenAITool[] | undefined = opts.tools?.length
      ? opts.tools.map((t) => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters as Record<string, unknown>,
          },
        }))
      : undefined;

    const stream = await this.client.chat.completions.create({
      model,
      messages: payload,
      tools,
      stream: true,
    });

    let full = '';
    const start = Date.now();
    // Accumulate tool calls across chunks — OpenAI streams them in pieces:
    // first chunk has the id + name, subsequent chunks append to arguments.
    const toolCallAccumulator = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta?.content || '';
      if (delta) {
        full += delta;
        yield delta;
      }

      // Accumulate tool call deltas.
      const toolCallDeltas = choice.delta?.tool_calls;
      if (toolCallDeltas) {
        for (const tcd of toolCallDeltas) {
          const idx = tcd.index;
          const existing = toolCallAccumulator.get(idx) || {
            id: '',
            name: '',
            arguments: '',
          };
          if (tcd.id) existing.id = tcd.id;
          if (tcd.function?.name) existing.name = tcd.function.name;
          if (tcd.function?.arguments) existing.arguments += tcd.function.arguments;
          toolCallAccumulator.set(idx, existing);
        }
      }
    }

    // Parse accumulated tool calls into ToolCall[].
    const toolCalls: ToolCall[] = [];
    for (const [, acc] of Array.from(toolCallAccumulator.entries())) {
      if (!acc.name) continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(acc.arguments || '{}');
      } catch {
        args = { _raw: acc.arguments };
      }
      toolCalls.push({
        id: acc.id,
        name: acc.name,
        args,
        status: 'pending' as const,
      });
    }

    const assistantMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content: full,
      model,
      provider: this.id,
      elapsedMs: Date.now() - start,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      ts: Date.now(),
    };
    return { message: assistantMsg };
  }

  private toOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[] {
    const out: OpenAIMessage[] = [];
    for (const m of messages) {
      if (m.role === 'tool') {
        // Tool result message — must include tool_call_id
        const toolCallId = m.toolCalls?.[0]?.id || 'unknown';
        out.push({
          role: 'tool',
          content: m.content,
          tool_call_id: toolCallId,
        } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam);
      } else if (m.role === 'assistant' && m.toolCalls?.length) {
        // Assistant message with tool calls
        out.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          })),
        } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam);
      } else {
        out.push({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        });
      }
    }
    return out;
  }

  private parseToolCalls(
    raw: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }> | undefined
  ): ToolCall[] {
    if (!raw?.length) return [];
    return raw.map((tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {
        args = { _raw: tc.function.arguments };
      }
      return {
        id: tc.id,
        name: tc.function.name,
        args,
        status: 'pending' as const,
      };
    });
  }

  private async streamChatInternal(
    payload: OpenAIMessage[],
    model: string,
    opts: ChatRequestOptions,
    tools: OpenAITool[] | undefined
  ): Promise<ChatResponse> {
    const stream = await this.client.chat.completions.create({
      model,
      messages: payload,
      tools,
      stream: true,
    });

    let full = '';
    const start = Date.now();
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        full += delta;
        opts.onDelta?.(delta);
      }
    }
    const assistantMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content: full,
      model,
      provider: this.id,
      elapsedMs: Date.now() - start,
      ts: Date.now(),
    };
    return { message: assistantMsg };
  }
}
