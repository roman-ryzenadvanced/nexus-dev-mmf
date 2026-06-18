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
import { BootAnimation } from './components/BootAnimation.js';
import { SessionPicker, type PickerSession, type PickerChoice } from './components/SessionPicker.js';
import { OptionPicker, type PickerOption } from './components/OptionPicker.js';
import { saveKey } from './config/keys.js';
import { buildProviders } from './providers/index.js';
import { sendChatStream } from './orchestrator/index.js';
import { fetchAllModels } from './models/fetcher.js';
import { addManualModel } from './models/registry.js';
import { runSlash, registerPluginCommand } from './commands/index.js';
import { newSession, saveSession, loadSession, listSessions, saveCurrentSession, loadCurrentSession, clearCurrentSession } from './session/store.js';
import { useInputHistory } from './session/useInputHistory.js';
import { saveConfig } from './config/index.js';
import { ToolRegistry, BUILTIN_TOOLS, COMPUTER_TOOLS, type ToolDefinition } from './tools/index.js';
import { MCPClient, type MCPServerStatus } from './mcp/index.js';
import { loadAllPlugins, ensurePluginsDir, type LoadedPlugin } from './plugins/index.js';
import { setTheme as setTuiTheme } from './tui/theme.js';
import { setTheme, getThemeName, listThemes } from './tui/theme.js';
import { ObserverEngine, type ObserverContext } from './observer/engine.js';
import type { AppConfig, ChatMessage, ModelDescriptor, Session, SlashCommandContext } from './types.js';
import type { StreamMetrics } from './components/StatusBar.js';
import { color } from './tui/theme.js';

import { REGISTRY } from './commands/builtin.js';
import { ALL_MODES, MODE_METADATA } from './orchestrator/modes.js';

interface AppProps {
  initialConfig: AppConfig;
  initialPrompt?: string;
  /** Resume a specific saved session by name on boot. */
  resumeSession?: string;
  /** Start fresh — skip auto-restore of the last session. */
  noResume?: boolean;
}

