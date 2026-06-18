// ============================================================
// Model registry — merges builtin + manual + auto-fetched models
// ============================================================

import type { AppConfig, ModelDescriptor } from '../types.js';
import { getAllModels } from '../config/index.js';

export interface RegistrySnapshot {
  byProvider: Record<string, ModelDescriptor[]>;
  flat: ModelDescriptor[];
}

export function buildRegistry(config: AppConfig, autoFetched: ModelDescriptor[] = []): RegistrySnapshot {
  const staticModels = getAllModels(config);
  const seen = new Set<string>();
  const flat: ModelDescriptor[] = [];

  // Precedence: auto > manual > builtin (auto wins because it's freshest)
  for (const m of [...autoFetched, ...staticModels]) {
    const key = `${m.providerId}::${m.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flat.push(m);
  }

  const byProvider: Record<string, ModelDescriptor[]> = {};
  for (const m of flat) {
    (byProvider[m.providerId] ??= []).push(m);
  }
  return { byProvider, flat };
}

export function addManualModel(config: AppConfig, providerId: string, modelId: string, label?: string): AppConfig {
  const exists = config.manualModels.some(m => m.providerId === providerId && m.id === modelId);
  if (exists) return config;
  const newModel: ModelDescriptor = {
    id: modelId,
    providerId,
    label: label || modelId,
    source: 'manual',
    capabilities: { streaming: true, tools: true },
  };
  return { ...config, manualModels: [...config.manualModels, newModel] };
}

export function removeManualModel(config: AppConfig, providerId: string, modelId: string): AppConfig {
  return {
    ...config,
    manualModels: config.manualModels.filter(m => !(m.providerId === providerId && m.id === modelId)),
  };
}

export function findModel(registry: RegistrySnapshot, providerId: string, modelId: string): ModelDescriptor | undefined {
  return registry.byProvider[providerId]?.find(m => m.id === modelId);
}
