// ============================================================
// Z.ai provider — wraps z-ai-web-dev-sdk (real SDK shape).
//
// SDK shape (v0.0.18):
//   import ZAI from 'z-ai-web-dev-sdk';
//   const client = await ZAI.create();   // async factory
//   await client.chat.completions.create({ model, messages, stream });
//
// Coding endpoints (with fallback):
//   Primary:   https://open.bigmodel.cn/api/coding/paas/v4
//   Fallback:  https://api.z.ai/api/coding/paas/v4
//
// MMFE orchestrator integration:
//   The nexus-dev-mmf root package (this monorepo) exposes a separate
//   `createOrchestrator` function. We try to import it dynamically; if
//   it's not available (e.g. only the TUI package is installed), we
//   fall back to direct provider calls.
// ============================================================

import { BaseProvider, ProviderError } from './base.js';
import type {
  ChatMessage,
  ChatRequestOptions,
  ChatResponse,
  ModelDescriptor,
  RoutingDecision,
  ToolCall,
} from '../types.js';
import { BUILTIN_MODELS } from '../config/schema.js';

// Minimal shape of the ZAI SDK instance we depend on.
interface ZAIClient {
  chat: {
    completions: {
      create: (body: {
        model?: string;
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
        stream?: boolean;
        thinking?: { type: 'enabled' | 'disabled' };
        tools?: Array<unknown>;
      }) => Promise<unknown>;
    };
  };
}

interface ZAISDKModule {
  default: { create: () => Promise<ZAIClient> };
}

// Minimal shape of the MMFE orchestrator (separate package).
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
}
interface MMFEModule {
  createOrchestrator?: (opts: Record<string, unknown>) => Orchestrator;
}

const ZAI_CODING_BASE_PRIMARY = 'https://open.bigmodel.cn/api/coding/paas/v4';
const ZAI_CODING_BASE_FALLBACK = 'https://api.z.ai/api/coding/paas/v4';

async function loadZAISDK(apiKey?: string): Promise<ZAIClient> {
  try {
    const mod = (await import('z-ai-web-dev-sdk')) as unknown as ZAISDKModule;

    // If the caller already has an API key (from config or env), write a
    // .z-ai-config so the SDK's internal loadConfig() can find it.
    const key = apiKey || process.env.ZAI_API_KEY;
    if (key) {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const os = await import('node:os');
      const homeDir = os.homedir();
      const configPaths = [
        path.join(process.cwd(), '.z-ai-config'),
        path.join(homeDir, '.z-ai-config'),
      ];

      // Check if any existing config is valid first
      let hasValidConfig = false;
      for (const filePath of configPaths) {
        try {
          const configStr = await fs.readFile(filePath, 'utf-8');
          const config = JSON.parse(configStr);
          if (config.baseUrl && config.apiKey) {
            hasValidConfig = true;
            break;
          }
        } catch {
          // File doesn't exist or is invalid — continue
        }
      }

      // Auto-create a .z-ai-config in home dir if no valid config exists
      // Use Z.ai coding endpoint with fallback
      if (!hasValidConfig) {
        const configPath = path.join(homeDir, '.z-ai-config');
        let baseUrl = ZAI_CODING_BASE_PRIMARY;
        try {
          const probe = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
          // 401/403 means the endpoint exists but requires auth — still valid.
          // Only fall back on 5xx (server error) or network failures.
          if (probe.status >= 500) baseUrl = ZAI_CODING_BASE_FALLBACK;
        } catch {
          baseUrl = ZAI_CODING_BASE_FALLBACK;
        }
        const config = { baseUrl, apiKey: key };
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      }
    }

    return await mod.default.create();
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('Configuration file not found')) {
      throw new ProviderError(
        `Z.ai SDK needs a config file with baseUrl + apiKey. ` +
        `Set ZAI_API_KEY env var or create ~/.z-ai-config with: ` +
        `{"baseUrl":"${ZAI_CODING_BASE_PRIMARY}","apiKey":"YOUR_KEY"}`,
        'zai',
        undefined,
        err
      );
    }
    throw new ProviderError(
      `Failed to load z-ai-web-dev-sdk: ${msg}`,
      'zai',
      undefined,
      err
    );
  }
}

