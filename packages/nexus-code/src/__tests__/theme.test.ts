import { describe, it, expect, beforeEach } from 'vitest';
import { THEMES, setTheme, getThemeName, listThemes, getTheme, type ThemeName } from '../tui/theme.js';

describe('TUI themes', () => {
  beforeEach(() => {
    // Reset to default before each test
    setTheme('tech-dark');
  });

  it('has 3 themes', () => {
    expect(listThemes()).toHaveLength(3);
    expect(listThemes()).toEqual(['tech-dark', 'editorial-light', 'hacker-terminal']);
  });

  it('every theme has all required tokens', () => {
    const required: Array<keyof typeof THEMES['tech-dark']> = [
      'bg', 'bgSoft', 'bgElev', 'line',
      'primary', 'primaryDim', 'primaryMute',
      'accent', 'accent2',
      'success', 'warn', 'danger',
    ];
    for (const name of listThemes() as ThemeName[]) {
      const theme = THEMES[name];
      for (const key of required) {
        expect(theme[key], `${name}.${key}`).toBeTruthy();
        expect(theme[key], `${name}.${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('defaults to tech-dark', () => {
    expect(getThemeName()).toBe('tech-dark');
  });

  it('setTheme switches active theme', () => {
    setTheme('hacker-terminal');
    expect(getThemeName()).toBe('hacker-terminal');
    expect(getTheme().bg).toBe('#000000');
    expect(getTheme().primary).toBe('#33FF66');
  });

  it('getTheme returns the active theme tokens', () => {
    setTheme('editorial-light');
    const t = getTheme();
    expect(t.bg).toBe('#FAFAF7');
    expect(t.accent).toBe('#4F46E5');
  });

  it('themes have distinct color palettes', () => {
    const dark = THEMES['tech-dark'];
    const light = THEMES['editorial-light'];
    const hacker = THEMES['hacker-terminal'];
    expect(dark.bg).not.toBe(light.bg);
    expect(dark.bg).not.toBe(hacker.bg);
    expect(light.bg).not.toBe(hacker.bg);
    expect(dark.accent).not.toBe(light.accent);
  });

  it('hacker-terminal is monochrome-ish (accent = primary = success)', () => {
    const h = THEMES['hacker-terminal'];
    expect(h.accent).toBe(h.primary);
    expect(h.accent).toBe(h.success);
  });

  it('editorial-light uses light backgrounds (bg luminance > 0.5)', () => {
    const t = THEMES['editorial-light'];
    // Hex → luminance approximation
    const hex = t.bg.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    expect(lum).toBeGreaterThan(0.5);
  });

  it('tech-dark uses dark backgrounds (bg luminance < 0.2)', () => {
    const t = THEMES['tech-dark'];
    const hex = t.bg.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    expect(lum).toBeLessThan(0.2);
  });
});
