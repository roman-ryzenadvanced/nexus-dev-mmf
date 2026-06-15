#!/usr/bin/env node
/**
 * Nexus-Dev MMFE — MTP Fusion Runner
 *
 * Runs the Multi-Threaded Pipeline (MTP) for hyperthreaded model orchestration.
 * Overlaps pipeline stages like CPU hyperthreading for dramatic speedups.
 *
 * Usage:
 *   node scripts/mtp-fusion.mjs "Your complex query here"
 *   node scripts/mtp-fusion.mjs --mode speed "Quick question"
 *   node scripts/mtp-fusion.mjs --no-spec "Disable speculation"
 */

import ZAI from 'z-ai-web-dev-sdk';

const args = process.argv.slice(2);
let mode = 'balanced';
let enableSpecDecomp = true;
let enableSpecExec = true;
let enableIncSynth = true;
let enableConcQuality = true;
let maxThreads = 8;
let maxSpec = 4;
let overlapDelay = 200;

// Parse flags
const queryParts = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--mode' && args[i + 1]) { mode = args[++i]; }
  else if (arg === '--no-spec') { enableSpecDecomp = false; enableSpecExec = false; }
  else if (arg === '--no-spec-decomp') { enableSpecDecomp = false; }
  else if (arg === '--no-spec-exec') { enableSpecExec = false; }
  else if (arg === '--no-inc-synth') { enableIncSynth = false; }
  else if (arg === '--no-conc-quality') { enableConcQuality = false; }
  else if (arg === '--threads' && args[i + 1]) { maxThreads = parseInt(args[++i]); }
  else if (arg === '--max-spec' && args[i + 1]) { maxSpec = parseInt(args[++i]); }
  else if (arg === '--overlap' && args[i + 1]) { overlapDelay = parseInt(args[++i]); }
  else if (arg === '--help' || arg === '-h') {
    console.log(`
MTP Fusion Runner — Multi-Threaded Pipeline for Nexus-Dev MMFE

Usage: node scripts/mtp-fusion.mjs [options] "query"

Options:
  --mode <mode>          Execution mode: speed|quality|balanced|creative (default: balanced)
  --no-spec              Disable all speculative execution
  --no-spec-decomp       Disable speculative decomposition
  --no-spec-exec         Disable speculative execution
  --no-inc-synth         Disable incremental synthesis
  --no-conc-quality      Disable concurrent quality scoring
  --threads <n>          Max concurrent threads (default: 8)
  --max-spec <n>         Max speculative threads (default: 4)
  --overlap <ms>         Overlap delay in ms (default: 200)
  --help, -h             Show this help

MTP hyperthreads pipeline stages — while one model generates,
the next stage is already being prepared. This overlaps:
  - Decomposition (flagship + speculative fast)
  - Routing + Execution (with speculative drafts)
  - Incremental + Final Synthesis
  - Quality Scoring (concurrent)
`);
    process.exit(0);
  }
  else { queryParts.push(arg); }
}

const query = queryParts.join(' ').trim();

if (!query) {
  console.error('Error: Please provide a query. Use --help for usage.');
  process.exit(1);
}

// ──────────────── MTP FUSION ENGINE ────────────────

