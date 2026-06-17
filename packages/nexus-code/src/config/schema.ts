// ============================================================
// Config schema + defaults — zod-validated
// ============================================================

import { z } from 'zod';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export const NEXUS_DIR = join(homedir(), '.nexus');
export const DEFAULT_CONFIG_PATH = join(NEXUS_DIR, 'config.json');
export const SESSIONS_DIR = join(NEXUS_DIR, 'sessions');

export const providerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['openai', 'anthropic', 'zai']),
  name: z.string().min(1),
  baseURL: z.string().url().optional(),
  apiKey: z.string().optional(),
  mmfe: z.boolean().default(true),
  defaultModel: z.string().optional(),
  options: z.record(z.unknown()).optional(),
});

export const modelDescriptorSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  label: z.string().optional(),
  source: z.enum(['auto', 'manual', 'builtin']),
  contextWindow: z.number().int().positive().optional(),
  capabilities: z.object({
    vision: z.boolean().optional(),
    tools: z.boolean().optional(),
    streaming: z.boolean().optional(),
    thinking: z.boolean().optional(),
  }).optional(),
  fetchedAt: z.number().int().nonnegative().optional(),
});

export const mcpServerSchema = z.object({
  id: z.string().min(1),
  transport: z.enum(['stdio', 'sse', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  env: z.record(z.string()).optional(),
});

export const appConfigSchema = z.object({
  version: z.string().default('1.1.0'),
  activeProviderId: z.string().default('zai'),
  activeModelId: z.string().default('glm-5.2'),
  mode: z.enum(['speed', 'balanced', 'quality', 'creative']).default('balanced'),
  useMMFE: z.boolean().default(true),
  providers: z.array(providerSchema).default([]),
  manualModels: z.array(modelDescriptorSchema).default([]),
  mcpServers: z.array(mcpServerSchema).default([]),
  ui: z.object({
    theme: z.enum(['tech-dark', 'editorial-light', 'hacker-terminal']).default('tech-dark'),
    showRouting: z.boolean().default(true),
    showTokens: z.boolean().default(true),
    showTimestamps: z.boolean().default(false),
  }).default({}),
});

export type AppConfigSchema = z.infer<typeof appConfigSchema>;

export function ensureDirs() {
  if (!existsSync(NEXUS_DIR)) mkdirSync(NEXUS_DIR, { recursive: true });
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
}

export const DEFAULT_PROVIDERS = [
  {
    id: 'zai',
    kind: 'zai' as const,
    name: 'Z.ai (MMFE native)',
    mmfe: true,
    defaultModel: 'glm-5.2',
  },
  {
    id: 'openai',
    kind: 'openai' as const,
    name: 'OpenAI-compatible',
    baseURL: 'https://api.openai.com/v1',
    mmfe: false,
    defaultModel: 'gpt-4o',
  },
  {
    id: 'anthropic',
    kind: 'anthropic' as const,
    name: 'Anthropic',
    baseURL: 'https://api.anthropic.com',
    mmfe: false,
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
];

export const BUILTIN_MODELS = [
  { id: 'glm-5.2-1m', providerId: 'zai', label: 'GLM 5.2 (1M context)', source: 'builtin' as const, contextWindow: 1_000_000, capabilities: { vision: true, tools: true, streaming: true, thinking: true } },
  { id: 'glm-5.2', providerId: 'zai', label: 'GLM 5.2 (flagship)', source: 'builtin' as const, contextWindow: 128_000, capabilities: { vision: true, tools: true, streaming: true, thinking: true } },
  { id: 'glm-5.1', providerId: 'zai', label: 'GLM 5.1', source: 'builtin' as const, contextWindow: 128_000, capabilities: { vision: false, tools: true, streaming: true, thinking: false } },
  { id: 'glm-5', providerId: 'zai', label: 'GLM 5 (fast)', source: 'builtin' as const, contextWindow: 128_000, capabilities: { vision: false, tools: true, streaming: true, thinking: false } },
  { id: 'glm-5v-turbo', providerId: 'zai', label: 'GLM 5v Turbo (vision)', source: 'builtin' as const, contextWindow: 64_000, capabilities: { vision: true, tools: true, streaming: true, thinking: false } },
  { id: 'glm-4.7', providerId: 'zai', label: 'GLM 4.7 (creative)', source: 'builtin' as const, contextWindow: 128_000, capabilities: { vision: false, tools: true, streaming: true, thinking: true } },
];
