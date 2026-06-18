// ============================================================
// Z.ai provider — wraps z-ai-web-dev-sdk (real SDK shape).
//
// SDK shape (v0.0.18):
//   import ZAI from 'z-ai-web-dev-sdk';
//   const client = await ZAI.create();   // async factory
//   await client.chat.completions.create({ model, messages, stream });
//
// MMFE orchestrator integration:
//   The nexus-dev-mmf root package (this monorepo) exposes a separate
//   `createOrchestrator` function. We try to import it dynamically; if
//   it's not available (e.g. only the TUI package is installed), we
//   fall back to direct provider calls and surface a warning.
// ============================================================

import { BaseProvider, ProviderError } from './base.js';
import type { ChatMessage, ChatRequestOptions, ChatResponse, ModelDescriptor, RoutingDecision, ToolCall } from '../types.js';
import { BUILTIN_MODELS } from '../config/schema.js';
import { loadZAIClient } from './zai-loader.js';

// ============================================================
// SSE stream parser.
// z-ai-web-dev-sdk returns the raw fetch `ReadableStream<Uint8Array>` of
// Server-Sent-Events text (lines like `data: {...}\n\n` ending with
// `data: [DONE]`). The OpenAI/Anthropic SDKs parse this for us, but the
// z-ai SDK does not, so we do it here. Yields just the content deltas.
// ============================================================
// Shape of one parsed SSE frame / non-streaming completion chunk.
type SSEChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
};

// Yield parsed SSE chunk objects from whatever the SDK returned. Extracts both
// content deltas and tool-call deltas, so callers can render streaming text AND
// drive tool-call chains.
async function* readSSEChunks(body: unknown): AsyncGenerator<SSEChunk, void, unknown> {
  if (body == null) return;

  // IMPORTANT: detect raw byte streams (getReader / Node `.on`) BEFORE the
  // async-iterable path. Modern Node makes web ReadableStream async-iterable
  // too, but iterating it yields raw Uint8Array chunks, NOT parsed objects —
  // so we must parse the SSE frames ourselves.
  if (typeof (body as ReadableStream<Uint8Array>).getReader === 'function') {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // Extract complete lines, keep the remainder in buf.
        let idx: number;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          const json = extractSSEJSON(line);
          if (json) yield json;
        }
      }
      // Flush any trailing partial line.
      for (const line of buf.split('\n')) {
        const json = extractSSEJSON(line);
        if (json) yield json;
      }
    } finally {
      reader.releaseLock();
    }
    return;
  }

  if (typeof (body as NodeJS.ReadableStream).on === 'function') {
    // Node stream: buffer everything, then split (these are used as a fallback
    // for non-web runtimes; streaming cadence is preserved by yielding after).
    const nodeStream = body as NodeJS.ReadableStream;
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    await new Promise<void>(resolve => {
      nodeStream.on('data', (chunk: Buffer | string) => {
        chunks.push(typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true }));
      });
      nodeStream.on('end', () => resolve());
      nodeStream.on('error', () => resolve());
    });
    for (const line of chunks.join('').split('\n')) {
      const json = extractSSEJSON(line);
      if (json) yield json;
    }
    return;
  }

  // Already-parsed async iterable of chunk objects (other SDK versions).
  if (typeof (body as AsyncIterable<SSEChunk>)[Symbol.asyncIterator] === 'function') {
    for await (const chunk of body as AsyncIterable<SSEChunk>) yield chunk;
    return;
  }

  // Unknown shape — best effort: stringify and try to pull JSON lines.
  for (const line of String(body).split('\n')) {
    const json = extractSSEJSON(line);
    if (json) yield json;
  }
}

function extractSSEJSON(line: string): SSEChunk | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    return JSON.parse(payload) as SSEChunk;
  } catch {
    return null;
  }
}

// Minimal shape of the ZAI SDK instance we depend on.
// OpenAI-compatible message/tool shapes the z-ai SDK accepts (it spreads the
// request body straight onto the POST, so tool calling works like OpenAI).
type ZAIMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls: Array<unknown> }
  | { role: 'tool'; content: string; tool_call_id: string };

type ZAITool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

interface ZAIClient {
  chat: {
    completions: {
      create: (body: {
        model?: string;
        messages: ZAIMessage[];
        stream?: boolean;
        thinking?: { type: 'enabled' | 'disabled' };
        tools?: ZAITool[];
        tool_choice?: string;
      }) => Promise<unknown>;
    };
  };
}

interface ZAISDKModule {
  default: { create: () => Promise<ZAIClient> };
}

