// ============================================================
// Web UI mode — boots a local HTTP server with a basic chat UI.
// Usage: nexus --web [--port=3000]
//
// Endpoints:
//   GET  /            — single-page HTML chat UI
//   GET  /api/config  — current provider + model + mode info
//   GET  /api/messages — current message history
//   POST /api/chat    — { message, mode?, model?, provider? } → streamed response
//   POST /api/command — { command } → slash command result
// ============================================================

import { createServer, type IncomingMessage } from 'node:http';
import { loadConfig, saveConfig } from './config/index.js';
import { buildProviders } from './providers/index.js';
import { sendChat } from './orchestrator/index.js';
import { ToolRegistry, BUILTIN_TOOLS } from './tools/index.js';
import { runSlash } from './commands/index.js';
import { newSession } from './session/store.js';
import type { AppConfig, ChatMessage, Session } from './types.js';

export interface WebServerOptions {
  port?: number;
  host?: string;
  configPath?: string;
}

export async function runWebServer(opts: WebServerOptions = {}): Promise<void> {
  const port = opts.port || 3000;
  const host = opts.host || '127.0.0.1';

  const config = await loadConfig(opts.configPath);
  // providers built lazily per-request via buildProviders(reqConfig)
  void buildProviders;
  const toolRegistry = new ToolRegistry();
  for (const tool of BUILTIN_TOOLS) toolRegistry.register(tool);

  // In-memory session for the web UI
  const session: Session = newSession({
    providerId: config.activeProviderId,
    modelId: config.activeModelId,
    mode: config.mode,
    useMMFE: config.useMMFE,
  });

  const server = createServer(async (req, res) => {
    try {
      // CORS for local dev
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${host}:${port}`);
      const path = url.pathname;

      if (path === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HTML_UI);
        return;
      }

      if (path === '/api/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            version: config.version,
            activeProviderId: config.activeProviderId,
            activeModelId: config.activeModelId,
            mode: config.mode,
            useMMFE: config.useMMFE,
            providers: config.providers.map(p => ({
              id: p.id,
              name: p.name,
              kind: p.kind,
              mmfe: p.mmfe,
              hasKey: !!p.apiKey,
            })),
          })
        );
        return;
      }

      if (path === '/api/messages' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(session.messages));
        return;
      }

      if (path === '/api/chat' && req.method === 'POST') {
        const body = await readBody(req);
        const parsed = JSON.parse(body) as {
          message: string;
          mode?: AppConfig['mode'];
          model?: string;
          provider?: string;
          noMMFE?: boolean;
        };
        if (!parsed.message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'message is required' }));
          return;
        }

        // Apply per-request overrides to a config clone
        const reqConfig: AppConfig = {
          ...config,
          activeProviderId: parsed.provider || config.activeProviderId,
          activeModelId: parsed.model || config.activeModelId,
          mode: parsed.mode || config.mode,
          useMMFE: parsed.noMMFE ? false : config.useMMFE,
        };
        const reqProviders = buildProviders(reqConfig);

        const userMsg: ChatMessage = {
          id: `msg_${Date.now()}_u${Math.random().toString(36).slice(2, 6)}`,
          role: 'user',
          content: parsed.message,
          ts: Date.now(),
        };
        session.messages.push(userMsg);

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        try {
          const result = await sendChat(reqConfig, reqProviders, session.messages, {
            stream: true,
            mode: reqConfig.mode,
            model: reqConfig.activeModelId,
            noMMFE: !reqConfig.useMMFE,
            tools: toolRegistry.list().map(t => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters as Record<string, unknown>,
            })),
            maxToolRounds: 5,
            toolRegistry,
            onDelta: delta => {
              res.write(`data: ${JSON.stringify({ type: 'delta', delta })}\n\n`);
            },
          });
          session.messages.push(result.message);
          res.write(`data: ${JSON.stringify({ type: 'done', message: result.message })}\n\n`);
        } catch (err) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: (err as Error).message })}\n\n`);
        }
        res.end();
        return;
      }

      if (path === '/api/command' && req.method === 'POST') {
        const body = await readBody(req);
        const parsed = JSON.parse(body) as { command: string };
        if (!parsed.command) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'command is required' }));
          return;
        }
        const ctx = makeCommandContext(config, session);
        const result = await runSlash(parsed.command, ctx);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result }));
        return;
      }

      if (path === '/api/clear' && req.method === 'POST') {
        session.messages = [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });

  server.listen(port, host, () => {
    console.log(`\n┌─────────────────────────────────────────────┐`);
    console.log(`│  nexus-code web mode                       │`);
    console.log(`│  Open: http://${host}:${port}                  │`);
    console.log(`│  Press Ctrl+C to stop                       │`);
    console.log(`└─────────────────────────────────────────────┘\n`);
  });

  // Keep the process alive
  return new Promise<void>(() => {});
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function makeCommandContext(config: AppConfig, session: Session) {
  return {
    config,
    session,
    setConfig: (patch: Partial<AppConfig>) => {
      Object.assign(config, patch);
      void saveConfig(config);
    },
    setSession: (patch: Partial<Session>) => Object.assign(session, patch),
    pushMessage: (msg: ChatMessage) => session.messages.push(msg),
    clearMessages: () => {
      session.messages = [];
    },
    saveSession: async () => {},
    loadSession: async () => false,
    fetchModels: async () => [],
    addModel: () => {},
    quit: () => {},
  };
}

