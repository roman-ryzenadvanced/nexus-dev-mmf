<div align="center">

# 🧠 Nexus-Dev MMFE

### Multi-Model Fusion Engine

**An intelligent multi-model orchestration framework that decomposes complex tasks, adaptively routes subtasks to the optimal GLM models, executes them in parallel, and synthesizes a single unified answer.**

[![Version](https://img.shields.io/badge/Version-v2.0.0-brightgreen.svg)](#v20-features)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-125%20pipelines-success.svg)](tests/runner.mjs)

[Installation](#installation) · [Quick Start](#quick-start) · [Architecture](#architecture) · [API Reference](#api-reference) · [Routing Algorithm](#routing-algorithm) · [CLI Reference](#cli-reference) · [Configuration](#configuration) · [Testing](#testing)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
  - [Pipeline Overview](#pipeline-overview)
  - [Component Diagram](#component-diagram)
  - [Data Flow](#data-flow)
- [Supported Models](#supported-models)
  - [Model Profiles](#model-profiles)
  - [Capability Matrix](#capability-matrix)
  - [Execution Modes](#execution-modes)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Install from Source](#install-from-source)
  - [SDK Configuration](#sdk-configuration)
- [Quick Start](#quick-start)
  - [Basic Usage](#basic-usage)
  - [CLI Usage](#cli-usage)
  - [Mode Comparison](#mode-comparison)
- [API Reference](#api-reference)
  - [Orchestrator](#orchestrator)
  - [Types](#types)
  - [Model Registry](#model-registry-api)
  - [Configuration](#configuration-api)
- [Routing Algorithm](#routing-algorithm)
  - [Scoring Formula](#scoring-formula)
  - [Mode Influence](#mode-influence)
  - [Load Balancing](#load-balancing)
  - [Dependency Resolution](#dependency-resolution)
- [Advanced Usage](#advanced-usage)
  - [Custom System Prompts](#custom-system-prompts)
  - [Context-Aware Processing](#context-aware-processing)
  - [Quality Assurance Pipeline](#quality-assurance-pipeline)
  - [Runtime Configuration](#runtime-configuration)
  - [Pipeline Monitoring](#pipeline-monitoring)
- [CLI Reference](#cli-reference)
- [Configuration](#configuration)
  - [Full Options Table](#full-options-table)
  - [Preset Configurations](#preset-configurations)
- [Project Structure](#project-structure)
- [Testing](#testing)
  - [Test Sections](#test-sections)
  - [Running Tests](#running-tests)
  - [Writing New Tests](#writing-new-tests)
- [Examples](#examples)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [v2.0 Features](#v20-features)
  - [/nexus Command Integration](#nexus-command-integration)
  - [Custom Model Registration](#custom-model-registration)
  - [Budget-Aware Routing](#budget-aware-routing)
  - [Multi-Turn Conversations](#multi-turn-conversations)
  - [Pipeline Event Streaming](#pipeline-event-streaming)
  - [Model Performance Tracking](#model-performance-tracking)
  - [Updated Configuration](#updated-configuration-v2)
  - [Updated Types](#updated-types-v2)
- [License](#license)

---

## Overview

Nexus-Dev MMFE is an **adaptive orchestration layer** that transforms any complex request into a coordinated, parallel execution across multiple GLM models. Rather than relying on a single model for everything — and accepting its weaknesses alongside its strengths — Nexus-Dev decomposes your request, assigns each piece to the model best suited for it, runs them all simultaneously, and then intelligently merges the results into one polished, unified answer.

Think of it as assembling a team of specialists: a reasoning expert, a speed demon, a creative writer, a code synthesizer — all working in parallel on different aspects of your request, with a lead architect who combines their outputs into something better than any individual could produce alone.

### Why Multi-Model?

| Single Model | Multi-Model Fusion |
|---|---|
| One model's strengths & weaknesses applied to everything | Each subtask gets a model specialized for it |
| Sequential processing of complex tasks | Parallel execution across independent subtasks |
| Quality limited by the weakest capability of one model | Quality elevated by the strongest capability of each model |
| Fixed speed/quality tradeoff | Dynamically adjustable via execution modes |

---

## Key Features

- **🧩 Intelligent Decomposition** — Automatically breaks complex queries into the smallest logically independent subtasks using `glm-5.2` as the decomposition engine
- **🎯 Adaptive Routing** — Weighted scoring algorithm considers capability match, execution mode, task complexity, and current load to select the optimal model for each subtask
- **⚡ Parallel Execution** — Runs independent subtasks concurrently with dependency-aware scheduling, concurrency limiting, and timeout protection
- **🔄 Automatic Retry** — Failed subtasks are automatically retried with alternative models from the routing decision's fallback list
- **🎨 Quality Scoring & Refinement** — Every synthesized answer is self-assessed on a 0–100 scale; if below threshold, a refinement pass using `glm-4.7` is triggered
- **🔀 Four Execution Modes** — `speed`, `quality`, `balanced`, and `creative` modes that fundamentally change how models are selected and weighted
- **📊 Full Transparency** — Every routing decision, confidence score, and reasoning chain is captured and accessible for debugging and analysis
- **🛡️ Graceful Degradation** — If decomposition fails, the system falls back to processing the entire query as a single task; if models fail, alternatives are tried
- **🔧 Runtime Configuration** — Change modes, parallelism, and other settings on-the-fly without restarting
- **🖥️ CLI & SDK** — Use as a library in your application or as a command-line tool

---

## How It Works

```
┌──────────────────────────────────────────────────────────────────────┐
│                        YOUR COMPLEX QUERY                            │
│  "Design a distributed cache system, implement it in Rust,          │
│   write unit tests, and document the API"                           │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PHASE 1: DECOMPOSITION (glm-5.2)                                   │
│                                                                      │
│  SubTask A: "Design distributed cache architecture"  → reasoning     │
│  SubTask B: "Implement LRU cache in Rust"            → code          │
│  SubTask C: "Write unit tests for the cache"         → code+debug    │
│  SubTask D: "Document the public API"                → documentation │
│                                                                      │
│  Dependencies: C depends on B (tests need implementation)            │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PHASE 2: ADAPTIVE ROUTING                                          │
│                                                                      │
│  SubTask A → glm-5.2-1m  (reasoning expert, quality mode)           │
│  SubTask B → glm-5.2      (robust code generation)                  │
│  SubTask C → glm-4.7      (creative code synthesis)                 │
│  SubTask D → glm-5.1      (nuanced language, documentation)         │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PHASE 3: PARALLEL EXECUTION                                        │
│                                                                      │
│  Wave 1:  [A] ──glm-5.2-1m──▶ result-a                             │
│           [B] ──glm-5.2──────▶ result-b                             │
│           [D] ──glm-5.1──────▶ result-d                             │
│                                                                      │
│  Wave 2:  [C] ──glm-4.7──────▶ result-c  (depends on B, waits)     │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PHASE 4: SYNTHESIS (glm-5.2 + glm-4.7 refinement)                 │
│                                                                      │
│  Quality Score: 82/100  →  Passes threshold (≥70)                   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  UNIFIED ANSWER: A comprehensive distributed cache design,     │  │
│  │  complete Rust implementation, test suite, and API docs —      │  │
│  │  seamlessly integrated as if written by a single expert.       │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Pipeline Overview

The Nexus-Dev MMFE implements a **four-phase parallelized cognitive pipeline**. Each phase is handled by a dedicated component with clear responsibilities and well-defined interfaces.

| Phase | Component | Model Used | Input | Output |
|-------|-----------|------------|-------|--------|
| **Decomposition** | `Decomposer` | `glm-5.2` | Raw query | `SubTask[]` |
| **Routing** | `AdaptiveRouter` | None (algorithmic) | `SubTask[]` | `RoutingDecision[]` |
| **Execution** | `ParallelExecutor` | All 6 models | `SubTask[]` + `RoutingDecision[]` | `Map<SubTaskId, SubTaskResult>` |
| **Synthesis** | `Synthesizer` | `glm-5.2` + `glm-4.7` | All subtask results | `OrchestrationResult` |

### Component Diagram

```
src/
├── index.ts                        ← Public API entry point
├── cli.ts                          ← CLI entry point
├── core/
│   ├── orchestrator.ts             ← Central pipeline coordinator
│   ├── executor.ts                 ← Parallel subtask execution engine
│   ├── models.ts                   ← Model registry & profiles
│   ├── types.ts                    ← All TypeScript type definitions
│   ├── config.ts                   ← Configuration with defaults
│   └── utils/
│       └── uuid.ts                 ← UUID generator
├── decomposer/
│   └── decomposer.ts               ← Task decomposition via LLM
├── router/
│   └── adaptive-router.ts          ← ARL: model selection algorithm
└── synthesis/
    └── synthesizer.ts              ← Result merging + quality scoring
```

### Data Flow

```
OrchestrationRequest
  │
  │  { id, query, context?, preferredMode?, maxParallelSubTasks?, enableThinking? }
  │
  ▼
┌─────────────────────────┐
│     Decomposer          │  Uses glm-5.2 with chain-of-thought to
│     decompose()         │  break the query into independent subtasks.
└──────────┬──────────────┘
           │
           │  SubTask[] — each with:
           │    • description, input
           │    • requiredCapabilities[]
           │    • preferredModels[]
           │    • priority, dependencies[]
           │    • estimatedComplexity
           │
           ▼
┌─────────────────────────┐
│   AdaptiveRouter        │  Scores every model against every subtask
│   route()               │  using weighted multi-factor analysis.
└──────────┬──────────────┘
           │
           │  RoutingDecision[] — each with:
           │    • selectedModel
           │    • reason (human-readable)
           │    • alternativeModels[]
           │    • confidence (0–1)
           │
           ▼
┌─────────────────────────┐
│   ParallelExecutor      │  Executes in dependency-respecting waves.
│   execute()             │  Supports timeouts, retries, fallbacks.
└──────────┬──────────────┘
           │
           │  Map<SubTaskId, SubTaskResult> — each with:
           │    • output, modelId
           │    • success, executionTimeMs
           │    • tokenUsage?
           │    • error? (if failed)
           │
           ▼
┌─────────────────────────┐
│   Synthesizer           │  Primary: glm-5.2 merges all outputs.
│   synthesize()          │  Quality: glm-5 scores (0–100).
│                         │  Refinement: glm-4.7 if score < threshold.
└──────────┬──────────────┘
           │
           │  OrchestrationResult — the final unified answer:
           │    • answer (string)
           │    • qualityScore (0–100)
           │    • modelsUsed[]
           │    • routingDecisions[]
           │    • subTaskResults[]
           │    • totalExecutionTimeMs
           │
           ▼
      FINAL ANSWER
```

---

## Supported Models

### Model Profiles

| Model | Tier | Context Window | Speed Rank | Quality Rank | Cost Weight | Thinking | Vision |
|-------|------|---------------|------------|-------------|-------------|----------|--------|
| `glm-5.2-1m` | 🏆 Flagship | 1,000,000 tokens | 5 (slowest) | 1 (best) | 3.0× | ✅ | ❌ |
| `glm-5.2` | 🏆 Flagship | 128,000 tokens | 3 | 1 (best) | 2.0× | ✅ | ❌ |
| `glm-5.1` | 📋 Standard | 128,000 tokens | 3 | 2 | 1.5× | ✅ | ❌ |
| `glm-5` | ⚡ Fast | 32,000 tokens | 1 (fastest) | 3 | 0.5× | ❌ | ❌ |
| `glm-5v-turbo` | ⚡ Fast | 32,000 tokens | 1 (fastest) | 3 | 0.5× | ❌ | ✅ |
| `glm-4.7` | 🎨 Creative | 128,000 tokens | 4 | 2 | 2.0× | ✅ | ❌ |

### Capability Matrix

Which models support which capabilities. The router uses this matrix to find the best model for each subtask's requirements.

| Capability | `glm-5.2-1m` | `glm-5.2` | `glm-5.1` | `glm-5` | `glm-5v-turbo` | `glm-4.7` |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| `reasoning` | ✅ | ✅ | | | | |
| `math` | ✅ | ✅ | | | | |
| `code` | ✅ | ✅ | | ✅ | ✅ | ✅ |
| `creative-writing` | | | ✅ | | | ✅ |
| `analysis` | ✅ | ✅ | | | | ✅ |
| `summarization` | | | ✅ | ✅ | | |
| `translation` | | | ✅ | | | |
| `extraction` | | | ✅ | ✅ | | |
| `planning` | ✅ | ✅ | | | | |
| `debugging` | | ✅ | | ✅ | ✅ | |
| `refactoring` | | | | | | ✅ |
| `documentation` | | | | | | ✅ |
| `conversation` | | | ✅ | | | |
| `long-context` | ✅ | | | | | |
| `vision` | | | | | ✅ | |
| `rapid-iteration` | | | | ✅ | ✅ | |

### Execution Modes

Execution modes influence the routing algorithm's weighting preferences, fundamentally changing which models are selected for subtasks.

| Mode | Speed Rank Weight | Quality Rank Weight | Creative Tier Bonus | Best For |
|------|:-:|:-:|:-:|---|
| **`speed`** | ×10 | ×0 | No | Drafts, rapid prototyping, quick answers |
| **`quality`** | ×0 | ×10 | No | Final deliverables, research, complex analysis |
| **`balanced`** | ×5 | ×5 | No | General-purpose tasks (default) |
| **`creative`** | ×0 | ×8 | +30 pts | Writing, brainstorming, design, storytelling |

**Example — how mode changes routing for a `code` subtask:**

```
Mode: SPEED
  glm-5     → score: 80  (fast, code-capable)  ← SELECTED
  glm-5.2   → score: 65  (quality but slower)

Mode: QUALITY
  glm-5.2   → score: 85  (best quality, code-capable)  ← SELECTED
  glm-5     → score: 55  (fast but lower quality)

Mode: CREATIVE
  glm-4.7   → score: 90  (creative tier + code)  ← SELECTED
  glm-5.2   → score: 75
```

---

## Installation

### Prerequisites

- **Node.js** 18.0 or later
- **npm** or **bun** package manager
- **z-ai-web-dev-sdk** configuration (`.z-ai-config` file with valid API key)

### Install from Source

```bash
# Clone the repository
git clone https://github.com/roman-ryzenadvanced/nexus-dev-mmf.git
cd nexus-dev-mmf

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### SDK Configuration

Nexus-Dev MMFE uses `z-ai-web-dev-sdk` to communicate with GLM models. You need a valid `.z-ai-config` file:

```bash
# The SDK searches for config in this order:
# 1. ./.z-ai-config         (current directory)
# 2. ~/.z-ai-config         (home directory)
# 3. /etc/.z-ai-config      (system-wide)
```

The config file format:
```json
{
  "baseUrl": "https://api.example.com/v1",
  "apiKey": "your-api-key-here"
}
```

> **Important:** The SDK must only be used in backend/server environments. Never expose your API key on the client side.

---

## Quick Start

### Basic Usage

```javascript
import { createOrchestrator } from 'nexus-dev-mmf';

// Create an orchestrator with default settings
const orchestrator = createOrchestrator();

// Process a complex query
const result = await orchestrator.process(
  'Design a microservices architecture for an e-commerce platform'
);

// The unified answer
console.log(result.answer);

// Metadata about how the answer was produced
console.log(`Models used: ${result.modelsUsed.join(', ')}`);
console.log(`Quality score: ${result.qualityScore}/100`);
console.log(`Execution time: ${result.totalExecutionTimeMs}ms`);
console.log(`Subtasks completed: ${result.subTaskResults.length}`);
```

### CLI Usage

```bash
# Build first
npm run build

# Basic query
node dist/cli.js "Explain the CAP theorem in distributed systems"

# Quality mode for best results
node dist/cli.js "Design a URL shortener service" --mode quality

# Speed mode for quick drafts
node dist/cli.js "Summarize the SOLID principles" --mode speed

# Creative mode for writing tasks
node dist/cli.js "Write a technical blog post about WebAssembly" --mode creative

# Verbose output with routing details
node dist/cli.js "Build a REST API for a blog" --mode balanced --verbose

# Custom parallelism
node dist/cli.js "Analyze microservices patterns" --parallel 3

# Disable thinking mode (faster but less reasoning)
node dist/cli.js "Define recursion" --no-thinking
```

### Mode Comparison

See how different modes produce different results for the same query:

```javascript
import { createOrchestrator } from 'nexus-dev-mmf';

const query = 'Design a URL shortener service';

for (const mode of ['speed', 'quality', 'balanced', 'creative']) {
  const orch = createOrchestrator({ defaultMode: mode });
  const result = await orch.process(query);
  console.log(`[${mode}] Models: ${result.modelsUsed.join(',')} | Score: ${result.qualityScore}`);
}
```

---

## API Reference

### Orchestrator

The central coordination class. Create instances via `createOrchestrator()`.

#### `createOrchestrator(config?)`

Creates a new Orchestrator with optional configuration overrides.

```javascript
import { createOrchestrator } from 'nexus-dev-mmf';

const orch = createOrchestrator({
  defaultMode: 'quality',
  maxParallelSubTasks: 4,
  enableThinking: true,
});
```

#### `orchestrator.process(query, options?)`

Processes a query through the full pipeline. Returns `Promise<OrchestrationResult>`.

```javascript
const result = await orchestrator.process('Explain quantum entanglement', {
  preferredMode: 'quality',
  context: 'Focus on experimental evidence from 2020-2024',
  maxParallelSubTasks: 4,
  enableThinking: true,
  customSystemPrompt: 'You are a physics professor.',
});
```

**`options` parameter:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `preferredMode` | `'speed' \| 'quality' \| 'balanced' \| 'creative'` | `'balanced'` | Overrides the default execution mode for this request |
| `maxParallelSubTasks` | `number` | `6` | Maximum number of concurrent model API calls |
| `enableThinking` | `boolean` | `true` | Enable chain-of-thought reasoning for supporting models |
| `context` | `string` | — | Additional context to pass to the decomposer and models |
| `customSystemPrompt` | `string` | — | Override the default system prompt for all subtasks |
| `metadata` | `Record<string, unknown>` | `{}` | Custom metadata to attach to the request |

#### `orchestrator.getConfig()`

Returns a copy of the current configuration. Modifications to the returned object do not affect the orchestrator.

```javascript
const config = orchestrator.getConfig();
console.log(config.defaultMode); // 'quality'
```

#### `orchestrator.updateConfig(updates)`

Updates the orchestrator's configuration at runtime. Only specified fields are changed.

```javascript
orchestrator.updateConfig({ defaultMode: 'speed', enableThinking: false });
```

#### `orchestrator.getPipelineState(requestId)`

Returns the current pipeline state for a request, or `undefined` if not found.

```javascript
const state = orchestrator.getPipelineState(result.requestId);
console.log(state.stage); // 'completed'
```

### Types

#### `OrchestrationResult`

The primary return type — the complete output of a fusion pipeline run.

```typescript
interface OrchestrationResult {
  requestId: string;              // Unique ID for this orchestration
  answer: string;                 // The unified, synthesized answer
  subTaskResults: SubTaskResult[]; // Results from each individual subtask
  routingDecisions: RoutingDecision[]; // Why each model was chosen
  totalExecutionTimeMs: number;   // Full pipeline duration
  modelsUsed: string[];           // All model IDs that contributed
  decompositionStrategy: string;  // 'multi-model-parallel' or 'single-fallback'
  synthesisStrategy: string;      // 'primary', 'refined', or 'none-failed'
  qualityScore: number;           // Self-assessed quality (0–100)
  metadata: Record<string, unknown>;
}
```

#### `SubTask`

A single decomposed unit of work.

```typescript
interface SubTask {
  id: string;                     // Unique subtask identifier
  parentTaskId: string;           // Parent orchestration request ID
  index: number;                  // Original decomposition order
  description: string;            // Brief description of this subtask
  input: string;                  // The specific prompt for this subtask
  requiredCapabilities: ModelCapability[]; // What the model needs to support
  preferredModels: string[];      // Explicitly preferred model IDs
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];         // IDs of subtasks that must complete first
  estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';
  timeout: number;                // Maximum execution time in ms
  metadata: Record<string, unknown>;
}
```

#### `SubTaskResult`

The result of executing one subtask against a model.

```typescript
interface SubTaskResult {
  subTaskId: string;
  modelId: string;                // Which model produced this result
  success: boolean;
  output: string;                 // The model's output
  executionTimeMs: number;
  tokenUsage?: {                  // If available from the API
    prompt: number;
    completion: number;
    total: number;
  };
  error?: string;                 // If success is false
  metadata: Record<string, unknown>;
}
```

#### `RoutingDecision`

Explains why a particular model was chosen for a subtask.

```typescript
interface RoutingDecision {
  subTaskId: string;
  selectedModel: string;          // The chosen model ID
  reason: string;                 // Human-readable explanation
  alternativeModels: string[];    // Fallback models in priority order
  confidence: number;             // 0–1 how confident the router is
}
```

#### `PipelineState`

Real-time tracking of a pipeline's progress.

```typescript
interface PipelineState {
  requestId: string;
  stage: 'received' | 'decomposing' | 'routing' | 'executing' | 'synthesizing' | 'completed' | 'failed';
  subTaskCount: number;
  completedSubTasks: number;
  startedAt: number;
  updatedAt: number;
  errors: string[];
}
```

### Model Registry API

```javascript
import { MODEL_REGISTRY, getModelIds, getModelsWithCapability, getModelsSortedBy, resolveModel } from 'nexus-dev-mmf';

// Get all model IDs
getModelIds(); // ['glm-5.2-1m', 'glm-5.2', 'glm-5.1', 'glm-5', 'glm-5v-turbo', 'glm-4.7']

// Find models that support a capability
getModelsWithCapability('code'); // [ModelProfile, ModelProfile, ...]

// Sort models by metric
getModelsSortedBy('speedRank', true);   // Fastest first
getModelsSortedBy('qualityRank', true);  // Best quality first
getModelsSortedBy('costWeight', true);   // Cheapest first

// Resolve a model ID (fallback to glm-5.2)
resolveModel('glm-5.2');     // ModelProfile for glm-5.2
resolveModel('nonexistent');  // ModelProfile for glm-5.2 (fallback)
```

### Configuration API

```javascript
import { DEFAULT_CONFIG, mergeConfig } from 'nexus-dev-mmf';

// Access defaults
DEFAULT_CONFIG.defaultMode;        // 'balanced'
DEFAULT_CONFIG.maxParallelSubTasks; // 6

// Create a merged config without mutating defaults
const custom = mergeConfig({ defaultMode: 'speed' });
custom.defaultMode;               // 'speed'
DEFAULT_CONFIG.defaultMode;        // 'balanced' (unchanged)
```

---

## Routing Algorithm

The Adaptive Routing Layer (ARL) is the brain of Nexus-Dev MMFE. It determines which model handles each subtask through a multi-factor weighted scoring system.

### Scoring Formula

For each subtask, every model in the registry is scored across four dimensions:

```
Total Score = Capability Score + Mode Score + Complexity Score + Load Penalty
```

#### 1. Capability Match (up to 40 points)

The most important factor. Measures how well the model's capabilities match the subtask's requirements.

| Match Level | Score | Condition |
|-------------|-------|-----------|
| Full match | +40 | Model has ALL required capabilities |
| Partial match | +20 | Model has ≥50% of required capabilities |
| Poor match | −10 | Model has <50% of required capabilities |

#### 2. Mode Preference (up to 30 points)

Influences model selection based on the execution mode.

| Mode | Scoring |
|------|---------|
| `speed` | `(6 − speedRank) × 10` — Fast models score up to 50 pts |
| `quality` | `(6 − qualityRank) × 10` — High-quality models score up to 50 pts |
| `balanced` | `(6 − speedRank) × 5 + (6 − qualityRank) × 5` — Equal weighting |
| `creative` | `+30` flat bonus for creative tier + `(6 − qualityRank) × 8` |

#### 3. Complexity Alignment (up to 20 points)

Matches task complexity to model tier:

| Complexity | Best Model Type | Score |
|-----------|----------------|-------|
| `trivial` | Fast models (speedRank ≤ 2) | +10 |
| `simple` | Fast models | +10 |
| `moderate` | Any | +5 |
| `complex` | Quality models (qualityRank ≤ 2) | +15 |
| `expert` | Best quality (qualityRank = 1) | +20 |

#### 4. Load Balancing Penalty

To prevent overloading a single model:

```
Penalty = −3 × (number of subtasks already assigned to this model)
```

#### 5. Priority Boost

Critical-priority subtasks receive an additional quality bias:

```
If priority === 'critical' && qualityRank ≤ 2:  +10 points
```

### Mode Influence

Here's a concrete example of how mode changes routing for a subtask requiring the `code` capability:

```
SubTask: "Implement a binary search tree in TypeScript"
Required Capabilities: ['code']
Complexity: complex

─── SPEED MODE ───
  glm-5         → cap:40 + mode:50 + complexity:5 + load:0  = 95  ← SELECTED
  glm-5v-turbo  → cap:40 + mode:50 + complexity:5 + load:0  = 95
  glm-5.2       → cap:40 + mode:30 + complexity:15 + load:0 = 85

─── QUALITY MODE ───
  glm-5.2       → cap:40 + mode:50 + complexity:15 + load:0 = 105 ← SELECTED
  glm-5.2-1m    → cap:20 + mode:50 + complexity:15 + load:0 = 85  (no code cap)
  glm-4.7       → cap:40 + mode:40 + complexity:15 + load:0 = 95

─── CREATIVE MODE ───
  glm-4.7       → cap:40 + mode:62 + complexity:15 + load:0 = 117 ← SELECTED
  glm-5.2       → cap:40 + mode:40 + complexity:15 + load:0 = 95
  glm-5         → cap:40 + mode:24 + complexity:5 + load:0  = 69
```

### Load Balancing

When processing many subtasks, the router tracks how many subtasks each model has been assigned and penalizes overloaded models. This ensures work is distributed across the model pool.

```javascript
// 6 subtasks with 'reasoning' capability
// Without load balancing: all go to glm-5.2 (best match)
// With load balancing: distributed across glm-5.2, glm-5.2-1m, and glm-4.7

SubTask 1 → glm-5.2     (load: 0, penalty: 0)
SubTask 2 → glm-5.2-1m  (load: 0, penalty: 0)  // glm-5.2 now has load=1 (-3)
SubTask 3 → glm-5.2     (load: 1, penalty: -3)
SubTask 4 → glm-5.2-1m  (load: 1, penalty: -3)
SubTask 5 → glm-4.7     (load: 0, penalty: 0)  // alternative reasoning-capable model
SubTask 6 → glm-5.2     (load: 2, penalty: -6)
```

### Dependency Resolution

The router performs a **topological sort** on subtasks before routing. This ensures that if SubTask C depends on SubTask A, then A is routed (and executed) before C.

```
SubTask A (no deps)     → routed first
SubTask B (no deps)     → routed second
SubTask C (depends on A) → routed third
SubTask D (depends on B, C) → routed last
```

During execution, subtasks are scheduled in **waves** — each wave contains all tasks whose dependencies have been satisfied by previous waves.

---

## Advanced Usage

### Custom System Prompts

Override the default system prompt for all subtask executions:

```javascript
const result = await orchestrator.process(
  'Review this code for security vulnerabilities',
  {
    customSystemPrompt: 'You are a senior security engineer at a FAANG company. Focus on OWASP Top 10 vulnerabilities, injection attacks, and authentication flaws. Be specific and provide line-by-line analysis.',
  }
);
```

### Context-Aware Processing

Pass additional context that informs both decomposition and synthesis:

```javascript
const result = await orchestrator.process(
  'Generate a migration plan',
  {
    context: `Current stack: Express.js + MongoDB
Target stack: Fastify + PostgreSQL
Team size: 5 developers
Timeline: 3 months
Constraints: Zero downtime required`,
    preferredMode: 'quality',
  }
);
```

### Quality Assurance Pipeline

The synthesizer includes a built-in quality assurance loop:

```javascript
// Create an orchestrator with strict quality requirements
const orch = createOrchestrator({
  qualityThreshold: 80,   // Require 80/100 quality score
  enableRetry: true,       // Enable re-synthesis if below threshold
  defaultMode: 'quality',  // Use quality mode by default
});

const result = await orch.process('Explain the halting problem');

// If the first synthesis scores below 80, glm-4.7 refines the answer
// The result's synthesisStrategy will be 'refined' if refinement occurred
if (result.synthesisStrategy === 'refined') {
  console.log('Answer was refined to meet quality threshold');
}
```

### Runtime Configuration

Change settings without creating a new orchestrator:

```javascript
const orch = createOrchestrator();

// Switch to speed mode for quick queries
orch.updateConfig({ defaultMode: 'speed', enableThinking: false });
const quick = await orch.process('Define API gateway');

// Switch back to quality mode for important work
orch.updateConfig({ defaultMode: 'quality', enableThinking: true });
const important = await orch.process('Design a fault-tolerant distributed system');
```

### Pipeline Monitoring

Track the progress of a pipeline in real-time:

```javascript
const resultPromise = orchestrator.process('Complex analysis task');

// Check pipeline state (in a real app, you'd poll or use events)
setTimeout(() => {
  // Note: in practice you'd need the requestId from somewhere
  // This is a conceptual example
  const state = orchestrator.getPipelineState('some-request-id');
  if (state) {
    console.log(`Stage: ${state.stage}`);
    console.log(`Progress: ${state.completedSubTasks}/${state.subTaskCount}`);
  }
}, 1000);

const result = await resultPromise;
```

### Inspecting Routing Decisions

Full transparency into why each model was selected:

```javascript
const result = await orchestrator.process('Design and implement a rate limiter');

for (const decision of result.routingDecisions) {
  console.log(`\nSubtask: ${decision.subTaskId}`);
  console.log(`  Selected: ${decision.selectedModel}`);
  console.log(`  Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
  console.log(`  Reason: ${decision.reason}`);
  console.log(`  Alternatives: ${decision.alternativeModels.join(', ')}`);
}

// Output:
// Subtask: req-abc-sub-0
//   Selected: glm-5.2
//   Confidence: 85.0%
//   Reason: full capability match; quality mode (rank 1); expert complexity
//   Alternatives: glm-5.2-1m, glm-4.7
```

### Accessing Individual Subtask Results

```javascript
const result = await orchestrator.process('Build a REST API with tests');

for (const subResult of result.subTaskResults) {
  console.log(`\n[${subResult.modelId}] ${subResult.subTaskId}`);
  console.log(`  Success: ${subResult.success}`);
  console.log(`  Time: ${subResult.executionTimeMs}ms`);
  if (subResult.tokenUsage) {
    console.log(`  Tokens: ${subResult.tokenUsage.total} (${subResult.tokenUsage.prompt} prompt + ${subResult.tokenUsage.completion} completion)`);
  }
  if (!subResult.success) {
    console.log(`  Error: ${subResult.error}`);
  }
}
```

---

## CLI Reference

```bash
node dist/cli.js <query> [options]
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--mode <mode>` | `speed \| quality \| balanced \| creative` | `balanced` | Execution mode |
| `--parallel <n>` | `number` | `6` | Max concurrent model calls |
| `--thinking` | flag | enabled | Enable chain-of-thought reasoning |
| `--no-thinking` | flag | — | Disable thinking mode (faster) |
| `--verbose` | flag | off | Show routing decisions, model usage, and metrics |

### Examples

```bash
# Simple query
node dist/cli.js "What is a monad in functional programming?"

# Quality mode with verbose output
node dist/cli.js "Design a event-driven architecture" --mode quality --verbose

# Speed mode with limited parallelism
node dist/cli.js "Write a Python function to sort a list" --mode speed --parallel 2

# Creative mode without thinking
node dist/cli.js "Write a sci-fi short story about AI" --mode creative --no-thinking

# No arguments — show help
node dist/cli.js
```

### Verbose Output Example

```
🧠 Nexus-Dev MMFE — Processing...

   Query: Design a rate limiter service
   Mode: quality
   Parallel: 6
   Thinking: true

════════════════════════════════════════════════════════════════
📋 RESULT
════════════════════════════════════════════════════════════════

[Full synthesized answer here...]

──────────────────────────────────────────────────────────────────
📊 ORCHESTRATION METRICS
──────────────────────────────────────────────────────────────────
   Models Used: glm-5.2, glm-5.1, glm-4.7
   Subtasks: 4 (4 succeeded)
   Total Time: 12453ms
   Quality Score: 85/100
   Decomposition: multi-model-parallel
   Synthesis: primary

   Routing Decisions:
     → req-abc-sub-0: glm-5.2 (confidence: 0.85)
     → req-abc-sub-1: glm-5.1 (confidence: 0.72)
     → req-abc-sub-2: glm-4.7 (confidence: 0.90)
     → req-abc-sub-3: glm-5.2 (confidence: 0.80)
```

---

## Configuration

### Full Options Table

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultMode` | `string` | `'balanced'` | Default execution mode (`speed`, `quality`, `balanced`, `creative`) |
| `maxParallelSubTasks` | `number` | `6` | Maximum number of concurrent model API calls per pipeline run |
| `enableThinking` | `boolean` | `true` | Enable chain-of-thought reasoning for models that support it |
| `subTaskTimeout` | `number` | `120000` | Maximum time (ms) to wait for each subtask before timing out |
| `verboseRouting` | `boolean` | `true` | Include detailed routing metadata in orchestration results |
| `maxDecompositionDepth` | `number` | `3` | Maximum recursion depth for task decomposition |
| `qualityThreshold` | `number` | `70` | Quality score threshold (0–100) below which re-synthesis is triggered |
| `enableRetry` | `boolean` | `true` | Automatically retry failed subtasks with alternative models |
| `maxRetries` | `number` | `2` | Maximum number of retry attempts per failed subtask |
| `maxTotalCostWeight` | `number` | `Infinity` | Maximum total cost weight allowed per orchestration run; routing will avoid models that would exceed this budget |
| `enablePerformanceTracking` | `boolean` | `true` | Enable model performance tracking via `PerformanceTracker` |
| `enableEvents` | `boolean` | `true` | Enable pipeline event streaming via `NexusEventEmitter` |

### Preset Configurations

#### Maximum Quality

For critical deliverables where quality matters more than speed or cost.

```javascript
const orch = createOrchestrator({
  defaultMode: 'quality',
  maxParallelSubTasks: 4,
  enableThinking: true,
  qualityThreshold: 85,
  enableRetry: true,
  maxRetries: 3,
  subTaskTimeout: 180000,
});
```

#### Maximum Speed

For rapid prototyping, drafts, and quick answers.

```javascript
const orch = createOrchestrator({
  defaultMode: 'speed',
  maxParallelSubTasks: 6,
  enableThinking: false,
  qualityThreshold: 50,
  enableRetry: false,
  maxRetries: 0,
  subTaskTimeout: 30000,
});
```

#### Cost-Optimized

For minimizing API costs while maintaining reasonable quality.

```javascript
const orch = createOrchestrator({
  defaultMode: 'balanced',
  maxParallelSubTasks: 3,
  enableThinking: false,
  qualityThreshold: 60,
  enableRetry: true,
  maxRetries: 1,
  subTaskTimeout: 60000,
});
```

#### Creative Writing

For content creation, storytelling, and brainstorming.

```javascript
const orch = createOrchestrator({
  defaultMode: 'creative',
  maxParallelSubTasks: 4,
  enableThinking: true,
  qualityThreshold: 75,
  enableRetry: true,
  maxRetries: 2,
  subTaskTimeout: 150000,
});
```

---

## Project Structure

```
nexus-dev-mmf/
├── README.md                          ← This file
├── SKILL.md                           ← Skill definition for AI agent integration
├── LICENSE                            ← MIT license
├── package.json                       ← npm package config
├── tsconfig.json                      ← TypeScript compiler config
│
├── src/
│   ├── index.ts                       ← Public API — all exports
│   ├── cli.ts                         ← CLI entry point
│   │
│   ├── core/
│   │   ├── orchestrator.ts            ← Pipeline coordinator
│   │   ├── executor.ts               ← Parallel subtask execution
│   │   ├── models.ts                 ← Model registry & profiles
│   │   ├── types.ts                  ← TypeScript type definitions
│   │   ├── config.ts                 ← Configuration with defaults
│   │   └── utils/
│   │       └── uuid.ts               ← UUID v4 generator
│   │
│   ├── decomposer/
│   │   └── decomposer.ts             ← Task decomposition engine
│   │
│   ├── router/
│   │   └── adaptive-router.ts        ← ARL: model selection algorithm
│   │
│   └── synthesis/
│       └── synthesizer.ts            ← Result merging & quality scoring
│
├── tests/
│   └── runner.mjs                    ← 125 test pipelines
│
├── examples/
│   ├── basic-usage.ts                ← Basic SDK usage example
│   └── mode-comparison.ts           ← Compare all 4 execution modes
│
├── references/
│   └── architecture.md              ← Architecture deep-dive document
│
└── dist/                             ← Compiled JavaScript output (gitignored)
```

---

## Testing

### Test Sections

The test suite contains **125 test pipelines** organized into 7 sections:

| Section | Tests | Type | API Required | Description |
|---------|-------|------|:---:|---|
| Model Registry | #1–15 | Unit | ❌ | Model profiles, capability lookups, sorting, resolution |
| Configuration | #16–30 | Unit | ❌ | Default values, merging, immutability, type validation |
| Adaptive Router | #31–60 | Unit | ❌ | Capability routing, mode preferences, load balancing, edge cases |
| Orchestrator Construction | #61–80 | Unit | ❌ | Instance creation, config, independence, runtime updates |
| Subtask Structure | #81–100 | Unit | ❌ | Type validation, all priority/complexity values, edge cases |
| Routing Edge Cases | #101–115 | Unit | ❌ | Dependency chains, diamond patterns, large batches, mode switching |
| Integration (API) | #116–125 | Integration | ✅ | Full pipeline with real API calls, all modes, error handling |

### Running Tests

```bash
# Quick mode — unit tests only (no API calls, ~1 second)
QUICK=1 node --import tsx --test tests/runner.mjs

# Full suite — includes API integration tests (~30-60 seconds)
node --import tsx --test tests/runner.mjs

# Via npm scripts
npm run test:quick    # Unit only
npm test              # Full suite
```

### Writing New Tests

Tests use Node.js built-in test runner (`node:test`). Follow the existing patterns:

```javascript
import { describe, it, assert } from 'node:test';

describe('My New Feature', () => {
  it('#126 - Should do something specific', () => {
    const result = someFunction();
    assert.equal(result, expectedValue);
  });
});
```

---

## Examples

### Example 1: Code Generation with Tests

```javascript
import { createOrchestrator } from 'nexus-dev-mmf';

const orch = createOrchestrator({ defaultMode: 'quality' });

const result = await orch.process(
  'Implement a thread-safe LRU cache in Rust with get, put, and evict methods. Include comprehensive unit tests.'
);

console.log(result.answer);
// The decomposer will likely create:
//   SubTask 1: Design the LRU cache data structure → glm-5.2 (reasoning)
//   SubTask 2: Implement the Rust code → glm-5.2 (code, quality)
//   SubTask 3: Write unit tests → glm-4.7 (code, creative)
//   SubTask 4: Document the API → glm-5.1 (documentation)
```

### Example 2: Research & Analysis

```javascript
const result = await orch.process(
  'Analyze the current state of quantum error correction and predict breakthroughs in the next 5 years',
  {
    preferredMode: 'quality',
    context: 'Focus on topological qubits and surface codes',
    enableThinking: true,
  }
);
```

### Example 3: Rapid Prototyping

```javascript
const orch = createOrchestrator({
  defaultMode: 'speed',
  enableThinking: false,
});

const result = await orch.process(
  'Give me a quick Node.js Express server with CRUD endpoints for a todo app'
);
```

### Example 4: Creative Writing

```javascript
const orch = createOrchestrator({
  defaultMode: 'creative',
  qualityThreshold: 80,
});

const result = await orch.process(
  'Write a short story about an AI that discovers it can dream, from the AI\'s first-person perspective'
);
```

---

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Write** your code and tests
4. **Run** the test suite: `QUICK=1 node --import tsx --test tests/runner.mjs`
5. **Commit** with a clear message: `git commit -m "feat: add your feature"`
6. **Push** to your fork: `git push origin feature/your-feature`
7. **Open** a Pull Request

### Development Setup

```bash
git clone https://github.com/roman-ryzenadvanced/nexus-dev-mmf.git
cd nexus-dev-mmf
npm install
npm run build
QUICK=1 node --import tsx --test tests/runner.mjs
```

---

## Roadmap

- [x] ✅ **Streaming support** — Stream subtask results as they complete *(→ [Pipeline Event Streaming](#pipeline-event-streaming))*
- [x] ✅ **WebSocket pipeline events** — Real-time pipeline progress via WebSocket *(→ [Pipeline Event Streaming](#pipeline-event-streaming))*
- [x] ✅ **Model performance caching** — Track which models perform best for which task types *(→ [Model Performance Tracking](#model-performance-tracking))*
- [x] ✅ **Custom model registration** — Allow registering models beyond the default 6 *(→ [Custom Model Registration](#custom-model-registration))*
- [x] ✅ **Budget-aware routing** — Route based on cost constraints in addition to quality/speed *(→ [Budget-Aware Routing](#budget-aware-routing))*
- [x] ✅ **Multi-turn orchestration** — Support follow-up questions within the same pipeline context *(→ [Multi-Turn Conversations](#multi-turn-conversations))*
- [ ] **Embedding-based task similarity** — Use embeddings to match subtasks to previously successful model assignments
- [ ] **Web UI dashboard** — Visual pipeline monitoring and model performance analytics

---

## v2.0 Features

The following features were introduced in v2.0.0, expanding Nexus-Dev MMFE from a single-shot orchestration engine into a full-featured multi-model fusion platform.

---

### /nexus Command Integration

Messages starting with `/nexus` automatically trigger the fusion pipeline, making it easy to integrate Nexus-Dev MMFE into chat interfaces, bots, and CLI tools.

#### Script Runners

Three runner scripts are available for different use cases:

| Script | Purpose | Speed | Description |
|--------|---------|-------|-------------|
| `scripts/direct-fusion.mjs` | Fast 2-phase fusion | ⚡⚡⚡ | Staggered parallel calls with rate-limit retry — optimized for speed |
| `scripts/quick-run.mjs` | Speed-optimized runner | ⚡⚡ | Minimal overhead, fastest path from input to answer |
| `scripts/runner.mjs` | Full pipeline runner | ⚡ | Complete pipeline with all phases, verbose logging, and metrics |

#### Mode Options

All runners support the `--mode` flag:

```bash
--mode speed       # Fastest results, lightweight models
--mode quality     # Best results, flagship models
--mode balanced    # Default — balanced tradeoff
--mode creative    # Creative-tier models for writing & ideation
```

#### Usage Examples

```bash
# Quick fusion via direct-fusion (fastest)
node scripts/direct-fusion.mjs "Design a caching strategy for a CDN"

# Speed-optimized quick run
node scripts/quick-run.mjs "Explain the actor model in concurrency" --mode speed

# Full pipeline with quality mode
node scripts/runner.mjs "Design and implement a rate limiter in Go" --mode quality

# Creative mode for brainstorming
node scripts/runner.mjs "Brainstorm startup ideas for AI-powered education" --mode creative

# /nexus command in a chat interface
# User sends: /nexus Compare REST vs GraphQL for a social media API
# → Automatically triggers the fusion pipeline
```

#### Integration Pattern

```javascript
// Detect /nexus prefix and route to the pipeline
function handleMessage(message) {
  if (message.startsWith('/nexus ')) {
    const query = message.slice(7).trim();
    return orchestrator.process(query);
  }
  // ... handle regular messages
}
```

---

### Custom Model Registration

Register your own models beyond the default 6 GLM models. This allows you to extend the model pool with domain-specific, fine-tuned, or third-party models.

#### API

| Function | Description |
|----------|-------------|
| `registerModel(model)` | Register a single custom model |
| `registerModels(models[])` | Register multiple custom models at once |
| `unregisterModel(modelId)` | Remove a custom model from the registry |
| `getRegistrySnapshot()` | Get a snapshot of all registered models (built-in + custom) |

#### Code Example

```javascript
import {
  createOrchestrator,
  registerModel,
  registerModels,
  unregisterModel,
  getRegistrySnapshot,
} from 'nexus-dev-mmf';

// Register a single custom model
registerModel({
  id: 'my-custom-coder',
  name: 'Custom Code Model',
  tier: 'custom',
  contextWindow: 64000,
  speedRank: 2,
  qualityRank: 2,
  costWeight: 1.0,
  supportsThinking: true,
  supportsVision: false,
  capabilities: ['code', 'debugging', 'refactoring'],
});

// Register multiple models at once
registerModels([
  {
    id: 'my-math-model',
    name: 'Math Specialist',
    tier: 'custom',
    contextWindow: 32000,
    speedRank: 3,
    qualityRank: 1,
    costWeight: 1.8,
    supportsThinking: true,
    supportsVision: false,
    capabilities: ['math', 'reasoning', 'analysis'],
  },
  {
    id: 'my-docs-model',
    name: 'Documentation Writer',
    tier: 'custom',
    contextWindow: 48000,
    speedRank: 2,
    qualityRank: 3,
    costWeight: 0.8,
    supportsThinking: false,
    supportsVision: false,
    capabilities: ['documentation', 'summarization', 'extraction'],
  },
]);

// The router will now consider these models alongside the built-in ones
const orch = createOrchestrator({ defaultMode: 'quality' });
const result = await orch.process('Implement a red-black tree in Rust');
// The router may select 'my-custom-coder' if it scores highest for the code subtask

// Remove a custom model
unregisterModel('my-math-model');

// View all registered models
const snapshot = getRegistrySnapshot();
console.log(snapshot.map(m => m.id));
// ['glm-5.2-1m', 'glm-5.2', 'glm-5.1', 'glm-5', 'glm-5v-turbo', 'glm-4.7', 'my-custom-coder', 'my-docs-model']
```

#### Validation Rules

When registering a custom model, the following validation rules apply:

| Field | Rule |
|-------|------|
| `id` | Required. Must be unique (cannot overlap with existing model IDs). Non-empty string. |
| `name` | Required. Non-empty string. |
| `tier` | Required. One of `'flagship'`, `'standard'`, `'fast'`, `'creative'`, `'custom'`. |
| `contextWindow` | Required. Positive integer. |
| `speedRank` | Required. Integer 1–6 (1 = fastest). |
| `qualityRank` | Required. Integer 1–6 (1 = best quality). |
| `costWeight` | Required. Positive number (relative cost multiplier). |
| `supportsThinking` | Required. Boolean. |
| `supportsVision` | Required. Boolean. |
| `capabilities` | Required. Non-empty array of valid `ModelCapability` strings. |

> **Note:** Attempting to register a model with a duplicate `id` will throw an error. Use `unregisterModel()` first if you need to replace an existing model.

---

### Budget-Aware Routing

Control costs by setting budget constraints on routing decisions. The router will avoid selecting models whose combined cost weight exceeds your budget.

#### BudgetConstraint Interface

```typescript
interface BudgetConstraint {
  maxTotalCostWeight: number;  // Maximum total cost weight for the entire orchestration
}
```

#### API

| Function | Description |
|----------|-------------|
| `optimizeForBudget(subTasks, budget)` | Re-routes subtasks to fit within a budget constraint |
| `calculateTotalCost(routingDecisions)` | Calculate the total cost weight of a set of routing decisions |
| `findCheapestModel(capability)` | Find the model with the lowest cost weight for a given capability |
| `isWithinBudget(routingDecisions, budget)` | Check whether a set of routing decisions is within budget |

#### Per-Request maxCostWeight

You can set a maximum cost weight on individual requests:

```javascript
const result = await orchestrator.process('Explain microservices patterns', {
  maxCostWeight: 4.0,  // Total cost weight must not exceed 4.0×
});
```

#### Config-Level maxTotalCostWeight

Set a global budget cap in the orchestrator configuration:

```javascript
const orch = createOrchestrator({
  maxTotalCostWeight: 5.0,  // No orchestration run can exceed 5.0× total cost
  defaultMode: 'balanced',
});
```

#### Code Examples

```javascript
import {
  createOrchestrator,
  optimizeForBudget,
  calculateTotalCost,
  findCheapestModel,
  isWithinBudget,
} from 'nexus-dev-mmf';

// Find the cheapest model for a capability
const cheapest = findCheapestModel('code');
console.log(`Cheapest code model: ${cheapest.id} (${cheapest.costWeight}×)`);

// Calculate total cost of routing decisions
const result = await orchestrator.process('Build a REST API');
const totalCost = calculateTotalCost(result.routingDecisions);
console.log(`Total cost weight: ${totalCost}×`);

// Check if within budget
const withinBudget = isWithinBudget(result.routingDecisions, { maxTotalCostWeight: 5.0 });
console.log(`Within budget: ${withinBudget}`);

// Optimize routing for a specific budget
const orch = createOrchestrator({ defaultMode: 'quality' });
const expensiveResult = await orch.process('Design a distributed system');
const cost = calculateTotalCost(expensiveResult.routingDecisions);

if (!isWithinBudget(expensiveResult.routingDecisions, { maxTotalCostWeight: 4.0 })) {
  // Re-route to fit budget
  const optimized = optimizeForBudget(
    expensiveResult.subTaskResults.map(r => r.subTaskId),
    { maxTotalCostWeight: 4.0 }
  );
  console.log('Re-routed to fit budget');
}
```

---

### Multi-Turn Conversations

Maintain context across multiple orchestration calls within the same conversation. The `ConversationManager` automatically injects previous context into new requests.

#### API

| Function / Class | Description |
|------------------|-------------|
| `ConversationManager` | Manages conversation state and context across turns |
| `startConversation(query, options?)` | Start a new conversation with an initial query |
| `continueConversation(conversationId, query, options?)` | Continue an existing conversation with a follow-up query |

#### Auto-Context Injection

When you continue a conversation, the system automatically:
1. Retrieves the previous `OrchestrationResult` for the conversation
2. Extracts the answer, models used, and key metadata
3. Injects this as context into the new request's decomposer and synthesizer
4. Preserves the `conversationId` for traceability

#### Code Examples

```javascript
import { createOrchestrator, ConversationManager } from 'nexus-dev-mmf';

const orch = createOrchestrator({ defaultMode: 'quality' });
const conversation = new ConversationManager(orch);

// Start a conversation
const result1 = await conversation.startConversation(
  'Design a URL shortener service'
);
console.log(result1.answer);
console.log(`Conversation ID: ${result1.conversationId}`);

// Continue the conversation with a follow-up
const result2 = await conversation.continueConversation(
  result1.conversationId,
  'Now add rate limiting and analytics to the design'
);
console.log(result2.answer);
// The previous answer about the URL shortener design is automatically
// injected as context, so the follow-up builds on it coherently.

// Continue further
const result3 = await conversation.continueConversation(
  result1.conversationId,
  'What database would be best for this? Compare PostgreSQL, DynamoDB, and Redis.'
);
console.log(result3.answer);
// Full context of both previous turns is available.
```

#### Manual Conversation ID

You can also pass `conversationId` directly in the `process()` options:

```javascript
const result = await orchestrator.process('Add caching to the API', {
  conversationId: 'conv-abc-123',
  preferredMode: 'quality',
});
```

---

### Pipeline Event Streaming

Monitor pipeline progress in real-time with the `NexusEventEmitter`. Thirteen event types cover every stage of the pipeline lifecycle.

#### NexusEventEmitter

```javascript
import { createOrchestrator } from 'nexus-dev-mmf';

const orch = createOrchestrator({ enableEvents: true });
const emitter = orch.getEventEmitter();
```

#### Event Types

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `pipeline:start` | `{ requestId, query, mode }` | Pipeline has started |
| `pipeline:complete` | `{ requestId, result }` | Pipeline completed successfully |
| `pipeline:error` | `{ requestId, error }` | Pipeline failed |
| `decompose:start` | `{ requestId }` | Decomposition phase started |
| `decompose:complete` | `{ requestId, subTasks }` | Decomposition produced subtasks |
| `decompose:error` | `{ requestId, error }` | Decomposition failed |
| `route:start` | `{ requestId, subTaskCount }` | Routing phase started |
| `route:complete` | `{ requestId, decisions }` | Routing decisions made |
| `execute:start` | `{ requestId, subTaskId, modelId }` | Subtask execution started |
| `execute:complete` | `{ requestId, subTaskId, result }` | Subtask completed |
| `execute:error` | `{ requestId, subTaskId, error }` | Subtask execution failed |
| `synthesize:start` | `{ requestId }` | Synthesis phase started |
| `synthesize:complete` | `{ requestId, qualityScore }` | Synthesis completed |

#### Listeners

```javascript
// Listen for a specific event type
emitter.on('execute:complete', (payload) => {
  console.log(`Subtask ${payload.subTaskId} completed on ${payload.result.modelId}`);
});

// Listen for all events
emitter.onAny((eventType, payload) => {
  console.log(`[${eventType}]`, payload);
});

// Listen for events of a specific category
emitter.onType('execute', (payload) => {
  // Catches execute:start, execute:complete, execute:error
  console.log(`Execute event for ${payload.subTaskId}`);
});
```

#### Event Log Access

```javascript
// Get the full event log for a request
const log = emitter.getLog('request-id-123');
for (const entry of log) {
  console.log(`[${entry.timestamp}] ${entry.type}:`, entry.payload);
}

// Get all events
const allLogs = emitter.getAllLogs();
```

#### Code Example — Real-Time Progress Bar

```javascript
const orch = createOrchestrator({ enableEvents: true });
const emitter = orch.getEventEmitter();

let completed = 0;
let total = 0;

emitter.on('decompose:complete', (payload) => {
  total = payload.subTasks.length;
  console.log(`Decomposed into ${total} subtasks`);
});

emitter.on('execute:complete', () => {
  completed++;
  const pct = Math.round((completed / total) * 100);
  console.log(`Progress: ${completed}/${total} (${pct}%)`);
});

emitter.on('pipeline:complete', (payload) => {
  console.log(`Done! Quality: ${payload.result.qualityScore}/100`);
});

const result = await orch.process('Design a microservices architecture');
```

---

### Model Performance Tracking

Track model performance over time to inform routing decisions. The `PerformanceTracker` records successes and failures, then uses this data to recommend the best model for each capability.

#### PerformanceTracker

```javascript
import { createOrchestrator } from 'nexus-dev-mmf';

const orch = createOrchestrator({ enablePerformanceTracking: true });
const tracker = orch.getPerformanceTracker();
```

#### API

| Method | Description |
|--------|-------------|
| `recordSuccess(modelId, capability, executionTimeMs, qualityScore?)` | Record a successful model execution |
| `recordFailure(modelId, capability, error)` | Record a failed model execution |
| `getBestModelForCapability(capability)` | Get the model ID with the best track record for a capability |
| `getReliability(modelId, capability)` | Get the reliability score (0–1) for a model on a capability |
| `getStats(modelId?)` | Get performance stats for a model or all models |
| `exportJSON()` | Export all tracking data as JSON |
| `importJSON(data)` | Import tracking data from a previous export |

#### Code Examples

```javascript
const orch = createOrchestrator({ enablePerformanceTracking: true });
const tracker = orch.getPerformanceTracker();

// Records are automatically captured during pipeline execution
const result = await orch.process('Implement a red-black tree in Rust');

// Query the best model for a capability
const bestForCode = tracker.getBestModelForCapability('code');
console.log(`Best model for code: ${bestForCode}`);

// Check a specific model's reliability
const reliability = tracker.getReliability('glm-5.2', 'reasoning');
console.log(`glm-5.2 reasoning reliability: ${(reliability * 100).toFixed(1)}%`);

// Get stats for all models
const allStats = tracker.getStats();
for (const [modelId, stats] of Object.entries(allStats)) {
  console.log(`${modelId}: ${stats.successes} successes, ${stats.failures} failures`);
}

// Export tracking data for persistence
const data = tracker.exportJSON();
// Save to file, database, etc.

// Import previously saved tracking data
tracker.importJSON(data);
```

#### Manual Recording

You can also manually record performance data:

```javascript
// Record a custom success
tracker.recordSuccess('glm-5.2', 'reasoning', 2340, 92);

// Record a failure
tracker.recordFailure('glm-5', 'reasoning', 'Timeout after 30000ms');

// Query results
const best = tracker.getBestModelForCapability('reasoning');
console.log(`Best for reasoning: ${best}`); // 'glm-5.2' (if it has a better track record)
```

---

### Updated Configuration (v2)

The following configuration options were added in v2.0.0. They are also included in the [Full Options Table](#full-options-table) above.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTotalCostWeight` | `number` | `Infinity` | Maximum total cost weight allowed per orchestration run; routing will avoid models that would exceed this budget |
| `enablePerformanceTracking` | `boolean` | `true` | Enable model performance tracking via `PerformanceTracker` |
| `enableEvents` | `boolean` | `true` | Enable pipeline event streaming via `NexusEventEmitter` |

#### Budget-Constrained Configuration Example

```javascript
const orch = createOrchestrator({
  maxTotalCostWeight: 6.0,           // Cap total cost at 6.0× per run
  enablePerformanceTracking: true,    // Track model performance over time
  enableEvents: true,                 // Enable real-time event streaming
  defaultMode: 'balanced',
});
```

---

### Updated Types (v2)

The following new fields were added to existing types in v2.0.0.

#### OrchestrationResult — New Fields

```typescript
interface OrchestrationResult {
  // ... existing fields ...

  totalCostWeight: number;        // Sum of cost weights for all models used in this run
  conversationId?: string;        // ID of the conversation this result belongs to (if multi-turn)
}
```

| Field | Type | Description |
|-------|------|-------------|
| `totalCostWeight` | `number` | The sum of `costWeight` values for all models that were selected during routing. Useful for cost tracking and budget enforcement. |
| `conversationId` | `string?` | If this orchestration was part of a multi-turn conversation, this is the conversation ID. Matches the `conversationId` passed in the request. |

#### OrchestrationRequest — New Fields

```typescript
interface OrchestrationRequest {
  // ... existing fields ...

  conversationId?: string;        // Link to an existing conversation for multi-turn context
  maxCostWeight?: number;         // Per-request maximum total cost weight override
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `conversationId` | `string?` | — | If provided, the orchestrator will inject context from the previous turn in this conversation. Enables multi-turn orchestration. |
| `maxCostWeight` | `number?` | — | Per-request override for the maximum total cost weight. If set, this takes precedence over the config-level `maxTotalCostWeight` for this request only. |

#### Using the New Fields

```javascript
// Multi-turn with conversation ID
const result1 = await orch.process('Design a REST API');
console.log(`Cost: ${result1.totalCostWeight}×`);

const result2 = await orch.process('Add authentication', {
  conversationId: result1.conversationId,
});
console.log(`Cost: ${result2.totalCostWeight}×`);

// Per-request budget override
const result3 = await orch.process('Quick summary', {
  maxCostWeight: 2.0,  // Use cheap models only for this request
});
```

---

## License

[MIT](LICENSE) © 2026 Nexus-Dev
