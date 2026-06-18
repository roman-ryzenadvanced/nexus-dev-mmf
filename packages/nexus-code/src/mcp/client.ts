// ============================================================
// MCP (Model Context Protocol) client runtime
// Supports stdio + HTTP/SSE transports.
// ============================================================

import { spawn, type ChildProcess } from 'node:child_process';
import type { MCPServerConfig } from '../types.js';
import type { ToolDefinition } from '../tools/protocol/index.js';

export interface MCPServerStatus {
  id: string;
  transport: MCPServerConfig['transport'];
  connected: boolean;
  tools: ToolDefinition[];
  lastError?: string;
  pid?: number;
}

/**
 * MCPClient manages one or more MCP server connections.
 * Each server exposes a list of tools that get registered with the
 * ToolRegistry so models can invoke them transparently.
 *
 * NOTE: This is a minimal implementation of the MCP spec. It supports:
 *   - stdio transport (spawn process, JSON-RPC over stdin/stdout)
 *   - HTTP transport (POST requests with JSON-RPC body)
 *   - tools/list and tools/call methods
 *
 * Future: SSE transport, resource subscriptions, prompts, completions.
 */
export class MCPClient {
  private processes = new Map<string, ChildProcess>();
  private statuses = new Map<string, MCPServerStatus>();

  constructor(private servers: MCPServerConfig[] = []) {}

  async connectAll(): Promise<MCPServerStatus[]> {
    return Promise.all(this.servers.map(s => this.connect(s)));
  }

  async connect(server: MCPServerConfig): Promise<MCPServerStatus> {
    try {
      if (server.transport === 'stdio') {
        return await this.connectStdio(server);
      }
      if (server.transport === 'http' || server.transport === 'sse') {
        return await this.connectHttp(server);
      }
      throw new Error(`Unsupported transport: ${server.transport}`);
    } catch (err) {
      const status: MCPServerStatus = {
        id: server.id,
        transport: server.transport,
        connected: false,
        tools: [],
        lastError: (err as Error).message,
      };
      this.statuses.set(server.id, status);
      return status;
    }
  }

  private async connectStdio(server: MCPServerConfig): Promise<MCPServerStatus> {
    if (!server.command) {
      throw new Error(`stdio server "${server.id}" missing "command"`);
    }
    const child = spawn(server.command, server.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...server.env },
    });
    // Suppress unhandled ENOENT — we surface the error via the try/catch
    // around connectAll() instead. Without this, a non-existent command
    // emits an unhandled 'error' event that vitest surfaces as a crash.
    child.on('error', () => {});
    this.processes.set(server.id, child);

    // Initialize MCP handshake: send "initialize" JSON-RPC request.
    await this.sendStdio(child, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'nexus-code', version: '1.1.7' },
    });

    // Send initialized notification.
    this.notifyStdio(child, 'notifications/initialized', {});

    // List tools.
    const toolsResult = (await this.sendStdio(child, 'tools/list', {})) as {
      tools?: Array<{
        name: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
      }>;
    };

    const tools: ToolDefinition[] = (toolsResult.tools || []).map(t => ({
      name: `mcp_${server.id}_${t.name}`,
      description: t.description || `MCP tool ${t.name} from ${server.id}`,
      parameters: (t.inputSchema as never) || {
        type: 'object',
        properties: {},
      },
      handler: async args => {
        const result = (await this.sendStdio(child, 'tools/call', {
          name: t.name,
          arguments: args,
        })) as { content?: Array<{ type: string; text?: string }> };
        return result.content?.map(c => c.text).join('\n') ?? null;
      },
    }));

    const status: MCPServerStatus = {
      id: server.id,
      transport: 'stdio',
      connected: true,
      tools,
      pid: child.pid,
    };
    this.statuses.set(server.id, status);
    return status;
  }

  private async connectHttp(server: MCPServerConfig): Promise<MCPServerStatus> {
    if (!server.url) {
      throw new Error(`http server "${server.id}" missing "url"`);
    }
    // For HTTP transport, we don't maintain a persistent connection.
    // Each request is a POST. We do an "initialize" call to verify connectivity.
    const initResult = await this.sendHttp(server.url, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'nexus-code', version: '1.1.7' },
    });
    void initResult;

    const toolsResult = (await this.sendHttp(server.url, 'tools/list', {})) as {
      tools?: Array<{
        name: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
      }>;
    };

    const tools: ToolDefinition[] = (toolsResult.tools || []).map(t => ({
      name: `mcp_${server.id}_${t.name}`,
      description: t.description || `MCP tool ${t.name} from ${server.id}`,
      parameters: (t.inputSchema as never) || {
        type: 'object',
        properties: {},
      },
      handler: async args => {
        const result = (await this.sendHttp(server.url!, 'tools/call', {
          name: t.name,
          arguments: args,
        })) as { content?: Array<{ type: string; text?: string }> };
        return result.content?.map(c => c.text).join('\n') ?? null;
      },
    }));

    const status: MCPServerStatus = {
      id: server.id,
      transport: server.transport,
      connected: true,
      tools,
    };
    this.statuses.set(server.id, status);
    return status;
  }

  private sendStdio(child: ChildProcess, method: string, params: Record<string, unknown>, timeoutMs = 10_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1_000_000);
      const req = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      let buffer = '';

      const timer = setTimeout(() => {
        reject(new Error(`MCP stdio "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const onStdout = (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.id === id) {
              clearTimeout(timer);
              child.stdout?.off('data', onStdout);
              if (msg.error) reject(new Error(`MCP error: ${JSON.stringify(msg.error)}`));
              else resolve(msg.result);
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      };
      child.stdout?.on('data', onStdout);
      // Guard against EPIPE when the child has already exited.
      child.stdin?.on?.('error', () => {});
      try {
        child.stdin?.write(req);
      } catch {
        // stdin already closed — let the timeout reject.
      }
    });
  }

  private notifyStdio(child: ChildProcess, method: string, params: Record<string, unknown>): void {
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
    child.stdin?.write(msg);
  }

  private async sendHttp(url: string, method: string, params: Record<string, unknown>, timeoutMs = 10_000): Promise<unknown> {
    const id = Math.floor(Math.random() * 1_000_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = (await res.json()) as { result?: unknown; error?: unknown };
      if (json.error) throw new Error(`MCP error: ${JSON.stringify(json.error)}`);
      return json.result;
    } finally {
      clearTimeout(timer);
    }
  }

  getStatus(id: string): MCPServerStatus | undefined {
    return this.statuses.get(id);
  }

  listStatuses(): MCPServerStatus[] {
    return Array.from(this.statuses.values());
  }

  async disconnect(id: string): Promise<void> {
    const child = this.processes.get(id);
    if (child) {
      child.stdin?.end();
      child.kill('SIGTERM');
      this.processes.delete(id);
    }
    const status = this.statuses.get(id);
    if (status) {
      status.connected = false;
      status.tools = [];
    }
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(Array.from(this.processes.keys()).map(id => this.disconnect(id)));
  }
}