async function runMTPFusion() {
  const zai = await ZAI.create();

  console.log('\n' + '═'.repeat(60));
  console.log('  🔥 Nexus-Dev MMFE — MTP Fusion Engine');
  console.log('  Multi-Threaded Pipeline (Hyperthreaded Mode)');
  console.log('═'.repeat(60));
  console.log(`\n  Query: "${query}"`);
  console.log(`  Mode: ${mode}`);
  console.log(`  Speculative Decomposition: ${enableSpecDecomp ? '✅' : '❌'}`);
  console.log(`  Speculative Execution: ${enableSpecExec ? '✅' : '❌'}`);
  console.log(`  Incremental Synthesis: ${enableIncSynth ? '✅' : '❌'}`);
  console.log(`  Concurrent Quality: ${enableConcQuality ? '✅' : '❌'}`);
  console.log(`  Max Threads: ${maxThreads}`);
  console.log('');

  const pipelineStart = Date.now();
  const threads = [];
  const metrics = {
    overlapTimeSavedMs: 0,
    speculativeHits: 0,
    speculativeMisses: 0,
    peakConcurrency: 0,
  };

  let currentActive = 0;
  function trackActive(delta) {
    currentActive += delta;
    if (currentActive > metrics.peakConcurrency) {
      metrics.peakConcurrency = currentActive;
    }
  }

  // ═══ PHASE 1: DUAL DECOMPOSITION ═══
  console.log('  ┌─ Phase 1: Dual Decomposition ─────────────────────');

  // Flagship decomposition
  const flagshipStart = Date.now();
  const flagshipPromise = callModel(zai, 'glm-5.2', [
    { role: 'system', content: DECOMPOSER_PROMPT },
    { role: 'user', content: `DECOMPOSE: ${query}\nMODE: ${mode}\nMAX PARALLEL: 6` },
  ], 0.3, true);
  trackActive(1);

  // Speculative fast decomposition
  let specDecompPromise = null;
  if (enableSpecDecomp) {
    specDecompPromise = callModel(zai, 'glm-5', [
      { role: 'system', content: FAST_DECOMP_PROMPT },
      { role: 'user', content: `Quick decompose: ${query}` },
    ], 0.5, false);
    trackActive(1);
    console.log('  │ 🔮 Speculative decomposition started (glm-5)');
  }

  // Wait for primary (with timeout fallback to spec)
  let decomposedRaw = null;
  let decompSource = 'flagship';

  try {
    decomposedRaw = await Promise.race([
      flagshipPromise,
      new Promise(resolve => setTimeout(() => resolve(null), 8000)),
    ]);
  } catch (e) { decomposedRaw = null; }
  trackActive(-1);

  if (!decomposedRaw && specDecompPromise) {
    console.log('  │ ⚡ Flagship slow — using speculative decomposition');
    try {
      decomposedRaw = await specDecompPromise;
      decompSource = 'speculative';
      metrics.speculativeHits++;
    } catch (e) {
      decomposedRaw = null;
    }
    trackActive(-1);
  } else if (specDecompPromise) {
    trackActive(-1); // spec was running but not needed
    metrics.speculativeMisses++;
  }

  const decompTime = Date.now() - flagshipStart;

  // Parse subtasks
  const subtasks = parseSubtasks(decomposedRaw);
  console.log(`  │ ✅ Decomposed into ${subtasks.length} subtasks (${decompTime}ms, via ${decompSource})`);
  console.log('  └─────────────────────────────────────────────────────');

  // ═══ PHASE 2: ROUTING + SPECULATIVE EXECUTION ═══
  console.log('  ┌─ Phase 2: Routing + Execution (Overlapped) ────────');

  // Quick routing (synchronous)
  const routes = routeSubtasks(subtasks, mode);
  for (const r of routes) {
    console.log(`  │ 🎯 ${r.description.slice(0, 40)} → ${r.model}`);
  }

  // Execute primary + speculative in parallel
  const primaryPromises = [];
  const specPromises = [];

  for (let i = 0; i < subtasks.length; i++) {
    const task = subtasks[i];
    const model = routes[i].model;

    // Stagger starts
    await sleep(300);

    // Primary execution
    const pStart = Date.now();
    primaryPromises.push(
      callModel(zai, model, [
        { role: 'system', content: `You are a specialized assistant for: "${task.description}". Produce a precise result.` },
        { role: 'user', content: task.input },
      ], 0.4, model === 'glm-5.2' || model === 'glm-5.2-1m' || model === 'glm-4.7').then(r => {
        trackActive(-1);
        return { id: i, model, result: r, time: Date.now() - pStart, type: 'primary' };
      })
    );
    trackActive(1);

    // Speculative execution on fast model
    if (enableSpecExec && i < maxSpec) {
      const specModel = 'glm-5v-turbo';
      const sStart = Date.now();
      specPromises.push(
        callModel(zai, specModel, [
          { role: 'system', content: 'Quick draft response. Be direct and factual.' },
          { role: 'user', content: task.input },
        ], 0.3, false).then(r => {
          trackActive(-1);
          return { id: i, model: specModel, result: r, time: Date.now() - sStart, type: 'speculative' };
        }).catch(() => {
          trackActive(-1);
          return { id: i, model: specModel, result: '', time: Date.now() - sStart, type: 'speculative-failed' };
        })
      );
      trackActive(1);
      console.log(`  │ 🔮 Speculative draft started for subtask ${i + 1}`);
    }
  }

  // Wait for all results
  const [primaryResults, specResults] = await Promise.all([
    Promise.allSettled(primaryPromises),
    Promise.allSettled(specPromises),
  ]);

  // Collect results
  const subtaskOutputs = [];
  let specUsed = 0;

  for (const settled of primaryResults) {
    if (settled.status === 'fulfilled') {
      const { id, model, result, time, type } = settled.value;
      subtaskOutputs[id] = { model, output: result, time, type };
      console.log(`  │ ✅ Subtask ${id + 1} completed (${model}, ${time}ms)`);
    }
  }

  // Fill gaps with speculative results
  for (const settled of specResults) {
    if (settled.status === 'fulfilled') {
      const { id, model, result, time, type } = settled.value;
      if (!subtaskOutputs[id] || !subtaskOutputs[id].output) {
        subtaskOutputs[id] = { model, output: result, time, type };
        specUsed++;
        metrics.speculativeHits++;
        console.log(`  │ 🔮 Subtask ${id + 1} using speculative result (${model}, ${time}ms)`);
      } else {
        metrics.speculativeMisses++;
      }
    }
  }

  console.log('  └─────────────────────────────────────────────────────');

  // ═══ PHASE 3: INCREMENTAL + FINAL SYNTHESIS ═══
  console.log('  ┌─ Phase 3: Incremental + Final Synthesis ───────────');

  let incrementalAnswer = '';
  if (enableIncSynth) {
    const incStart = Date.now();
    trackActive(1);
    try {
      incrementalAnswer = await callModel(zai, 'glm-5.1', [
        { role: 'system', content: INC_SYNTH_PROMPT },
        { role: 'user', content: buildSynthInput(query, subtaskOutputs, true) },
      ], 0.4, false);
      console.log(`  │ 📝 Incremental synthesis completed (${Date.now() - incStart}ms)`);
    } catch (e) {
      console.log('  │ ⚠️  Incremental synthesis failed, continuing');
    }
    trackActive(-1);
  }

  // Final synthesis
  const synthStart = Date.now();
  trackActive(1);
  const finalAnswer = await callModel(zai, 'glm-5.2', [
    { role: 'system', content: MTP_SYNTH_PROMPT },
    { role: 'user', content: buildSynthInput(query, subtaskOutputs, false, incrementalAnswer) },
  ], 0.5, true);
  trackActive(-1);
  console.log(`  │ ✅ Final synthesis completed (${Date.now() - synthStart}ms)`);
  console.log('  └─────────────────────────────────────────────────────');

  // ═══ PHASE 4: QUALITY SCORING ═══
  console.log('  ┌─ Phase 4: Quality Scoring ──────────────────────────');
  const qStart = Date.now();
  trackActive(1);
  let qualityScore = 50;
  try {
    const scoreRaw = await callModel(zai, 'glm-5', [
      { role: 'system', content: 'Score this response 0-100 on completeness, accuracy, coherence, depth, clarity. Return ONLY a number.' },
      { role: 'user', content: `QUERY: ${query}\n\nRESPONSE:\n${finalAnswer}\n\nScore:` },
    ], 0.1, false);
    qualityScore = parseInt(scoreRaw.replace(/[^0-9]/g, '')) || 50;
    qualityScore = Math.max(0, Math.min(100, qualityScore));
  } catch (e) {}
  trackActive(-1);
  console.log(`  │ 📊 Quality Score: ${qualityScore}/100 (${Date.now() - qStart}ms)`);

  // Refinement if needed
  let answer = finalAnswer;
  if (qualityScore < 70) {
    console.log('  │ 🔄 Refining with GLM 4.7...');
    trackActive(1);
    try {
      const refined = await callModel(zai, 'glm-4.7', [
        { role: 'system', content: `Improve this answer (scored ${qualityScore}/100). Add depth, fix gaps, enhance clarity.` },
        { role: 'user', content: `QUERY: ${query}\n\nANSWER:\n${finalAnswer}\n\nImproved version:` },
      ], 0.6, true);
      if (refined) {
        answer = refined;
        console.log('  │ ✅ Refinement completed');
      }
    } catch (e) {}
    trackActive(-1);
  }
  console.log('  └─────────────────────────────────────────────────────');

  // ═══ RESULTS ═══
  const totalTime = Date.now() - pipelineStart;
  const modelsUsed = [...new Set(subtaskOutputs.filter(Boolean).map(r => r.model))];

  console.log('\n' + '═'.repeat(60));
  console.log('  🎯 MTP Fusion Result');
  console.log('═'.repeat(60));
  console.log(`\n${answer}\n`);
  console.log('─'.repeat(60));
  console.log(`  ⏱  Total Time: ${totalTime}ms`);
  console.log(`  📊 Quality: ${qualityScore}/100`);
  console.log(`  🤖 Models: ${modelsUsed.join(', ')}`);
  console.log(`  🔮 Speculative hits: ${specUsed}`);
  console.log(`  📈 Peak concurrency: ${metrics.peakConcurrency}`);
  console.log(`  ⚡ MTP Speedup: ~${Math.max(1, Math.round(subtaskOutputs.reduce((s, r) => s + (r?.time || 0), 0) / totalTime * 10) / 10)}x vs sequential`);
  console.log('═'.repeat(60) + '\n');
}

