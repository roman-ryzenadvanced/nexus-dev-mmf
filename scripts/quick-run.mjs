#!/usr/bin/env node
/**
 * Nexus-Dev MMFE — Quick Runner (no thinking, fast response)
 * Optimized for speed when you want a quick fusion answer.
 */

import { createOrchestrator } from '../src/index.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node quick-run.mjs "<query>" [--mode <mode>]');
  process.exit(1);
}

let query = '';
let mode = 'balanced';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--mode' && args[i + 1]) {
    mode = args[i + 1];
    i++;
  } else if (!arg.startsWith('--')) {
    query += (query ? ' ' : '') + arg;
  }
}

async function run() {
  const orchestrator = createOrchestrator({
    defaultMode: mode,
    enableThinking: false,
    maxParallelSubTasks: 6,
    qualityThreshold: 50,
    enableRetry: true,
    maxRetries: 1,
  });

  const result = await orchestrator.process(query);

  // Output just the answer + minimal metadata
  process.stdout.write(result.answer);
  process.stderr.write(`\n[Models: ${result.modelsUsed.join(',')} | Score: ${result.qualityScore} | ${result.totalExecutionTimeMs}ms]\n`);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
