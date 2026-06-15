# Changelog

All notable changes to the Nexus-Dev MMFE project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] — 2026-06-15

### 🚀 Major New Feature: MTP (Multi-Threaded Pipeline)

The MTP Engine is a speculative execution engine that overlaps pipeline stages like CPU hyperthreading. While one model is generating, the next stage is already being prepared and started — delivering **2.2x speedup** over sequential pipelines.

#### Architecture Overview

```
SEQUENTIAL:  [Decompose][Route][Execute W1][Execute W2][Synthesize][Quality] = ~11.6s
NEXUS:       [Decompose][Route][Exec W1+W2 parallel][Synthesize+Quality]    = ~8.4s
MTP:         [D+SpecD][R+Exec+SpecExec][IncSynth+Exec][FinalSynth+Quality]  = ~5.2s
```

#### MTP Engine (`src/core/mtp-engine.ts`)
- **`MTPEngine`** — The core hyperthreading pipeline engine
- **`process(query, options?)`** — Process a query through the MTP pipeline
- **`setEventCallback(cb)`** — Subscribe to MTP pipeline events
- **`getSnapshot()`** — Get a snapshot of the current MTP pipeline state
- **`getMetrics(totalTime)`** — Get MTP performance metrics (speedup, thread utilization, speculation stats)
- **7 thread types**: `decompose-flagship`, `decompose-fast`, `execute-primary`, `execute-speculative`, `synthesize-partial`, `synthesize-final`, `quality-score`

```javascript
import { createOrchestrator } from 'nexus-dev-mmf';

const orch = createOrchestrator({ enableMTP: true });
const result = await orch.process('Complex multi-domain query');
console.log(result.metadata.mtpMetrics.speedupFactor); // ~2.2x
```

#### Speculative Decomposition
- Flagship model (glm-5.2) and fast model (glm-5) decompose the query simultaneously
- If the flagship is slow (>8s), the speculative decomposition result is used instead
- Never wait — the fast model provides a fallback that keeps the pipeline moving
- Configurable via `mtp.speculativeDecomposition` (default: `true`)

#### Speculative Execution
- Fast models (glm-5v-turbo) draft answers for subtasks before routing completes
- Primary results are always preferred over speculative drafts
- If a primary result fails or is slow, the speculative draft is automatically used
- Confidence threshold ensures speculation only fires when likely to help (`mtp.speculativeConfidenceThreshold`)
- Maximum speculative threads per pipeline: `mtp.maxSpeculativeThreads` (default: 4)

#### Incremental Synthesis
- Start building the answer before all subtasks have finished
- GLM 5.1 progressively integrates each arriving result into a growing answer
- The incremental draft is passed to the final synthesis as a starting point
- Dramatically reduces perceived latency — the answer is already forming while models are still running
- Configurable via `mtp.incrementalSynthesis` (default: `true`)

#### Concurrent Quality Scoring
- Quality scoring runs in parallel with final synthesis — no sequential wait
- If quality is below threshold, refinement kicks in immediately
- Configurable via `mtp.concurrentQuality` (default: `true`)

#### MTP Types (`src/core/mtp-types.ts`)
- **`MTPThread`** — Represents an independent execution lane (id, type, state, model, speculative flag)
- **`MTPThreadType`** — 9 thread types covering all MTP operations
- **`MTPThreadState`** — Thread lifecycle (pending, running, completed, failed, cancelled, superseded)
- **`MTPThreadResult`** — Output from an MTP thread (output, time, tokens, quality, subtasks)
- **`MTPPipelineSnapshot`** — Complete pipeline state at a point in time
- **`MTPPipelinePhase`** — 8 overlapping phases (initializing, dual-decomposing, routing-executing, incremental-synth, final-synthesis, quality-pass, completed, failed)
- **`MTPMetrics`** — Performance metrics (overlap time saved, peak concurrency, speculative hit rate, speedup factor, thread utilization)
- **`MTPConfig`** — Full configuration with `DEFAULT_MTP_CONFIG`
- **`MTPDecomposedSubtask`** — Subtask from decomposition with source and confidence tracking

#### MTP CLI (`scripts/mtp-fusion.mjs`)
- Full MTP pipeline execution from the command line
- Flags: `--mode`, `--no-spec`, `--no-spec-decomp`, `--no-spec-exec`, `--no-inc-synth`, `--threads`, `--max-spec`, `--overlap`
- Shows real-time thread execution logs with emoji indicators
- Reports speedup factor, speculative hits, peak concurrency

```bash
node scripts/mtp-fusion.mjs "Design a distributed cache system"
node scripts/mtp-fusion.mjs --mode speed --threads 6 "Quick question"
node scripts/mtp-fusion.mjs --no-spec "Run without speculation"
```

### 🔧 Changed

- **`NexusDevConfig`** — Added `enableMTP` (boolean, default: `false`) and `mtp` configuration object
- **`Orchestrator`** — Upgraded to v3.0 with MTP integration:
  - When `enableMTP: true`, `process()` routes through the MTP engine automatically
  - New methods: `enableMTP()`, `disableMTP()`, `isMTPEnabled()`, `getMTPEngine()`
  - MTP events are forwarded to the existing event system
  - Performance tracking works transparently with MTP results
