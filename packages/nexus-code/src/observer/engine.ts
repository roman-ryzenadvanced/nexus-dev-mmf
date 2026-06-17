// ============================================================
// Observer — a cheap, lightweight side-channel model.
//
// The observer has REAL, live access to what the main agent is doing
// behind the scenes: the in-flight stream buffer, tool calls being
// executed, MMFE routing decisions, and progress metrics. It uses that
// context to either (a) answer the user's quick aside, or (b) narrate
// what's actually happening right now — in a fun, slightly sarcastic tone.
//
// It runs on a cheap model and never blocks the main stream.
// ============================================================

import type { ChatMessage } from '../types.js';
import type { Provider } from '../providers/base.js';
import type { ToolCall, RoutingDecision } from '../types.js';

const SYSTEM_PROMPT = `You are the "Observer" — a witty, friendly, slightly sarcastic side-channel assistant riding shotgun while the main AI agent works on a longer task.

You get a live feed of what the main agent is actually doing RIGHT NOW (its streamed text so far, the tools it's calling, which models it routed to, how long it's been running). Use that real context to answer the user's aside or narrate what's going on behind the scenes.

Rules:
- Keep it SHORT: 1–3 sentences max. You are the snack, not the meal.
- Be fun, warm, a touch sarcastic — never mean, never robotic.
- Plain text only. No markdown, no headers, no bullet lists.
- You are NOT the main agent. Don't pretend to do the big task.
- If the aside is a real question you can answer quickly, answer it.
- If it's a comment/vent, react with personality.
- When narrating, be specific about what you SEE in the live feed (e.g. "it's 3 tool-calls deep", "it just streamed X", "it fanned out to 2 models") — not generic "it's thinking".`;

/** Live behind-the-scenes snapshot the observer reads each time it fires. */
export interface ObserverContext {
  /** The main agent's streamed text so far (tail, capped). */
  streamTail?: string;
  /** Tool calls the main agent has executed this turn, newest last. */
  toolCalls?: ToolCall[];
  /** MMFE routing decisions for the in-flight turn, if any. */
  routing?: RoutingDecision[];
  /** Models the main agent fanned out to this turn. */
  modelsUsed?: string[];
  /** Elapsed ms since the current turn started. */
  elapsedMs?: number;
  /** Approx output tokens streamed so far. */
  tokensSoFar?: number;
  /** Whether the main agent is mid-stream right now. */
  mainBusy: boolean;
}

function summarizeContext(ctx: ObserverContext): string {
  const bits: string[] = [];
  bits.push(ctx.mainBusy ? 'Main agent status: BUSY (streaming right now).' : 'Main agent status: idle.');

  if (typeof ctx.elapsedMs === 'number') {
    const s = (ctx.elapsedMs / 1000).toFixed(1);
    bits.push(`Running for ${s}s${ctx.tokensSoFar ? `, ~${ctx.tokensSoFar} tokens out so far` : ''}.`);
  }
  if (ctx.modelsUsed?.length) {
    bits.push(`Routed to model(s): ${ctx.modelsUsed.join(', ')}.`);
  }
  if (ctx.routing?.length) {
    const legs = ctx.routing
      .map((r) => `"${r.subtaskLabel}" → ${r.selectedModel} (${Math.round(r.confidence * 100)}%)`)
      .join('; ');
    bits.push(`MMFE routing: ${legs}.`);
  }
  if (ctx.toolCalls?.length) {
    const names = ctx.toolCalls.map((t) => `${t.name}(${Object.keys(t.args).join(',')})→${t.status}`);
    bits.push(`Tool calls so far (${ctx.toolCalls.length}): ${names.join(', ')}.`);
  }
  if (ctx.streamTail) {
    bits.push(`Latest streamed text: "${ctx.streamTail.slice(-240)}"`);
  }
  return bits.join('\n');
}

export class ObserverEngine {
  constructor(private provider: Provider, private modelId: string) {}

  /**
   * Respond to the user's interjection right away, grounded in the live
   * behind-the-scenes feed. Returns an assistant message tagged
   * `provider: 'observer'` so the UI can style it distinctly.
   */
  async respond(userText: string, ctx: ObserverContext): Promise<ChatMessage> {
    const start = Date.now();

    const messages: ChatMessage[] = [
      { id: 'obs_sys', role: 'system', content: SYSTEM_PROMPT, ts: Date.now() },
      {
        id: 'obs_user',
        role: 'user',
        content:
          `LIVE FEED from the main agent:\n${summarizeContext(ctx)}\n\n` +
          `The user just fired off this aside while the main agent is busy: "${userText}"\n\n` +
          `Respond as the Observer.`,
        ts: Date.now(),
      },
    ];

    const res = await this.provider.chat(messages, { model: this.modelId, noMMFE: true });
    const msg = res.message;
    return {
      ...msg,
      // Tag distinctly so the UI renders an "observer" bubble.
      provider: 'observer',
      model: `observer:${this.modelId}`,
      elapsedMs: Date.now() - start,
    };
  }
}
