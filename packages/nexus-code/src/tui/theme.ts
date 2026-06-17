// ============================================================
// TUI themes — three palettes
//   tech-dark        (default) — cyan + violet on deep navy
//   editorial-light            — slate + indigo on off-white
//   hacker-terminal            — phosphor green on pure black
// ============================================================

import chalk from 'chalk';

export type ThemeName = 'tech-dark' | 'editorial-light' | 'hacker-terminal';

export interface ThemeTokens {
  bg: string;
  bgSoft: string;
  bgElev: string;
  line: string;
  primary: string;
  primaryDim: string;
  primaryMute: string;
  accent: string;
  accent2: string;
  success: string;
  warn: string;
  danger: string;
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  'tech-dark': {
    bg: '#0A0E1A',
    bgSoft: '#111827',
    bgElev: '#1A2236',
    line: '#1F2A44',
    primary: '#E2E8F0',
    primaryDim: '#94A3B8',
    primaryMute: '#475569',
    accent: '#06B6D4',
    accent2: '#8B5CF6',
    success: '#10B981',
    warn: '#F59E0B',
    danger: '#EF4444',
  },
  'editorial-light': {
    bg: '#FAFAF7',
    bgSoft: '#F1F0EB',
    bgElev: '#E8E6DF',
    line: '#D6D3CA',
    primary: '#1F2937',
    primaryDim: '#4B5563',
    primaryMute: '#9CA3AF',
    accent: '#4F46E5',
    accent2: '#7C3AED',
    success: '#059669',
    warn: '#D97706',
    danger: '#DC2626',
  },
  'hacker-terminal': {
    bg: '#000000',
    bgSoft: '#0A0A0A',
    bgElev: '#141414',
    line: '#1F331F',
    primary: '#33FF66',
    primaryDim: '#22AA44',
    primaryMute: '#0E5511',
    accent: '#33FF66',
    accent2: '#FFFF33',
    success: '#33FF66',
    warn: '#FFAA33',
    danger: '#FF3333',
  },
};

// Active theme — set via setTheme(). Defaults to tech-dark.
let activeThemeName: ThemeName = 'tech-dark';
let active = THEMES[activeThemeName];

export function setTheme(name: ThemeName): void {
  activeThemeName = name;
  active = THEMES[name];
}

export function getThemeName(): ThemeName {
  return activeThemeName;
}

export function listThemes(): ThemeName[] {
  return Object.keys(THEMES) as ThemeName[];
}

export const THEME = active; // Backward-compat — references the module-level `active`

// Re-export for component access. Components should call getTheme() at
// render time so they pick up changes from setTheme().
export function getTheme(): ThemeTokens {
  return active;
}

// Chalk color helpers — getters resolved at access time so setTheme() takes
// effect immediately. We define them directly on the exported `color` object
// (enumerable) so `color.dim`, `color.accent`, etc. are always present.
const COLOR_KEYS = [
  'user',
  'assistant',
  'system',
  'tool',
  'muted',
  'dim',
  'accent',
  'accent2',
  'success',
  'warn',
  'danger',
] as const;

const COLOR_MAP: Record<string, (t: ThemeTokens) => string> = {
  user: (t) => t.accent,
  assistant: (t) => t.primary,
  system: (t) => t.primaryDim,
  tool: (t) => t.warn,
  muted: (t) => t.primaryMute,
  dim: (t) => t.primaryDim,
  accent: (t) => t.accent,
  accent2: (t) => t.accent2,
  success: (t) => t.success,
  warn: (t) => t.warn,
  danger: (t) => t.danger,
};

type ColorHelpers = Record<(typeof COLOR_KEYS)[number], ReturnType<typeof chalk.hex>>;

export const color = {
  bold: chalk.bold,
  dim2: chalk.dim,
} as Record<string, unknown> & ColorHelpers & { bold: typeof chalk.bold; dim2: typeof chalk.dim };

for (const key of COLOR_KEYS) {
  Object.defineProperty(color, key, {
    enumerable: true,
    configurable: true,
    get() {
      return chalk.hex(COLOR_MAP[key](active));
    },
  });
}

export const SIGILS = {
  user: '❯',
  assistant: '◆',
  system: 'ⓘ',
  tool: '⚙',
  routing: '↳',
  ok: '✓',
  fail: '✗',
  pending: '…',
} as const;
