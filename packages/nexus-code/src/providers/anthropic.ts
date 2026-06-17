// ============================================================
// Anthropic provider — claude family + any Anthropic-compatible endpoint
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, ProviderError } from './base.js';
import type { ChatMessage, ChatRequestOptions, ChatResponse, ModelDescriptor } from '../types.js';

export class AnthropicProvider extends BaseProvider {
  readonly kind = 'anthropic' as const;
  readonly id: string;
  readonly name: string;
  private _client: Anthropic | null = null;
  private _clientOpts: { baseURL?: string; apiKey?: string };

  constructor(opts: {
    id: string;
    name: string;
    baseURL?: string;
    apiKey?: string;
  }) {
    super(opts);
    this.id = opts.id;
    this.name = opts.name;
    // Defer Anthropic client construction until first use.
    this._clientOpts = {
      baseURL: opts.baseURL || undefined,
      apiKey: opts.apiKey || process.env.ANTHROPIC_API_KEY,
    };
  }

  private get client(): Anthropic {
    if (!this._client) {
      this._client = new Anthropic(this._clientOpts);
    }
    return this._client;
  }

  async fetchModels(): Promise<ModelDescriptor[]> {
    // Anthropic SDK doesn't expose .models.list() directly. Use raw fetch
    // against the /v1/models endpoint (Anthropic added it in 2024-10).
    // Some Anthropic-compatible endpoints don't expose it — return empty
    // so users can register models manually via /add.
    if (!this.apiKey) {
      throw new ProviderError(
        `Cannot fetch models from ${this.name} without an API key. ` +
        `Add models manually via /add ${this.id} <model-id>.`,
        this.id
      );
    }
    try {
      const base = this.baseURL || 'https://api.anthropic.com';
      const url = `${base.replace(/\/$/, '')}/v1/models?limit=100`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      if (!res.ok) {
        throw new ProviderError(
          `Failed to fetch models from ${this.name}: HTTP ${res.status} ${res.statusText}. ` +
          `Add models manually via /add ${this.id} <model-id>.`,
          this.id,
          res.status
        );
      }
      const json = (await res.json()) as { data?: Array<{ id: string; display_name?: string }> };
      const now = Date.now();
      return (json.data || []).map((m) => ({
        id: m.id,
        providerId: this.id,
        label: m.display_name || m.id,
        source: 'auto' as const,
        fetchedAt: now,
        capabilities: { streaming: true, tools: true, thinking: m.id.includes('opus') },
      }));
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        `Failed to fetch models from ${this.name}: ${(err as Error).message}. ` +
        `Add models manually via /add ${this.id} <model-id>.`,
        this.id,
        undefined,
        err
      );
    }
  }

  async chat(messages: ChatMessage[], opts: ChatRequestOptions = {}): Promise<ChatResponse> {
    this.assertKey();
    const model = opts.model || messages[0]?.model || 'claude-3-5-sonnet-20241022';

    // Anthropic separates system from the message stream.
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const turns = this.toAnthropicTurns(messages.filter((m) => m.role !== 'system'));
    const tools = opts.tools?.length
      ? opts.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: {
            type: 'object' as const,
            ...(t.parameters as Record<string, unknown>),
          },
        }))
      : undefined;

    try {
      if (opts.stream) {
        return await this.streamChatInternal(system, turns, model, opts, tools);
      }
      const start = Date.now();
      const res = await this.client.messages.create({
        model,
        system,
        messages: turns,
        max_tokens: 4096,
        tools,
      });
      const text = res.content
        .filter((c): c is Anthropic.Messages.TextBlock => c.type === 'text')
        .map((c) => c.text)
        .join('');
      const toolUses = res.content.filter(
        (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use'
      );
      const toolCalls = toolUses.map((tu) => ({
        id: tu.id,
        name: tu.name,
        args: (tu.input as Record<string, unknown>) || {},
        status: 'pending' as const,
      }));
      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content: text,
        model,
        provider: this.id,
        elapsedMs: Date.now() - start,
        tokens: { input: res.usage.input_tokens, output: res.usage.output_tokens },
        toolCalls: toolCalls.length ? toolCalls : undefined,
        ts: Date.now(),
      };
      return { message: assistantMsg, raw: res };
    } catch (err) {
      throw new ProviderError(
        `Chat failed on ${this.name}: ${(err as Error).message}`,
        this.id,
        (err as { status?: number }).status,
        err
      );
    }
  }

  /** Stream tokens via onDelta. Returns full message at the end. */
  async *streamChat(
    messages: ChatMessage[],
    opts: ChatRequestOptions = {}
  ): AsyncGenerator<string, ChatResponse, unknown> {
    this.assertKey();
    const model = opts.model || messages[0]?.model || 'claude-3-5-sonnet-20241022';
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const turns = this.toAnthropicTurns(messages.filter((m) => m.role !== 'system'));
    const tools = opts.tools?.length
      ? opts.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: {
            type: 'object' as const,
            ...(t.parameters as Record<string, unknown>),
          },
        }))
      : undefined;

    const stream = this.client.messages.stream({
      model,
      system,
      messages: turns,
      max_tokens: 4096,
      tools,
    });

    let full = '';
    const start = Date.now();
    stream.on('text', (delta) => {
      full += delta;
      opts.onDelta?.(delta);
    });
    // finalMessage() returns the full message with all content blocks
    // (text + tool_use). We capture tool calls from it.
    const final = await stream.finalMessage();

    // Extract tool_use blocks from the final message.
    const toolUses = final.content.filter(
      (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use'
    );
    const toolCalls = toolUses.map((tu) => ({
      id: tu.id,
      name: tu.name,
      args: (tu.input as Record<string, unknown>) || {},
      status: 'pending' as const,
    }));

    const assistantMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content: full,
      model,
      provider: this.id,
      elapsedMs: Date.now() - start,
      tokens: { input: final.usage.input_tokens, output: final.usage.output_tokens },
      toolCalls: toolCalls.length ? toolCalls : undefined,
      ts: Date.now(),
    };
    return { message: assistantMsg, raw: final };
  }

  /** Convert internal ChatMessage[] to Anthropic's message format (with tool_use / tool_result blocks). */
  private toAnthropicTurns(
    messages: ChatMessage[]
  ): Array<Anthropic.Messages.MessageParam> {
    return messages.map((m) => {
      if (m.role === 'tool') {
        // Tool result — Anthropic expects a user message with tool_result content
        const toolUseId = m.toolCalls?.[0]?.id || 'unknown';
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: m.content,
            },
          ],
        };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        // Assistant with tool_use blocks
        const blocks: Array<Anthropic.Messages.ContentBlock> = [];
        if (m.content) {
          blocks.push({ type: 'text', text: m.content });
        }
        for (const tc of m.toolCalls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.args,
          });
        }
        return { role: 'assistant', content: blocks };
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      };
    });
  }

  private async streamChatInternal(
    system: string,
    turns: Array<Anthropic.Messages.MessageParam>,
    model: string,
    opts: ChatRequestOptions,
    tools?: Array<{
      name: string;
      description: string;
      input_schema: { type: 'object'; [k: string]: unknown };
    }>
  ): Promise<ChatResponse> {
    const stream = this.client.messages.stream({
      model,
      system,
      messages: turns,
      max_tokens: 4096,
      tools,
    });

    let full = '';
    const start = Date.now();
    stream.on('text', (delta) => {
      full += delta;
      opts.onDelta?.(delta);
    });
    await stream.finalMessage();

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
