#!/usr/bin/env node
/**
 * Nexus-Dev MMFE — Direct Fusion Runner
 * Sends the query to multiple models in parallel and synthesizes inline.
 * Uses a streamlined 2-phase approach (parallel call + merge) instead of the
 * full 4-phase pipeline, making it fast enough for interactive use.
 */

import ZAI from 'z-ai-web-dev-sdk';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    'Usage: node direct-fusion.mjs "<query>" [--mode <speed|quality|balanced|creative>]\n       Start your message with /nexus to auto-trigger this.'
  );
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

// Model selection based on mode
const MODEL_SETS = {
  speed: ['glm-5', 'glm-5v-turbo', 'glm-5.1'],
  quality: ['glm-5.2', 'glm-5.2-1m', 'glm-4.7'],
  balanced: ['glm-5.2', 'glm-5.1', 'glm-4.7'],
  creative: ['glm-4.7', 'glm-5.1', 'glm-5.2'],
};

const models = MODEL_SETS[mode] || MODEL_SETS.balanced;

const SYSTEM_PROMPTS = {
  'glm-5.2-1m': 'You are an advanced reasoning specialist. Provide deep, thorough analysis with step-by-step logical reasoning. Be comprehensive and precise.',
  'glm-5.2': 'You are a high-performance task executor. Provide robust, accurate, and well-structured answers. Focus on correctness and completeness.',
  'glm-5.1': 'You are a language and context specialist. Focus on nuance, clarity, and precise communication. Ensure smooth, well-articulated responses.',
  'glm-5': 'You are a rapid-response specialist. Provide concise, efficient, and direct answers. Prioritize speed without sacrificing accuracy.',
  'glm-5v-turbo': 'You are a quick-iteration specialist. Provide fast, focused, and practical responses. Cut to the essentials.',
  'glm-4.7': 'You are a creative synthesis specialist. Provide elegant, well-crafted, and insightful responses. Focus on originality and depth of thought.',
};

const SYNTHESIS_PROMPT = `You are a master synthesis engine. Combine the following outputs from multiple specialized AI models into a single, coherent, comprehensive answer.

PRINCIPLES:
1. UNIFY — the answer must read as one coherent perspective, not a patchwork.
2. RESOLVE — if results disagree, use judgment to determine the most accurate view.
3. ELEVATE — improve clarity, structure, and precision beyond individual contributions.
4. PRESERVE — keep important details; don't sacrifice depth for brevity.
5. FLOW — ensure smooth logical transitions between sections.

Produce a single, polished answer.`;

async function run() {
  const zai = await ZAI.create();
  const startTime = Date.now();

  // Phase 1: Query all selected models in parallel (with staggered start to avoid rate limits)
  const modelPromises = models.map(async (modelId, index) => {
    // Stagger requests by 300ms each to reduce rate-limit collisions
    if (index > 0) await new Promise(r => setTimeout(r, index * 300));
    const t0 = Date.now();
    try {
      const response = await zai.chat.completions.create({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPTS[modelId] || 'You are a helpful assistant.',
          },
          { role: 'user', content: query },
        ],
        temperature: mode === 'creative' ? 0.7 : 0.4,
      });
      const output = response.choices?.[0]?.message?.content ?? '';
      return { model: modelId, output, time: Date.now() - t0, success: true };
    } catch (err) {
      // Retry once after a delay on rate limit
      if (String(err.message).includes('429') || String(err.message).includes('rate')) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const retryResp = await zai.chat.completions.create({
            model: modelId,
            messages: [
              {
                role: 'system',
                content: SYSTEM_PROMPTS[modelId] || 'You are a helpful assistant.',
              },
              { role: 'user', content: query },
            ],
            temperature: mode === 'creative' ? 0.7 : 0.4,
          });
          const output = retryResp.choices?.[0]?.message?.content ?? '';
          return {
            model: modelId,
            output,
            time: Date.now() - t0,
            success: true,
            retried: true,
          };
        } catch {
          return {
            model: modelId,
            output: '',
            time: Date.now() - t0,
            success: false,
            error: err.message,
          };
        }
      }
      return {
        model: modelId,
        output: '',
        time: Date.now() - t0,
        success: false,
        error: err.message,
      };
    }
  });

  const results = await Promise.all(modelPromises);
  const successful = results.filter(r => r.success && r.output.trim());

  if (successful.length === 0) {
    console.error('All model calls failed.');
    process.exit(1);
  }

  // Phase 2: Synthesize (only if we have multiple results)
  if (successful.length === 1) {
    // Only one model responded — use its output directly
    console.log(successful[0].output);
  } else {
    // Merge multiple model outputs
    const synthesisInput =
      `ORIGINAL QUERY:\n${query}\n\nMODEL OUTPUTS:\n${'='.repeat(50)}\n\n` +
      successful.map(r => `[${r.model} — ${r.time}ms]\n${r.output}\n${'─'.repeat(40)}\n`).join('\n') +
      `\nSYNTHESIZE the above into one comprehensive answer.`;

    const synthResponse = await zai.chat.completions.create({
      model: 'glm-5.2',
      messages: [
        { role: 'system', content: SYNTHESIS_PROMPT },
        { role: 'user', content: synthesisInput },
      ],
      temperature: 0.5,
    });

    const answer = synthResponse.choices?.[0]?.message?.content ?? successful[0].output;
    console.log(answer);
  }

  const totalTime = Date.now() - startTime;
  const modelInfo = successful.map(r => `${r.model}(${r.time}ms)`).join(', ');
  const failedInfo = results
    .filter(r => !r.success)
    .map(r => `${r.model}(FAILED)`)
    .join(', ');
  process.stderr.write(`\n🔧 Fusion: ${modelInfo}${failedInfo ? ' | ' + failedInfo : ''} | Total: ${totalTime}ms | Mode: ${mode}\n`);
}

run().catch(err => {
  console.error('Fusion error:', err.message);
  process.exit(1);
});
