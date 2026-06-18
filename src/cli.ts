#!/usr/bin/env node
/**
 * Nexus-Dev MMFE — CLI Entry Point (v3.2.0)
 * Run the orchestrator from the command line.
 * Supports: default query, code-review, design
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';

import type { NexusDevConfig } from './core/config.js';
import { createOrchestrator } from './index.js';
import type { ProviderId } from './providers/types.js';

/**
 * Minimal .env loader (no dependency on dotenv).
 * Populates process.env from a .env file in the cwd (if present) without
 * overriding values already set in the real environment. Lets users keep their
 * API keys in .env and run \`node dist/cli.js\` directly.
 */
function loadDotEnv(): void {
  try {
    const content = readFileSync('.env', 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // strip surrounding quotes if any
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // never override an existing env var (env wins over .env)
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // no .env present — that's fine, rely on real env vars
  }
}
loadDotEnv();

/**
 * Resolve the provider to use for this run.
 *
 * Priority:
 *   1. --provider <id> CLI flag (highest)
 *   2. NEXUS_DEFAULT_PROVIDER env var
 *   3. the config default (zai)
 *
 * The router's initialize() will additionally cascade-fallback to another
 * provider if this one fails to initialize (e.g. missing API key), so this is
 * a hint, not a hard requirement.
 */
const VALID_PROVIDERS: ProviderId[] = ['zai', 'zai-anthropic', 'openai', 'freemodel', 'anthropic', 'google'];

function resolveDefaultProvider(args: string[]): { provider?: ProviderId; rest: string[] } {
  const rest: string[] = [];
  let provider: ProviderId | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--provider' && args[i + 1]) {
      const value = args[i + 1] as ProviderId;
      if (VALID_PROVIDERS.includes(value)) {
        provider = value;
      } else {
        console.warn(`[nexus-dev] Unknown provider '${value}', ignoring. Valid: ${VALID_PROVIDERS.join(', ')}`);
      }
      i++;
    } else {
      rest.push(arg);
    }
  }
  provider ??= process.env.NEXUS_DEFAULT_PROVIDER as ProviderId | undefined;
  if (provider && !VALID_PROVIDERS.includes(provider)) {
    console.warn(`[nexus-dev] NEXUS_DEFAULT_PROVIDER='${provider}' is unknown, ignoring.`);
    provider = undefined;
  }
  return { provider, rest };
}

/**
 * Build the orchestrator config patch that overrides the default provider.
 * mergeConfig() deep-merges this with the defaults, so we only need to supply
 * the fields we want to override.
 */
function buildProviderConfigPatch(provider?: ProviderId): Partial<NexusDevConfig> {
  if (!provider) return {};
  return {
    providers: {
      defaultProvider: provider,
      // ensure the chosen provider is in the providers map so initialize() picks it up
      providers: { [provider]: { provider } },
    } as Partial<NexusDevConfig>['providers'],
  };
}

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
  const { provider, rest } = resolveDefaultProvider(args);
  args = rest;

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
  console.log(`   Thinking: ${enableThinking}`);
  console.log(`   Provider: ${provider ?? '(default, with cascade fallback)'}\n`);

  const orchestrator = createOrchestrator({
    defaultMode: mode,
    maxParallelSubTasks: maxParallel,
    enableThinking,
    ...buildProviderConfigPatch(provider),
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
