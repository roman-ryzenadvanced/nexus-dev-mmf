#!/usr/bin/env node
/**
 * Nexus-Dev MMFE — CLI Entry Point
 * Run the orchestrator from the command line.
 */

import { createOrchestrator } from './index.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔══════════════════════════════════════════════════╗
║           Nexus-Dev MMFE v1.0.0                  ║
║   Multi-Model Fusion Engine — CLI Interface      ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  Usage:                                          ║
║    nexus-dev "your query here"                   ║
║                                                  ║
║  Options:                                        ║
║    --mode <speed|quality|balanced|creative>       ║
║    --parallel <number>                            ║
║    --thinking                                     ║
║    --verbose                                      ║
║                                                  ║
║  Example:                                        ║
║    nexus-dev "Design a REST API for a blog"       ║
║    nexus-dev "Explain quantum computing" --mode quality  ║
╚══════════════════════════════════════════════════╝
`);
    process.exit(0);
  }

  // Parse args
  let query = '';
  let mode: 'speed' | 'quality' | 'balanced' | 'creative' = 'balanced';
  let maxParallel = 6;
  let enableThinking = true;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--mode' && args[i + 1]) {
      mode = args[i + 1] as any;
      i++;
    } else if (arg === '--parallel' && args[i + 1]) {
      maxParallel = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--thinking') {
      enableThinking = true;
    } else if (arg === '--no-thinking') {
      enableThinking = false;
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (!arg.startsWith('--')) {
      query += (query ? ' ' : '') + arg;
    }
  }

  if (!query) {
    console.error('Error: No query provided.');
    process.exit(1);
  }

  console.log(`\n🧠 Nexus-Dev MMFE — Processing...\n`);
  console.log(`   Query: ${query}`);
  console.log(`   Mode: ${mode}`);
  console.log(`   Parallel: ${maxParallel}`);
  console.log(`   Thinking: ${enableThinking}\n`);

  const orchestrator = createOrchestrator({
    defaultMode: mode,
    maxParallelSubTasks: maxParallel,
    enableThinking,
  });

  try {
    const result = await orchestrator.process(query);

    console.log('\n' + '═'.repeat(60));
    console.log('📋 RESULT');
    console.log('═'.repeat(60) + '\n');
    console.log(result.answer);

    if (verbose) {
      console.log('\n' + '─'.repeat(60));
      console.log('📊 ORCHESTRATION METRICS');
      console.log('─'.repeat(60));
      console.log(`   Models Used: ${result.modelsUsed.join(', ')}`);
      console.log(`   Subtasks: ${result.subTaskResults.length} (${result.subTaskResults.filter(r => r.success).length} succeeded)`);
      console.log(`   Total Time: ${result.totalExecutionTimeMs}ms`);
      console.log(`   Quality Score: ${result.qualityScore}/100`);
      console.log(`   Decomposition: ${result.decompositionStrategy}`);
      console.log(`   Synthesis: ${result.synthesisStrategy}`);

      console.log('\n   Routing Decisions:');
      for (const rd of result.routingDecisions) {
        console.log(`     → ${rd.subTaskId}: ${rd.selectedModel} (confidence: ${rd.confidence})`);
      }
    }

    console.log('\n');
  } catch (error: any) {
    console.error('\n❌ Orchestration failed:', error.message);
    process.exit(1);
  }
}

main();
