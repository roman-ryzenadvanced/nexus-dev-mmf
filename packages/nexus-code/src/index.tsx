// ============================================================
// Entry point — boots the Ink app
// ============================================================

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { loadConfig } from './config/index.js';

export interface RunOptions {
  initialPrompt?: string;
  provider?: string;
  model?: string;
  mode?: 'speed' | 'balanced' | 'quality' | 'creative';
  useMMFE?: boolean;
  configPath?: string;
}

export async function runTUI(opts: RunOptions = {}): Promise<void> {
  const config = await loadConfig(opts.configPath);

  // Apply CLI overrides.
  if (opts.provider) config.activeProviderId = opts.provider;
  if (opts.model) config.activeModelId = opts.model;
  if (opts.mode) config.mode = opts.mode;
  if (typeof opts.useMMFE === 'boolean') config.useMMFE = opts.useMMFE;

  const { waitUntilExit } = render(<App initialConfig={config} initialPrompt={opts.initialPrompt} />);
  await waitUntilExit();
}

// Allow direct invocation: `node dist/index.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  runTUI().catch((err) => {
    console.error('nexus-code failed to boot:');
    console.error(err.stack || err.message || err);
    process.exit(1);
  });
}
