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
import type {
  ChatMessage,
  ChatRequestOptions,
  ChatResponse,
  ModelDescriptor,
  RoutingDecision,
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

async function loadZAISDK(): Promise<ZAIClient> {
  try {
    const mod = (await import('z-ai-web-dev-sdk')) as unknown as ZAISDKModule;
    return await mod.default.create();
  } catch (err) {
    throw new ProviderError(
      `Failed to load z-ai-web-dev-sdk: ${(err as Error).message}. ` +
      `Run: npm install z-ai-web-dev-sdk`,
      'zai',
      undefined,
      err
    );
  }
}

async function tryLoadOrchestrator(): Promise<Orchestrator | null> {
  try {
    // The root `nexus-dev-mmf` package — same monorepo, optional dep.
    // Use dynamic require via createRequire to avoid TS module resolution errors
    // when the package isn't installed standalone.
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
      this.cachedClient = await loadZAISDK();
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
      const payload = messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }));

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
    const client = await this.client();
    const payload = messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const res = (await client.chat.completions.create({
      model,
      messages: payload,
      stream: true,
    })) as AsyncIterable<{
      choices?: Array<{ delta?: { content?: string } }>;
    }>;

    let full = '';
    const start = Date.now();
    for await (const chunk of res) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        yield delta;
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