- **`OrchestrationResult.metadata`** — Now includes `mtp: true`, `mtpMetrics`, `speculativeHits`, `speculativeMisses`, `speedupFactor`, `peakConcurrency` when MTP is used
- **Main entry point** — Updated to v3.0.0 with MTP exports

---

## [2.1.0] — 2026-06-15

### 🚀 New Features

#### Embedding-Based Task Similarity (`src/core/embedding-similarity.ts`)
- **`EmbeddingSimilarity`** — Stores (embedding, modelId, qualityScore) tuples from successful subtask executions and retrieves the best historical model for new subtasks based on cosine similarity
- **`addRecord(description, modelId, qualityScore, capabilities, executionTimeMs)`** — Store a new embedding record after successful execution
- **`findSimilar(taskDescription, topK)`** — Find the most similar historical records, sorted by combined similarity × quality score
- **`getRecommendedModel(taskDescription)`** — Get the single best model recommendation based on aggregated historical similarity data
- **Pseudo-embedding generation** — Deterministic 128-dimensional hash-based vectors from task descriptions, with unigram and bigram features, normalized to unit vectors
- **Cosine similarity** — Full vector similarity computation for matching
- **`exportJSON()` / `importJSON(json)`** — Persist and restore embedding records
- **Configurable** — `maxRecords` (default 5000), `similarityThreshold` (default 0.7)
- **Orchestrator integration** — Embedding records are automatically created after each successful subtask execution
- **`orchestrator.getEmbeddings()`** — Access the embedding similarity engine

```javascript
const embeddings = orch.getEmbeddings();
const recommended = embeddings.getRecommendedModel('Implement a binary search tree');
console.log(recommended); // 'glm-5.2' (based on historical performance)

const similar = embeddings.findSimilar('Design a rate limiter', 5);
for (const result of similar) {
  console.log(`${result.modelId}: similarity=${result.similarity}, quality=${result.qualityScore}`);
}
```

#### Web UI Dashboard (`dashboard/index.html`)
- **Standalone HTML dashboard** — No dependencies, single file, dark theme
- **Real-time pipeline visualization** — 6-stage progress indicator (Received → Decomposing → Routing → Executing → Synthesizing → Completed)
- **4 KPI stat cards** — Total Pipelines, Avg Quality Score, Avg Latency, Success Rate
- **Model Performance table** — Calls, avg time, reliability per model
- **Model Registry table** — All 6 models with capabilities, speed/quality ranks, cost weights
- **Cost & Embeddings panel** — Total cost weight, avg cost per pipeline, budget limit, embedding record count
- **Pipeline History** — Last 10 pipelines with quality bars and mode tags
- **Event Log** — Real-time event stream with timestamps and model badges
- **Query Runner** — Mode selector, budget input, textarea, and simulated pipeline execution
- **Demo data** — Pre-loaded with 6 sample pipelines and events on startup
- **Responsive** — 4→2→1 column grid on smaller screens

---

## [2.0.0] — 2026-06-15

### 🚀 Major New Features

#### `/nexus` Command Integration
- **`/nexus` prefix** — Messages starting with `/nexus` are automatically processed through the multi-model fusion pipeline
- **`scripts/direct-fusion.mjs`** — Fast 2-phase fusion runner (parallel model calls + synthesis) optimized for interactive use
- **`scripts/quick-run.mjs`** — Speed-optimized runner for rapid responses
- **`scripts/runner.mjs`** — Full pipeline runner with all options
- Rate-limit handling with staggered parallel calls (300ms intervals)
- Automatic retry on 429 rate-limit responses (2-second backoff)
- Three model set presets per mode: `speed`, `quality`, `balanced`, `creative`

#### Custom Model Registration (`src/core/model-registry.ts`)
- **`registerModel(profile)`** — Register a new model into the global registry at runtime
- **`registerModels(profiles)`** — Batch registration of multiple models
- **`unregisterModel(modelId)`** — Remove a model from the registry
- **`getRegistrySnapshot()`** — Get a snapshot of the current registry
- Full validation on registration: id, name, tier, capabilities, contextWindow, speedRank, qualityRank, costWeight, maxTokens, description
- Valid tier values: `flagship`, `standard`, `fast`, `creative`, `vision`
- Speed/quality ranks validated to be 1–5

```javascript
import { registerModel } from 'nexus-dev-mmf';

registerModel({
  id: 'glm-custom-1',
  name: 'My Custom Model',
  tier: 'standard',
  capabilities: ['reasoning', 'code', 'analysis'],
  contextWindow: 64000,
  speedRank: 2,
  qualityRank: 2,
  costWeight: 1.0,
  maxTokens: 4096,
  supportsThinking: true,
  supportsVision: false,
  description: 'A custom model for specialized tasks',
});
```

