// ============================================================
// Tool calling protocol — provider-agnostic
//
// Tools are registered with a name, JSON schema for args, and a
// handler. Providers that support tool calling (OpenAI, Anthropic,
// GLM-5.2+) emit tool_call deltas that the protocol executes and
// feeds back as tool_result messages.
// ============================================================

import type { ChatMessage, ToolCall } from '../../types.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema7;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export type JSONSchema7 = {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
  properties?: Record<string, JSONSchema7>;
  required?: string[];
  enum?: unknown[];
  description?: string;
  items?: JSONSchema7;
  additionalProperties?: boolean | JSONSchema7;
  [key: string]: unknown;
};

export interface ProviderToolSchema {
  /** OpenAI-style tool schema, or Anthropic-style, depending on provider. */
  format: 'openai' | 'anthropic';
  tools: unknown[];
}

/** Convert internal ToolDefinition[] to OpenAI tool schema. */
export function toOpenAITools(tools: ToolDefinition[]): unknown[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/** Convert internal ToolDefinition[] to Anthropic tool schema. */
export function toAnthropicTools(tools: ToolDefinition[]): unknown[] {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  clear(): void {
    this.tools.clear();
  }

  /** Execute a tool call by name with the given args. */
  async execute(name: string, args: Record<string, unknown>): Promise<ToolCall> {
    const tool = this.tools.get(name);
    const id = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const call: ToolCall = { id, name, args, status: 'running' };
    if (!tool) {
      call.status = 'error';
      call.result = { error: `Unknown tool: ${name}` };
      return call;
    }
    try {
      call.result = await tool.handler(args);
      call.status = 'ok';
    } catch (err) {
      call.result = { error: (err as Error).message };
      call.status = 'error';
    }
    return call;
  }

  /** Convert a finalized tool call into a ChatMessage for the transcript. */
  toToolMessage(call: ToolCall): ChatMessage {
    return {
      id: call.id,
      role: 'tool',
      content: typeof call.result === 'string' ? call.result : JSON.stringify(call.result, null, 2),
      ts: Date.now(),
      toolCalls: [call],
    };
  }
}
