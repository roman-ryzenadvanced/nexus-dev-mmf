import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { runWebServer } from '../web.js';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

let testConfigDir: string;
let testConfigPath: string;
let serverPort: number;
let shutdown: (() => void) | null = null;

async function startServer(): Promise<void> {
  if (shutdown) return;
  // Pick a random port to avoid collisions
  serverPort = 40000 + Math.floor(Math.random() * 5000);
  // Start server in background — runWebServer returns a never-resolving promise
  runWebServer({ port: serverPort, configPath: testConfigPath }).catch(() => {});
  // Give it time to boot
  await new Promise(r => setTimeout(r, 500));
}

beforeAll(async () => {
  // Compute the dir name ONCE so mkdir + writeFile use the same path.
  testConfigDir = join(tmpdir(), `nexus-web-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(testConfigDir, { recursive: true });
  testConfigPath = join(testConfigDir, 'config.json');
  await writeFile(
    testConfigPath,
    JSON.stringify({
      version: '1.1.6',
      activeProviderId: 'zai',
      activeModelId: 'glm-5.2',
      mode: 'balanced',
      useMMFE: true,
      providers: [
        {
          id: 'zai',
          kind: 'zai',
          name: 'Z.ai',
          mmfe: true,
          defaultModel: 'glm-5.2',
        },
      ],
      manualModels: [],
      mcpServers: [],
      ui: {
        theme: 'tech-dark',
        showRouting: true,
        showTokens: true,
        showTimestamps: false,
      },
    }),
    'utf8'
  );
  process.env.NEXUS_CONFIG = testConfigPath;
});

afterAll(async () => {
  delete process.env.NEXUS_CONFIG;
  await rm(testConfigDir, { recursive: true, force: true }).catch(() => {});
});

describe('web UI server', () => {
  it('runWebServer is a function', () => {
    expect(typeof runWebServer).toBe('function');
  });

  it('boots an HTTP server and serves the HTML UI', async () => {
    await startServer();
    const res = await fetch(`http://127.0.0.1:${serverPort}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('nexus-code');
    expect(html).toContain('<input');
    expect(html).toContain('messages');
  }, 15_000);

  it('GET /api/config returns current config', async () => {
    await startServer();
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/config`);
    expect(res.status).toBe(200);
    const cfg = await res.json();
    expect(cfg.version).toBe('1.1.6');
    expect(cfg.activeProviderId).toBe('zai');
    expect(cfg.activeModelId).toBe('glm-5.2');
    expect(cfg.mode).toBe('balanced');
    expect(cfg.useMMFE).toBe(true);
    expect(Array.isArray(cfg.providers)).toBe(true);
    expect(cfg.providers[0]).toHaveProperty('id');
    expect(cfg.providers[0]).toHaveProperty('hasKey');
  }, 15_000);

  it('GET /api/messages returns empty array initially', async () => {
    await startServer();
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/messages`);
    expect(res.status).toBe(200);
    const msgs = await res.json();
    expect(Array.isArray(msgs)).toBe(true);
  }, 15_000);

  it('POST /api/clear returns ok', async () => {
    await startServer();
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/clear`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  }, 15_000);

  it('POST /api/command executes slash commands', async () => {
    await startServer();
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '/mode' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.result).toBe('string');
    expect(data.result).toContain('balanced');
  }, 15_000);

  it('POST /api/command returns 400 when command is missing', async () => {
    await startServer();
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  }, 15_000);

  it('GET /api/chat returns 400 when message is missing', async () => {
    await startServer();
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  }, 15_000);

  it('returns 404 for unknown paths', async () => {
    await startServer();
    const res = await fetch(`http://127.0.0.1:${serverPort}/nonexistent`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Not found');
  }, 15_000);

  it('HTML UI contains key UI elements', async () => {
    await startServer();
    const res = await fetch(`http://127.0.0.1:${serverPort}/`);
    const html = await res.text();
    // Verify the HTML has the chat UI elements
    expect(html).toContain('id="messages"');
    expect(html).toContain('id="input"');
    expect(html).toContain('id="send"');
    expect(html).toContain('id="provider"');
    expect(html).toContain('id="mode"');
    expect(html).toContain('id="no-mmfe"');
    expect(html).toContain('id="clear"');
    // Streaming JS code — we use fetch + ReadableStream, not EventSource
    expect(html).not.toContain('new EventSource');
    expect(html).toContain('fetch');
    expect(html).toContain('getReader');
  }, 15_000);

  it('HTML UI references tech-dark theme colors', async () => {
    await startServer();
    const res = await fetch(`http://127.0.0.1:${serverPort}/`);
    const html = await res.text();
    expect(html).toContain('#0A0E1A'); // bg
    expect(html).toContain('#06B6D4'); // accent
    expect(html).toContain('#8B5CF6'); // accent-2
  }, 15_000);
});

void existsSync;