async function tryLoadOrchestrator(): Promise<Orchestrator | null> {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const mod = require('nexus-dev-mmf') as MMFEModule;
    if (typeof mod.createOrchestrator === 'function') {
      return mod.createOrchestrator({
        defaultMode: 'balanced',
        maxParallelSubTasks: 6,
        enableThinking: true,
        verboseRouting: true,
      });
    }
  } catch {
    // Orchestrator not installed — fall back to direct provider calls.
  }
  return null;
}

/**
 * Convert ChatMessage[] to ZAI API format, properly filtering out
 * tool messages that the ZAI API doesn't understand. Tool results
 * are represented as assistant messages with structured content.
 */
function toZAIMessages(messages: ChatMessage[]): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const result: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  for (const m of messages) {
    if (m.role === 'system' || m.role === 'user' || m.role === 'assistant') {
      result.push({ role: m.role, content: m.content });
    } else if (m.role === 'tool') {
      // Convert tool messages to assistant messages with context markers
      // so the API doesn't reject unknown roles
      const toolInfo = m.toolCalls?.map(tc => `${tc.name}(${Object.keys(tc.args).join(', ')}) → ${tc.status}`).join('; ') || 'tool result';
      result.push({ role: 'assistant', content: `[Tool Result: ${toolInfo}]\n${m.content}` });
    }
  }
  return result;
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
    return BUILTIN_MODELS.map((m) => ({ ...m, source: 'builtin' as const }));
  }

  async chat(messages: ChatMessage[], opts: ChatRequestOptions = {}): Promise<ChatResponse> {
    const model = opts.model || 'glm-5.2';
    const start = Date.now();

    try {
      // MMFE path — if orchestrator is available and MMFE is on, route through it.
      const useMMFE = !opts.noMMFE;
      const orch = useMMFE ? await this.orchestrator() : null;

      if (useMMFE && orch) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user');
        const prompt = lastUser?.content || '';
        const result = await orch.process(prompt, {
          preferredMode: opts.mode || 'balanced',
          enableThinking: true,
        });

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

      const res = (await client.chat.completions.create({
        model,
        messages: payload,
        stream: false,
        thinking: { type: 'enabled' },
      })) as {
        choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
        content?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const text = res.choices?.[0]?.message?.content || res.content || '';

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
        ts: Date.now(),
      };
      return { message: assistantMsg, raw: res };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        `Z.ai chat failed: ${(err as Error).message}`,
        this.id,
        undefined,
        err
      );
    }
  }

  async *streamChat(
    messages: ChatMessage[],
    opts: ChatRequestOptions = {}
  ): AsyncGenerator<string, ChatResponse, unknown> {
    const model = opts.model || 'glm-5.2';
    const start = Date.now();

    // MMFE path — if orchestrator is available and MMFE is on, use it
    // but stream the output word-by-word for a smooth UX.
    const useMMFE = !opts.noMMFE;
    const orch = useMMFE ? await this.orchestrator() : null;

    if (useMMFE && orch) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      const prompt = lastUser?.content || '';

      const result = await orch.process(prompt, {
        preferredMode: opts.mode || 'balanced',
        enableThinking: true,
      });

      if (result.routingDecisions && opts.onRouting) {
        opts.onRouting(result.routingDecisions);
      }

      // Simulate streaming by yielding the answer word-by-word
      const answer = result.answer || '';
      const words = answer.split(/(\s+)/);
      for (const word of words) {
        if (word) yield word;
      }

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content: answer,
        model: result.modelsUsed.join(', '),
        provider: this.id,
        elapsedMs: Date.now() - start,
        routing: result.routingDecisions,
        qualityScore: result.qualityScore,
        ts: Date.now(),
      };
      return { message: assistantMsg, raw: result };
    }

    // Direct SDK streaming path.
    // The SDK returns a raw Web ReadableStream (not an AsyncIterable of parsed
    // JSON). We need to parse SSE events ourselves.
    const client = await this.client();
    const payload = toZAIMessages(messages);

    const rawStream = (await client.chat.completions.create({
      model,
      messages: payload,
      stream: true,
    })) as ReadableStream<Uint8Array>;

    let full = '';

    // If the SDK returned a ReadableStream, parse SSE events from it.
    if (rawStream && typeof rawStream.getReader === 'function') {
      const reader = rawStream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue; // skip empty/comments
            if (trimmed === 'data: [DONE]') continue;

            if (trimmed.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  full += delta;
                  yield delta;
                }
              } catch {
                // Malformed JSON chunk — skip
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
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
