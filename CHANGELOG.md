# Changelog

All notable changes to the Nexus-Dev MMFE project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
