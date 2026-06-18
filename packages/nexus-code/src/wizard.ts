// ============================================================
// Config wizard — interactive (or non-interactive) generator for
// ~/.nexus/config.json. Runs on first launch when no config exists,
// or explicitly via `nexus init` / `/init`.
// ============================================================

import { saveConfig } from './config/index.js';
import { DEFAULT_PROVIDERS, BUILTIN_MODELS } from './config/schema.js';
import type { AppConfig, ProviderConfig, ModelDescriptor, MMFEMode } from './types.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';

export interface WizardOptions {
  /** Skip prompts — accept all defaults. Used for `--yes` flag and non-TTY contexts. */
  nonInteractive?: boolean;
  /** Override the config path. */
  configPath?: string;
}

/**
 * Run the config wizard. Returns a human-readable summary string.
 * In non-interactive mode, generates a sensible default config without prompts.
 */
export async function runWizard(opts: WizardOptions = {}): Promise<string> {
  const configPath = opts.configPath || process.env.NEXUS_CONFIG || join(homedir(), '.nexus', 'config.json');

  // Already exists? Confirm overwrite (in interactive mode).
  if (existsSync(configPath) && !opts.nonInteractive) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const overwrite = await new Promise<boolean>(resolve => {
      rl.question(`Config already exists at ${configPath}. Overwrite? [y/N] `, answer => {
        rl.close();
        resolve(answer.trim().toLowerCase().startsWith('y'));
      });
    });
    if (!overwrite) {
      return 'Aborted — config not modified.';
    }
  } else if (existsSync(configPath) && opts.nonInteractive) {
    // Non-interactive + exists → refuse silently.
    return `Config already exists at ${configPath}. Use --force to overwrite.`;
  }

  // Build the config.
  const config = opts.nonInteractive ? buildDefaultConfig() : await promptForConfig();

  await saveConfig(config, configPath);

  return [
    `Config written to ${configPath}`,
    '',
    `Active provider: ${config.activeProviderId}`,
    `Active model:    ${config.activeModelId}`,
    `MMFE:            ${config.useMMFE ? 'on' : 'off'}`,
    `Mode:            ${config.mode}`,
    `Providers:       ${config.providers.length}`,
    `Manual models:   ${config.manualModels.length}`,
    '',
    'Set API keys via env vars (recommended):',
    '  export OPENAI_API_KEY=sk-...',
    '  export ANTHROPIC_API_KEY=sk-ant-...',
    '  export ZAI_API_KEY=...',
    '',
    'Or edit the config file directly. API keys are NEVER written to disk by nexus-code.',
  ].join('\n');
}

function buildDefaultConfig(): AppConfig {
  return {
    version: '1.1.5',
    activeProviderId: 'zai',
    activeModelId: 'glm-5.2',
    mode: 'balanced',
    useMMFE: true,
    providers: DEFAULT_PROVIDERS,
    manualModels: [],
    mcpServers: [],
    ui: {
      theme: 'tech-dark',
      showRouting: true,
      showTokens: true,
      showTimestamps: false,
    },
  };
}

async function promptForConfig(): Promise<AppConfig> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise(resolve => rl.question(q, a => resolve(a.trim())));

  try {
    console.log('\n=== nexus-code config wizard ===\n');
    const providerId = (await ask('Default provider [zai]: ')) || 'zai';
    const validProviders = ['zai', 'openai', 'anthropic'];
    const finalProviderId = validProviders.includes(providerId) ? providerId : 'zai';

    const defaultModel = finalProviderId === 'zai' ? 'glm-5.2' : finalProviderId === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022';
    const modelId = (await ask(`Default model [${defaultModel}]: `)) || defaultModel;

    const modeInput = (await ask('MMFE mode (speed|balanced|quality|creative) [balanced]: ')) || 'balanced';
    const validModes: MMFEMode[] = ['speed', 'balanced', 'quality', 'creative'];
    const mode = validModes.includes(modeInput as MMFEMode) ? (modeInput as MMFEMode) : 'balanced';

    const mmfeInput = (await ask('Enable MMFE orchestrator? [Y/n]: ')) || 'y';
    const useMMFE = !mmfeInput.toLowerCase().startsWith('n');

    const themeInput = (await ask('Theme (tech-dark|editorial-light|hacker-terminal) [tech-dark]: ')) || 'tech-dark';
    const validThemes: Array<'tech-dark' | 'editorial-light' | 'hacker-terminal'> = ['tech-dark', 'editorial-light', 'hacker-terminal'];
    const theme = validThemes.includes(themeInput as (typeof validThemes)[number])
      ? (themeInput as 'tech-dark' | 'editorial-light' | 'hacker-terminal')
      : 'tech-dark';

    // Always include all 3 default providers so switching is easy later.
    const providers: ProviderConfig[] = DEFAULT_PROVIDERS.map(p => {
      if (p.id === finalProviderId) {
        return { ...p, defaultModel: modelId };
      }
      return p;
    });

    const manualModels: ModelDescriptor[] = [];
    // Suggest builtin models for the active provider
    if (finalProviderId === 'zai') {
      for (const m of BUILTIN_MODELS) {
        manualModels.push({ ...m, source: 'builtin' });
      }
    }

    return {
      version: '1.1.5',
      activeProviderId: finalProviderId,
      activeModelId: modelId,
      mode,
      useMMFE,
      providers,
      manualModels: [],
      mcpServers: [],
      ui: {
        theme,
        showRouting: true,
        showTokens: true,
        showTimestamps: false,
      },
    };
  } finally {
    rl.close();
  }
}

/** Returns true if a config exists at the default path. */
export function configExists(): boolean {
  const p = join(homedir(), '.nexus', 'config.json');
  return existsSync(p);
}

/** Ensure ~/.nexus directory exists. */
export function ensureConfigDir(): void {
  const dir = join(homedir(), '.nexus');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
