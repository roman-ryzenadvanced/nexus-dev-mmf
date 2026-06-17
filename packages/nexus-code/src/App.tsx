// ============================================================
// Main App — root Ink component
// ============================================================

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useApp, useStdout, useInput } from 'ink';
import { ChatView } from './components/ChatView.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { CommandPalette } from './components/CommandPalette.js';
import { buildProviders } from './providers/index.js';
import { sendChatStream } from './orchestrator/index.js';
import { fetchAllModels } from './models/fetcher.js';
import { addManualModel } from './models/registry.js';
import { runSlash, registerPluginCommand } from './commands/index.js';
import { newSession, saveSession, loadSession } from './session/store.js';
import { useInputHistory } from './session/useInputHistory.js';
import { saveConfig } from './config/index.js';
import { ToolRegistry, BUILTIN_TOOLS, type ToolDefinition } from './tools/index.js';
import { MCPClient, type MCPServerStatus } from './mcp/index.js';
import { loadAllPlugins, ensurePluginsDir, type LoadedPlugin } from './plugins/index.js';
import { setTheme as setTuiTheme } from './tui/theme.js';
import type { AppConfig, ChatMessage, ModelDescriptor, Session, SlashCommandContext } from './types.js';
import { color } from './tui/theme.js';

import { REGISTRY } from './commands/builtin.js';

interface AppProps {
  initialConfig: AppConfig;
  initialPrompt?: string;
}