// Minimal shape of the MMFE orchestrator (separate package).
interface OrchestratorEvents {
  on(event: string, listener: (e: { type: string; data: Record<string, unknown> }) => void): unknown;
  off(event: string, listener: (e: { type: string; data: Record<string, unknown> }) => void): unknown;
}
interface Orchestrator {
  process: (
    prompt: string,
    opts?: Record<string, unknown>
  ) => Promise<{
    answer: string;
    modelsUsed: string[];
    qualityScore: number;
    routingDecisions: RoutingDecision[];
  }>;
  /** Event emitter for live pipeline progress (optional on older versions). */
  getEvents?: () => OrchestratorEvents;
}
interface MMFEModule {
  createOrchestrator?: (opts: Record<string, unknown>) => Orchestrator;
}

async function loadZAISDK(apiKey?: string): Promise<ZAIClient> {
  // Delegate to the shared loader (zai-loader.ts): it auto-creates
  // ~/.z-ai-config, probes the primary endpoint (401 ≠ down), and falls
  // back to the secondary URL only on 5xx / network failure.
  try {
    return (await loadZAIClient(apiKey)) as ZAIClient;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError((err as Error).message, 'zai', undefined, err);
  }
}

async function tryLoadOrchestrator(): Promise<Orchestrator | null> {
  const { resolve, dirname, join } = await import('node:path');
  const { fileURLToPath, pathToFileURL } = await import('node:url');

  // Candidate modules, in order: published `nexus-dev-mmf` package, then the
  // monorepo sibling build (this repo's own dist/ — used during dev when the
  // root package isn't self-linked in node_modules). Both are ESM, so we use
  // dynamic import() (not require()).
  const candidateUrls: string[] = [];
  candidateUrls.push('nexus-dev-mmf');
  try {
    // From dist/providers/zai.js (or src/providers/zai.ts), four levels up is
    // the monorepo root; its compiled entry is dist/index.js.
    const here = fileURLToPath(import.meta.url);
    const repoRoot = resolve(dirname(here), '..', '..', '..', '..');
    candidateUrls.push(pathToFileURL(join(repoRoot, 'dist', 'index.js')).href);
  } catch {
    // Path resolution failed — skip the relative candidate.
  }

  const mods = await Promise.all(candidateUrls.map(u => import(u).then(m => m as MMFEModule).catch(() => null as unknown as MMFEModule)));
  for (const mod of mods) {
    if (mod && typeof mod.createOrchestrator === 'function') {
      return mod.createOrchestrator({
        defaultMode: 'balanced',
        maxParallelSubTasks: 6,
        enableThinking: true,
        verboseRouting: true,
      });
    }
  }
  return null;
}

export class ZAIProvider extends BaseProvider {
  readonly kind = 'zai' as const;
  readonly id = 'zai';
  readonly name = 'Z.ai (MMFE native)';
  private cachedClient: ZAIClient | null = null;
  private cachedOrchestrator: Orchestrator | null | undefined = undefined;

  constructor(opts: { apiKey?: string } = {}) {
    super(opts);
    this.apiKey = opts.apiKey || process.env.ZAI_API_KEY;
  }

  private async client(): Promise<ZAIClient> {
    if (!this.cachedClient) {
      this.cachedClient = await loadZAISDK(this.apiKey);
    }
    return this.cachedClient;
  }

  private async orchestrator(): Promise<Orchestrator | null> {
    if (this.cachedOrchestrator === undefined) {
      this.cachedOrchestrator = await tryLoadOrchestrator();
    }
    return this.cachedOrchestrator;
  }

  async fetchModels(): Promise<ModelDescriptor[]> {
    // The ZAI SDK doesn't expose a listModels() method.
    // Return the builtin roster — users can add more via /add.
    return BUILTIN_MODELS.map(m => ({ ...m, source: 'builtin' as const }));
  }

