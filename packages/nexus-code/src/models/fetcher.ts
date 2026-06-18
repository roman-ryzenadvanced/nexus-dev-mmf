// ============================================================
// Model auto-fetcher — calls each provider's fetchModels()
// ============================================================

import type { Provider } from '../providers/base.js';
import type { ModelDescriptor } from '../types.js';
import { ProviderError } from '../providers/base.js';

export interface FetchResult {
  providerId: string;
  ok: boolean;
  models?: ModelDescriptor[];
  error?: string;
}

export async function fetchModelsFromProvider(provider: Provider): Promise<ModelDescriptor[]> {
  return provider.fetchModels();
}

export async function fetchAllModels(providers: Map<string, Provider>, opts: { onlyIds?: string[]; signal?: AbortSignal } = {}): Promise<FetchResult[]> {
  const targets = opts.onlyIds ? Array.from(providers.entries()).filter(([id]) => opts.onlyIds!.includes(id)) : Array.from(providers.entries());

  return Promise.all(
    targets.map(async ([id, provider]) => {
      if (opts.signal?.aborted) {
        return { providerId: id, ok: false, error: 'aborted' };
      }
      try {
        const models = await provider.fetchModels();
        return { providerId: id, ok: true, models };
      } catch (err) {
        const msg = err instanceof ProviderError ? err.message : (err as Error).message || 'unknown error';
        return { providerId: id, ok: false, error: msg };
      }
    })
  );
}
