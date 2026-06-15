---
name: nexus-dev-mmf
version: 1.0.0
description: |
  Multi-Model Fusion Engine (MMFE) — An adaptive multi-model orchestrator that decomposes complex tasks,
  routes subtasks to the optimal GLM models via z-ai-web-dev-sdk, executes in parallel, and synthesizes
  unified results. Use when you need to leverage multiple AI models simultaneously for superior output quality,
  when tasks are complex enough to benefit from decomposition, or when you want intelligent model selection
  based on task characteristics. Supports speed/quality/balanced/creative modes. Triggers: "multi-model",
  "fusion", "orchestrator", "parallel AI", "decompose and route", "use multiple models", "best model for",
  "ensemble AI", "AI team", "多模型", "融合引擎", "并行执行".
license: MIT
---

# Nexus-Dev MMFE — Multi-Model Fusion Engine

## Overview

Nexus-Dev MMFE is an intelligent orchestration layer that transforms a single complex request into a coordinated, parallel execution across multiple GLM models. Rather than relying on one model for everything, it:

1. **Decomposes** complex requests into independent subtasks
2. **Routes** each subtask to the model best suited for its specific requirements
3. **Executes** subtasks in parallel (respecting dependency ordering)
4. **Synthesizes** all results into a single, coherent, unified answer

This approach produces higher-quality output than any single model alone, especially for multi-faceted tasks.

## When to Use

- **Complex, multi-faceted queries** that span different domains (e.g., "Design a REST API and write unit tests")
- **Quality-critical tasks** where the best possible output matters
- **Tasks requiring diverse capabilities** (reasoning + creativity + code + analysis)
- **Performance-optimized scenarios** where parallel execution saves time
- **Any request where model specialization matters**

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
```

## Available Models

| Model | Tier | Strengths |
|-------|------|-----------|
| `glm-5.2-1m` | Flagship | Advanced reasoning, 1M context, complex decomposition |
| `glm-5.2` | Flagship | Baseline high-performance, balanced quality-speed |
| `glm-5.1` | Standard | Nuanced language, context sensitivity, summarization |
| `glm-5` | Fast | Speed, efficiency, rapid drafts, high-throughput |
| `glm-5v-turbo` | Fast | Accelerated feedback, vision support, quick iteration |
| `glm-4.7` | Creative | Creative generation, deep knowledge, code synthesis |

## Execution Modes

- **speed** — Prioritizes fast models (glm-5, glm-5v-turbo). Best for drafts and rapid iteration.
- **quality** — Prioritizes high-quality models (glm-5.2, glm-5.2-1m). Best for final deliverables.
- **balanced** — Balances speed and quality across all models. Default mode.
- **creative** — Biases toward creative models (glm-4.7). Best for writing, design, brainstorming.

## SDK Usage

### Basic Usage

```javascript
import { createOrchestrator } from 'nexus-dev-mmf';

const orchestrator = createOrchestrator({
  defaultMode: 'balanced',
  maxParallelSubTasks: 6,
  enableThinking: true,
});

const result = await orchestrator.process('Design a microservices architecture for an e-commerce platform');

console.log(result.answer);
console.log(`Models used: ${result.modelsUsed.join(', ')}`);
console.log(`Quality score: ${result.qualityScore}/100`);
```

### Advanced Configuration

```javascript
const result = await orchestrator.process('Write a research paper on quantum computing', {
  preferredMode: 'quality',
  maxParallelSubTasks: 4,
  enableThinking: true,
  context: 'Focus on recent breakthroughs in error correction',
  customSystemPrompt: 'You are an academic research assistant.',
});
```

### Accessing Routing Details

```javascript
for (const decision of result.routingDecisions) {
  console.log(`${decision.subTaskId} → ${decision.selectedModel} (${decision.confidence})`);
  console.log(`  Reason: ${decision.reason}`);
  console.log(`  Alternatives: ${decision.alternativeModels.join(', ')}`);
}
```

## CLI Usage

```bash
# Basic query
nexus-dev "Explain the difference between microservices and monoliths"

# Quality mode
nexus-dev "Design a database schema" --mode quality

# Verbose output with routing details
nexus-dev "Write a business plan" --mode creative --verbose

# Custom parallelism
nexus-dev "Analyze this dataset" --parallel 3 --no-thinking
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
| `verboseRouting` | `true` | Include routing metadata in responses |
| `maxDecompositionDepth` | `3` | Maximum decomposition depth |
| `qualityThreshold` | `70` | Score threshold for re-synthesis |
| `enableRetry` | `true` | Retry failed subtasks with alternative models |
| `maxRetries` | `2` | Maximum retry attempts per subtask |

## Pipeline Stages

1. **received** — Request acknowledged
2. **decomposing** — Breaking into subtasks
3. **routing** — Assigning models to subtasks
4. **executing** — Running subtasks in parallel
5. **synthesizing** — Merging results into unified answer
6. **completed** — Pipeline finished successfully
7. **failed** — Pipeline encountered an error