const HTML_UI = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>nexus-code · web</title>
<style>
  :root {
    --bg: #0A0E1A;
    --bg-soft: #111827;
    --bg-elev: #1A2236;
    --line: #1F2A44;
    --primary: #E2E8F0;
    --primary-dim: #94A3B8;
    --primary-mute: #475569;
    --accent: #06B6D4;
    --accent-2: #8B5CF6;
    --success: #10B981;
    --warn: #F59E0B;
    --danger: #EF4444;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--primary);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  header {
    padding: 12px 24px;
    border-bottom: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 16px;
    background: var(--bg-soft);
  }
  header h1 {
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.02em;
  }
  header .status {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--primary-mute);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  header select, header button {
    background: var(--bg-elev);
    border: 1px solid var(--line);
    color: var(--primary);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
  }
  header button:hover { border-color: var(--accent); }
  #messages {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .msg {
    max-width: 80%;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid var(--line);
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .msg.user {
    align-self: flex-end;
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }
  .msg.assistant {
    align-self: flex-start;
    background: var(--bg-soft);
  }
  .msg.assistant pre {
    background: var(--bg);
    padding: 8px 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
  }
  .msg .role {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--primary-mute);
    margin-bottom: 4px;
  }
  .msg.user .role { color: var(--bg); opacity: 0.7; }
  #input-area {
    border-top: 1px solid var(--line);
    padding: 16px 24px;
    background: var(--bg-soft);
    display: flex;
    gap: 12px;
  }
  #input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--primary);
    padding: 10px 14px;
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    resize: none;
    min-height: 40px;
    max-height: 200px;
  }
  #input:focus { outline: none; border-color: var(--accent); }
  #send {
    background: var(--accent);
    color: var(--bg);
    border: none;
    padding: 0 20px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }
  #send:disabled { opacity: 0.5; cursor: not-allowed; }
  .error {
    color: var(--danger);
    font-size: 12px;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 6px;
    border: 1px solid var(--danger);
  }
</style>
</head>
<body>
<header>
  <h1>nexus-code</h1>
  <span class="status" id="status">connecting…</span>
  <span style="flex:1"></span>
  <label>Provider: <select id="provider"></select></label>
  <label>Mode: <select id="mode">
    <option value="speed">speed</option>
    <option value="balanced">balanced</option>
    <option value="quality">quality</option>
    <option value="creative">creative</option>
  </select></label>
  <label><input type="checkbox" id="no-mmfe"> no MMFE</label>
  <button id="clear">Clear</button>