// ──────────────── HELPERS ────────────────

async function callModel(zai, model, messages, temp, thinking) {
  const opts = { model, messages, temperature: temp };
  if (thinking) opts.thinking = { type: 'enabled' };

  const response = await zai.chat.completions.create(opts);
  return response.choices?.[0]?.message?.content ?? '';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseSubtasks(raw) {
  if (!raw) return [{ description: 'Complete task', input: query, requiredCapabilities: ['reasoning'] }];
  try {
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrMatch) return [{ description: 'Complete task', input: query, requiredCapabilities: ['reasoning'] }];
    const parsed = JSON.parse(arrMatch[0]);
    return Array.isArray(parsed) ? parsed : [{ description: 'Complete task', input: query }];
  } catch {
    return [{ description: 'Complete task', input: query, requiredCapabilities: ['reasoning'] }];
  }
}

function routeSubtasks(subtasks, mode) {
  const modelProfiles = {
    'glm-5.2-1m': { caps: ['reasoning','math','code','analysis','long-context','planning'], speed: 5, quality: 1, tier: 'flagship' },
    'glm-5.2': { caps: ['reasoning','math','code','analysis','planning','debugging'], speed: 3, quality: 1, tier: 'flagship' },
    'glm-5.1': { caps: ['conversation','translation','summarization','extraction','creative-writing'], speed: 3, quality: 2, tier: 'standard' },
    'glm-5': { caps: ['code','debugging','rapid-iteration','summarization','extraction'], speed: 1, quality: 3, tier: 'fast' },
    'glm-5v-turbo': { caps: ['rapid-iteration','code','debugging','vision'], speed: 1, quality: 3, tier: 'fast' },
    'glm-4.7': { caps: ['creative-writing','code','documentation','refactoring','analysis'], speed: 4, quality: 2, tier: 'creative' },
  };

  return subtasks.map(task => {
    const reqCaps = task.requiredCapabilities || ['reasoning'];
    let bestModel = 'glm-5.2';
    let bestScore = -Infinity;

    for (const [modelId, profile] of Object.entries(modelProfiles)) {
      let score = 0;
      const capMatch = reqCaps.filter(c => profile.caps.includes(c)).length;
      const capRatio = reqCaps.length > 0 ? capMatch / reqCaps.length : 0.5;
      if (capRatio >= 1) score += 40; else if (capRatio >= 0.5) score += 20; else score -= 10;

      switch (mode) {
        case 'speed': score += (6 - profile.speed) * 10; break;
        case 'quality': score += (6 - profile.quality) * 10; break;
        case 'balanced': score += (6 - profile.speed) * 5 + (6 - profile.quality) * 5; break;
        case 'creative': if (profile.tier === 'creative') score += 30; score += (6 - profile.quality) * 8; break;
      }

      if (score > bestScore) { bestScore = score; bestModel = modelId; }
    }

    return { description: task.description || task.input, model: bestModel };
  });
}

