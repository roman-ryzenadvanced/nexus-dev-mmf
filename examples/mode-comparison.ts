#!/usr/bin/env node
/**
 * Example: Mode comparison — run the same query in all 4 modes
 */

import { createOrchestrator } from '../src/index.js';

async function main() {
  const query = 'Design a URL shortener service';
  const modes = ['speed', 'quality', 'balanced', 'creative'] as const;

  console.log('🧠 Nexus-Dev MMFE — Mode Comparison\n');
  console.log(`Query: "${query}"\n`);

  for (const mode of modes) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Mode: ${mode.toUpperCase()}`);
    console.log('═'.repeat(60));

    const orchestrator = createOrchestrator({
      defaultMode: mode,
      enableThinking: false, // Faster for demo
    });

    const result = await orchestrator.process(query);
    console.log(result.answer);
    console.log(`\nModels: ${result.modelsUsed.join(', ')} | Score: ${result.qualityScore}/100 | Time: ${result.totalExecutionTimeMs}ms`);
  }
}

main().catch(console.error);
