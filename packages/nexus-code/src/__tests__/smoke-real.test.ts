// ============================================================
// Real-API smoke tests — gated behind env vars.
//
// These tests actually call provider APIs and verify the response
// shape. They are SKIPPED by default — set any of these env vars
// to enable the corresponding test:
//
//   OPENAI_API_KEY=sk-...         → runs OpenAI smoke test (gpt-4o-mini)
//   ANTHROPIC_API_KEY=sk-ant-...  → runs Anthropic smoke test (claude-3-5-haiku)
//   ZAI_API_KEY=...               → runs Z.ai smoke test (glm-5)
//
// Run with: OPENAI_API_KEY=sk-... npm test -- smoke-real
// ============================================================

import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../providers/openai.js';
import { AnthropicProvider } from '../providers/anthropic.js';
import { ZAIProvider } from '../providers/zai.js';
import type { ChatMessage } from '../types.js';

const TIMEOUT = 30_000;

const userMsg = (text: string): ChatMessage => ({
  id: `u_${Date.now()}`,
  role: 'user',
  content: text,
  ts: Date.now(),
});

describe.skipIf(!process.env.OPENAI_API_KEY)('OpenAI — real API smoke', () => {
  it('returns a chat completion', async () => {
    const provider = new OpenAIProvider({
      id: 'openai',
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
    });
    const res = await provider.chat(
      [userMsg('Reply with exactly: pong')],
      { model: 'gpt-4o-mini' }
    );
    expect(res.message.role).toBe('assistant');
    expect(res.message.content).toBeTruthy();
    expect(res.message.content.length).toBeGreaterThan(0);
    expect(res.message.tokens?.input).toBeGreaterThan(0);
    expect(res.message.tokens?.output).toBeGreaterThan(0);
  }, TIMEOUT);

  it('streams tokens via streamChat()', async () => {
    const provider = new OpenAIProvider({
      id: 'openai',
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
    });
    const gen = provider.streamChat!(
      [userMsg('Count from 1 to 5, separated by spaces.')],
      { model: 'gpt-4o-mini' }
    );
    const deltas: string[] = [];
    let final;
    while (true) {
      const { done, value } = await gen.next();
      if (done) {
        final = value;
        break;
      }
      if (typeof value === 'string') deltas.push(value);
    }
    expect(deltas.length).toBeGreaterThan(0);
    expect(final).toBeDefined();
    expect(final!.message.content.length).toBeGreaterThan(0);
    // Content should match the concatenation of deltas
    expect(final!.message.content).toContain(deltas.join(''));
  }, TIMEOUT);

  it('fetches models via /v1/models', async () => {
    const provider = new OpenAIProvider({
      id: 'openai',
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
    });
    const models = await provider.fetchModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].source).toBe('auto');
    expect(models[0].providerId).toBe('openai');
    const ids = models.map((m) => m.id);
    expect(ids).toContain('gpt-4o-mini');
  }, TIMEOUT);
});

describe.skipIf(!process.env.ANTHROPIC_API_KEY)('Anthropic — real API smoke', () => {
  it('returns a chat completion with system prompt', async () => {
    const provider = new AnthropicProvider({
      id: 'anthropic',
      name: 'Anthropic',
      baseURL: 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const messages: ChatMessage[] = [
      { id: 's1', role: 'system', content: 'Reply with exactly: pong', ts: Date.now() },
      userMsg('go'),
    ];
    const res = await provider.chat(messages, {
      model: 'claude-3-5-haiku-20241022',
    });
    expect(res.message.role).toBe('assistant');
    expect(res.message.content).toBeTruthy();
    expect(res.message.content.toLowerCase()).toContain('pong');
    expect(res.message.tokens?.input).toBeGreaterThan(0);
  }, TIMEOUT);

  it('streams tokens via streamChat()', async () => {
    const provider = new AnthropicProvider({
      id: 'anthropic',
      name: 'Anthropic',
      baseURL: 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const gen = provider.streamChat!(
      [userMsg('Count from 1 to 5.')],
      { model: 'claude-3-5-haiku-20241022' }
    );
    const deltas: string[] = [];
    let final;
    while (true) {
      const { done, value } = await gen.next();
      if (done) {
        final = value;
        break;
      }
      if (typeof value === 'string') deltas.push(value);
    }
    expect(deltas.length).toBeGreaterThan(0);
    expect(final).toBeDefined();
    expect(final!.message.content.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('fetches models via /v1/models', async () => {
    const provider = new AnthropicProvider({
      id: 'anthropic',
      name: 'Anthropic',
      baseURL: 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const models = await provider.fetchModels();
    expect(models.length).toBeGreaterThan(0);
    const ids = models.map((m) => m.id);
    expect(ids.some((id) => id.includes('claude'))).toBe(true);
  }, TIMEOUT);
});

describe.skipIf(!process.env.ZAI_API_KEY)('Z.ai — real API smoke', () => {
  it('returns a chat completion (direct, no MMFE)', async () => {
    const provider = new ZAIProvider({ apiKey: process.env.ZAI_API_KEY });
    const res = await provider.chat(
      [userMsg('Reply with exactly: pong')],
      { model: 'glm-5', noMMFE: true }
    );
    expect(res.message.role).toBe('assistant');
    expect(res.message.content).toBeTruthy();
    expect(res.message.content.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('returns builtin models from fetchModels()', async () => {
    const provider = new ZAIProvider({ apiKey: process.env.ZAI_API_KEY });
    const models = await provider.fetchModels();
    expect(models.length).toBeGreaterThanOrEqual(6);
    const ids = models.map((m) => m.id);
    expect(ids).toContain('glm-5.2');
    expect(ids).toContain('glm-4.7');
  }, TIMEOUT);
});
