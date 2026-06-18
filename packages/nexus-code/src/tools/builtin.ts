// ============================================================
// Builtin tools — fs, shell, diff
// Registered with the ToolRegistry on TUI boot.
// ============================================================

import { readContextFile, writeContextFile } from './fs.js';
import { execShell } from './shell.js';
import { diffFile, applyDiff } from './diff.js';
import type { ToolDefinition } from './protocol/index.js';

export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file from the local filesystem. ' + 'Use for inspecting source code, configs, or logs.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative file path' },
      maxBytes: {
        type: 'integer',
        description: 'Max bytes to read (default 200000)',
        minimum: 1,
      },
    },
    required: ['path'],
  },
  async handler(args) {
    const path = String(args.path);
    const maxBytes = args.maxBytes ? Number(args.maxBytes) : undefined;
    return readContextFile(path, maxBytes);
  },
};

export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: 'Write content to a file on the local filesystem. Overwrites existing content.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative file path' },
      content: { type: 'string', description: 'Full file content' },
    },
    required: ['path', 'content'],
  },
  async handler(args) {
    await writeContextFile(String(args.path), String(args.content));
    return { ok: true, bytesWritten: String(args.content).length };
  },
};

export const shellTool: ToolDefinition = {
  name: 'shell',
  description: 'Execute a shell command and return stdout/stderr. ' + 'Use for running tests, git operations, build commands.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      cwd: { type: 'string', description: 'Working directory (optional)' },
      timeoutMs: {
        type: 'integer',
        description: 'Timeout in ms (default 60000)',
        minimum: 1000,
      },
    },
    required: ['command'],
  },
  async handler(args) {
    const command = String(args.command);
    const cwd = args.cwd ? String(args.cwd) : undefined;
    const timeoutMs = args.timeoutMs ? Number(args.timeoutMs) : 60_000;
    const res = await execShell(command, { cwd, timeoutMs });
    return {
      exitCode: res.exitCode,
      stdout: res.stdout.slice(0, 50_000),
      stderr: res.stderr.slice(0, 50_000),
      durationMs: res.durationMs,
    };
  },
};

export const diffTool: ToolDefinition = {
  name: 'diff',
  description: 'Generate a unified diff between the current file contents and proposed new contents.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File to diff against' },
      newContent: { type: 'string', description: 'Proposed new content' },
    },
    required: ['path', 'newContent'],
  },
  async handler(args) {
    const diff = await diffFile(String(args.path), String(args.newContent));
    return {
      path: diff.path,
      added: diff.added,
      removed: diff.removed,
      patch: diff.patch,
    };
  },
};

export const applyDiffTool: ToolDefinition = {
  name: 'apply_diff',
  description: 'Apply new content to a file, replacing its current contents.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File to overwrite' },
      newContent: { type: 'string', description: 'New content to write' },
    },
    required: ['path', 'newContent'],
  },
  async handler(args) {
    const result = await applyDiff(String(args.path), String(args.newContent));
    return {
      applied: result.applied,
      path: result.path,
      added: result.added,
      removed: result.removed,
    };
  },
};

export const BUILTIN_TOOLS: ToolDefinition[] = [readFileTool, writeFileTool, shellTool, diffTool, applyDiffTool];