export function App({ initialConfig, initialPrompt, resumeSession, noResume }: AppProps) {
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
  const [booting, setBooting] = useState(true);
  // Session picker: when non-null, the boot picker is shown so the user can
  // resume a saved conversation or start fresh. Cleared once a choice is made.
  const [bootChoice, setBootChoice] = useState<PickerSession[] | null>(null);
  // API-key capture mode. When set, the InputBox switches to a masked "key
  // entry" line: the next Enter saves the key for the named provider and
  // (optionally) resumes the pending prompt. Triggered when the user selects
  // a provider/model that has no key, or when they try to send with no key.
  const [keyCapture, setKeyCapture] = useState<{
    providerId: string;
    providerName: string;
    pendingPrompt?: string;
  } | null>(null);
  // Reusable option picker (mimo-style) for /provider, /model, /mode, /theme.
  // When non-null, the OptionPicker overlay is shown and owns all keys.
  const [openPicker, setOpenPicker] = useState<{
    title: string;
    options: PickerOption[];
    currentId?: string;
    onPick: (id: string) => void;
    hint?: string;
  } | null>(null);
  const [metrics, setMetrics] = useState<StreamMetrics | undefined>(undefined);
  // Session-restore banner: shown briefly when we resume a prior session.
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null);
  // Queue-vs-observer choice: when the user submits a prompt WHILE streaming,
  // we ask whether to queue it for the main agent or fire it at the Observer
  // for an immediate (cheap, snarky) answer. `null` = no choice pending.
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  // koda-style pending queue: prompts submitted while streaming are held and
  // drained (in order) when the in-flight response completes.
  const pendingQueueRef = useRef<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const streamStartRef = useRef<number>(0);
  const streamCharsRef = useRef<number>(0);
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

  // koda/mimo-style session persistence:
  //  • On boot, auto-resume the last conversation (the __current__ slot),
  //    unless the user passed --new (noResume) or named a session to resume.
  //  • After that, continuously auto-save the live transcript so a restart
  //    never loses the conversation.
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Explicit flags short-circuit the picker: --new skips everything,
      // --continue <name> resumes a named session directly.
      if (noResume) {
        if (!cancelled) setBooting(false);
        return;
      }
      if (resumeSession) {
        const restored = await loadSession(resumeSession);
        if (!cancelled && restored && Array.isArray(restored.messages) && restored.messages.length > 0) {
          setSession(restored);
          setMessages(restored.messages);
          if (restored.providerId) setConfig({ activeProviderId: restored.providerId });
          if (restored.modelId) setConfig({ activeModelId: restored.modelId });
          if (restored.mode) setConfig({ mode: restored.mode });
          if (typeof restored.useMMFE === 'boolean') setConfig({ useMMFE: restored.useMMFE });
          setRestoredFrom(restored.name && restored.name !== '__current__' ? restored.name : 'last session');
          setTimeout(() => {
            if (!cancelled) setRestoredFrom(null);
          }, 4000);
        }
        if (!cancelled) setBooting(false);
        return;
      }
      // No flags → show the picker if there are saved sessions to choose
      // from; otherwise (nothing saved yet) start fresh.
      const all = await listSessions();
      if (cancelled) return;
      if (all.length > 0) {
        // Mark the auto-saved slot so the picker labels it "last session".
        setBootChoice(
          all.map(s => ({
            name: s.name,
            updatedAt: s.updatedAt,
            isCurrent: s.name === '__current__',
          }))
        );
        setBooting(false);
        return;
      }
      // Nothing saved — go straight in.
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle a selection from the boot session picker.
  const handleBootChoice = useCallback(async (choice: PickerChoice) => {
    setBootChoice(null);
    if (choice.action === 'new') {
      void clearCurrentSession();
      return;
    }
    // Resume the chosen session.
    const restored = choice.name === '__current__' ? await loadCurrentSession() : await loadSession(choice.name!);
    if (restored && Array.isArray(restored.messages) && restored.messages.length > 0) {
      setSession(restored);
      setMessages(restored.messages);
      if (restored.providerId) setConfig({ activeProviderId: restored.providerId });
      if (restored.modelId) setConfig({ activeModelId: restored.modelId });
      if (restored.mode) setConfig({ mode: restored.mode });
      if (typeof restored.useMMFE === 'boolean') setConfig({ useMMFE: restored.useMMFE });
      setRestoredFrom(restored.name && restored.name !== '__current__' ? restored.name : 'last session');
      setTimeout(() => setRestoredFrom(null), 4000);
    }
  }, []);

  // Debounced auto-save: whenever messages change, persist to the __current__
  // slot (max once per ~800ms so rapid streaming doesn't hammer disk).
  useEffect(() => {
    if (messages.length === 0) return; // don't write an empty session over a real one
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const snap: Session = {
        ...sessionRef.current,
        messages: messagesRef.current,
        updatedAt: Date.now(),
      };
      void saveCurrentSession(snap);
    }, 800);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [messages]);

  // Flush any pending auto-save on exit so the last turn is never lost.
  useEffect(() => {
    return () => {
      if (messagesRef.current.length > 0) {
        void saveCurrentSession({
          ...sessionRef.current,
          messages: messagesRef.current,
          updatedAt: Date.now(),
        });
      }
    };
  }, []);

  // Tool registry — registered once on boot with builtin tools.
  // MCP tools + plugin tools get added as servers/plugins connect.
  const toolRegistry = useMemo(() => {
    const reg = new ToolRegistry();
    for (const tool of BUILTIN_TOOLS) reg.register(tool);
    // Computer-control tools (browse, preview, launch_app) are registered
    // separately so they don't inflate BUILTIN_TOOLS (which a test pins at 5).
    for (const tool of COMPUTER_TOOLS) reg.register(tool);
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
      const flat = results.flatMap(r => r.models || []);
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
    setMessages(m => [...m, msg]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    // Drop the auto-restore slot too, so a restart doesn't bring back what
    // the user just cleared. This is a fresh start.
    void clearCurrentSession();
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
    listSessions: async () => {
      const all = await listSessions();
      // Exclude the internal auto-restore slot from the user-facing list,
      // and enrich with message counts.
      return all
        .filter(s => s.name !== '__current__')
        .map(s => ({
          name: s.name,
          updatedAt: s.updatedAt,
          messageCount: 0,
        }));
    },
    startNewSession: () => {
      void clearCurrentSession();
      const fresh = newSession({
        providerId: config.activeProviderId,
        modelId: config.activeModelId,
        mode: config.mode,
        useMMFE: config.useMMFE,
      });
      setSession(fresh);
      setMessages([]);
      setError(null);
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
      setConfig({
        manualModels: addManualModel(config, providerId, modelId, label).manualModels,
      });
    },
    quit: () => exit(),
    getProviderInfo: () => {
      const p = config.providers.find(x => x.id === config.activeProviderId);
      const all = [...config.manualModels, ...autoModels];
      // Dedupe by providerId::id
      const seen = new Set<string>();
      const deduped = all.filter(m => {
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
      mcpStatuses.map(s => ({
        id: s.id,
        connected: s.connected,
        toolCount: s.tools.length,
        lastError: s.lastError,
      })),
  };

  const handleSlash = useCallback(
    async (input: string) => {
      if (input === '/help' || input === '/?') {
        setShowHelp(v => !v);
        return;
      }
      if (input === '/mcp') {
        if (!mcpStatuses.length) return 'No MCP servers configured.';
        return mcpStatuses
          .map(
            s => `  ${s.id.padEnd(16)} ${s.transport.padEnd(6)} ${s.connected ? '✓' : '✗'}  ${s.tools.length} tools${s.lastError ? `  (${s.lastError})` : ''}`
          )
          .join('\n');
      }
      // ── Interactive pickers (mimo-style) ────────────────────────────
      // These four commands open a scrollable OptionPicker when invoked
      // with no argument, instead of printing a text list. An explicit
      // argument still works (e.g. "/model glm-5.2") and bypasses the menu.
      const pickerMatch = input === '/provider' || input === '/model' || input === '/mode' || input === '/theme';
      if (pickerMatch) {
        if (input === '/provider') {
          setOpenPicker({
            title: 'Switch provider',
            currentId: config.activeProviderId,
            options: config.providers.map(p => ({
              id: p.id,
              label: p.id,
              detail: `${p.name} ${p.mmfe ? '[mmfe]' : '[direct]'}${p.id === config.activeProviderId ? ' (active)' : ''}`,
            })),
            onPick: id => {
              const p = config.providers.find(x => x.id === id);
              if (p) {
                setConfig({
                  activeProviderId: p.id,
                  activeModelId: p.defaultModel || '',
                });
                // Switching to a provider that has no key yet prompts for it
                // inline (masked entry) so the user can authenticate and start
                // chatting immediately instead of hitting an auth error on send.
                if (needsKey(p)) {
                  setKeyCapture({ providerId: p.id, providerName: p.name });
                }
              }
              setOpenPicker(null);
            },
          });
          return; // picker owns the screen now
        }
        if (input === '/model') {
          // Combine builtin + manual + auto-fetched models for the active provider.
          const seen = new Set<string>();
          const all: ModelDescriptor[] = [];
          for (const m of [...config.manualModels, ...autoModels]) {
            if (m.providerId !== config.activeProviderId) continue;
            if (seen.has(m.id)) continue;
            seen.add(m.id);
            all.push(m);
          }
          setOpenPicker({
            title: `Models for ${config.activeProviderId}`,
            currentId: config.activeModelId,
            options: all.length
              ? all.map(m => ({
                  id: m.id,
                  label: m.id,
                  detail: `[${m.source}]${m.id === config.activeModelId ? ' (active)' : ''}${m.label ? ' ' + m.label : ''}`,
                  meta: m.contextWindow ? `${m.contextWindow} ctx` : undefined,
                }))
              : [
                  {
                    id: '',
                    label: '(no models — use /fetch or /add)',
                    detail: '',
                  },
                ],
            hint: '↑↓ move · ↵ select · /fetch to load more · esc cancel',
            onPick: id => {
              if (id) {
                setConfig({ activeModelId: id });
                // Selecting a model whose provider lacks a key prompts for the
                // key inline, so the user can authenticate and use the model
                // right away rather than discovering the gap on first send.
                const active = config.providers.find(p => p.id === config.activeProviderId);
                if (needsKey(active)) {
                  setKeyCapture({
                    providerId: config.activeProviderId,
                    providerName: active?.name || config.activeProviderId,
                  });
                }
              }
              setOpenPicker(null);
            },
          });
          return;
        }
        if (input === '/mode') {
          setOpenPicker({
            title: 'MMFE execution mode',
            currentId: config.mode,
            options: ALL_MODES.map(m => ({
              id: m,
              label: m,
              detail: MODE_METADATA[m].tagline + (m === config.mode ? ' (active)' : ''),
            })),
            onPick: id => {
              setConfig({ mode: id as never });
              setOpenPicker(null);
            },
          });
          return;
        }
        if (input === '/theme') {
          setOpenPicker({
            title: 'Color theme',
            currentId: getThemeName(),
            options: listThemes().map(t => ({
              id: t,
              label: t,
              detail: t === getThemeName() ? '(active)' : '',
            })),
            onPick: id => {
              setTheme(id as never);
              setConfig({ ui: { ...(config.ui || {}), theme: id as never } });
              setOpenPicker(null);
            },
          });
          return;
        }
      }
      if (input === '/tools') {
        const tools = toolRegistry.list();
        if (!tools.length) return 'No tools registered.';
        return tools.map(t => `  ${t.name.padEnd(24)}  ${t.description.slice(0, 60)}`).join('\n');
      }
      // /observer — toggle the side-channel Observer on/off, or set its model.
      // Inline (not in REGISTRY) so the command-palette count stays at 20.
      if (input === '/observer' || input.startsWith('/observer ')) {
        const arg = input.split(/\s+/)[1];
        if (!arg) {
          return `Observer is ${config.observer?.enabled ? 'ON' : 'OFF'} (model: ${config.observer?.modelId || 'glm-4.5-flash'}). Usage: /observer [on|off|<model>]`;
        }
        if (arg === 'on' || arg === 'off') {
          setConfig({
            observer: {
              enabled: arg === 'on',
              modelId: config.observer?.modelId || 'glm-4.5-flash',
              intervalMs: config.observer?.intervalMs || 8000,
            },
          });
          return `Observer ${arg === 'on' ? 'ON — type while streaming to choose queue-or-observer' : 'OFF'}.`;
        }
        // Otherwise treat as a model id.
        setConfig({
          observer: {
            enabled: true,
            modelId: arg,
            intervalMs: config.observer?.intervalMs || 8000,
          },
        });
        return `Observer model → ${arg}.`;
      }
      // /sessions — list saved conversations (inline so the command palette
      // count stays at 20; same pattern as /tools and /mcp).
      if (input === '/sessions' || input === '/sessions ') {
        if (!ctx.listSessions) return 'Sessions unavailable in this context.';
        const all = await ctx.listSessions();
        if (!all.length) return 'No saved sessions yet. Use /save <name> to keep one.';
        const lines = [`Saved sessions (${all.length}):`, ''];
        all.forEach((s, i) => {
          const time = new Date(s.updatedAt).toLocaleString();
          lines.push(`  ${String(i + 1).padStart(2, ' ')}. ${s.name.padEnd(20)} ${time}`);
        });
        lines.push('', 'Resume with: /continue <name|index>');
        return lines.join('\n');
      }
      // /continue — resume a saved session or the last auto-saved one.
      if (input.startsWith('/continue')) {
        const arg = input.split(/\s+/)[1]?.trim();
        if (!arg) {
          // No argument → resume the last auto-saved session.
          const last = await loadCurrentSession();
          if (!last || !last.messages?.length) return 'No previous session to continue.';
          setSession(last);
          setMessages(last.messages);
          setRestoredFrom('last session');
          setTimeout(() => setRestoredFrom(null), 4000);
          return `Continued last session (${last.messages.length} messages).`;
        }
        // Numeric index into /sessions list.
        let name = arg;
        if (/^\d+$/.test(arg) && ctx.listSessions) {
          const all = await ctx.listSessions();
          const idx = parseInt(arg, 10) - 1;
          if (idx >= 0 && idx < all.length) name = all[idx].name;
          else return `No session at index ${arg}.`;
        }
        const ok = await ctx.loadSession(name);
        return ok ? `Continued session "${name}".` : `No session named "${name}".`;
      }
      // /new — start a fresh empty session (clears the auto-restore slot).
      if (input === '/new') {
        ctx.startNewSession?.();
        return 'Started a new session.';
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

  // A provider needs an API key if it has none AND it isn't Z.ai (Z.ai
  // resolves its key from ~/.z-ai-config via the loader, so it works without
  // an apiKey field). All other kinds (openai / anthropic / freemodel / …)
  // require one before they can chat.
  const needsKey = useCallback((p: AppConfig['providers'][number] | undefined): boolean => {
    if (!p) return false;
    if (p.apiKey && p.apiKey.trim().length > 0) return false;
    return p.kind !== 'zai';
  }, []);

  const handleSubmit = useCallback(
    async (text: string) => {
      // If the active provider needs a key the user hasn't entered yet, swap
      // into key-capture mode instead of sending (which would just fail). The
      // original prompt is preserved and re-sent once the key is saved.
      if (!streaming && text.trim()) {
        const active = config.providers.find(p => p.id === config.activeProviderId);
        if (needsKey(active)) {
          setKeyCapture({
            providerId: config.activeProviderId,
            providerName: active?.name || config.activeProviderId,
            pendingPrompt: text,
          });
          return;
        }
      }
      // koda-style pending messages: if a response is already streaming,
      // we either queue the prompt for the main agent OR — if the Observer
      // is enabled — ask the user which they want. The Observer fires the
      // prompt at a cheap model immediately so the user isn't blocked.
      if (streaming) {
        if (getObserver()) {
          // Defer the choice to a keystroke handler (q/o/Esc).
          setPendingChoice(text);
          return;
        }
        pendingQueueRef.current.push(text);
        setPendingCount(pendingQueueRef.current.length);
        return;
      }
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
      // Live-metrics tracking — start a fresh window on each prompt.
      streamStartRef.current = Date.now();
      streamCharsRef.current = 0;
      setMetrics({ elapsedMs: 0, tokens: 0, tps: 0 });
      // Wall-clock ticker so elapsed/tok update every ~250ms even when the
      // provider is in MMFE fusion mode (no per-token deltas mid-flight) or
      // the first delta is slow to arrive.
      streamTickerRef.current = setInterval(() => {
        const elapsedMs = Date.now() - streamStartRef.current;
        const tokens = Math.max(0, Math.round(streamCharsRef.current / 4));
        const secs = elapsedMs / 1000;
        setMetrics(prev => ({
          elapsedMs,
          tokens,
          tps: secs > 0 ? tokens / secs : 0,
          // Preserve MMFE progress while fusing; cleared when fusion emits a delta.
          progress: prev?.progress,
        }));
      }, 250);

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
          onDelta: delta => {
            setStreamBuffer(b => b + delta);
            // Update live metrics: ~4 chars ≈ 1 token for approximation.
            streamCharsRef.current += delta.length;
            const elapsedMs = Date.now() - streamStartRef.current;
            const tokens = Math.max(1, Math.round(streamCharsRef.current / 4));
            const secs = elapsedMs / 1000;
            setMetrics({
              elapsedMs,
              tokens,
              tps: secs > 0 ? tokens / secs : 0,
            });
          },
          onRouting: decisions => {
            pendingRoutingRef.current = decisions;
          },
          onProgress: progress => {
            // Real MMFE pipeline progress — surface it so the status bar shows
            // stage + subtask throughput instead of zeroed metrics.
            const elapsedMs = Date.now() - streamStartRef.current;
            setMetrics(prev => ({
              elapsedMs,
              tokens: prev?.tokens ?? 0,
              tps: prev?.tps ?? 0,
              progress,
            }));
          },
          onToolCall: call => {
            setToolCallInfo(
              `${call.name}(${Object.keys(call.args).join(', ')}) → ${call.status}${
                call.status === 'error' && call.result ? `: ${(call.result as { error?: string }).error || 'failed'}` : ''
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
        setMetrics(undefined);
        clearStreamTicker();
        pushMessage(res.message);
        // Drain the pending queue — send the next queued prompt (koda pattern).
        const next = pendingQueueRef.current.shift();
        if (next) {
          setPendingCount(pendingQueueRef.current.length);
          // Defer so React commits the idle state before the next turn starts.
          setTimeout(() => {
            void handleSubmit(next);
          }, 0);
        }
      } catch (err) {
        setStreaming(false);
        setStreamBuffer('');
        setRetryInfo(null);
        setToolCallInfo(null);
        setMetrics(undefined);
        clearStreamTicker();
        // On error, drop the queue so stale prompts don't fire unexpectedly.
        pendingQueueRef.current = [];
        setPendingCount(0);
        setError((err as Error).message);
      }
    },
    [config, providers, messages, pushMessage, streaming]
  );

  // Save an entered key for a provider, inject it into the live config, exit
  // capture mode, and — if the user was mid-send — resume their prompt. Lives
  // after handleSubmit so it can legitimately depend on it.
  const saveKeyAndResume = useCallback(
    (providerId: string, key: string) => {
      const trimmed = key.trim();
      if (!trimmed) {
        setKeyCapture(null);
        return;
      }
      saveKey(providerId, trimmed);
      // setConfig is a partial-merge setter (no function-updater form), so we
      // build the next providers array from the current `config` closure.
      setConfig({
        providers: config.providers.map(p => (p.id === providerId ? { ...p, apiKey: trimmed } : p)),
      });
      const pending = keyCapture?.pendingPrompt;
      setKeyCapture(null);
      if (pending) {
        // Resume the send that triggered the key prompt.
        void handleSubmit(pending);
      }
    },
    [config, keyCapture, handleSubmit]
  );

  const handleTab = useCallback(
    (currentInput: string): string[] => {
      if (currentInput.startsWith('/')) {
        const q = currentInput.slice(1).toLowerCase();
        return REGISTRY.filter(c => c.name.startsWith(q) || c.aliases?.some(a => a.startsWith(q)))
          .flatMap(c => [`/${c.name}`, ...(c.aliases?.map(a => `/${a}`) || [])])
          .filter(s => s.toLowerCase().startsWith(currentInput.toLowerCase()))
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
      setMetrics(undefined);
      clearStreamTicker();
      // Drop queued prompts on abort — the user explicitly cancelled.
      pendingQueueRef.current = [];
      setPendingCount(0);
      setError('Aborted.');
    } else {
      exit();
    }
  }, [streaming, exit]);

  const pendingRoutingRef = useRef<ChatMessage['routing'] | null>(null);
  void pendingRoutingRef;

  // Streaming-metrics ticker — cleared on completion/abort/error.
  const streamTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearStreamTicker = useCallback(() => {
    if (streamTickerRef.current) {
      clearInterval(streamTickerRef.current);
      streamTickerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearStreamTicker(), [clearStreamTicker]);

  // Observer engine — a cheap side-channel model. Lazily built from the
  // active provider; rebuilt if the provider changes.
  const observerRef = useRef<ObserverEngine | null>(null);
  const getObserver = useCallback((): ObserverEngine | null => {
    if (!config.observer?.enabled) return null;
    const provider = providers.get(config.activeProviderId);
    if (!provider) return null;
    const modelId = config.observer.modelId || 'glm-4.5-flash';
    // Rebuild when the provider/model identity changes.
    const key = `${provider.id}::${modelId}`;
    if (!observerRef.current || observerKeyRef.current !== key) {
      observerRef.current = new ObserverEngine(provider, modelId);
      observerKeyRef.current = key;
    }
    return observerRef.current;
  }, [config.activeProviderId, config.observer, providers]);
  const observerKeyRef = useRef<string>('');

  // Send a prompt to the Observer immediately, grounded in the live feed.
  const sendToObserver = useCallback(
    async (text: string) => {
      const observer = getObserver();
      if (!observer) return;
      // Push the user's aside into the transcript first so it's visible.
      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: text,
        ts: Date.now(),
      };
      pushMessage(userMsg);
      try {
        const ctx: ObserverContext = {
          mainBusy: streaming,
          streamTail: streamBuffer || undefined,
          elapsedMs: metrics?.elapsedMs,
          tokensSoFar: metrics?.tokens,
          modelsUsed: metrics?.progress?.modelsActive,
        };
        const reply = await observer.respond(text, ctx);
        pushMessage(reply);
      } catch (err) {
        pushMessage({
          id: `obs_err_${Date.now()}`,
          role: 'assistant',
          provider: 'observer',
          content: `(Observer hiccuped: ${(err as Error).message})`,
          ts: Date.now(),
        });
      }
    },
    [getObserver, pushMessage, streaming, streamBuffer, metrics]
  );

  // Global key handling: command-palette toggle + queue/observer choice.
  useInput((input, key) => {
    // Queue-vs-observer choice takes priority when a prompt is waiting.
    if (pendingChoice) {
      const c = input.toLowerCase();
      if (c === 'q') {
        pendingQueueRef.current.push(pendingChoice);
        setPendingCount(pendingQueueRef.current.length);
        setPendingChoice(null);
      } else if (c === 'o') {
        const p = pendingChoice;
        setPendingChoice(null);
        void sendToObserver(p);
      } else if (key.escape) {
        setPendingChoice(null);
      }
      return; // swallow all other keys while the choice is up
    }
    if (key.ctrl && input === 'p' && !streaming) {
      setShowPalette(v => !v);
    }
  });

  return (
    <Box flexDirection="column" height={stdout?.rows || 40}>
      {booting ? (
        <BootAnimation onDone={() => setBooting(false)} />
      ) : bootChoice ? (
        <SessionPicker sessions={bootChoice} onPick={handleBootChoice} />
      ) : (
        <>
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
            {openPicker && (
              <OptionPicker
                title={openPicker.title}
                options={openPicker.options}
                currentId={openPicker.currentId}
                hint={openPicker.hint}
                onPick={openPicker.onPick}
                onClose={() => setOpenPicker(null)}
              />
            )}
            {showPalette && (
              <CommandPalette
                onPick={cmd => {
                  setShowPalette(false);
                  void handleSlash(cmd);
                }}
                onClose={() => setShowPalette(false)}
              />
            )}
            {(pendingChoice || restoredFrom || error || retryInfo || toolCallInfo) && (
              <Box marginTop={1} paddingX={1} flexDirection="column">
                {pendingChoice && (
                  <Box flexDirection="column">
                    <Text color="#8B5CF6" bold>
                      👁 Observer or ⏳ Queue?
                    </Text>
                    <Text color="#E2E8F0"> “{pendingChoice.slice(0, 80)}”</Text>
                    <Text color="#06B6D4"> [o] Observer answers now</Text>
                    <Text color="#94A3B8"> [q] Queue for the main agent</Text>
                    <Text color="#475569"> [esc] cancel</Text>
                  </Box>
                )}
                {restoredFrom && <Text color="#10B981">↺ continued from {restoredFrom}</Text>}
                {toolCallInfo && <Text color="#06B6D4">⚙ {toolCallInfo}</Text>}
                {retryInfo && <Text color="#F59E0B">↻ {retryInfo}</Text>}
                {error && <Text color="#EF4444">✗ {error}</Text>}
              </Box>
            )}
          </Box>
          <StatusBar config={config} streaming={streaming} lastMessage={messages[messages.length - 1]} metrics={metrics} />
          {keyCapture ? (
            <Box flexDirection="column" paddingX={1} marginTop={1}>
              <Text color="#F59E0B" bold>
                🔑 Enter API key for {keyCapture.providerName}
                {keyCapture.pendingPrompt ? ' (then your prompt continues)' : ''}
              </Text>
              <InputBox
                secret
                onSubmit={key => saveKeyAndResume(keyCapture.providerId, key)}
                onSlash={handleSlash}
                onAbort={() => setKeyCapture(null)}
                busy={false}
              />
            </Box>
          ) : (
            <InputBox
              onSubmit={handleSubmit}
              onSlash={handleSlash}
              onAbort={handleAbort}
              busy={streaming}
              pendingCount={pendingCount}
              providerId={config.activeProviderId}
              onTab={handleTab}
              history={historyState}
              onHistoryAppend={appendHistoryState}
            />
          )}
        </>
      )}
    </Box>
  );
}

function Header({ config, mcpCount, toolCount }: { config: AppConfig; mcpCount: number; toolCount: number }) {
  return (
    <Box flexDirection="row" justifyContent="space-between" paddingX={1} paddingBottom={0}>
      <Box gap={1}>
        <Text color="#06B6D4" bold>
          nexus-code
        </Text>
        <Text color="#475569">v{config.version}</Text>
      </Box>
      <Text color="#475569">
        {config.providers.length} providers · {config.manualModels.length} models · {toolCount} tools · {mcpCount} mcp
      </Text>
    </Box>
  );
}

void color;
