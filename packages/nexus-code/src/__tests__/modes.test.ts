import { describe, it, expect } from 'vitest';
import { ALL_MODES, MODE_METADATA, isMode, describeMode } from '../orchestrator/modes.js';

describe('MMFE modes', () => {
  it('has exactly 4 modes', () => {
    expect(ALL_MODES).toHaveLength(4);
    expect(ALL_MODES).toEqual(['speed', 'balanced', 'quality', 'creative']);
  });

  it('every mode has full metadata', () => {
    for (const mode of ALL_MODES) {
      const meta = MODE_METADATA[mode];
      expect(meta.label).toBe(mode);
      expect(meta.tagline).toBeTruthy();
      expect(meta.preferredModels.length).toBeGreaterThan(0);
      expect(meta.color).toMatch(/^#/);
    }
  });

  it('balanced mode prefers all 5 standard GLM models', () => {
    expect(MODE_METADATA.balanced.preferredModels).toHaveLength(5);
  });

  it('quality mode prefers flagship models only', () => {
    const preferred = MODE_METADATA.quality.preferredModels;
    expect(preferred).toContain('glm-5.2');
    expect(preferred).toContain('glm-5.2-1m');
    expect(preferred.length).toBe(2);
  });

  it('creative mode biases toward glm-4.7', () => {
    expect(MODE_METADATA.creative.preferredModels[0]).toBe('glm-4.7');
  });

  it('isMode validates correctly', () => {
    expect(isMode('speed')).toBe(true);
    expect(isMode('balanced')).toBe(true);
    expect(isMode('quality')).toBe(true);
    expect(isMode('creative')).toBe(true);
    expect(isMode('turbo')).toBe(false);
    expect(isMode('')).toBe(false);
  });

  it('describeMode returns label — tagline format', () => {
    const desc = describeMode('quality');
    expect(desc).toContain('quality');
    expect(desc).toContain('—');
    expect(desc).toContain('glm-5.2');
  });
});
