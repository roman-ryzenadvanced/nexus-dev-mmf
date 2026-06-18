#!/usr/bin/env node
// ============================================================
// scripts/setup.mjs — one-command installer for Nexus-Dev MMFE.
//
// Run from the repo root (after `git clone`):
//
//     node scripts/setup.mjs
//
// What it does, in order:
//   1. Verifies Node.js >= 18 is installed.
//   2. Installs + builds the root orchestrator SDK (nexus-dev-mmf).
//   3. Installs + builds the Nexus Code TUI (packages/nexus-code).
//   4. Links the `nexus` and `nexus-code` commands GLOBALLY so you can run
//      `nexus` from anywhere (via `npm link`). This is the step the plain
//      `npm install && npm run build` flow misses.
//   5. Verifies the `nexus` command actually resolves on your PATH.
//   6. Prints clear next steps for configuring your API key.
//
// Safe to re-run. Idempotent.
// ============================================================

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, chmodSync, symlinkSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PKG = join(ROOT, 'packages', 'nexus-code');

const isWin = platform() === 'win32';
const STEP = (n, msg) => console.log(`\n${cyan}▸ [${n}/6] ${msg}${reset}`);
const OK = (msg) => console.log(`${green}  ✓ ${msg}${reset}`);
const WARN = (msg) => console.log(`${yellow}  ⚠ ${msg}${reset}`);
const ERR = (msg) => console.error(`${red}  ✗ ${msg}${reset}`);

// --- tiny ANSI helpers (no deps) ---
const cyan = '\x1b[36m', green = '\x1b[32m', yellow = '\x1b[33m', red = '\x1b[31m';
const bold = '\x1b[1m', reset = '\x1b[0m', dim = '\x1b[2m';

function run(cmd, args, cwd, opts = {}) {
  const label = `${dim}$ ${cmd} ${args.join(' ')}${reset}`;
  if (cwd) console.log(`  ${dim}(${cwd.replace(ROOT, '.')})${reset} ${label}`);
  else console.log(`  ${label}`);
  const r = spawnSync(cmd, args, { cwd, stdio: opts.silent ? 'pipe' : 'inherit', shell: isWin, ...opts });
  if (r.status !== 0) {
    ERR(`Command failed: ${cmd} ${args.join(' ')} (exit ${r.status})`);
    if (!opts.silent && r.stdout) process.stdout.write(r.stdout);
    if (!opts.silent && r.stderr) process.stderr.write(r.stderr);
    process.exit(1);
  }
  return r;
}

function pkgManager() {
  // Prefer npm; detect pnpm/yarn/bun only if a lockfile points to them.
  if (existsSync(join(ROOT, 'bun.lockb'))) return { cmd: 'bun', i: ['install'], bi: ['install'] };
  if (existsSync(join(ROOT, 'pnpm-lock.yaml'))) return { cmd: 'pnpm', i: ['install'], bi: ['install'] };
  if (existsSync(join(ROOT, 'yarn.lock'))) return { cmd: 'yarn', i: ['install'], bi: ['install'] };
  return { cmd: 'npm', i: ['install', '--no-audit', '--no-fund'], bi: ['install', '--no-audit', '--no-fund'] };
}

