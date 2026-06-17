// ============================================================
// nexus-code — core type definitions
// ============================================================

export type ProviderKind = 'openai' | 'anthropic' | 'zai';

export type MMFEMode = 'speed' | 'balanced' | 'quality' | 'creative';

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  name: string;
  baseURL?: string;
  apiKey?: string;
  /** When true, MMFE wraps calls to this provider. */
  mmfe?: boolean;
  /** Default model to use when none is specified. */
  defaultModel?: string;
  /** Extra provider-specific options. */
  options?: Record<string, unknown>;
}

export interface ModelDescriptor {
  id: string;
  /** Provider this model belongs to. */
  providerId: string;
  /** Human-friendly label. */
  label?: string;
  /** How this model entered the registry. */
  source: 'auto' | 'manual' | 'builtin';
  /** Max input context in tokens (if known). */
  contextWindow?: number;
  /** Capabilities the model advertises. */
  capabilities?: {
    vision?: boolean;
    tools?: boolean;
    streaming?: boolean;
    thinking?: boolean;
  };
  /** When auto-fetched, the timestamp. */
  fetchedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Model that produced this message (assistant only). */
  model?: string;
  /** Provider that handled this message. */
  provider?: string;
  /** Wall-clock time for the response. */
  elapsedMs?: number;
  /** MMFE routing decisions (assistant only, when MMFE was on). */
  routing?: RoutingDecision[];
  /** MMFE quality score (assistant only, when MMFE was on). */
  qualityScore?: number;
  /** Token counts if reported. */
  tokens?: { input: number; output: number };
  /** Tool calls emitted by this message. */
  toolCalls?: ToolCall[];
  /** Timestamp. */
  ts: number;
}

export interface RoutingDecision {
  subTaskId: string;
  subtaskLabel: string;
  selectedModel: string;
  confidence: number;
  reason: string;
  alternativeModels: string[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'ok' | 'error';
}

export interface ChatRequestOptions {
  mode?: MMFEMode;
  /** Override the active model for this single request. */
  model?: string;
  /** Bypass MMFE for this single request (direct provider call). */
  noMMFE?: boolean;
  /** Attach file context (paths already resolved). */
  fileContext?: Array<{ path: string; content: string }>;
  /** Stream tokens as they arrive. */
  stream?: boolean;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
  /** Called for each streamed delta. */
  onDelta?: (delta: string) => void;
  /** Called when routing decisions are emitted (MMFE only). */
  onRouting?: (decisions: RoutingDecision[]) => void;
  /** Called with live MMFE pipeline progress (stage + subtask counts). */
  onProgress?: (progress: {
    /** Human-readable stage label, e.g. "executing", "synthesizing". */
    stage: string;
    /** Subtasks completed so far this turn. */
    subtasksDone: number;
    /** Total subtasks routed this turn. */
    subtasksTotal: number;
    /** Models currently active in the fan-out. */
    modelsActive: string[];
  }) => void;
  /** Tools the model is allowed to call. Provider-agnostic schema. */
  tools?: ToolDefinitionInput[];
  /** Max tool-call round trips before giving up (default 5). */
  maxToolRounds?: number;
}

/** Simplified tool definition accepted by ChatRequestOptions. */
export interface ToolDefinitionInput {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Optional handler — if omitted, the orchestrator's registry is used. */
  handler?: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ChatResponse {
  message: ChatMessage;
  /** Raw provider response object (provider-specific). */
  raw?: unknown;
}

export interface Session {
  id: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  providerId: string;
  modelId: string;
  mode: MMFEMode;
  useMMFE: boolean;
}

export interface AppConfig {
  version: string;
  activeProviderId: string;
  activeModelId: string;
  mode: MMFEMode;
  useMMFE: boolean;
  providers: ProviderConfig[];
  /** Manually-added models (auto-fetched ones are merged at runtime). */
  manualModels: ModelDescriptor[];
  /** MCP servers. */
  mcpServers?: MCPServerConfig[];
  /** UI preferences. */
  ui?: {
    theme?: 'tech-dark' | 'editorial-light' | 'hacker-terminal';
    showRouting?: boolean;
    showTokens?: boolean;
    showTimestamps?: boolean;
  };
  /** Observer — a cheap model that narrates what the main agent is doing. */
  observer?: ObserverConfig;
}

export interface MCPServerConfig {
  id: string;
  transport: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface ObserverConfig {
  /** Enable the observer commentary during long tasks. */
  enabled: boolean;
  /** Cheap model used for observations (default: glm-4.5-flash). */
  modelId: string;
  /** How often to generate an observation, in ms (default: 8000). */
  intervalMs: number;
}

export interface SlashCommandContext {
  config: AppConfig;
  session: Session;
  setConfig: (patch: Partial<AppConfig>) => void;
  setSession: (patch: Partial<Session>) => void;
  pushMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  saveSession: (name?: string) => Promise<void>;
  loadSession: (name: string) => Promise<boolean>;
  /** List saved sessions (newest first), excluding the auto-restore slot. */
  listSessions?: () => Promise<Array<{ name: string; updatedAt: number; messageCount: number }>>;
  /** Start a fresh empty session and drop the auto-restore slot. */
  startNewSession?: () => void;
  fetchModels: (providerId?: string) => Promise<ModelDescriptor[]>;
  addModel: (providerId: string, modelId: string, label?: string) => void;
  quit: () => void;
  /** Returns active provider + registered models for status display. */
  getProviderInfo?: () => {
    providerId: string;
    providerName: string;
    providerKind: ProviderKind;
    mmfe: boolean;
    models: ModelDescriptor[];
  };
  /** Returns MCP server statuses if any are configured. */
  getMcpStatuses?: () => Array<{ id: string; connected: boolean; toolCount: number; lastError?: string }>;
}

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  examples?: string[];
  run: (args: string[], ctx: SlashCommandContext) => Promise<string | void>;
}
