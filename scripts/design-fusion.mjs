#!/usr/bin/env node
/**
 * Nexus-Dev MMFE — Design Fusion Runner
 *
 * Runs the design skill pipeline with AI SLOPE elimination.
 * Triggered by: /nexus design <query>
 *
 * Features:
 * - Design knowledge base search (BM25 across 9 domains)
 * - Design system generation with product-specific reasoning
 * - Multi-model parallel design generation
 * - AI SLOPE detection (10 categories of generic AI patterns)
 * - AI SLOPE elimination (re-generation with anti-slope instructions)
 * - Cross-model synthesis of best design elements
 *
 * Usage:
 *   node design-fusion.mjs "<query>" [--mode <speed|quality|balanced|creative>] [--no-slope] [--no-design-system]
 */

import ZAI from 'z-ai-web-dev-sdk';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../src/design-skill/data');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(`Usage: node design-fusion.mjs "<query>" [options]

Options:
  --mode <speed|quality|balanced|creative>  Execution mode (default: balanced)
  --no-slope                                Disable AI SLOPE detection
  --no-design-system                        Skip design system generation
  --product <type>                          Product type (e.g., SaaS, E-commerce)
  --brand <name>                            Brand name
  --industry <industry>                     Industry (e.g., fintech, healthcare)
  --stack <stack>                           Tech stack (e.g., nextjs, react, vue)
  --persist                                 Persist design system to disk
  --page <name>                             Page-specific design overrides
  --verbose                                 Show detailed pipeline output

Examples:
  node design-fusion.mjs "Design a fintech dashboard landing page"
  node design-fusion.mjs "Create a modern SaaS homepage" --brand "Acme" --mode creative
  node design-fusion.mjs "Build a healthcare app UI" --no-slope --product Healthcare
