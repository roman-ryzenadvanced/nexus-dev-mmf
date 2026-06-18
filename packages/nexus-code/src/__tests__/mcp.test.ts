import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { MCPClient } from '../mcp/client.js';
import type { MCPServerConfig } from '../types.js';

// Integration test: spawns the official @modelcontextprotocol/server-filesystem
// MCP server via npx and verifies the MCPClient can list + invoke tools.
//
// Prereqs: npx + internet access on first run (to fetch the package).
// Skipped automatically if npx isn't available or the server fails to start.

const hasNpx = (() => {
  try {
    const { execSync } = require('node:child_process');
    execSync('npx --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasNpx)('MCPClient — integration with filesystem MCP server', () => {
  let client: MCPClient;
  const tmpDir = '/tmp/mcp-test-fs';

  beforeEach(async () => {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    if (client) await client.disconnectAll();
    const { rm } = await import('node:fs/promises');
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('connects to filesystem MCP server and lists tools', async () => {
    const config: MCPServerConfig = {
      id: 'fs',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir],
    };

    client = new MCPClient([config]);
    const statuses = await client.connectAll();

    expect(statuses).toHaveLength(1);
    const status = statuses[0];
    expect(status.id).toBe('fs');
    expect(status.connected).toBe(true);
    expect(status.tools.length).toBeGreaterThan(0);

    // Filesystem server exposes tools like read_file, write_file, list_directory
    const toolNames = status.tools.map(t => t.name);
    expect(toolNames.some(n => n.includes('read_file'))).toBe(true);
    expect(toolNames.some(n => n.includes('list_directory'))).toBe(true);
  }, 30_000);

  it('can invoke a tool through the registered handler', async () => {
    const { writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    await writeFile(join(tmpDir, 'hello.txt'), 'Hello from MCP test!', 'utf8');

    const config: MCPServerConfig = {
      id: 'fs',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir],
    };

    client = new MCPClient([config]);
    const statuses = await client.connectAll();
    const status = statuses[0];
    expect(status.connected).toBe(true);

    // Find the read_file tool
    const readFileTool = status.tools.find(t => t.name.includes('read_file'));
    expect(readFileTool).toBeDefined();

    // Invoke it with an absolute path (filesystem MCP server requires paths
    // inside one of the allowed directories — passing the absolute tmpDir path)
    const result = await readFileTool!.handler({
      path: join(tmpDir, 'hello.txt'),
    });
    expect(result).toContain('Hello from MCP test!');
  }, 30_000);
});

describe('MCPClient — handles connection failures gracefully', () => {
  it('reports error when command does not exist', async () => {
    const config: MCPServerConfig = {
      id: 'broken',
      transport: 'stdio',
      command: 'this-command-does-not-exist-anywhere-xyz',
      args: [],
    };
    const client = new MCPClient([config]);
    const statuses = await client.connectAll();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].connected).toBe(false);
    expect(statuses[0].lastError).toBeTruthy();
  });

  it('reports error when stdio command is missing', async () => {
    const config: MCPServerConfig = {
      id: 'no-command',
      transport: 'stdio',
      args: [],
    };
    const client = new MCPClient([config]);
    const statuses = await client.connectAll();
    expect(statuses[0].connected).toBe(false);
    expect(statuses[0].lastError).toContain('missing');
  });

  it('reports error when http URL is missing', async () => {
    const config: MCPServerConfig = {
      id: 'no-url',
      transport: 'http',
    };
    const client = new MCPClient([config]);
    const statuses = await client.connectAll();
    expect(statuses[0].connected).toBe(false);
    expect(statuses[0].lastError).toContain('missing');
  });

  it('listStatuses returns all configured servers', async () => {
    const configs: MCPServerConfig[] = [
      { id: 'a', transport: 'stdio', command: 'echo', args: ['hi'] },
      { id: 'b', transport: 'http', url: 'http://example.invalid/mcp' },
    ];
    const client = new MCPClient(configs);
    await client.connectAll();
    const statuses = client.listStatuses();
    expect(statuses).toHaveLength(2);
    const ids = statuses.map(s => s.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });
});

// Suppress unused spawn import (kept for future use)
void spawn;
