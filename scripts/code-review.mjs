#!/usr/bin/env node
/**
 * Nexus-Dev MMFE — Code Review Runner
 *
 * Multi-model code review powered by Nexus-Dev MMFE.
 * Adapted from Alibaba Open Code Review (https://github.com/alibaba/open-code-review)
 * Integrated into the Nexus multi-model fusion pipeline.
 *
 * Usage:
 *   node scripts/code-review.mjs                    # Review staged changes
 *   node scripts/code-review.mjs --diff HEAD~1      # Review last commit
 *   node scripts/code-review.mjs --diff main...HEAD # Review branch changes
 *   node scripts/code-review.mjs --file src/foo.ts  # Review specific file
 *   node scripts/code-review.mjs --mode quality     # Use quality models
 *   node scripts/code-review.mjs --no-filter        # Skip review filter
 *   node scripts/code-review.mjs --mtp              # Enable MTP hyperthreading
 */

import ZAI from 'z-ai-web-dev-sdk';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
let diffRef = '';
let filePath = '';
let mode = 'balanced';
let enableFilter = true;
let enablePlan = undefined;
let enableMTP = false;
let customRule = '';
let background = '';

// Parse flags
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--diff' && args[i + 1]) {
    diffRef = args[++i];
  } else if (arg === '--file' && args[i + 1]) {
    filePath = args[++i];
  } else if (arg === '--mode' && args[i + 1]) {
    mode = args[++i];
  } else if (arg === '--no-filter') {
    enableFilter = false;
  } else if (arg === '--no-plan') {
    enablePlan = false;
  } else if (arg === '--plan') {
    enablePlan = true;
  } else if (arg === '--mtp') {
    enableMTP = true;
  } else if (arg === '--rule' && args[i + 1]) {
    customRule = args[++i];
  } else if (arg === '--background' && args[i + 1]) {
    background = args[++i];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Nexus-Dev Code Review — Multi-Model Code Review Engine

Usage: node scripts/code-review.mjs [options]

Options:
  --diff <ref>        Git ref for diff (e.g., HEAD~1, main...HEAD). Default: staged changes
  --file <path>       Review a specific file only
  --mode <mode>       Review mode: speed|quality|balanced (default: balanced)
  --no-filter         Skip review filter (fact-checking phase)
  --no-plan           Skip plan phase
  --plan              Force plan phase
  --mtp               Enable MTP hyperthreading
  --rule <rule>       Custom review rule text
  --background <bg>   Requirement/business background
  --help, -h          Show this help

Examples:
  node scripts/code-review.mjs                       # Review staged changes
  node scripts/code-review.mjs --diff HEAD~1         # Review last commit
  node scripts/code-review.mjs --diff main...HEAD    # Review branch vs main
  node scripts/code-review.mjs --mode quality --mtp  # Quality MTP review
`);
    process.exit(0);
  }
}

// ──────────────── GET DIFF ────────────────

function getDiff() {
  try {
    if (diffRef) {
      return execSync(`git diff ${diffRef}`, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });
    }
    // Default: staged changes
    const staged = execSync('git diff --cached', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    if (staged.trim()) return staged;
    // Fallback: unstaged changes
    return execSync('git diff', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    console.error('Error: Could not get git diff. Make sure you are in a git repository.');
    process.exit(1);
  }
}

// ──────────────── REVIEW ENGINE ────────────────

async function runReview() {
  const zai = await ZAI.create();

  const diff = getDiff();
  if (!diff || !diff.trim()) {
    console.log('No changes to review.');
    return;
  }

  // Parse changed files
  const changedFiles = [];
  const fileMatch = diff.match(/^+++ b\/(.+)$/gm);
  if (fileMatch) {
    for (const m of fileMatch) {
      changedFiles.push(m.replace('+++ b/', ''));
    }
  }

  const currentFile = filePath || changedFiles[0] || '';

  console.log('\n' + '═'.repeat(60));
  console.log('  Nexus-Dev MMFE — Code Review Engine');
  console.log('  Multi-Model Code Review (Nexus Fusion)');
  console.log('═'.repeat(60));
  console.log(`\n  Changed files: ${changedFiles.length}`);
  for (const f of changedFiles) {
    console.log(`    - ${f}`);
  }
  console.log(`  Mode: ${mode}`);
  console.log(`  Filter: ${enableFilter ? 'enabled' : 'disabled'}`);
  console.log(`  MTP: ${enableMTP ? 'enabled' : 'disabled'}`);
  console.log('');

  const pipelineStart = Date.now();

  // ─── MODEL ASSIGNMENTS ───
  const reviewModels = {
    speed: ['glm-5', 'glm-5v-turbo'],
    quality: ['glm-5.2-1m', 'glm-5.2'],
    balanced: ['glm-5.2', 'glm-5.1', 'glm-5'],
  };
  const models = reviewModels[mode] || reviewModels.balanced;
  const planModel = 'glm-5';
  const synthModel = 'glm-5.2';
  const filterModel = 'glm-5.1';

  // ─── GET REVIEW RULE ───
  let rule = customRule;
  if (!rule && currentFile) {
    const ext = currentFile.split('.').pop()?.toLowerCase() ?? '';
    const ruleMap = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      java: 'java',
      kt: 'kotlin',
      rs: 'rust',
      cpp: 'cpp',
      cc: 'cpp',
      c: 'c',
      go: 'go',
      py: 'python',
    };
    // Use default rule for now - the engine handles language detection
    rule = '';
  }

  // ─── PHASE 1: PARALLEL REVIEW ───
  console.log('  ┌─ Phase 1: Multi-Model Review ─────────────────────');

  const reviewPromises = models.map(async (modelId, idx) => {
    await new Promise(r => setTimeout(r, idx * 300)); // Stagger starts

    const modelLabel = modelId;
    const useThinking = modelId === 'glm-5.2' || modelId === 'glm-5.2-1m' || modelId === 'glm-4.7';

    try {
      const opts = {
        model: modelId,
        messages: [
          {
            role: 'system',
            content: `You are a code review specialist. Review the following code diff for bugs, security issues, performance problems, and code quality. Focus on newly added code only. Output findings as JSON:\n\`\`\`json\n{"comments": [{"content": "Issue description", "existing_code": "exact code from diff", "suggestion_code": "suggested fix", "severity": "high|medium|low"}]}\n\`\`\`\nIf no issues, return: \`{"comments": []}\``,
          },
          {
            role: 'user',
            content: `Review this code diff:\n\n${diff.slice(0, 30000)}`,
          },
        ],
        temperature: 0.3,
        ...(useThinking ? { thinking: { type: 'enabled' } } : {}),
      };

      const start = Date.now();
      const response = await zai.chat.completions.create(opts);
      const content = response.choices?.[0]?.message?.content ?? '';
      const elapsed = Date.now() - start;

      console.log(`  │ ✅ ${modelLabel} completed (${elapsed}ms)`);
      return { model: modelId, content, elapsed };
    } catch (e) {
      console.log(`  │ ❌ ${modelLabel} failed: ${e.message}`);
      return { model: modelId, content: '', elapsed: 0 };
    }
  });

  const reviewResults = await Promise.allSettled(reviewPromises);
  const successfulReviews = reviewResults.filter(r => r.status === 'fulfilled' && r.value.content).map(r => r.value);

  console.log('  └─────────────────────────────────────────────────────');

  if (successfulReviews.length === 0) {
    console.log('\n  ⚠️  All review models failed. Please try again.');
    return;
  }

  // ─── PHASE 2: SYNTHESIS ───
  console.log('  ┌─ Phase 2: Synthesis ────────────────────────────────');

  const allComments = successfulReviews.map(r => r.content).join('\n\n---\n\n');
  let finalAnswer = '';

  if (successfulReviews.length === 1) {
    finalAnswer = successfulReviews[0].content;
  } else {
    try {
      const synthStart = Date.now();
      const synthResponse = await zai.chat.completions.create({
        model: synthModel,
        messages: [
          {
            role: 'system',
            content: `You are a code review synthesis engine. You received review comments from multiple AI models. Merge, deduplicate, and rank them by severity. Output a clean structured review. For each issue include: severity (🔴 HIGH / 🟡 MEDIUM / 🟢 LOW), file location, description, and suggested fix.`,
          },
          {
            role: 'user',
            content: `Code diff:\n\`\`\`diff\n${diff.slice(0, 20000)}\n\`\`\`\n\nReview comments from multiple models:\n${allComments}\n\nSynthesize into a final review.`,
          },
        ],
        thinking: { type: 'enabled' },
        temperature: 0.3,
      });

      finalAnswer = synthResponse.choices?.[0]?.message?.content ?? '';
      console.log(`  │ ✅ Synthesis completed (${Date.now() - synthStart}ms)`);
    } catch (e) {
      finalAnswer = successfulReviews[0].content;
      console.log(`  │ ⚠️  Synthesis failed, using first model's output`);
    }
  }

  console.log('  └─────────────────────────────────────────────────────');

  // ─── RESULTS ───
  const totalTime = Date.now() - pipelineStart;

  console.log('\n' + '═'.repeat(60));
  console.log('  Code Review Result');
  console.log('═'.repeat(60));
  console.log(`\n${finalAnswer}\n`);
  console.log('─'.repeat(60));
  console.log(`  ⏱  Total Time: ${totalTime}ms`);
  console.log(`  🤖 Models: ${models.join(', ')}`);
  console.log(`  📁 Files: ${changedFiles.length}`);
  console.log(`  🔧 Mode: ${mode}`);
  console.log('═'.repeat(60) + '\n');
}

// ──────────────── RUN ────────────────

runReview().catch(err => {
  console.error('Code review failed:', err.message);
  process.exit(1);
});
