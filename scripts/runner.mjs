#!/usr/bin/env node
/**
 * Nexus-Dev MMFE — Inline Runner
 * Lightweight entry point for processing queries through the fusion pipeline.
 * Designed for programmatic invocation by the AI agent.
 */

import { createOrchestrator } from '../src/index.js';

// Parse args
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node runner.mjs "<query>" [--mode <speed|quality|balanced|creative>] [--no-thinking] [--json]');
  process.exit(1);
}

let query = '';
let mode = 'balanced';
let thinking = true;
let jsonOutput = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--mode' && args[i + 1]) {
    mode = args[i + 1];
    i++;
  } else if (arg === '--no-thinking') {
    thinking = false;
  } else if (arg === '--json') {
    jsonOutput = true;
  } else if (!arg.startsWith('--')) {
    query += (query ? ' ' : '') + arg;
  }
}

async function run() {
  const orchestrator = createOrchestrator({
    defaultMode: mode,
    enableThinking: thinking,
  });

  const result = await orchestrator.process(query);

  if (jsonOutput) {
    // Full structured output for programmatic consumption
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Human-readable output
    console.log(result.answer);
    console.log('\n---');
    console.log(
      `🔧 Models: ${result.modelsUsed.join(', ')} | Score: ${result.qualityScore}/100 | Time: ${result.totalExecutionTimeMs}ms | Strategy: ${result.decompositionStrategy} → ${result.synthesisStrategy}`
    );
  }
}

run().catch(err => {
  console.error('Nexus-Dev error:', err.message);
  process.exit(1);
});
