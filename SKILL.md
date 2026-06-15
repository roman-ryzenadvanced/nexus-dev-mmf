---
name: nexus-dev-mmf
version: 3.2.0
description: |
  Multi-Model Fusion Engine (MMFE) — An adaptive multi-model orchestrator that decomposes complex tasks,
  routes subtasks to the optimal GLM models via z-ai-web-dev-sdk, executes in parallel, and synthesizes
  unified results. Includes MTP hyperthreading, code review (from Alibaba Open Code Review), and design
  skill with AI SLOPE elimination (from UI/UX Pro Max Skill). Use when you need to leverage multiple AI
  models simultaneously for superior output quality, when tasks are complex enough to benefit from
  decomposition, or when you want intelligent model selection based on task characteristics.
  Supports speed/quality/balanced/creative modes.
  Triggers: "multi-model", "fusion", "orchestrator", "parallel AI", "decompose and route",
  "use multiple models", "best model for", "ensemble AI", "AI team", "design", "code review",
  "AI SLOPE", "design system", "多模型", "融合引擎", "并行执行".
license: MIT
---

# Nexus-Dev MMFE — Multi-Model Fusion Engine

## Overview

Nexus-Dev MMFE is an intelligent orchestration layer that transforms a single complex request into a coordinated, parallel execution across multiple GLM models. Rather than relying on one model for everything, it:

1. **Decomposes** complex requests into independent subtasks
2. **Routes** each subtask to the model best suited for its specific requirements
3. **Executes** subtasks in parallel (respecting dependency ordering)
4. **Synthesizes** all results into a single, coherent, unified answer

### Specialized Pipelines

- **MTP (Multi-Threaded Pipeline)** — Hyperthreading for LLM orchestration with speculative decomposition, speculative execution, incremental synthesis, and concurrent quality scoring. Up to 2.83x speedup over sequential.
- **Code Review** — Adapted from Alibaba Open Code Review. Multi-model review with plan phase, review filter, and MTP support.
- **Design Skill** — Adapted from UI/UX Pro Max Skill with AI SLOPE elimination. BM25 search across 9 design domains, design system generation, and 10-category AI SLOPE detection/elimination.

## When to Use

- **Complex, multi-faceted queries** that span different domains
- **Quality-critical tasks** where the best possible output matters
- **Tasks requiring diverse capabilities** (reasoning + creativity + code + analysis)
- **Performance-optimized scenarios** where parallel execution saves time
- **Design tasks** where AI SLOPE (generic AI sameness) must be eliminated
- **Code review** tasks requiring multi-model analysis

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌────────────┐
│   Request    │────▶│  Decomposer  │────▶│  Adaptive Router│────▶│  Parallel  │
│             │     │  (glm-5.2)   │     │     (ARL)      │     │  Executor  │
└─────────────┘     └──────────────┘     └────────────────┘     └─────┬──────┘
                                                                        │
                          ┌──────────────┐                              │
                          │  Synthesizer │◀─────────────────────────────┘
                          │  (glm-5.2 +  │
                          │   glm-4.7)   │
                          └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                          │ Unified Result│
                          └──────────────┘

Specialized Pipelines:
  ┌──────────────┐   ┌───────────────┐   ┌────────────────────┐
  │  MTP Engine  │   │ Code Review   │   │  Design Skill      │
  │ (Hyperthread)│   │ (Alibaba OCR) │   │ (UI/UX Pro Max +   │
  │              │   │               │   │  AI SLOPE Elim.)   │
  └──────────────┘   └───────────────┘   └────────────────────┘
