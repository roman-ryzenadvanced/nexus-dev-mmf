#!/usr/bin/env node
/**
 * Example: Basic usage of Nexus-Dev MMFE
 */

import { createOrchestrator } from '../src/index.js';

async function main() {
  console.log('🧠 Nexus-Dev MMFE — Basic Example\n');

  const orchestrator = createOrchestrator({
    defaultMode: 'balanced',
    enableThinking: true,
  });

  console.log('Processing query: "Explain the CAP theorem in distributed systems"\n');

  const result = await orchestrator.process('Explain the CAP theorem in distributed systems and give a real-world example of each tradeoff');

  console.log('═'.repeat(60));
  console.log('RESULT\n');
  console.log(result.answer);
  console.log('\n' + '─'.repeat(60));
  console.log(`Models used: ${result.modelsUsed.join(', ')}`);
  console.log(`Quality score: ${result.qualityScore}/100`);
  console.log(`Execution time: ${result.totalExecutionTimeMs}ms`);
  console.log(`Subtasks: ${result.subTaskResults.length}`);
  console.log(`Strategy: ${result.decompositionStrategy} → ${result.synthesisStrategy}`);
}

main().catch(console.error);
