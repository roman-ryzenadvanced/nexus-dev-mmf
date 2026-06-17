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

// Chalk color helpers — getters so setTheme() takes effect on next access.
// Each property is a function-less ChalkInstance that resolves `active`
// at access time via Object.defineProperty traps below.
const colorProxy: Record<string, ReturnType<typeof chalk.hex>> = {};
for (const key of ['user', 'assistant', 'system', 'tool', 'muted', 'dim', 'accent', 'accent2', 'success', 'warn', 'danger']) {
  Object.defineProperty(colorProxy, key, {
    get() {
      const map: Record<string, string> = {
        user: active.accent,
        assistant: active.primary,
        system: active.primaryDim,
        tool: active.warn,
        muted: active.primaryMute,
        dim: active.primaryDim,
        accent: active.accent,
        accent2: active.accent2,
        success: active.success,
        warn: active.warn,
        danger: active.danger,
      };
      return chalk.hex(map[key]);
    },
  });
}

export const color = {
  ...colorProxy,
  bold: chalk.bold,
  dim2: chalk.dim,
} as unknown as {
  user: ReturnType<typeof chalk.hex>;
  assistant: ReturnType<typeof chalk.hex>;
  system: ReturnType<typeof chalk.hex>;
  tool: ReturnType<typeof chalk.hex>;
  muted: ReturnType<typeof chalk.hex>;
  dim: ReturnType<typeof chalk.hex>;
  accent: ReturnType<typeof chalk.hex>;
  accent2: ReturnType<typeof chalk.hex>;
  success: ReturnType<typeof chalk.hex>;
  warn: ReturnType<typeof chalk.hex>;
  danger: ReturnType<typeof chalk.hex>;
  bold: typeof chalk.bold;
  dim2: typeof chalk.dim;
};

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