```

## Available Models

| Model | Tier | Strengths |
|-------|------|-----------|
| `glm-5.2-1m` | Flagship | Advanced reasoning, 1M context, complex decomposition, SLOPE detection |
| `glm-5.2` | Flagship | Baseline high-performance, design generation, balanced quality-speed |
| `glm-5.1` | Standard | Nuanced language, context sensitivity, design copy |
| `glm-5` | Fast | Speed, efficiency, rapid drafts, high-throughput |
| `glm-5v-turbo` | Fast | Accelerated feedback, vision support, quick iteration |
| `glm-4.7` | Creative | Creative generation, deep knowledge, design systems |

## Execution Modes

- **speed** — Prioritizes fast models (glm-5, glm-5v-turbo). Best for drafts and rapid iteration.
- **quality** — Prioritizes high-quality models (glm-5.2, glm-5.2-1m). Best for final deliverables.
- **balanced** — Balances speed and quality across all models. Default mode.
- **creative** — Biases toward creative models (glm-4.7). Best for writing, design, brainstorming.

## Design Skill — AI SLOPE Elimination

AI SLOPE = **A**I-generated **S**ameness, **L**ack of **O**riginality, **O**ver-reliance on **P**atterns, **E**mptiness

### What is AI SLOPE?

AI SLOPE is the generic, template-like quality that makes AI-generated designs instantly recognizable as machine-produced. Common indicators include:

- Default blue (#3B82F6) or AI purple (#6366F1) as primary colors
- Centered hero + 3-column features + CTA (the "AI special" layout)
- "Empower your workflow", "Revolutionize your X" cliché microcopy
- Backdrop-blur on every element
- Uniform spacing and border-radius everywhere
- No signature visual element unique to the brand

### Design Skill Pipeline

1. **ANALYZE** — Detect design sub-domain, product type, style keywords
2. **SEARCH** — BM25 search across design knowledge base (9 domains, 600+ entries)
3. **GENERATE DESIGN SYSTEM** — Aggregate search results with reasoning rules
4. **PROMPT ENGINEERING** — Build SLOPE-aware design prompts for models
5. **EXECUTE** — Multi-model parallel design generation
6. **SLOPE DETECTION** — Cross-model review for 10 categories of AI SLOPE
7. **ELIMINATE** — Re-generate with anti-slope instructions if threshold exceeded
8. **SYNTHESIZE** — Merge best elements from all model outputs

### Design Sub-Domains

| Sub-domain | Purpose |
|------------|---------|
| `brand` | Brand identity, voice, assets |
| `design-system` | Token architecture, specs |
| `ui-styling` | Component implementation (shadcn/ui, Tailwind) |
| `logo` | AI logo generation |
| `cip` | Corporate Identity Program deliverables |
| `slides` | HTML presentations with Chart.js |
| `banner` | Banner design for social, ads, web, print |
| `icon` | SVG icon generation |
| `social-photos` | Social media images |
| `ux-audit` | UX review, accessibility audit |

### AI SLOPE Detection Categories

| Category | Severity | Key Indicator |
|----------|----------|---------------|
| `generic-colors` | High | Default blue (#3B82F6), AI purple (#6366F1) |
| `template-layout` | High | Centered hero + 3-column features + CTA |
| `missing-brand-identity` | High | No signature visual element |
| `stock-imagery` | Medium | Generic hero images |
| `flat-typography` | Medium | No hierarchy, Inter-only |
| `overused-effects` | Medium | Backdrop-blur on everything |
| `cliche-microcopy` | Low | "Empower your workflow" |
| `uniform-spacing` | Low | Same padding everywhere |
| `default-icon-sets` | Low | Lucide without customization |
| `predictable-animations` | Low | Fade-in-up on everything |

### Design Knowledge Base

The design skill includes a comprehensive BM25-searchable knowledge base:

| Domain | Rows | Content |
|--------|------|---------|
| Products | 161 | Product-specific style recommendations |
| Styles | 84 | UI styles with colors, effects, accessibility |
| Colors | 161 | Product-specific color palettes (17 tokens each) |
| Typography | 73 | Font pairings with Google Fonts URLs |
| Landing | 34 | Landing page patterns and CTA strategies |
| Charts | 25 | Chart type recommendations by data type |
| UX Guidelines | 99 | UX best practices with Do/Don't examples |
| UI Reasoning | 161 | Decision rules and anti-patterns per product |
| Stacks | 14 | React, Next.js, Vue, Svelte, Flutter, etc. |

### Usage: Design Command

```bash
# Basic design with AI SLOPE elimination
node scripts/design-fusion.mjs "Design a fintech dashboard landing page"

# With brand context
node scripts/design-fusion.mjs "Create a SaaS homepage" --brand "Acme" --industry tech --mode creative

# Disable SLOPE detection
node scripts/design-fusion.mjs "Build a healthcare app UI" --no-slope

# With tech stack guidelines
node scripts/design-fusion.mjs "React dashboard" --stack nextjs --product SaaS

# Verbose output with metrics
node scripts/design-fusion.mjs "Design landing page" --verbose
```

### Usage: Design Skill Engine (SDK)

```javascript
import { createDesignSkillEngine } from 'nexus-dev-mmf';

const engine = createDesignSkillEngine({
  enableSlopeDetection: true,
  enableDesignSystem: true,
  slopeThreshold: 40,
  maxSlopeRetries: 2,
  defaultMode: 'balanced',
});

const result = await engine.process({
  id: 'design-001',
  query: 'Design a fintech dashboard landing page',
  productType: 'Fintech/Crypto',
  brandName: 'PayFlow',
  industry: 'fintech',
  enableSlopeDetection: true,
  enableDesignSystem: true,
  persistDesignSystem: false,
  mode: 'balanced',
  enableMTP: false,
  metadata: {},
});

console.log(result.designOutput);
console.log(`SLOPE Score: ${result.slopeReport.slopeScore}/100`);
console.log(`Originality: ${result.slopeReport.originalityScore}/100`);
```

## Code Review (from Alibaba Open Code Review)

Multi-model code review with plan phase, review filter, and MTP support.

```bash
# Basic code review
node scripts/code-review.mjs "<diff-content>"

# With MTP hyperthreading
node scripts/code-review.mjs "<diff-content>" --mtp
```

## MTP (Multi-Threaded Pipeline)

Hyperthreading for LLM orchestration — speculative decomposition, speculative execution, incremental synthesis, concurrent quality scoring.

```bash
# MTP hyperthreaded execution
node scripts/mtp-fusion.mjs "Complex multi-step task"
```

## CLI Usage

```bash
# General query
nexus-dev "Explain the difference between microservices and monoliths"

# Design command with SLOPE elimination
nexus-dev design "Create a fintech landing page" --brand PayFlow

# Quality mode
nexus-dev "Design a database schema" --mode quality

# Verbose output
nexus-dev design "SaaS homepage" --verbose --mode creative
```

## Prerequisites

- Node.js 18+
- `z-ai-web-dev-sdk` installed and configured (with valid `.z-ai-config`)
- Backend execution only (SDK must not be used client-side)

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `defaultMode` | `'balanced'` | Default execution mode |
| `maxParallelSubTasks` | `6` | Maximum concurrent model calls |
| `enableThinking` | `true` | Enable chain-of-thought reasoning |
| `subTaskTimeout` | `120000` | Timeout per subtask (ms) |
| `qualityThreshold` | `70` | Score threshold for re-synthesis |
| `enableMTP` | `false` | Enable MTP hyperthreading |
| `enableSlopeDetection` | `true` | Enable AI SLOPE detection in design |
| `slopeThreshold` | `40` | SLOPE score threshold for re-generation |
| `maxSlopeRetries` | `2` | Maximum SLOPE elimination attempts |