export function App({ initialConfig, initialPrompt }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [config, setConfigState] = useState<AppConfig>(initialConfig);
  const [session, setSession] = useState<Session>(() =>
    newSession({
      providerId: initialConfig.activeProviderId,
      modelId: initialConfig.activeModelId,
      mode: initialConfig.mode,
      useMMFE: initialConfig.useMMFE,
    })
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [autoModels, setAutoModels] = useState<ModelDescriptor[]>([]);
  void autoModels; // referenced indirectly via setAutoModels in fetchModels callback
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcpStatuses, setMcpStatuses] = useState<MCPServerStatus[]>([]);
  const [retryInfo, setRetryInfo] = useState<string | null>(null);
  const [toolCallInfo, setToolCallInfo] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  void plugins; // surfaced via /plugins command in handleSlash
  const { history: historyState, append: appendHistoryState } = useInputHistory();

  // Tool registry — registered once on boot with builtin tools.
  // MCP tools + plugin tools get added as servers/plugins connect.
  const toolRegistry = useMemo(() => {
    const reg = new ToolRegistry();
    for (const tool of BUILTIN_TOOLS) reg.register(tool);
    return reg;
  }, []);

  // Apply persisted theme on boot + whenever config.ui.theme changes.
  useEffect(() => {
    if (config.ui?.theme) {
      setTuiTheme(config.ui.theme);
    }
  }, [config.ui?.theme]);

  // Load plugins from ~/.nexus/plugins/ on boot.
  useEffect(() => {
    (async () => {
      await ensurePluginsDir();
      const loaded = await loadAllPlugins();
      setPlugins(loaded);
      for (const p of loaded) {
        for (const tool of p.tools) {
          try {
            toolRegistry.register(tool);
          } catch {
            // Already registered — skip
          }
        }
        for (const cmd of p.commands) {
          registerPluginCommand(cmd);
        }
      }
    })();
  }, [toolRegistry]);

  // MCP client — booted once on mount.
  const mcpClientRef = useRef<MCPClient | null>(null);

  // Build providers whenever config changes (cheap — providers are stateless wrappers).
  const providers = React.useMemo(() => buildProviders(config), [config.providers]);

  // Auto-fetch models on first boot, in the background.
  useEffect(() => {
    (async () => {
      const results = await fetchAllModels(providers);
      const flat = results.flatMap((r) => r.models || []);
      setAutoModels(flat);
    })();
  }, []);

  // Boot MCP servers on first mount; register their tools with the registry.
  useEffect(() => {
    if (!config.mcpServers || config.mcpServers.length === 0) return;
    const client = new MCPClient(config.mcpServers);
    mcpClientRef.current = client;
    (async () => {
      const statuses = await client.connectAll();
      setMcpStatuses(statuses);
      for (const status of statuses) {
        for (const tool of status.tools) {
          try {
            toolRegistry.register(tool);
          } catch {
            // Already registered (e.g. reconnect) — skip.
          }
        }
      }
    })();
    return () => {
      void client.disconnectAll();
    };
  }, [config.mcpServers, toolRegistry]);

  // Pre-fill the input if --prompt was passed.
  useEffect(() => {
    if (initialPrompt) {
      void handleSubmit(initialPrompt);
    }
  }, [initialPrompt]);

  const setConfig = useCallback((patch: Partial<AppConfig>) => {
    setConfigState((prev: AppConfig) => {
      const next: AppConfig = { ...prev, ...patch };
      void saveConfig(next);
      return next;
    });
  }, []);

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((m) => [...m, msg]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const ctx: SlashCommandContext = {
    config,
    session,
    setConfig,
    setSession: (patch: Partial<Session>) => setSession((s: Session) => ({ ...s, ...patch })),
    pushMessage,
    clearMessages,
    saveSession: async (name?: string) => {
      const named = await saveSession(session, name);
      setSession(named);
    },
    loadSession: async (name: string) => {
      const loaded = await loadSession(name);
      if (loaded) {
        setSession(loaded);
        setMessages(loaded.messages);
        return true;
      }
      return false;
    },
    fetchModels: async (providerId?: string) => {
      const results = await fetchAllModels(providers, providerId ? { onlyIds: [providerId] } : {});
      const flat: ModelDescriptor[] = results.flatMap((r: { models?: ModelDescriptor[] }) => r.models || []);
      setAutoModels((prev: ModelDescriptor[]) => {
        const seen = new Set(flat.map((m: ModelDescriptor) => `${m.providerId}::${m.id}`));
        return [...flat, ...prev.filter((m: ModelDescriptor) => !seen.has(`${m.providerId}::${m.id}`))];
      });
      return flat;
    },
    addModel: (providerId: string, modelId: string, label?: string) => {
      setConfig({ manualModels: addManualModel(config, providerId, modelId, label).manualModels });
    },
    quit: () => exit(),
    getProviderInfo: () => {
      const p = config.providers.find((x) => x.id === config.activeProviderId);
      const all = [...config.manualModels, ...autoModels];
      // Dedupe by providerId::id
      const seen = new Set<string>();
      const deduped = all.filter((m) => {
        const k = `${m.providerId}::${m.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return {
        providerId: p?.id || '',
        providerName: p?.name || '',
        providerKind: p?.kind || 'openai',
        mmfe: p?.mmfe ?? false,
        models: deduped,
      };
    },
    getMcpStatuses: () =>
      mcpStatuses.map((s) => ({
        id: s.id,
        connected: s.connected,
        toolCount: s.tools.length,
        lastError: s.lastError,
      })),
  };

  const handleSlash = useCallback(
    async (input: string) => {
      if (input === '/help' || input === '/?') {
        setShowHelp((v) => !v);
        return;
      }
      if (input === '/mcp') {
        if (!mcpStatuses.length) return 'No MCP servers configured.';
        return mcpStatuses
          .map(
            (s) =>
              `  ${s.id.padEnd(16)} ${s.transport.padEnd(6)} ${s.connected ? '✓' : '✗'}  ${s.tools.length} tools${
                s.lastError ? `  (${s.lastError})` : ''
              }`
          )
          .join('\n');
      }
      if (input === '/tools') {
        const tools = toolRegistry.list();
        if (!tools.length) return 'No tools registered.';
        return tools.map((t) => `  ${t.name.padEnd(24)}  ${t.description.slice(0, 60)}`).join('\n');
      }
      try {
        return await runSlash(input, ctx);
      } catch (err) {
        setError((err as Error).message);
        return `Error: ${(err as Error).message}`;
      }
    },
    [ctx, mcpStatuses, toolRegistry]
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      setError(null);
      setRetryInfo(null);
      setToolCallInfo(null);
      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: text,
        ts: Date.now(),
      };
      pushMessage(userMsg);
      setStreaming(true);
      setStreamBuffer('');

      const allMessages = [...messages, userMsg];
      // Pass all registered tools to the provider so models can call them.
      const tools = toolRegistry.list().map((t: ToolDefinition) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>,
      }));
      try {
        // Use the streaming path — falls back to non-streaming chat()
        // automatically if the provider doesn't implement streamChat().
        const res = await sendChatStream(config, providers, allMessages, {
          stream: true,
          mode: config.mode,
          model: config.activeModelId,
          noMMFE: !config.useMMFE,
          tools,
          maxToolRounds: 5,
          toolRegistry,
          onDelta: (delta) => {
            setStreamBuffer((b) => b + delta);
          },
          onRouting: (decisions) => {
            pendingRoutingRef.current = decisions;
          },
          onToolCall: (call) => {
            setToolCallInfo(
              `${call.name}(${Object.keys(call.args).join(', ')}) → ${call.status}${
                call.status === 'error' && call.result
                  ? `: ${(call.result as { error?: string }).error || 'failed'}`
                  : ''
              }`
            );
          },
          retry: {
            maxRetries: 2,
            baseDelayMs: 500,
            maxDelayMs: 8000,
            onRetry: ({ attempt, error: retryErr, nextDelayMs }) => {
              setRetryInfo(`retry ${attempt}: ${retryErr.message} (waiting ${nextDelayMs}ms)`);
            },
          },
        });
        pendingRoutingRef.current = null;
        setStreamBuffer('');
        setStreaming(false);
        setRetryInfo(null);
        setToolCallInfo(null);
        pushMessage(res.message);
      } catch (err) {
        setStreaming(false);
        setStreamBuffer('');
        setRetryInfo(null);
        setToolCallInfo(null);
        setError((err as Error).message);
      }
    },
    [config, providers, messages, pushMessage]
  );

  const handleTab = useCallback(
    (currentInput: string): string[] => {
      if (currentInput.startsWith('/')) {
        const q = currentInput.slice(1).toLowerCase();
        return REGISTRY
          .filter((c) => c.name.startsWith(q) || c.aliases?.some((a) => a.startsWith(q)))
          .flatMap((c) => [`/${c.name}`, ...(c.aliases?.map((a) => `/${a}`) || [])])
          .filter((s) => s.toLowerCase().startsWith(currentInput.toLowerCase()))
          .slice(0, 8);
      }
      // History-based completion for free text
      const q = currentInput.toLowerCase();
      const seen = new Set<string>();
      const matches: string[] = [];
      // Iterate from most recent backward
      for (let i = historyState.length - 1; i >= 0 && matches.length < 8; i--) {
        const t = historyState[i].text;
        if (t.toLowerCase().startsWith(q) && !seen.has(t)) {
          seen.add(t);
          matches.push(t);
        }
      }
      return matches;
    },
    [historyState]
  );

  const handleAbort = useCallback(() => {
    if (streaming) {
      setStreaming(false);
      setStreamBuffer('');
      setError('Aborted.');
    } else {
      exit();
    }
  }, [streaming, exit]);

  const pendingRoutingRef = useRef<ChatMessage['routing'] | null>(null);
  void pendingRoutingRef;

  // Global Ctrl+P shortcut → toggle command palette
  useInput((input, key) => {
    if (key.ctrl && input === 'p' && !streaming) {
      setShowPalette((v) => !v);
    }
  });

  return (
    <Box flexDirection="column" height={stdout?.rows || 40}>
      <Header config={config} mcpCount={mcpStatuses.length} toolCount={toolRegistry.list().length} />
      <Box flexGrow={1} flexDirection="column" overflowY="hidden">
        <ChatView
          messages={messages}
          streaming={streaming}
          streamBuffer={streamBuffer}
          showRouting={config.ui?.showRouting ?? true}
          showTokens={config.ui?.showTokens ?? true}
        />
        {showHelp && <HelpOverlay />}
        {showPalette && (
          <CommandPalette
            onPick={(cmd) => {
              setShowPalette(false);
              void handleSlash(cmd);
            }}
            onClose={() => setShowPalette(false)}
          />
        )}
        {(error || retryInfo || toolCallInfo) && (
          <Box marginTop={1} paddingX={1} flexDirection="column">
            {toolCallInfo && <Text color="#06B6D4">⚙ {toolCallInfo}</Text>}
            {retryInfo && <Text color="#F59E0B">↻ {retryInfo}</Text>}
            {error && <Text color="#EF4444">✗ {error}</Text>}
          </Box>
        )}
      </Box>
      <StatusBar config={config} streaming={streaming} lastMessage={messages[messages.length - 1]} />
      <InputBox
        onSubmit={handleSubmit}
        onSlash={handleSlash}
        onAbort={handleAbort}
        busy={streaming}
        providerId={config.activeProviderId}
        onTab={handleTab}
        history={historyState}
        onHistoryAppend={appendHistoryState}
      />
    </Box>
  );
}

function Header({ config, mcpCount, toolCount }: { config: AppConfig; mcpCount: number; toolCount: number }) {
  return (
    <Box flexDirection="row" justifyContent="space-between" paddingX={1} paddingBottom={0}>
      <Box gap={1}>
        <Text color="#06B6D4" bold>nexus-code</Text>
        <Text color="#475569">v{config.version}</Text>
      </Box>
      <Text color="#475569">
        {config.providers.length} providers · {config.manualModels.length} models · {toolCount} tools · {mcpCount} mcp
      </Text>
    </Box>
  );
}

void color;
