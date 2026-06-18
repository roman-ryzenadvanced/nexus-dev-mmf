import { describe, it, expect } from 'vitest';
import { chatWithRetry } from '../providers/retry.js';
import { ProviderError } from '../providers/base.js';
import type { Provider } from '../providers/base.js';
import type { ChatMessage, ChatResponse } from '../types.js';

class FakeProvider implements Provider {
  readonly id = 'fake';
  readonly kind = 'openai' as const;
  readonly name = 'Fake';
  calls = 0;
  failNTimes: number;
  failStatusCode?: number;

  constructor(opts: { failNTimes?: number; failStatusCode?: number } = {}) {
    this.failNTimes = opts.failNTimes ?? 0;
    this.failStatusCode = opts.failStatusCode;
  }

  async fetchModels() {
    return [];
  }

  async chat(): Promise<ChatResponse> {
    this.calls++;
    if (this.calls <= this.failNTimes) {
      throw new ProviderError(`Simulated failure #${this.calls}`, this.id, this.failStatusCode, null);
    }
    const msg: ChatMessage = {
      id: `msg_${this.calls}`,
      role: 'assistant',
      content: `success after ${this.calls} attempt(s)`,
      ts: Date.now(),
    };
    return { message: msg };
  }
}

describe('chatWithRetry', () => {
  it('succeeds on first attempt when no errors', async () => {
    const p = new FakeProvider();
    const res = await chatWithRetry(p, [], {}, { maxRetries: 2, baseDelayMs: 1 });
    expect(p.calls).toBe(1);
    expect(res.message.content).toContain('success after 1');
  });

  it('retries on retryable status and eventually succeeds', async () => {
    const p = new FakeProvider({ failNTimes: 2, failStatusCode: 429 });
    const res = await chatWithRetry(
      p,
      [],
      {},
      {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 5,
      }
    );
    expect(p.calls).toBe(3);
    expect(res.message.content).toContain('success after 3');
  });

  it('does not retry on non-retryable status codes', async () => {
    const p = new FakeProvider({ failNTimes: 5, failStatusCode: 400 });
    await expect(chatWithRetry(p, [], {}, { maxRetries: 3, baseDelayMs: 1 })).rejects.toThrow('Simulated failure');
    expect(p.calls).toBe(1);
  });

  it('gives up after maxRetries', async () => {
    const p = new FakeProvider({ failNTimes: 10, failStatusCode: 500 });
    await expect(chatWithRetry(p, [], {}, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 5 })).rejects.toThrow('Simulated failure');
    expect(p.calls).toBe(3); // initial + 2 retries
  });

  it('invokes onRetry callback', async () => {
    const p = new FakeProvider({ failNTimes: 1, failStatusCode: 500 });
    const onRetry = vi.fn();
    await chatWithRetry(p, [], {}, { maxRetries: 2, baseDelayMs: 1, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        error: expect.any(Error),
        nextDelayMs: expect.any(Number),
      })
    );
  });
});

// vitest auto-imports vi, but in case it doesn't:
import { vi } from 'vitest';
