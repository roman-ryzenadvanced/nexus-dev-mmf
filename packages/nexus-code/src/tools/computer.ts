// ============================================================
// Computer-control tools — browser, preview, app launcher.
//
// All GUI launches are DETACHED (setsid + ignored stdio + unref) so a
// browser/app never blocks the agent's tool call — the call returns
// immediately once the process is spawned, and the GUI lives on.
//
// Robustness: every tool auto-detects the best available launcher for
// the current OS and never throws — failures come back as a structured
// `{ launched: false, error }` result so the model can adapt.
// ============================================================

import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { ToolDefinition } from './protocol/index.js';

/** Spawn a detached GUI process that outlives the agent. Never throws. */
function launchDetached(command: string, args: string[]): { ok: boolean; pid?: number; error?: string } {
  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    });
    child.on('error', () => {}); // surfaced via the ok flag below instead
    child.unref();
    // If the spawn failed synchronously (ENOENT), node emits 'error' async;
    // pid is undefined in that case. A real pid means it started.
    if (typeof child.pid === 'number') {
      return { ok: true, pid: child.pid };
    }
    return { ok: false, error: `failed to start ${command}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const DEFAULT_URL = 'about:blank';

/** Normalize a target into a usable URL. */
function normalizeUrl(target: string): string {
  const t = String(target).trim();
  if (!t) return DEFAULT_URL;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || t === 'about:blank') return t; // has scheme
  if (/^[a-z0-9.-]+(:\d+)?(\/|$)/i.test(t)) return `https://${t}`; // bare domain
  return t;
}

/**
 * Resolve the best browser-launch command for this host.
 * Preference: an explicit binary > xdg-open > generic launchers.
 * Returns the command + whether to pass the URL through a shell.
 */
function resolveBrowserLauncher(explicit?: string): { cmd: string; args: string[]; needsShell: boolean } {
  const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'firefox', 'brave-browser', 'microsoft-edge'];
  // Explicit browser wins if it's installed.
  if (explicit && explicit !== 'default') {
    const bin = candidates.find((c) => c === explicit || c.startsWith(explicit));
    if (bin) return { cmd: bin, args: [], needsShell: false };
    // Allow a raw binary name too.
    return { cmd: explicit, args: [], needsShell: false };
  }
  // xdg-open respects the user's default-browser setting.
  return { cmd: 'xdg-open', args: [], needsShell: false };
}

// ── browse ───────────────────────────────────────────────────
export const browseTool: ToolDefinition = {
  name: 'browse',
  description:
    'Open a URL (or search the web) in the default web browser on the user\'s machine. ' +
    'Use this when the user asks to launch/open/preview a website, URL, or search the web. ' +
    'The browser opens immediately and this returns right away — it never blocks.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to open, e.g. "https://example.com", or a bare domain like "example.com". Omit to open a blank/new tab.',
      },
      browser: {
        type: 'string',
        description: 'Optional: "default" (system default), "chrome", "chromium", or "firefox".',
        enum: ['default', 'chrome', 'chromium', 'firefox', 'brave', 'edge'],
      },
    },
    required: ['url'],
  },
  async handler(args) {
    const url = normalizeUrl(String(args.url ?? ''));
    const { cmd, args: baseArgs } = resolveBrowserLauncher(String(args.browser ?? 'default'));
    const res = launchDetached(cmd, [...baseArgs, url]);
    return {
      launched: res.ok,
      url,
      command: `${cmd} ${url}`,
      pid: res.pid,
      ...(res.error ? { error: res.error } : {}),
    };
  },
};

// ── preview (open a file/folder) ─────────────────────────────
export const previewTool: ToolDefinition = {
  name: 'preview',
  description:
    'Open a local file or folder with its default application (the OS "open" action). ' +
    'Use to preview HTML, images, PDFs, source files, or open a folder in the file manager. ' +
    'Returns immediately; the application stays open.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative path to the file/folder to preview.' },
    },
    required: ['path'],
  },
  async handler(args) {
    const raw = String(args.path ?? '').trim();
    if (!raw) return { launched: false, error: 'no path provided' };
    const abs = resolve(raw);
    if (!existsSync(abs)) return { launched: false, path: abs, error: 'path does not exist' };
    const isDir = statSync(abs).isDirectory();
    // xdg-open is the standard on Linux; gio open is a solid fallback.
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    const res = launchDetached(cmd, [abs]);
    return {
      launched: res.ok,
      path: abs,
      kind: isDir ? 'directory' : 'file',
      command: `${cmd} ${abs}`,
      pid: res.pid,
      ...(res.error ? { error: res.error } : {}),
    };
  },
};

// ── launch_app ───────────────────────────────────────────────
export const launchAppTool: ToolDefinition = {
  name: 'launch_app',
  description:
    'Launch any GUI application or Linux command detached from the agent. ' +
    'Use when the user asks to open/start/run an app (e.g. code editor, terminal, calculator) ' +
    'or any program that should run in the background and not block the conversation.',
  parameters: {
    type: 'object',
    properties: {
      application: { type: 'string', description: 'Executable name or path, e.g. "code", "gnome-terminal", "gimp".' },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional command-line arguments for the application.',
      },
    },
    required: ['application'],
  },
  async handler(args) {
    const app = String(args.application ?? '').trim();
    if (!app) return { launched: false, error: 'no application provided' };
    const argList = Array.isArray(args.args) ? args.args.map(String) : [];
    const res = launchDetached(app, argList);
    return {
      launched: res.ok,
      application: app,
      args: argList,
      pid: res.pid,
      ...(res.error ? { error: res.error } : {}),
    };
  },
};

export const COMPUTER_TOOLS: ToolDefinition[] = [browseTool, previewTool, launchAppTool];
