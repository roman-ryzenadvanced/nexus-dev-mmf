// ============================================================
// Retry + error recovery wrapper for provider calls
// ============================================================

import { ProviderError } from '../providers/base.js';
import type { Provider } from '../providers/base.js';
import type { ChatMessage, ChatRequestOptions, ChatResponse } from '../types.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatusCodes?: number[];
  onRetry?: (info: { attempt: number; error: Error; nextDelayMs: number }) => void;
}

const DEFAULT_RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504];

export async function chatWithRetry(
  provider: Provider,
  messages: ChatMessage[],
  opts: ChatRequestOptions = {},
  retryOpts: RetryOptions = {}
): Promise<ChatResponse> {
  const maxRetries = retryOpts.maxRetries ?? 2;
  const baseDelayMs = retryOpts.baseDelayMs ?? 500;
  const maxDelayMs = retryOpts.maxDelayMs ?? 8000;
  const retryableStatus = retryOpts.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await provider.chat(messages, opts);
    } catch (err) {
      lastError = err as Error;
      if (attempt === maxRetries) break;

      const isRetryable = err instanceof ProviderError ? (err.statusCode ? retryableStatus.includes(err.statusCode) : true) : true; // Non-provider errors (network) are retryable.

      if (!isRetryable) break;

      // Exponential backoff with jitter.
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 250);
      const delayMs = exp + jitter;
      retryOpts.onRetry?.({
        attempt: attempt + 1,
        error: lastError,
        nextDelayMs: delayMs,
      });
      await sleep(delayMs);
    }
  }
  throw lastError ?? new Error('chatWithRetry: unknown failure');
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
