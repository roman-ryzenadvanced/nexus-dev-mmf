#!/usr/bin/env node
/**
 * Nexus-Dev MMFE — CLI Entry Point (v3.2.0)
 * Run the orchestrator from the command line.
 * Supports: default query, code-review, design
 */

import { createOrchestrator } from './index.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           Nexus-Dev MMFE v3.2.0                            ║
║   Multi-Model Fusion Engine — CLI Interface                 ║
╠════════════════════════════════════════════════════════════╣
║                                                              ║
║  Commands:                                                   ║
║    nexus-dev "<query>"              General query            ║
║    nexus-dev design "<query>"       Design with SLOPE elim   ║
║    nexus-dev review "<diff>"        Code review              ║
║                                                              ║
║  Options:                                                    ║
║    --mode <speed|quality|balanced|creative>                   ║
║    --parallel <number>                                        ║
║    --thinking                                                 ║
║    --verbose                                                  ║
║                                                              ║
║  Design Options:                                             ║
║    --no-slope               Disable AI SLOPE detection       ║
║    --no-design-system       Skip design system generation    ║
║    --product <type>         Product type (SaaS, E-commerce)  ║
║    --brand <name>           Brand name                       ║
║    --industry <industry>    Industry (fintech, healthcare)   ║
║    --stack <stack>          Tech stack (nextjs, react)       ║
║                                                              ║
║  Example:                                                    ║
║    nexus-dev "Design a REST API for a blog"                   ║
║    nexus-dev design "Create a fintech landing page"           ║
║    nexus-dev design "SaaS dashboard" --brand Acme --creative  ║
╚════════════════════════════════════════════════════════════╝
`);
    process.exit(0);
  }

  // Detect sub-command
  let command = 'default';
  let remainingArgs = args;

  if (args[0] === 'design') {
    command = 'design';
    remainingArgs = args.slice(1);
  } else if (args[0] === 'review') {
    command = 'review';
    remainingArgs = args.slice(1);
  }

  // Route to appropriate handler
  switch (command) {
    case 'design':
      await runDesignCommand(remainingArgs);
      break;
    case 'review':
      console.log('Code review command — use: node scripts/code-review.mjs "<diff>"');
      break;
    default:
      await runDefaultCommand(remainingArgs);
      break;
  }
}

async function runDefaultCommand(args: string[]) {
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

async function runDesignCommand(args: string[]) {
  let query = '';
  let mode: 'speed' | 'quality' | 'balanced' | 'creative' = 'balanced';
  let enableSlope = true;
  let enableDesignSystem = true;
  let productType = '';
  let brandName = '';
  let industry = '';
  let techStack = '';
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--mode' && args[i + 1]) {
      mode = args[i + 1] as any;
      i++;
    } else if (arg === '--no-slope') {
      enableSlope = false;
    } else if (arg === '--no-design-system') {
      enableDesignSystem = false;
    } else if (arg === '--product' && args[i + 1]) {
      productType = args[i + 1];
      i++;
    } else if (arg === '--brand' && args[i + 1]) {
      brandName = args[i + 1];
      i++;
    } else if (arg === '--industry' && args[i + 1]) {
      industry = args[i + 1];
      i++;
    } else if (arg === '--stack' && args[i + 1]) {
      techStack = args[i + 1];
      i++;
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (!arg.startsWith('--')) {
      query += (query ? ' ' : '') + arg;
    }
  }

  if (!query) {
    console.error('Error: No design query provided. Usage: nexus-dev design "<query>"');
    process.exit(1);
  }

  console.log(`\n🎨 Nexus Design Fusion — AI SLOPE Elimination Engine\n`);
  console.log(`   Query: ${query}`);
  console.log(`   Mode: ${mode} | SLOPE Detection: ${enableSlope ? 'ON' : 'OFF'} | Design System: ${enableDesignSystem ? 'ON' : 'OFF'}`);
  if (productType) console.log(`   Product: ${productType}`);
  if (brandName) console.log(`   Brand: ${brandName}`);
  if (industry) console.log(`   Industry: ${industry}`);
  if (techStack) console.log(`   Stack: ${techStack}`);
  console.log('');

  // Use the DesignSkillEngine
  const { createDesignSkillEngine } = await import('./design-skill/design-engine.js');
  const engine = createDesignSkillEngine({
    enableSlopeDetection: enableSlope,
    enableDesignSystem,
    defaultMode: mode,
  });

  try {
    const result = await engine.process({
      id: `design-${Date.now()}`,
      query,
      productType: productType || undefined,
      brandName: brandName || undefined,
      industry: industry || undefined,
      techStack: techStack || undefined,
      enableSlopeDetection: enableSlope,
      enableDesignSystem,
      persistDesignSystem: false,
      mode,
      enableMTP: false,
      metadata: {},
    });

    console.log('\n' + '═'.repeat(60));
    console.log('🎨 DESIGN RESULT');
    console.log('═'.repeat(60) + '\n');
    console.log(result.designOutput);

    if (verbose && result.slopeReport) {
      console.log('\n' + '─'.repeat(60));
      console.log('🔍 AI SLOPE REPORT');
      console.log('─'.repeat(60));
      console.log(`   SLOPE Score: ${result.slopeReport.slopeScore}/100`);
      console.log(`   Originality: ${result.slopeReport.originalityScore}/100`);
      console.log(`   Brand Alignment: ${result.slopeReport.brandAlignmentScore}/100`);
      for (const issue of result.slopeReport.issues) {
        console.log(`   ⚠️  [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description}`);
      }
    }

    if (verbose && result.designSystem) {
      console.log('\n' + '─'.repeat(60));
      console.log('📐 DESIGN SYSTEM');
      console.log('─'.repeat(60));
      console.log(`   Pattern: ${result.designSystem.pattern}`);
      console.log(`   Style: ${result.designSystem.style}`);
      console.log(`   Primary: ${result.designSystem.colors.primary}`);
      console.log(`   Typography: ${result.designSystem.typography.headingFont} / ${result.designSystem.typography.bodyFont}`);
    }

    console.log(`\n🔧 Models: ${result.modelsUsed.join(', ')} | Time: ${result.totalExecutionTimeMs}ms\n`);
  } catch (error: any) {
    console.error('\n❌ Design generation failed:', error.message);
    process.exit(1);
  }
}

main();
