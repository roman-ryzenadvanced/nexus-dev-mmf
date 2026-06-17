// ============================================================
// MMFE orchestrator bridge
// Wraps the active provider so the rest of the TUI can call one
// function regardless of whether MMFE is on or off, and regardless
// of whether the active provider is OpenAI, Anthropic, or Z.ai.
//
// Adds a tool-call execution loop: when a provider response includes
// toolCalls, the orchestrator executes them via the ToolRegistry,
// appends the results as tool messages, and re-calls the provider —
// up to maxToolRounds times.
// ============================================================

import type { Provider } from '../providers/base.js';
import type {
  AppConfig,
  ChatMessage,
  ChatRequestOptions,
  ChatResponse,
  ToolCall,
} from '../types.js';
import { getActiveProvider } from '../config/index.js';
import { chatWithRetry } from '../providers/retry.js';
import type { ToolRegistry } from '../tools/protocol/index.js';

export interface OrchestratorOptions extends ChatRequestOptions {
  /** If true, force-bypass MMFE for this call (provider-unlocked mode). */
  noMMFE?: boolean;
  /** Mode override for this call. */
  mode?: AppConfig['mode'];
  /** Retry options forwarded to chatWithRetry. */
  retry?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (info: { attempt: number; error: Error; nextDelayMs: number }) => void;
  };
  /** Tool registry — if provided, tool calls in responses will be executed automatically. */
  toolRegistry?: ToolRegistry;
  /** Called when a tool is executed (for UI feedback). */
  onToolCall?: (call: ToolCall) => void;
}

const DEFAULT_MAX_TOOL_ROUNDS = 5;

export async function sendChat(
  config: AppConfig,
  providers: Map<string, Provider>,
  messages: ChatMessage[],
  opts: OrchestratorOptions = {}
): Promise<ChatResponse> {
  const providerCfg = getActiveProvider(config);
  const provider = providers.get(providerCfg.id);
  if (!provider) {
    throw new Error(`Provider "${providerCfg.id}" is configured but not constructed.`);
  }

  const mmfeOff = opts.noMMFE || !providerCfg.mmfe || !config.useMMFE;
  const maxRounds = opts.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  const toolRegistry = opts.toolRegistry;

  const chatOpts: ChatRequestOptions = {
    ...opts,
    mode: opts.mode || config.mode,
    noMMFE: mmfeOff,
  };

  // Always wrap in retry — both MMFE-routed and direct calls benefit.
  let res = await chatWithRetry(provider, messages, chatOpts, opts.retry ?? { maxRetries: 2 });

  // Tool-call execution loop.
  // If the response includes toolCalls AND we have a registry, execute
  // them, append results as tool messages, and re-call the provider.
  // Continue until the model stops emitting toolCalls or we hit maxRounds.
  if (toolRegistry && res.message.toolCalls?.length) {
    let currentMessages = [...messages, res.message];
    for (let round = 0; round < maxRounds; round++) {
      const pendingCalls = res.message.toolCalls;
      if (!pendingCalls?.length) break;

      // Execute each tool call and append the result as a tool message.
      for (const call of pendingCalls) {
        const executed = await toolRegistry.execute(call.name, call.args);
        opts.onToolCall?.(executed);
        const toolMsg: ChatMessage = {
          id: executed.id,
          role: 'tool',
          content:
            typeof executed.result === 'string'
              ? executed.result
              : JSON.stringify(executed.result, null, 2),
          toolCalls: [executed],
          ts: Date.now(),
        };
        currentMessages = [...currentMessages, toolMsg];
      }

      // Re-call the provider with the updated message list.
      res = await chatWithRetry(provider, currentMessages, chatOpts, opts.retry ?? { maxRetries: 2 });
      if (!res.message.toolCalls?.length) break;
    }
  }

  return res;
}

export function activeMode(config: AppConfig): AppConfig['mode'] {
  return config.mode;
}

/**
 * Streaming variant of sendChat — uses the provider's streamChat() async
 * generator to yield token deltas as they arrive. Returns the final
 * ChatResponse (with tool calls, if any) when the stream completes.
 *
 * If the provider doesn't implement streamChat(), falls back to the
 * non-streaming chat() path (opts.onDelta is still called once with the
 * full content).
 *
 * Tool-call execution loop: if a registry is provided AND the final
 * streamed response includes toolCalls, the orchestrator executes them
 * and re-calls the provider — re-streaming each follow-up response.
 */
