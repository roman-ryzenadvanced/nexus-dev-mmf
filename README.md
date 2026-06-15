# 🧠 Nexus-Dev MMFE — Multi-Model Fusion Engine

An adaptive multi-model orchestrator that decomposes complex tasks, routes subtasks to the optimal GLM models via `z-ai-web-dev-sdk`, executes them in parallel, and synthesizes unified results.

## Architecture

```
Request → Decomposer → Adaptive Router → Parallel Executor → Synthesizer → Unified Result
           (glm-5.2)      (ARL)          (6 models)         (glm-5.2+4.7)
```

### Pipeline Phases

| Phase | Component | Description |
|-------|-----------|-------------|
| **1. Decomposition** | `Decomposer` | Breaks complex queries into independent subtasks using `glm-5.2` |
| **2. Routing** | `AdaptiveRouter` | Assigns each subtask to the optimal model based on capabilities, mode, and load |
| **3. Execution** | `ParallelExecutor` | Runs subtasks in parallel, respecting dependency ordering |
| **4. Synthesis** | `Synthesizer` | Merges all results into a single coherent answer, with quality scoring and refinement |

### Supported Models

| Model | Tier | Key Strengths |
|-------|------|---------------|
| `glm-5.2-1m` | Flagship | Advanced reasoning, 1M context, deep decomposition |
| `glm-5.2` | Flagship | Balanced high-performance, robust execution |
| `glm-5.1` | Standard | Nuanced language, context sensitivity, summarization |
| `glm-5` | Fast | Speed, efficiency, rapid drafts |
| `glm-5v-turbo` | Fast | Accelerated feedback, vision support |
| `glm-4.7` | Creative | Creative generation, code synthesis |

### Execution Modes

- **`speed`** — Prioritizes fast models for rapid iteration
- **`quality`** — Prioritizes flagship models for best output
- **`balanced`** — Balanced tradeoff (default)
- **`creative`** — Biases toward creative models

## Quick Start

### Installation

```bash
npm install
```

### SDK Usage

```javascript
import { createOrchestrator } from 'nexus-dev-mmf';

const orchestrator = createOrchestrator({
  defaultMode: 'balanced',
  maxParallelSubTasks: 6,
  enableThinking: true,
});

const result = await orchestrator.process(
  'Design a microservices architecture for an e-commerce platform'
);

console.log(result.answer);
console.log(`Models used: ${result.modelsUsed.join(', ')}`);
console.log(`Quality score: ${result.qualityScore}/100`);
```

### CLI Usage

```bash
# Build first
npm run build

# Run a query
node dist/cli.js "Explain quantum computing" --mode quality --verbose
```

### Advanced Usage

```javascript
// Custom mode and context
const result = await orchestrator.process('Write a research paper', {
  preferredMode: 'quality',
  context: 'Focus on recent breakthroughs in error correction',
  maxParallelSubTasks: 4,
  customSystemPrompt: 'You are an academic research assistant.',
});

// Access routing details
for (const decision of result.routingDecisions) {
  console.log(`${decision.subTaskId} → ${decision.selectedModel}`);
  console.log(`  Confidence: ${decision.confidence}`);
  console.log(`  Reason: ${decision.reason}`);
}
```

## Testing

```bash
# Unit tests only (no API calls, fast)
npm run test:quick

# Full integration tests (requires z-ai-web-dev-sdk config)
npm test
```

125 test pipelines across 7 sections:
- Model Registry (15 tests)
- Configuration (15 tests)
- Adaptive Router (30 tests)
- Orchestrator Construction (20 tests)
- Subtask Structure (20 tests)
- Routing Edge Cases (15 tests)
- Integration/API (10 tests)

## API Reference

### `createOrchestrator(config?)`

Creates a new Orchestrator instance with optional configuration overrides.

### `orchestrator.process(query, options?)`

Processes a query through the full pipeline. Returns `Promise<OrchestrationResult>`.

**Options:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `preferredMode` | `'speed'\|'quality'\|'balanced'\|'creative'` | `'balanced'` | Execution mode |
| `maxParallelSubTasks` | `number` | `6` | Max concurrent model calls |
| `enableThinking` | `boolean` | `true` | Enable chain-of-thought |
| `context` | `string` | — | Additional context |
| `customSystemPrompt` | `string` | — | Custom system prompt |

### `OrchestrationResult`

| Field | Type | Description |
|-------|------|-------------|
| `answer` | `string` | The unified synthesized answer |
| `modelsUsed` | `string[]` | All models that contributed |
| `qualityScore` | `number` | Self-assessed quality (0-100) |
| `subTaskResults` | `SubTaskResult[]` | Individual subtask results |
| `routingDecisions` | `RoutingDecision[]` | Model selection rationale |
| `totalExecutionTimeMs` | `number` | Total pipeline duration |

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `defaultMode` | `'balanced'` | Default execution mode |
| `maxParallelSubTasks` | `6` | Max concurrent subtasks |
| `enableThinking` | `true` | Enable chain-of-thought |
| `subTaskTimeout` | `120000` | Per-subtask timeout (ms) |
| `qualityThreshold` | `70` | Score threshold for re-synthesis |
| `enableRetry` | `true` | Retry with alternative models |
| `maxRetries` | `2` | Max retry attempts |
| `maxDecompositionDepth` | `3` | Max decomposition levels |

## License

MIT