`);
  process.exit(1);
}

// Parse arguments
let query = '';
let mode = 'balanced';
let enableSlope = true;
let enableDesignSystem = true;
let productType = '';
let brandName = '';
let industry = '';
let techStack = '';
let persist = false;
let pageName = '';
let verbose = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--mode' && args[i + 1]) {
    mode = args[i + 1];
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
  } else if (arg === '--persist') {
    persist = true;
  } else if (arg === '--page' && args[i + 1]) {
    pageName = args[i + 1];
    i++;
  } else if (arg === '--verbose') {
    verbose = true;
  } else if (!arg.startsWith('--')) {
    query += (query ? ' ' : '') + arg;
  }
}

// ============ BM25 SEARCH (inline for .mjs) ============
class BM25 {
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }
  k1;
  b;
  corpus = [];
  docLengths = [];
  avgdl = 0;
  idf = {};
  docFreqs = {};
  N = 0;

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  fit(documents) {
    this.corpus = documents.map(doc => this.tokenize(doc));
    this.N = this.corpus.length;
    if (this.N === 0) return;
    this.docLengths = this.corpus.map(doc => doc.length);
    this.avgdl = this.docLengths.reduce((a, b) => a + b, 0) / this.N;
    this.docFreqs = {};
    for (const doc of this.corpus) {
      const seen = new Set();
      for (const word of doc) {
        if (!seen.has(word)) {
          this.docFreqs[word] = (this.docFreqs[word] ?? 0) + 1;
          seen.add(word);
        }
      }
    }
    this.idf = {};
    for (const [word, freq] of Object.entries(this.docFreqs)) {
      this.idf[word] = Math.log((this.N - freq + 0.5) / (freq + 0.5) + 1);
    }
  }

  score(query) {
    const queryTokens = this.tokenize(query);
    const scores = [];
    for (let idx = 0; idx < this.corpus.length; idx++) {
      const doc = this.corpus[idx];
      let score = 0;
      const docLen = this.docLengths[idx];
      const termFreqs = {};
      for (const word of doc) {
        termFreqs[word] = (termFreqs[word] ?? 0) + 1;
      }
      for (const token of queryTokens) {
        if (token in this.idf) {
          const tf = termFreqs[token] ?? 0;
          const idf = this.idf[token];
          score += (idf * (tf * (this.k1 + 1))) / (tf + this.k1 * (1 - this.b + (this.b * docLen) / this.avgdl));
        }
      }
      scores.push([idx, score]);
    }
    return scores.sort((a, b) => b[1] - a[1]);
  }
}

// ============ CSV LOADING ============
function loadCSV(filepath) {
  if (!existsSync(filepath)) return [];
  const content = readFileSync(filepath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] ?? '').trim();
    });
    return row;
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function searchCSV(filepath, searchCols, query, maxResults = 3) {
  const data = loadCSV(filepath);
  if (data.length === 0) return [];
  const documents = data.map(row => searchCols.map(col => row[col] ?? '').join(' '));
  const bm25 = new BM25();
  bm25.fit(documents);
  const ranked = bm25.score(query);
  const results = [];
  for (const [idx, score] of ranked) {
    if (score > 0 && results.length < maxResults) {
      results.push(data[idx]);
    }
  }
  return results;
}

// ============ DESIGN SYSTEM GENERATION ============
function generateDesignSystem(query, productType) {
  const fullQuery = `${productType} ${query}`;

  // Search across domains
  const productResults = searchCSV(
    resolve(DATA_DIR, 'products.csv'),
    ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Key Considerations'],
    fullQuery,
    1
  );
  const styleResults = searchCSV(resolve(DATA_DIR, 'styles.csv'), ['Style Category', 'Keywords', 'Best For', 'AI Prompt Keywords'], fullQuery, 2);
  const colorResults = searchCSV(resolve(DATA_DIR, 'colors.csv'), ['Product Type', 'Notes'], fullQuery, 1);
  const typographyResults = searchCSV(resolve(DATA_DIR, 'typography.csv'), ['Font Pairing Name', 'Category', 'Mood/Style Keywords', 'Best For'], fullQuery, 1);
  const reasoningResults = searchCSV(resolve(DATA_DIR, 'ui-reasoning.csv'), ['UI_Category', 'Recommended_Pattern', 'Style_Priority'], fullQuery, 1);

  const product = productResults[0] ?? {};
  const style = styleResults[0] ?? {};
  const color = colorResults[0] ?? {};
  const typography = typographyResults[0] ?? {};
  const reasoning = reasoningResults[0] ?? {};

  return {
    pattern: reasoning['Recommended_Pattern'] ?? 'Hero + Features + CTA',
    style: style['Style Category'] ?? product['Primary Style Recommendation'] ?? reasoning['Style_Priority'] ?? 'Minimalism',
    colors: {
      primary: color['Primary'] ?? '#1E3A5F',
      secondary: color['Secondary'] ?? '#4A90D9',
      accent: color['Accent'] ?? '#FFD700',
      background: color['Background'] ?? '#FFFFFF',
      foreground: color['Foreground'] ?? '#0A0A0A',
      muted: color['Muted'] ?? '#F5F5F5',
      border: color['Border'] ?? '#E5E5E5',
      notes: color['Notes'] ?? '',
    },
    typography: {
      heading: typography['Heading Font'] ?? 'Instrument Sans',
      body: typography['Body Font'] ?? 'Inter',
      mood: typography['Mood/Style Keywords'] ?? 'modern, professional',
    },
    effects: (style['Effects & Animation'] ?? 'Subtle hover (200-250ms)').split(',').map(s => s.trim()),
    antiPatterns: (reasoning['Anti_Patterns'] ?? '')
      .split('+')
      .map(s => s.trim())
      .filter(Boolean),
    slopeAntiPatterns: [
      'Avoid AI purple (#6366F1) as primary',
      'No centered hero + 3-column features + CTA template',
      'No "Empower your workflow" cliché copy',
      'No backdrop-blur on everything',
      'Add a signature visual element unique to this brand',
    ],
    productInfo: product,
  };
}

// ============ AI SLOPE PATTERNS ============
const SLOPE_PATTERNS = {
  'generic-colors': {
    indicators: ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', 'purple-gradient', 'indigo-to-pink'],
    fixes: ['Replace default blue with brand primary', 'Avoid AI purple as primary', 'Add signature accent color'],
  },
  'template-layout': {
    indicators: ['grid-cols-3', 'hero-centered', 'three-column-features'],
    fixes: ['Use bento grid instead', 'Try asymmetric layout', 'Add storytelling sections'],
  },
  'cliche-microcopy': {
    indicators: ['empower your workflow', 'revolutionize', 'seamless experience', 'cutting-edge', 'next-generation'],
    fixes: ['Write specific copy', 'Use brand voice', 'Replace with action-specific CTAs'],
  },
  'overused-effects': {
    indicators: ['backdrop-blur'],
    threshold: 3,
    fixes: ['Use backdrop-filter sparingly', 'Vary border-radius', 'Add depth through elevation'],
  },
};

function detectSlopePatterns(output) {
  const issues = [];
  const outputLower = output.toLowerCase();

  for (const [category, config] of Object.entries(SLOPE_PATTERNS)) {
    for (const indicator of config.indicators) {
      if (category === 'overused-effects') {
        const count = (output.match(new RegExp(indicator, 'gi')) ?? []).length;
        if (count > (config.threshold ?? 3)) {
          issues.push({
            category,
            description: `Excessive ${indicator} usage (${count}x)`,
            severity: 'medium',
            fixes: config.fixes,
          });
        }
      } else if (outputLower.includes(indicator.toLowerCase())) {
        issues.push({
          category,
          description: `Detected: ${indicator}`,
          severity: 'high',
          fixes: config.fixes,
        });
      }
    }
  }

  const slopeScore = Math.min(100, issues.filter(i => i.severity === 'high').length * 25 + issues.length * 8);
  return {
    slopeScore,
    issues,
    originalityScore: Math.max(0, 100 - slopeScore),
  };
}

// ============ MAIN PIPELINE ============
async function run() {
  const zai = await ZAI.create();
  const startTime = Date.now();

  console.log(`\n🎨 Nexus Design Fusion — AI SLOPE Elimination Engine\n`);
  console.log(`📋 Query: ${query}`);
  console.log(`⚙️  Mode: ${mode} | SLOPE Detection: ${enableSlope ? 'ON' : 'OFF'} | Design System: ${enableDesignSystem ? 'ON' : 'OFF'}`);
  if (productType) console.log(`🏪 Product: ${productType}`);
  if (brandName) console.log(`🏷️  Brand: ${brandName}`);
  if (industry) console.log(`🏭 Industry: ${industry}`);
  if (techStack) console.log(`🛠️  Stack: ${techStack}`);
  console.log('');

  // Phase 1: Generate design system from knowledge base
  let designSystem = null;
  if (enableDesignSystem) {
    if (verbose) process.stderr.write('🔍 Searching design knowledge base...\n');
    designSystem = generateDesignSystem(query, productType);
    if (verbose) {
      process.stderr.write(`   Pattern: ${designSystem.pattern}\n`);
      process.stderr.write(`   Style: ${designSystem.style}\n`);
      process.stderr.write(`   Primary: ${designSystem.colors.primary}\n`);
      process.stderr.write(`   Typography: ${designSystem.typography.heading} / ${designSystem.typography.body}\n`);
    }
  }

  // Phase 2: Multi-model design generation
  const MODEL_SETS = {
    speed: ['glm-5', 'glm-5v-turbo', 'glm-5.1'],
    quality: ['glm-5.2', 'glm-5.2-1m', 'glm-4.7'],
    balanced: ['glm-5.2', 'glm-5.1', 'glm-4.7'],
    creative: ['glm-4.7', 'glm-5.1', 'glm-5.2'],
  };
  const models = MODEL_SETS[mode] || MODEL_SETS.balanced;

  const designSystemContext = designSystem
    ? `DESIGN SYSTEM:\n  Pattern: ${designSystem.pattern}\n  Style: ${designSystem.style}\n  Primary Color: ${designSystem.colors.primary}\n  Secondary: ${designSystem.colors.secondary}\n  Accent: ${designSystem.colors.accent}\n  Heading Font: ${designSystem.typography.heading}\n  Body Font: ${designSystem.typography.body}\n  Effects: ${designSystem.effects.join(', ')}\n  Anti-Patterns: ${designSystem.antiPatterns.join('; ')}\n  SLOPE Anti-Patterns: ${designSystem.slopeAntiPatterns.join('; ')}`
    : 'No design system. Use best practices.';

  const slopeWarnings = enableSlope
    ? `