export async function sendChatStream(
  config: AppConfig,
  providers: Map<string, Provider>,
  messages: ChatMessage[],
  opts: OrchestratorOptions = {}
): Promise<ChatResponse> {
  const providerCfg = getActiveProvider(config);
  const provider = providers.get(providerCfg.id);
  if (!provider) {
    throw new Error(`Provider "${providerCfg.id}" is configured but not constructed.`);
  }

  const mmfeOff = opts.noMMFE || !providerCfg.mmfe || !config.useMMFE;
  const maxRounds = opts.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  const toolRegistry = opts.toolRegistry;

  const chatOpts: ChatRequestOptions = {
    ...opts,
    mode: opts.mode || config.mode,
    noMMFE: mmfeOff,
  };

  // If the provider doesn't implement streamChat(), fall back to sendChat
  // (which uses non-streaming chat() but still calls onDelta with the full text).
  if (!provider.streamChat) {
    return sendChat(config, providers, messages, opts);
  }

  // First streaming call.
  let res = await runStreamWithRetry(provider, messages, chatOpts, opts.retry);

  // Tool-call execution loop — same logic as sendChat, but each follow-up
  // call also streams its tokens to onDelta.
  if (toolRegistry && res.message.toolCalls?.length) {
    let currentMessages = [...messages, res.message];
    for (let round = 0; round < maxRounds; round++) {
      const pendingCalls = res.message.toolCalls;
      if (!pendingCalls?.length) break;

      for (const call of pendingCalls) {
        const executed = await toolRegistry.execute(call.name, call.args);
        opts.onToolCall?.(executed);
        const toolMsg: ChatMessage = {
          id: executed.id,
          role: 'tool',
          content:
            typeof executed.result === 'string'
              ? executed.result
              : JSON.stringify(executed.result, null, 2),
          toolCalls: [executed],
          ts: Date.now(),
        };
        currentMessages = [...currentMessages, toolMsg];
      }

      // Stream the follow-up response too.
      res = await runStreamWithRetry(provider, currentMessages, chatOpts, opts.retry);
      if (!res.message.toolCalls?.length) break;
    }
  }

  return res;
}

/** Run provider.streamChat() with retry — yields deltas via opts.onDelta, returns final ChatResponse. */
async function runStreamWithRetry(
  provider: Provider,
  messages: ChatMessage[],
  opts: ChatRequestOptions,
  retryOpts?: NonNullable<OrchestratorOptions['retry']>
): Promise<ChatResponse> {
  const maxRetries = retryOpts?.maxRetries ?? 2;
  const baseDelayMs = retryOpts?.baseDelayMs ?? 500;
  const maxDelayMs = retryOpts?.maxDelayMs ?? 8000;
  const retryableStatus = [408, 429, 500, 502, 503, 504];

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (!provider.streamChat) {
        // Fallback — shouldn't happen (caller checks), but be defensive.
        return provider.chat(messages, opts);
      }
      const gen = provider.streamChat(messages, opts);
      let final: ChatResponse | undefined;
      // Drain the generator — onDelta is called inside the provider's streamChat.
      while (true) {
        // Check for abort before each chunk
        if (opts.signal?.aborted) {
          try { gen.return?.(undefined as any); } catch {}
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
        const { done, value } = await gen.next();
        if (done) {
          final = value as ChatResponse | undefined;
          break;
        }
        if (typeof value === 'string' && opts.onDelta) {
          opts.onDelta(value);
        }
      }
      if (!final) {
        // Generator returned without a value — synthesize an empty response.
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: '',
          ts: Date.now(),
        };
        return { message: msg };
      }
      return final;
    } catch (err) {
      lastError = err as Error;
      if (attempt === maxRetries) break;

      const status = (err as { status?: number }).status;
      const isRetryable = status ? retryableStatus.includes(status) : true;
      if (!isRetryable) break;

      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 250);
      const delayMs = exp + jitter;
      retryOpts?.onRetry?.({ attempt: attempt + 1, error: lastError, nextDelayMs: delayMs });
      await new Promise<void>((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError ?? new Error('runStreamWithRetry: unknown failure');
}