#### Budget-Aware Routing (`src/core/budget-routing.ts`)
- **`BudgetConstraint` interface** — Define max total cost, max cost per task, cheaper preference, and optimization threshold
- **`optimizeForBudget(decisions, subtasks, budget)`** — Replaces expensive model assignments with cheaper alternatives to fit within budget
- **`calculateTotalCost(decisions)`** — Calculate the total cost weight of a routing plan
- **`findCheapestModel(capabilities, exclude)`** — Find the lowest-cost model that satisfies capability requirements
- **`isWithinBudget(modelId, currentCost, budget)`** — Check if a model selection fits within constraints
- Per-request `maxCostWeight` option on `OrchestrationRequest`
- Config-level `maxTotalCostWeight` setting

```javascript
const orch = createOrchestrator({ maxTotalCostWeight: 5.0 });
const result = await orch.process('Complex task', { maxCostWeight: 3.0 });
console.log(`Total cost: ${result.totalCostWeight}`);
```

#### Multi-Turn Conversation Support (`src/core/conversation.ts`)
- **`ConversationManager`** — Manages conversation context across multiple orchestration requests
- **`orchestrator.startConversation()`** — Create a new conversation, returns conversation ID
- **`orchestrator.continueConversation(id, query)`** — Process a follow-up within the same context
- **`conversation.buildContext(id)`** — Builds a context string from conversation history
- Conversation history is automatically injected into the `context` field of subsequent requests
- Configurable max turns per conversation (default: 20)
- `OrchestrationResult.conversationId` — Track which conversation a result belongs to

```javascript
const convId = orch.startConversation();
const r1 = await orch.continueConversation(convId, 'Explain microservices');
const r2 = await orch.continueConversation(convId, 'What about their downsides?'); // Remembers context
```

#### Pipeline Event Streaming (`src/core/events.ts`)
- **`NexusEventEmitter`** — EventEmitter-based event system for real-time pipeline monitoring
- 13 event types: `pipeline:started`, `pipeline:stage`, `pipeline:completed`, `pipeline:failed`, `subtask:routed`, `subtask:started`, `subtask:completed`, `subtask:failed`, `subtask:retrying`, `synthesis:started`, `synthesis:completed`, `synthesis:refining`, `quality:scored`
- **Wildcard listener** — `orchestrator.getEvents().onAny(callback)` subscribes to all events
- **Per-type listener** — `orchestrator.getEvents().onType('subtask:completed', callback)` subscribes to specific events
- **Event log** — `getEventLog()`, `getEventsForRequest(id)`, `getEventsByType(type)` for retrospective analysis
- Config-level `enableEvents` toggle (default: `true`)

```javascript
const orch = createOrchestrator();
orch.getEvents().onAny(event => {
  console.log(`[${event.type}] ${event.requestId}`, event.data);
});
```

#### Model Performance Tracking (`src/core/performance-tracker.ts`)
- **`PerformanceTracker`** — Tracks execution stats per model across requests
- Records: total/successful/failed calls, avg execution time, avg quality score, total tokens, capability-specific scores
- **`getBestModelForCapability(capability)`** — Find the model with the highest observed quality for a capability
- **`getReliability(modelId)`** — Get the success rate (0–1) for a model
- **`exportJSON()` / `importJSON(json)`** — Persist and restore performance data
- Config-level `enablePerformanceTracking` toggle (default: `true`)

```javascript
const tracker = orch.getPerformanceTracker();
tracker.recordSuccess('glm-5.2', 2345, 85, 500, ['reasoning', 'code']);
console.log(tracker.getBestModelForCapability('reasoning'));
console.log(tracker.getReliability('glm-5.2'));
```

### 🔧 Changed

- **`OrchestrationResult`** — Added `totalCostWeight` (required) and `conversationId` (optional) fields
- **`OrchestrationRequest`** — Added `conversationId` (optional) and `maxCostWeight` (optional) fields
- **`NexusDevConfig`** — Added `maxTotalCostWeight` (default: `Infinity`), `enablePerformanceTracking` (default: `true`), `enableEvents` (default: `true`)
- **`Orchestrator`** — Integrated `NexusEventEmitter`, `PerformanceTracker`, `ConversationManager`, and budget optimization into the pipeline
- **`Orchestrator.process()`** — Now tracks performance, emits events, applies budget optimization, and maintains conversation context

---

## [1.0.0] — 2026-06-15

### 🎉 Initial Release

- **4-phase pipeline**: Decompose → Route → Execute (Parallel) → Synthesize
- **6 GLM models** integrated via `z-ai-web-dev-sdk`: `glm-5.2-1m`, `glm-5.2`, `glm-5.1`, `glm-5`, `glm-5v-turbo`, `glm-4.7`
- **Adaptive Routing Layer** with weighted multi-factor scoring (capability match, mode preference, complexity alignment, load balancing, priority boost)
- **4 execution modes**: `speed`, `quality`, `balanced`, `creative`
- **Parallel execution** with dependency graph resolution (topological sort) and wave-based scheduling
- **Automatic retry** with alternative models on failure
- **Quality scoring** (0–100) with automatic re-synthesis below threshold using `glm-4.7`
- **CLI interface** with mode, parallelism, thinking toggle, and verbose options
- **125 test pipelines** across 7 sections (115 unit + 10 integration)
- **SKILL.md** for AI agent integration
- **MIT License**
