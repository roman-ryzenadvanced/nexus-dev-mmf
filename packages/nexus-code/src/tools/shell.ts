// ============================================================
// Shell exec tool — sandboxed command runner
// ============================================================

import { spawn } from 'node:child_process';

export interface ShellResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  signal: NodeJS.Signals | null;
  durationMs: number;
}

export async function execShell(command: string, opts: { cwd?: string; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<ShellResult> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      cwd: opts.cwd,
      signal: opts.signal,
      timeout: opts.timeoutMs,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d.toString()));
    child.stderr.on('data', d => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (exitCode, signal) => {
      resolve({
        exitCode,
        stdout,
        stderr,
        signal: signal ?? null,
        durationMs: Date.now() - start,
      });
    });
  });
}