  async chat(messages: ChatMessage[], opts: ChatRequestOptions = {}): Promise<ChatResponse> {
    const model = opts.model || 'glm-5.2';
    const start = Date.now();

    try {
      // MMFE path — if orchestrator is available and MMFE is on, route through it.
      const useMMFE = !opts.noMMFE;
      const orch = useMMFE ? await this.orchestrator() : null;

      if (useMMFE && orch) {
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        const prompt = lastUser?.content || '';

        // Subscribe to live pipeline events so the UI can show REAL progress
        // (stage + subtask throughput) instead of zeroed metrics while the
        // non-streaming fusion runs. Subtasks/models are accumulated here.
        let routedTotal = 0;
        let completed = 0;
        const activeModels = new Set<string>();
        let lastStage = 'starting';
        const forward = opts.onProgress
          ? (e: { type: string; data: Record<string, unknown> }) => {
              try {
                const d = e.data || {};
                if (e.type === 'pipeline:stage' && typeof d.stage === 'string') {
                  lastStage = String(d.stage);
                } else if (e.type === 'subtask:routed') {
                  routedTotal++;
                  if (typeof d.selectedModel === 'string') activeModels.add(String(d.selectedModel));
                } else if (e.type === 'subtask:completed') {
                  completed++;
                  if (typeof d.modelId === 'string') activeModels.add(String(d.modelId));
                } else if (e.type === 'synthesis:started') {
                  lastStage = 'synthesizing';
                }
                opts.onProgress?.({
                  stage: lastStage,
                  subtasksDone: completed,
                  subtasksTotal: routedTotal,
                  modelsActive: [...activeModels],
                });
              } catch {
                // Progress forwarding must never break a chat.
              }
            }
          : null;
        const events = forward && typeof orch.getEvents === 'function' ? orch.getEvents() : null;
        if (events && forward) {
          events.on('*', forward);
        }

        let result;
        try {
          result = await orch.process(prompt, {
            preferredMode: opts.mode || 'balanced',
            enableThinking: true,
          });
        } finally {
          if (events && forward) events.off('*', forward);
        }

        if (result.routingDecisions && opts.onRouting) {
          opts.onRouting(result.routingDecisions);
        }

        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: result.answer,
          model: result.modelsUsed.join(', '),
          provider: this.id,
          elapsedMs: Date.now() - start,
          routing: result.routingDecisions,
          qualityScore: result.qualityScore,
          ts: Date.now(),
        };
        return { message: assistantMsg, raw: result };
      }

      // Direct provider call — bypass orchestrator.
      const client = await this.client();
      const payload = toZAIMessages(messages);
      const tools = toZAITools(opts.tools);

      const res = (await client.chat.completions.create({
        model,
        messages: payload,
        stream: false,
        thinking: { type: 'enabled' },
        tools,
        tool_choice: tools ? 'auto' : undefined,
      })) as {
        choices?: Array<{
          message?: {
            content?: string;
            tool_calls?: Array<{
              id: string;
              function: { name: string; arguments: string };
            }>;
          };
          delta?: { content?: string };
          finish_reason?: string;
        }>;
        content?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const choice = res.choices?.[0];
      const text = choice?.message?.content || res.content || '';
      const toolCalls = parseZAIToolCalls(choice?.message?.tool_calls);

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content: text,
        model,
        provider: this.id,
        elapsedMs: Date.now() - start,
        tokens: res.usage
          ? {
              input: res.usage.prompt_tokens ?? 0,
              output: res.usage.completion_tokens ?? 0,
            }
          : undefined,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        ts: Date.now(),
      };
      return { message: assistantMsg, raw: res };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(`Z.ai chat failed: ${(err as Error).message}`, this.id, undefined, err);
    }
  }

  async *streamChat(messages: ChatMessage[], opts: ChatRequestOptions = {}): AsyncGenerator<string, ChatResponse, unknown> {
    const model = opts.model || 'glm-5.2';
    const client = await this.client();
    const payload = toZAIMessages(messages);
    const tools = toZAITools(opts.tools);

    const res = await client.chat.completions.create({
      model,
      messages: payload,
      stream: true,
      tools,
      tool_choice: tools ? 'auto' : undefined,
    });

    let full = '';
    const start = Date.now();
    // Accumulate tool calls across SSE chunks (GLM streams them in pieces,
    // same as OpenAI: id+name first, arguments appended across frames).
    const toolAccumulator = new Map<number, { id: string; name: string; arguments: string }>();

    // The z-ai-web-dev-sdk returns the raw fetch ReadableStream (SSE text)
    // when stream:true — readSSEChunks parses the `data: {...}` frames.
    for await (const chunk of readSSEChunks(res)) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta?.content;
      if (delta) {
        full += delta;
        yield delta;
      }
      const tcds = choice.delta?.tool_calls;
      if (tcds) {
        for (const tcd of tcds) {
          const idx = tcd.index;
          const existing = toolAccumulator.get(idx) || {
            id: '',
            name: '',
            arguments: '',
          };
          if (tcd.id) existing.id = tcd.id;
          if (tcd.function?.name) existing.name = tcd.function.name;
          if (tcd.function?.arguments) existing.arguments += tcd.function.arguments;
          toolAccumulator.set(idx, existing);
        }
      }
    }

    const toolCalls: ToolCall[] = [];
    for (const [, acc] of Array.from(toolAccumulator.entries())) {
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
}

// ---- tool / message helpers (OpenAI-compatible; GLM uses the same shape) ----

function toZAITools(tools?: ChatRequestOptions['tools']): ZAITool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function toZAIMessages(messages: ChatMessage[]): ZAIMessage[] {
  const out: ZAIMessage[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({
        role: 'tool',
        content: m.content,
        tool_call_id: m.toolCalls?.[0]?.id || 'unknown',
      });
    } else if (m.role === 'assistant' && m.toolCalls?.length) {
      out.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      });
    } else {
      out.push({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      });
    }
  }
  return out;
}

function parseZAIToolCalls(raw?: Array<{ id: string; function: { name: string; arguments: string } }>): ToolCall[] {
  if (!raw?.length) return [];
  return raw.map(tc => {
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