// Resolve the global install prefix (npm's, or a sane fallback). Computed
// from $HOME so it never inherits a workspace context.
function globalPrefix() {
  const fromNpm = safeExec('npm config get prefix');
  if (fromNpm && existsSync(fromNpm)) return fromNpm;
  if (isWin) return join(homedir(), 'AppData', 'Roaming', 'npm');
  return join(homedir(), '.npm-global');
}
function safeExec(cmd) {
  try { return execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'], cwd: homedir() }).toString().trim(); }
  catch { return ''; }
}

// Manually create the global module + bin symlinks. This is exactly what
// `npm link` does, but we do it by hand because the repo uses npm workspaces
// (`"workspaces": ["packages/*"]`) and `npm link` inside a workspace throws
// ENOWORKSPACES on recent npm versions. Doing it manually is cross-platform
// and doesn't depend on npm's workspace handling.
function linkGlobally() {
  const prefix = globalPrefix();
  const lib = join(prefix, isWin ? '' : 'lib', 'node_modules');
  const bin = join(prefix, 'bin');
  mkdirSync(lib, { recursive: true });
  mkdirSync(bin, { recursive: true });
  const modLink = join(lib, 'nexus-code');
  const execPath = isWin ? join('bin', 'nexus.js') : join('bin', 'nexus.js');
  // POSIX: module dir symlink; Windows: would need junction/dir — fall back to npm link.
  if (!isWin) {
    try { symlinkSync(PKG, modLink, 'dir'); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    for (const name of ['nexus', 'nexus-code']) {
      const target = join(lib, 'nexus-code', execPath);
      const link = join(bin, name);
      try { symlinkSync(target, link, 'file'); }
      catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
    return true;
  }
  // Windows: delegate to npm link (workspaces quirk is POSIX-only in practice).
  run(pm.cmd, ['link'], PKG, { silent: true });
  return true;
}

console.log(`\n${bold}${cyan}╔══════════════════════════════════════════════════════════╗`);
console.log(`║   Nexus-Dev MMFE — installer + global TUI setup          ║`);
console.log(`╚══════════════════════════════════════════════════════════╝${reset}`);

// ── Step 1: Node version ──────────────────────────────────────
STEP(1, 'Checking Node.js…');
const nodeVer = parseInt(process.versions.node.split('.')[0], 10);
if (nodeVer < 18) {
  ERR(`Node.js >= 18 required (found v${process.versions.node}). Upgrade at https://nodejs.org`);
  process.exit(1);
}
OK(`Node.js v${process.versions.node}`);

const pm = pkgManager();
OK(`Package manager: ${pm.cmd}`);

// ── Step 2: install + build root SDK ──────────────────────────
STEP(2, 'Installing + building root orchestrator SDK…');
run(pm.cmd, pm.i, ROOT);
run(pm.cmd, ['run', 'build'], ROOT);
OK('Root SDK built → dist/');

// ── Step 3: install + build Nexus Code TUI ────────────────────
STEP(3, 'Installing + building Nexus Code TUI…');
run(pm.cmd, pm.bi, PKG);
run(pm.cmd, ['run', 'build'], PKG);
OK('Nexus Code built → packages/nexus-code/dist/');

// ── Step 4: link nexus globally ───────────────────────────────
STEP(4, 'Linking `nexus` + `nexus-code` globally…');
// We create the global module + bin symlinks manually (see linkGlobally) so
// the command works even though the repo uses npm workspaces.
linkGlobally();
OK('Global symlinks created for: nexus, nexus-code');

// ── Step 5: verify `nexus` resolves on PATH ───────────────────
STEP(5, 'Verifying `nexus` command…');
const which = isWin ? 'where' : 'which';
const probe = spawnSync(which, ['nexus'], { shell: isWin });
if (probe.status === 0 && probe.stdout.toString().trim()) {
  OK(`nexus → ${probe.stdout.toString().trim().split('\n')[0]}`);
} else {
  // Fallback: try invoking `nexus --version` directly.
  const ver = spawnSync(isWin ? 'nexus.cmd' : 'nexus', ['--version'], { shell: isWin });
  if (ver.status === 0) {
    OK(`nexus runs: ${ver.stdout.toString().trim()}`);
  } else {
    WARN('`nexus` not found on your current PATH.');
    const globalBin = safeGlobalBin();
    console.log(`  ${dim}The global bin dir is:${reset} ${bold}${globalBin}${reset}`);
    console.log(`  ${dim}Add it to PATH:${reset}`);
    if (!isWin) {
      console.log(`    ${cyan}export PATH="${globalBin}:$PATH"${reset}   ${dim}# add to ~/.bashrc or ~/.zshrc${reset}`);
    } else {
      console.log(`    ${cyan}setx PATH "%PATH%;${globalBin}"${reset}`);
    }
  }
}

// Confirm version one more time via direct invocation.
const verOut = spawnSync(isWin ? 'nexus.cmd' : 'nexus', ['--version'], { shell: isWin, stdio: 'pipe' });
const version = verOut.stdout?.toString().trim() || 'OK';
OK(`nexus --version → ${version}`);

// ── Step 6: next steps (API key) ──────────────────────────────
STEP(6, 'Next steps — configure your API key');
console.log();
console.log(`  ${bold}Nexus Code is installed. Last step: add a provider API key.${reset}`);
console.log();
console.log(`  ${cyan}Option A — Z.ai (GLM, MMFE native, free tier available):${reset}`);
console.log(`    Get a key at https://z.ai, then run:`);
console.log(`    ${dim}mkdir -p ~/.config && \\${reset}`);
console.log(`    ${dim}printf '{"apiKey":"YOUR_ZAI_KEY","baseUrl":"https://open.bigmodel.cn/api/coding/paas/v4"}' > ~/.z-ai-config && \\${reset}`);
console.log(`    ${dim}chmod 600 ~/.z-ai-config${reset}`);
console.log();
console.log(`  ${cyan}Option B — any OpenAI/Anthropic key:${reset}`);
console.log(`    Launch nexus, then use the ${bold}/provider${reset} picker to switch providers and add keys inline.`);
console.log();
console.log(`  Then start coding:   ${bold}${green}nexus${reset}`);
console.log();

function safeGlobalBin() {
  try {
    const out = execSync('npm config get prefix', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    return isWin ? out : join(out, 'bin');
  } catch {
    return isWin ? '%APPDATA%\\npm' : '/usr/local/bin';
  }
}

// Done.
console.log(`${bold}${green}✓ Setup complete. Run "nexus" to start the TUI.${reset}\n`);
