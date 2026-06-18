// ============================================================
// MMFE modes — constants + helpers
// ============================================================

import type { MMFEMode } from '../types.js';

export const ALL_MODES: MMFEMode[] = ['speed', 'balanced', 'quality', 'creative'];

export const MODE_METADATA: Record<MMFEMode, { label: string; tagline: string; preferredModels: string[]; color: string }> = {
  speed: {
    label: 'speed',
    tagline: 'prioritizes glm-5, glm-5v-turbo',
    preferredModels: ['glm-5', 'glm-5v-turbo'],
    color: '#06B6D4',
  },
  balanced: {
    label: 'balanced',
    tagline: 'spreads load across all models',
    preferredModels: ['glm-5.2', 'glm-5.1', 'glm-5', 'glm-5v-turbo', 'glm-4.7'],
    color: '#06B6D4',
  },
  quality: {
    label: 'quality',
    tagline: 'prioritizes glm-5.2, glm-5.2-1m',
    preferredModels: ['glm-5.2', 'glm-5.2-1m'],
    color: '#8B5CF6',
  },
  creative: {
    label: 'creative',
    tagline: 'biases toward glm-4.7',
    preferredModels: ['glm-4.7', 'glm-5.1'],
    color: '#F59E0B',
  },
};

export function isMode(x: string): x is MMFEMode {
  return ALL_MODES.includes(x as MMFEMode);
}

export function describeMode(mode: MMFEMode): string {
  const m = MODE_METADATA[mode];
  return `${m.label} — ${m.tagline}`;
}