</header>
<div id="messages"></div>
<div id="input-area">
  <textarea id="input" placeholder="Type a message… (Enter to send, Shift+Enter for newline)" rows="1"></textarea>
  <button id="send">Send</button>
</div>
<script>
  const $ = (s) => document.querySelector(s);
  const messages = $('#messages');
  const input = $('#input');
  const send = $('#send');
  const status = $('#status');
  const providerSel = $('#provider');
  const modeSel = $('#mode');
  const noMmfeBox = $('#no-mmfe');
  let busy = false;

  async function loadConfig() {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    status.textContent = cfg.activeProviderId + ' / ' + cfg.activeModelId + ' / ' + cfg.mode + (cfg.useMMFE ? ' / mmfe' : ' / direct');
    providerSel.innerHTML = '';
    for (const p of cfg.providers) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name + (p.hasKey ? '' : ' (no key)');
      if (p.id === cfg.activeProviderId) opt.selected = true;
      providerSel.appendChild(opt);
    }
    modeSel.value = cfg.mode;
    noMmfeBox.checked = !cfg.useMMFE;
  }

  async function loadMessages() {
    const res = await fetch('/api/messages');
    const msgs = await res.json();
    messages.innerHTML = '';
    for (const m of msgs) appendMessage(m);
  }

  function appendMessage(m) {
    const div = document.createElement('div');
    div.className = 'msg ' + m.role;
    const role = document.createElement('div');
    role.className = 'role';
    role.textContent = m.role + (m.model ? ' · ' + m.model : '');
    div.appendChild(role);
    const content = document.createElement('div');
    content.innerHTML = formatContent(m.content);
    div.appendChild(content);
    if (m.toolCalls && m.toolCalls.length) {
      const tc = document.createElement('div');
      tc.style.fontSize = '11px';
      tc.style.color = 'var(--warn)';
      tc.style.marginTop = '8px';
      tc.textContent = '⚙ ' + m.toolCalls.map(t => t.name + '(' + Object.keys(t.args).join(', ') + ') → ' + t.status).join(', ');
      div.appendChild(tc);
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function formatContent(text) {
    if (!text) return '';
    // Escape HTML
    let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Code blocks
    s = s.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre>$1</pre>');
    // Inline code
    s = s.replace(/\`([^\\n]+?)\`/g, '<code style="font-family: monospace; color: var(--accent);">$1</code>');
    return s;
  }

  async function sendMessage() {
    if (busy) return;
    const text = input.value.trim();
    if (!text) return;
    if (text.startsWith('/')) {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: text }),
      });
      const data = await res.json();
      appendMessage({ role: 'system', content: data.result || '(no output)' });
      input.value = '';
      input.style.height = 'auto';
      return;
    }
    appendMessage({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';
    busy = true;
    send.disabled = true;
    const assistantDiv = appendMessage({ role: 'assistant', content: '' });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          mode: modeSel.value,
          provider: providerSel.value,
          noMMFE: noMmfeBox.checked,
        }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === 'delta') {
            assistantDiv.querySelector('div:last-child').innerHTML += formatContent(data.delta);
            messages.scrollTop = messages.scrollHeight;
          } else if (data.type === 'done') {
            if (data.message.qualityScore) {
              const q = document.createElement('div');
              q.style.fontSize = '11px';
              q.style.color = 'var(--success)';
              q.style.marginTop = '8px';
              q.textContent = '✓ quality ' + data.message.qualityScore + '/100';
              assistantDiv.appendChild(q);
            }
          } else if (data.type === 'error') {
            const err = document.createElement('div');
            err.className = 'error';
            err.textContent = data.error;
            assistantDiv.appendChild(err);
          }
        }
      }
    } catch (err) {
      appendMessage({ role: 'system', content: 'Error: ' + err.message });
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(200, input.scrollHeight) + 'px';
  });
  $('#clear').addEventListener('click', async () => {
    await fetch('/api/clear', { method: 'POST' });
    await loadMessages();
  });

  loadConfig();
  loadMessages();
  input.focus();
</script>
</body>
</html>`;