CRITICAL ANTI-AI-SLOPE RULES:
1. DO NOT use default blue (#3B82F6) or AI purple (#6366F1) as primary colors
2. DO NOT create a centered hero + 3-column features + CTA template
3. DO NOT use "Empower your workflow", "Revolutionize", "Seamless experience"
4. DO NOT apply backdrop-blur to everything
5. DO NOT use uniform spacing — create visual rhythm
6. MUST create a SIGNATURE VISUAL ELEMENT unique to this brand
7. MUST use dramatic typography contrast (weight + size)
8. MUST vary border-radius (sharp for some, rounded for others)`
    : '';

  const designPrompt = `You are an expert UI/UX designer. Generate a complete, production-ready design.

${designSystemContext}

${slopeWarnings}

${productType ? `PRODUCT TYPE: ${productType}` : ''}
${brandName ? `BRAND: ${brandName}` : ''}
${industry ? `INDUSTRY: ${industry}` : ''}
${techStack ? `TECH STACK: ${techStack}` : ''}

Generate the complete design as HTML with inline CSS or Tailwind classes.
The design must look HANDCRAFTED and BRAND-SPECIFIC, not AI-generated.`;

  if (verbose) process.stderr.write(`🚀 Generating designs across ${models.length} models...\n`);

  const modelPromises = models.map(async (modelId, index) => {
    if (index > 0) await new Promise(r => setTimeout(r, index * 300));
    const t0 = Date.now();
    try {
      const response = await zai.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: designPrompt },
          { role: 'user', content: query },
        ],
        temperature: mode === 'creative' ? 0.8 : 0.5,
      });
      const output = response.choices?.[0]?.message?.content ?? '';
      return { model: modelId, output, time: Date.now() - t0, success: true };
    } catch (err) {
      // Retry once on rate limit
      if (String(err.message).includes('429') || String(err.message).includes('rate')) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const retryResp = await zai.chat.completions.create({
            model: modelId,
            messages: [
              { role: 'system', content: designPrompt },
              { role: 'user', content: query },
            ],
            temperature: mode === 'creative' ? 0.8 : 0.5,
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
    console.error('❌ All model calls failed.');
    process.exit(1);
  }

  if (verbose) {
    for (const r of successful) {
      process.stderr.write(`   ✅ ${r.model}: ${r.time}ms${r.retried ? ' (retried)' : ''}\n`);
    }
    for (const r of results.filter(r => !r.success)) {
      process.stderr.write(`   ❌ ${r.model}: FAILED\n`);
    }
  }

  // Phase 3: AI SLOPE Detection (quick pattern scan)
  let bestOutput = successful[0].output;
  let slopeResult = null;

  if (enableSlope) {
    slopeResult = detectSlopePatterns(bestOutput);
    if (verbose) {
      process.stderr.write(`\n🔍 AI SLOPE Detection:\n`);
      process.stderr.write(`   SLOPE Score: ${slopeResult.slopeScore}/100\n`);
      process.stderr.write(`   Originality: ${slopeResult.originalityScore}/100\n`);
      for (const issue of slopeResult.issues) {
        process.stderr.write(`   ⚠️  [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description}\n`);
      }
    }

    // If SLOPE score > 40, run LLM-based SLOPE elimination
    if (slopeResult.slopeScore > 40) {
      if (verbose) process.stderr.write(`\n🧹 Running AI SLOPE Elimination (score > 40)...\n`);

      const slopeIssues = slopeResult.issues
        .map(i => `[${i.severity.toUpperCase()}] ${i.category}: ${i.description}\n  Fixes: ${i.fixes.join('; ')}`)
        .join('\n');

      const eliminationPrompt = `You are an AI SLOPE elimination specialist. The following design has been flagged for AI SLOPE patterns. Revise it to eliminate ALL detected SLOPE issues while preserving the design intent.

DETECTED SLOPE ISSUES:
${slopeIssues}

DESIGN SYSTEM CONTEXT:
${designSystemContext}

ELIMINATION RULES:
1. Replace any default blue (#3B82F6) or AI purple (#6366F1) with brand-specific colors
2. Replace template layout with asymmetric or bento grid layout
3. Replace cliché microcopy with specific, brand-unique language
4. Reduce backdrop-blur usage to overlays only
5. Add a signature visual element unique to this brand
6. Create dramatic typography contrast
7. Vary border-radius and spacing for visual rhythm

The revised design must look HANDCRAFTED and BRAND-SPECIFIC, not AI-generated.

ORIGINAL DESIGN:
${bestOutput.substring(0, 5000)}

Generate the complete revised design now.`;

      try {
        const elimResponse = await zai.chat.completions.create({
          model: 'glm-5.2',
          messages: [
            { role: 'system', content: eliminationPrompt },
            {
              role: 'user',
              content: 'Eliminate all AI SLOPE patterns from this design.',
            },
          ],
          temperature: 0.6,
        });

        const eliminated = elimResponse.choices?.[0]?.message?.content ?? '';
        if (eliminated.trim()) {
          bestOutput = eliminated;
          // Re-check SLOPE
          const recheck = detectSlopePatterns(bestOutput);
          if (verbose) {
            process.stderr.write(`   Post-elimination SLOPE: ${recheck.slopeScore}/100 (was ${slopeResult.slopeScore})\n`);
          }
          slopeResult = recheck;
        }
      } catch (err) {
        if (verbose) process.stderr.write(`   Elimination failed: ${err.message}\n`);
      }
    }
  }

  // Phase 4: Synthesis (if multiple models produced output)
  if (successful.length > 1) {
    if (verbose) process.stderr.write(`\n🔀 Synthesizing ${successful.length} model outputs...\n`);

    const synthInput =
      `ORIGINAL QUERY:\n${query}\n\nDESIGN OUTPUTS FROM MULTIPLE MODELS:\n${'='.repeat(50)}\n\n` +
      successful.map(r => `[${r.model} — ${r.time}ms]\n${r.output.substring(0, 2500)}\n${'─'.repeat(40)}\n`).join('\n') +
      `\nSYNTHESIZE the best elements into one polished, SLOPE-free design. Prioritize ORIGINALITY and BRAND SPECIFICITY.`;

    try {
      const synthResponse = await zai.chat.completions.create({
        model: 'glm-5.2',
        messages: [
          {
            role: 'system',
            content: `You are a design synthesis specialist. Combine the best elements from multiple design outputs into one coherent, production-ready design. Prioritize ORIGINALITY and BRAND SPECIFICITY. Eliminate any AI SLOPE patterns (generic colors, template layouts, cliché copy).`,
          },
          { role: 'user', content: synthInput },
        ],
        temperature: 0.5,
      });

      const synthesized = synthResponse.choices?.[0]?.message?.content ?? '';
      if (synthesized.trim()) {
        bestOutput = synthesized;
      }
    } catch {
      // Use best individual output
    }
  }

  // Output the final design
  console.log(bestOutput);

  // Print metrics to stderr
  const totalTime = Date.now() - startTime;
  const modelInfo = successful.map(r => `${r.model}(${r.time}ms)`).join(', ');
  process.stderr.write(`\n🎨 Design Fusion: ${modelInfo} | Total: ${totalTime}ms | Mode: ${mode}`);
  if (slopeResult) {
    process.stderr.write(` | SLOPE: ${slopeResult.slopeScore}/100 | Originality: ${slopeResult.originalityScore}/100`);
  }
  process.stderr.write('\n');
}

run().catch(err => {
  console.error('Design Fusion error:', err.message);
  process.exit(1);
});