function buildSynthInput(query, outputs, incremental, existingAnswer) {
  let input = `ORIGINAL QUERY:\n${query}\n\n`;
  if (existingAnswer) {
    input += `EXISTING PARTIAL ANSWER:\n${existingAnswer}\n\n`;
  }
  input += `SUBTASK RESULTS:\n${'='.repeat(40)}\n\n`;
  for (const out of outputs.filter(Boolean)) {
    input += `[Model: ${out.model}${out.type === 'speculative' ? ' (speculative)' : ''}]\n`;
    input += `${out.output}\n\n${'-'.repeat(30)}\n\n`;
  }
  input += incremental ? 'Build a partial answer from these results.' : 'SYNTHESIZE into one comprehensive answer.';
  return input;
}

// ──────────────── PROMPTS ────────────────

const DECOMPOSER_PROMPT = `You are a task decomposition specialist. Break down the request into smallest logically independent subtasks. Return ONLY a JSON array: [{"description":"...","input":"...","requiredCapabilities":["reasoning","code",...],"priority":"critical|high|medium|low","dependencies":[],"estimatedComplexity":"trivial|simple|moderate|complex|expert"}]

CAPABILITIES: reasoning,math,code,creative-writing,analysis,summarization,translation,extraction,planning,debugging,refactoring,documentation,conversation,long-context,vision,rapid-iteration

Prefer MORE subtasks for parallelism. No markdown.`;

const FAST_DECOMP_PROMPT = `Quick decomposition. Break this into 2-4 subtasks. Return ONLY a JSON array: [{"description":"...","input":"...","requiredCapabilities":["reasoning"],"priority":"medium","dependencies":[],"estimatedComplexity":"moderate"}]. Fast and simple.`;

const INC_SYNTH_PROMPT = `You are an incremental synthesis engine. Build a coherent answer from partial results. Integrate new information, don't repeat. Return the updated answer.`;

const MTP_SYNTH_PROMPT = `You are a master synthesis engine with MTP results. Combine parallel and speculative outputs into one coherent answer. Prefer primary results over speculative. UNIFY, RESOLVE conflicts, ELEVATE quality. Return one polished answer.`;

// ──────────────── RUN ────────────────

runMTPFusion().catch(err => {
  console.error('MTP Fusion failed:', err.message);
  process.exit(1);
});
