# Changelog

All notable changes to the Nexus-Dev MMFE project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [5.1.0] — 2026-06-15

### 🖥️ Nexus Code TUI — v1.2.0: Production-Quality Terminal Experience

This release transforms the Nexus Code TUI from a functional prototype into a polished, production-grade terminal coding assistant. Every change below was verified end-to-end before landing; the full 230-test suite passes with zero regressions.

#### Streaming & Provider Reliability

- **Fixed "no response" streaming bug** — a proper SSE chunk parser (`readSSEChunks()`) now yields both content deltas and tool-call deltas, so Z.ai/GLM streams actually render.
- **Fixed tool-calling chains** — `toZAITools()` / `toZAIMessages()` / `parseZAIToolCalls()` round-trip tool definitions and calls correctly, enabling multi-round tool use.
- **Fixed MMFE streaming bypass** — `sendChatStream` now routes through the orchestrator when MMFE is on and emits the fused result via `onDelta`.
- **Fixed ESM `__dirname` crashes** in `search-engine.ts` and `design-engine.ts` (root package is `"type":"module"`).
- **Self-contained Z.ai loader** (`zai-loader.ts`) — resolves the API key, probes/selects the correct base URL, auto-creates `~/.z-ai-config`, and dynamic-imports the SDK. No new dependencies.

#### Live Metrics (the big one)

- **Real-time token speed & counter** during direct streams — tokens, tok/s, and elapsed time update on every delta.
- **Live progress during MMFE fusion** — because fusion is non-streaming, the UI now forwards _real_ orchestrator events (`pipeline:stage`, `subtask:routed/completed`, `synthesis:started`) as `{stage, subtasksDone, subtasksTotal, modelsActive}`. The status bar shows `executing 2/4 8.4s` while models fan out, then the fused answer.
- A 250 ms wall-clock ticker keeps elapsed time live even before the first delta arrives.

#### UI / UX Polish

- **koda-style line-window viewport (ChatView rewrite)** — the entire transcript is flattened into styled `Line[]` (per-token color/bold/dim segments) and only the visible window is rendered. This eliminates message overlap, cut-off text, and the disappearing-input bug. Content is word-wrapped to terminal width.
- **Scrollback** — PageUp / PageDown / Ctrl+↑↓ navigate history with auto-follow and a scroll-position indicator.
- **Multi-model message headers** — every assistant message shows all models involved (deduped from the message model + routing decisions), humanized time (`540ms` / `2.3s` / `2m30s`), tokens (`↑↓`), tok/s, and quality (`Q:n/100`).
- **Streaming animation** — a self-contained roller (⠋⠙⠹…) + cycling dots at 80 ms/frame. No `ink-spinner` dependency.
- **Boot animation** wired into the app.
- **Slash command menu** — typing `/` as the first character auto-opens a filterable command list (claude-code / koda / mimo style). Further typing filters it; ↑↓ navigate; Enter/Tab runs; Esc cancels.

#### Workflow Features

- **Session picker on boot** — launching `nexus` shows a picker: start a fresh session or resume any saved one (`↑↓` move, `↵` select, `n`/`esc` for new). Use `--new` to skip straight to a blank session or `--continue [name]` to resume a specific one.
- **Type while streaming (pending queue)** — follow-ups typed mid-stream are queued and sent when the current response finishes, with a `[N queued]` hint. Ctrl+C aborts and clears the queue.
- **Session persistence** — auto-save after every message (debounced), plus `/sessions`, `/continue [name|index]`, `/new`, and `--continue` / `--new` CLI flags. A `↺ continued from` banner confirms restores.
- **Observer — side-channel model** 👁 — when you send a prompt _while_ the main agent is streaming, you're asked whether to **queue** it for the main agent or fire it at the **Observer**, a cheap model (`glm-4.5-flash` by default) that answers immediately, grounded in the live behind-the-scenes feed. Observer messages render with a distinct `👁` sigil. Toggle with `/observer [on|off|<model>]`.

#### Docs

- README clarifies that Nexus Code is a **terminal app first** with an optional `--web` localhost mode (no hosted/web screenshots).
- New commands documented: `/sessions`, `/continue`, `/new`, `/observer`, `--continue`, `--new`.

---

## [5.0.0] — 2026-06-17

### 🚀 Major New Feature: Nexus Code — Terminal AI Coding Assistant

Nexus-Dev MMFE v5.0 adds **Nexus Code** (`nexus-code`), a full terminal UI coding assistant built with Ink + React that lives at `packages/nexus-code/`. Nexus Code integrates the MMFE orchestrator directly into an interactive terminal chat experience with multi-provider support, streaming, tool calling, and extensive slash command system.

#### What's New

- **Nexus Code TUI** — Ink + React terminal UI with streaming chat, 3 color themes, command palette
- **Multi-provider chat** — OpenAI-compatible, Anthropic, Z.ai (MMFE native) — switch with `/provider`
- **MMFE built in** — mode switcher (`/mode quality`), routing panel, quality score — or bypass with `/mmfe off`
- **20 slash commands** — `/mode`, `/model`, `/provider`, `/fetch`, `/add`, `/save`, `/load`, `/diff`, `/init`, `/branch`, `/theme`, `/status`, `/history`, `/plugins`, `/mcp`, `/tools`, `/clear`, `/help`, `/exit`
- **Streaming responses** — token-by-token rendering with Ctrl+C abort
- **Tool calling** — provider-agnostic tool protocol, 5 builtin tools (`read_file`, `write_file`, `shell`, `diff`, `apply_diff`), up to 5 tool rounds
- **MCP support** — Model Context Protocol with stdio + HTTP transports
- **Plugin system** — load custom tools/commands from `~/.nexus/plugins/*.js`
- **Web UI** — `nexus --web` launches local HTTP server + browser chat with SSE streaming
- **Pipe mode** — `echo "prompt" | nexus` for scripting
- **Command palette** — Ctrl+P fuzzy-filter slash commands
- **Session persistence** — save/load chat transcripts
- **Input history** — persisted to `~/.nexus/history.json` (500 entries)
- **Config wizard** — `nexus init` or `/init` interactive setup
- **Multi-line input** — Shift+Enter for newline
- **Conversation branching** — `/branch <msgId>` fork from past message
- **Auto-fetch models** — `/fetch` pulls model list from provider's `/v1/models`

#### Monorepo Structure

```
nexus-dev-mmf/
├── src/                          # MMFE orchestrator (v1.0+)
├── packages/nexus-code/          # Nexus Code TUI (v1.1.0+)
└── package.json                  # Workspace root
```

#### Test Coverage

- 230+ unit tests across 20 test suites
- 61% code coverage (threshold: 40%)
- 8 env-gated smoke tests (real API calls)

#### CI/CD

- 3 GitHub Actions workflows: CI matrix (Node 18/20/22), npm publish on tag, GitHub Release with auto-changelog

---

## [4.0.0] — 2026-06-15

### 🚀 Major New Feature: Multi-Provider Support (ZAI, OpenAI, Anthropic, Google)

Nexus-Dev MMFE v4.0 introduces a **Provider Abstraction Layer** that enables routing across multiple LLM providers — not just ZAI/GLM models. The same orchestration pipeline (decompose → route → execute → synthesize) now works with models from any provider, allowing you to mix GLM, GPT, Claude, and Gemini models in the same pipeline.

#### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Nexus Orchestration Pipeline              │
│  Decompose → Route → Execute (Parallel) → Synthesize        │
└───────────────────────────┬──────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │ ProviderRouter │  ← Resolves model → provider
                    └───┬───┬───┬───┘
                        │   │   │
              ┌─────────┘   │   └─────────┐
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ZAIProvider│ │OpenAI    │ │Anthropic │ │Google    │
        │(GLM 5.x) │ │Provider  │ │Provider  │ │Provider  │
        └──────────┘ │(GPT-4o,  │ │(Claude 4)│ │(Gemini)  │
                     │o3, o4)   │ └──────────┘ └──────────┘
                     └──────────┘
```

#### Provider Abstraction Layer (`src/providers/`)

**Core Interface (`src/providers/types.ts`)**

- **`LLMProvider`** — The unified interface all providers must implement
  - `initialize(config)` — Authenticate and prepare the provider
  - `complete(model, messages, options)` — Execute a chat completion
  - `healthCheck()` — Test connectivity and authentication
  - `listModels()` / `supportsModel(id)` — Model availability queries
  - `shutdown()` — Graceful teardown
- **`ProviderId`** — Union type: `'zai' | 'openai' | 'anthropic' | 'google'`
- **`ProviderConfig`** — Per-provider initialization config (apiKey, baseURL, organization, project, region, timeout, maxConcurrent, providerConfig)
- **`ProviderMessage`** — Unified message format (`{ role, content }`)
- **`ProviderCompletionOptions`** — Temperature, maxTokens, enableThinking, topP, stopSequences, providerOptions
- **`ProviderCompletionResult`** — Content, model, provider, usage, thinkingUsed, metadata
- **`MultiProviderConfig`** — Full multi-provider configuration with `DEFAULT_MULTI_PROVIDER_CONFIG`

**ZAI Provider (`src/providers/zai-provider.ts`)**

- Wraps `z-ai-web-dev-sdk` as an `LLMProvider`
- Supports: `glm-5.2-1m`, `glm-5.2`, `glm-5.1`, `glm-5`, `glm-5v-turbo`, `glm-4.7`
- Full backward compatibility — existing code using ZAI works unchanged
- Auto-initializes via `ZAI.create()`, no API key required

**OpenAI Provider (`src/providers/openai-provider.ts`)**

- Direct HTTP adapter for the OpenAI Chat Completions API
- Supports: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `o3`, `o3-mini`, `o4-mini`
- Handles reasoning models (o3, o4-mini) with `max_completion_tokens` and `reasoning_effort`
- Requires `OPENAI_API_KEY` env var or `apiKey` in config
- Supports custom base URL (for proxies, Azure OpenAI, etc.) and organization ID

**Anthropic Provider (`src/providers/anthropic-provider.ts`)**

- Direct HTTP adapter for the Anthropic Messages API
- Supports: `claude-opus-4`, `claude-sonnet-4`, `claude-haiku-3.5` (+ older 3.5 models)
- Model aliases: `'claude-opus-4'` → `'claude-opus-4-20250514'`, etc.
- Properly extracts `system` prompt from messages (Anthropic uses separate system parameter)
- Supports extended thinking for Claude 4 models
- Requires `ANTHROPIC_API_KEY` env var or `apiKey` in config

**Google Provider (`src/providers/google-provider.ts`)**

- Direct HTTP adapter for the Google AI (Gemini) API
- Supports: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2-flash`, `gemini-2-flash-lite`
- Converts messages to Gemini's `contents` format with `systemInstruction`
- Supports thinking mode for Gemini 2.5 models via `thinkingConfig`
- Requires `GOOGLE_API_KEY` or `GEMINI_API_KEY` env var or `apiKey` in config

**Provider Router (`src/providers/provider-router.ts`)**

- Central registry and router for all LLM providers
- Model ID resolution order:
  1. **Provider prefix**: `"openai/gpt-4o"` → OpenAI provider
  2. **Model registry**: Model's `provider` field in `MODEL_REGISTRY`
  3. **Default provider**: Falls back to configured `defaultProvider`
- `complete(modelId, messages, options)` — Route to the correct provider
- `completeWithFallback(modelId, messages, options, fallbackModels)` — Try fallback providers on failure
- `initialize()` — Initialize all configured providers (parallel, fault-tolerant)
- `healthCheckAll()` — Run health checks across all providers
- `listAllModels()` — List available models across all providers
- `registerProvider(provider)` — Register custom providers at runtime
- Configurable: `enableFallback`, `lazyLoad`, `initTimeout`

```javascript
import { createProviderRouter } from 'nexus-dev-mmf';

const router = createProviderRouter({
  defaultProvider: 'zai',
  enableFallback: true,
  providers: {
    openai: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY },
    anthropic: { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY },
    google: { provider: 'google', apiKey: process.env.GEMINI_API_KEY },
  },
});

await router.initialize();

// Route by model registry — knows which provider to use
const result = await router.complete('gpt-4o', messages);
const result2 = await router.complete('claude-sonnet-4', messages);

// Explicit provider prefix
const result3 = await router.complete('openai/o3', messages);

// With fallback — if gpt-4o fails, try gemini-2.5-pro, then glm-5.2
const result4 = await router.completeWithFallback('gpt-4o', messages, {}, ['gemini-2.5-pro', 'glm-5.2']);
```

#### Expanded Model Registry (`src/core/models.ts`)

The model registry now includes **16 models across 4 providers**:

| Provider  | Models                                                     | Tiers                                      |
| --------- | ---------------------------------------------------------- | ------------------------------------------ |
| ZAI (GLM) | glm-5.2-1m, glm-5.2, glm-5.1, glm-5, glm-5v-turbo, glm-4.7 | flagship, standard, fast, creative, vision |
| OpenAI    | gpt-4o, gpt-4.1, gpt-4.1-mini, o3, o4-mini                 | flagship, standard                         |
| Anthropic | claude-opus-4, claude-sonnet-4, claude-haiku-3.5           | flagship, fast                             |
| Google    | gemini-2.5-pro, gemini-2.5-flash, gemini-2-flash           | flagship, fast                             |

- **`ModelProfile.provider`** — New required field (`ProviderId`) that maps each model to its provider
- **`getModelsByProvider(provider)`** — Get all models from a specific provider
- **`getModelProvider(modelId)`** — Get the provider for a given model ID
- All models include `design`, `code-review`, and `slope-detection` capabilities where appropriate

#### Custom Provider Interface

You can implement your own provider by implementing the `LLMProvider` interface:

```javascript
import { LLMProvider, ProviderId, ProviderConfig, ProviderMessage, ProviderCompletionOptions, ProviderCompletionResult } from 'nexus-dev-mmf';

class MyCustomProvider implements LLMProvider {
  readonly providerId = 'zai';  // or register a new ID
  readonly name = 'My Custom Provider';
  readonly supportedModels = ['my-model-1'];
  get isReady() { return true; }

  async initialize(config) { /* ... */ }
  async complete(model, messages, options) { /* ... */ }
  async healthCheck() { return true; }
  listModels() { return this.supportedModels; }
  supportsModel(id) { return this.supportedModels.includes(id); }
  async shutdown() { /* ... */ }
}

// Register at runtime
orch.getProviderRouter().registerProvider(new MyCustomProvider());
```

### 🔧 Changed

- **`ModelProfile`** — Added required `provider: ProviderId` field
- **`MODEL_REGISTRY`** — Expanded from 6 GLM models to 16 models across 4 providers
- **`ModelCapability`** — Added `'design'`, `'slope-detection'`, `'design-system'` capability types
- **`getModelsByProvider()`** — New function to filter models by provider
- **`getModelProvider()`** — New function to look up a model's provider
- **`package.json`** — Updated version to 4.0.0, added `openai`, `anthropic`, `google`, `gemini`, `claude`, `gpt`, `multi-provider`, `llm-router` keywords
- **`README.md`** — Updated with v4.0.0 multi-provider documentation, configuration examples, and provider-specific setup instructions
- **Main exports** (`src/index.ts`) — Added all provider exports: `LLMProvider`, `ProviderId`, `ProviderConfig`, `ProviderMessage`, `ProviderCompletionOptions`, `ProviderCompletionResult`, `ProviderTokenUsage`, `MultiProviderConfig`, `DEFAULT_MULTI_PROVIDER_CONFIG`, `ZAIProvider`, `OpenAIProvider`, `AnthropicProvider`, `GoogleProvider`, `ProviderRouter`, `createProviderRouter`

---

## [3.2.0] — 2026-06-15

### 🚀 Major New Feature: Design Skill with AI SLOPE Elimination

Integrated an 8-phase design pipeline that generates professional UI/UX designs and systematically detects/eliminates AI SLOPE (Systematic Lapses in Output Precision & Excellence) — the common patterns where AI-generated designs feel generic, predictable, and uninspired.

#### Architecture Overview

The design skill uses an **8-phase pipeline** that leverages Nexus's multi-model fusion for high-quality, AI-SLOPE-free design generation:

```
ANALYZE:   Extract requirements, constraints, and design domain
SEARCH:    BM25 search across 9 design sub-domains (600+ entries)
GENERATE:  Multi-model design generation with domain knowledge
SLOPE:     Detect AI SLOPE patterns across 10 categories
ELIMINATE: Re-generate with SLOPE elimination constraints
EVALUATE:  Score design quality (0-100) across 6 dimensions
REFINE:    Re-synthesize if quality below threshold
OUTPUT:    Final design specification with quality report
```

#### Design Engine (`src/design-skill/design-engine.ts`)

- **`DesignEngine`** — The core 8-phase design pipeline engine
- **`process(request)`** — Process a design request through the full pipeline
- **`createDesignEngine(config?)`** — Factory function
- Supports all 4 Nexus execution modes: `speed`, `quality`, `balanced`, `creative`

#### BM25 Search Engine (`src/design-skill/search-engine.ts`)

- **`DesignSearchEngine`** — BM25-powered search across the design knowledge base
- **`search(query, domain?, topK?)`** — Search for relevant design entries
- 9 design sub-domains with 600+ curated entries covering layouts, color systems, typography, interactions, accessibility, responsive patterns, animation, iconography, and design tokens

#### AI SLOPE Detection (`src/design-skill/types.ts`)

- **10 SLOPE categories**: Generic Templates, Color-by-Numbers, Layout Defaults, Cookie-Cutter Components, Placeholder Content, Uniform Spacing, Predictable Interactions, Default Typography, Stock Visual Language, Template Patterns
- Each category includes detection heuristics, severity scoring (1-5), and elimination strategies
- SLOPE score calculated as weighted average across all detected patterns

#### Design Knowledge Base (`src/design-skill/data/`)

- **`layout-patterns.json`** — 80+ layout patterns with responsive variants
- **`color-systems.json`** — 60+ color system definitions with accessibility ratings
- **`typography-systems.json`** — 50+ typography scale systems
- **`interaction-patterns.json`** — 70+ interaction and animation patterns
- **`accessibility-rules.json`** — 40+ accessibility compliance rules
- **`responsive-patterns.json`** — 50+ responsive design strategies
- **`animation-patterns.json`** — 60+ animation and transition patterns
- **`iconography-rules.json`** — 50+ icon design and usage rules
- **`design-tokens.json`** — 100+ design token definitions

#### Design CLI (`scripts/design-fusion.mjs`)

- Design generation from the command line with SLOPE elimination
- Flags: `--mode`, `--domain`, `--no-slope`, `--quality-threshold`, `--mtp`

```bash
node scripts/design-fusion.mjs "Design a SaaS dashboard with analytics"
node scripts/design-fusion.mjs --mode creative --domain dashboard "Design a fintech app"
node scripts/design-fusion.mjs --no-slope "Quick design without SLOPE check"
```

### 🔧 Changed

- **`ModelCapability`** — Added `'design'`, `'slope-detection'`, `'design-system'` to the capability union type
- **`MODEL_REGISTRY`** — Added `design`, `slope-detection`, `design-system` capabilities to appropriate models
- **`package.json`** — Updated version to 3.2.0, added `design-skill`, `ai-slope`, `ui-ux` keywords
- **Main exports** (`src/index.ts`) — Added all design skill exports: `DesignEngine`, `createDesignEngine`, `DesignSearchEngine`, plus all design types
- **`README.md`** — Updated with v3.2.0 design skill documentation and agentic tool integration guides for 15+ platforms

---

## [3.1.0] — 2026-06-15

### 🚀 Major New Feature: Code Review Engine (Adapted from Alibaba Open Code Review)

Integrated the code review concepts and prompts from [Alibaba Open Code Review](https://github.com/alibaba/open-code-review) into the Nexus multi-model fusion pipeline. This brings professional-grade, multi-model code review capabilities to Nexus-Dev MMFE, leveraging the same 6 GLM models for intelligent, multi-perspective code analysis.

#### Architecture Overview

The code review engine uses a **5-phase pipeline** that leverages Nexus's multi-model fusion for deeper, more reliable reviews:

```
PLAN:     Fast model (glm-5) analyzes risks → structured review plan
REVIEW:   Multiple models review in parallel with different specializations
SYNTH:    Flagship model (glm-5.2) merges & deduplicates comments
FILTER:   Independent model (glm-5.1) fact-checks comments against diff
RE-LOC:   Fast model re-locates comments that failed line matching
```

With MTP enabled, phases overlap:

- Plan + Review run concurrently (speculative review starts before plan completes)
- Synthesis begins as soon as first reviews arrive (incremental)
- Filter runs concurrently with synthesis

#### Code Review Engine (`src/code-review/review-engine.ts`)

- **`CodeReviewEngine`** — The core multi-model code review engine
- **`review(request)`** — Process a code review request through the 5-phase pipeline
- **`createCodeReviewEngine(config?)`** — Factory function
- Model assignments: Plan → glm-5, Review → mode-dependent, Synthesis → glm-5.2, Filter → glm-5.1, Re-location → glm-5

```javascript
import { createCodeReviewEngine } from 'nexus-dev-mmf';

const engine = createCodeReviewEngine({
  mode: 'balanced',
  enableFilterPhase: true,
});
const result = await engine.review({
  id: 'review-1',
  diff: unifiedDiffString,
  changedFiles: ['src/foo.ts'],
  currentFilePath: 'src/foo.ts',
  requirementBackground: 'This change adds user authentication',
});
console.log(result.comments); // Filtered, deduplicated review comments
console.log(result.summary); // { filesReviewed, totalComments, highSeverity, ... }
```

#### Language-Specific Review Rules (`src/code-review/rules.ts`)

- **14 language rule sets** adapted from open-code-review: default, TypeScript, JavaScript, Java, Kotlin, Rust, C++, C, Go, Python, properties, JSON, YAML, XML, ArkTS
- Each rule set contains detailed checklists covering correctness, security, performance, maintainability, and language-specific best practices
- **`detectLanguage(filePath)`** — Auto-detect review language from file extension
- **`getReviewRule(language)`** — Get the review checklist for a language
- **`getReviewRuleForFile(filePath)`** — Get the review rule auto-detected for a file

#### Prompt Templates (`src/code-review/prompts.ts`)

Adapted from open-code-review's `task_template.json`:

- **MAIN_REVIEW_SYSTEM** — Primary code review system prompt with strict focus rules
- **PLAN_REVIEW_SYSTEM** — Risk analysis and review planning prompt
- **REVIEW_FILTER_SYSTEM** — Fact-checking prompt (falsify, not verify principle)
- **RE_LOCATION_SYSTEM** — Line re-location prompt for unmatched comments
- **SYNTHESIS_PROMPT** — Multi-model comment deduplication and merging
- **`fillTemplate(template, values)`** — Template variable interpolation

#### Diff Parser (`src/code-review/diff-parser.ts`)

- **`parseDiff(diffText)`** — Parse unified diff into structured DiffHunk objects
- **`getChangedFiles(diffText)`** — Extract list of changed file paths
- **`findCodeInDiff(hunks, filePath, codeSnippet)`** — Locate code snippets in diff for comment anchoring
- **`getFileDiff(hunks, filePath)`** — Get reconstructed diff for a specific file
- **`getTotalChangedLines(hunks)`** — Count total changed lines (for plan phase threshold)

#### Code Review Types (`src/code-review/types.ts`)

- **`ReviewComment`** — A single review finding with severity, location, and suggestion
- **`DiffHunk`** / **`DiffLine`** — Parsed unified diff structure
- **`CodeReviewRequest`** — Input to the review engine (diff + context + options)
- **`CodeReviewResult`** — Output with comments, plan, summary, and metrics
- **`ReviewPlan`** / **`ReviewPlanIssue`** — Risk analysis plan from plan phase
- **`ReviewLanguage`** — 14 supported languages for review rules
- **`CodeReviewConfig`** — Configuration with `DEFAULT_CODE_REVIEW_CONFIG`

#### Code Review CLI (`scripts/code-review.mjs`)

- Multi-model code review from the command line
- Flags: `--diff`, `--file`, `--mode`, `--no-filter`, `--no-plan`, `--plan`, `--mtp`, `--rule`, `--background`

```bash
node scripts/code-review.mjs                       # Review staged changes
node scripts/code-review.mjs --diff HEAD~1         # Review last commit
node scripts/code-review.mjs --diff main...HEAD    # Review branch vs main
node scripts/code-review.mjs --mode quality --mtp  # Quality MTP review
```

### 🔧 Changed

- **`ModelCapability`** — Added `'code-review'` to the capability union type
- **All 6 models** — Added `'code-review'` to their capabilities arrays
- **`Decomposer`** — Updated capability options list to include `code-review`
- **`Orchestrator`** — Fixed TypeScript type error in MTP event callback (cast to `any`)
- **`package.json`** — Updated version to 3.1.0
- **Main exports** (`src/index.ts`) — Added all code review exports: `CodeReviewEngine`, `createCodeReviewEngine`, `getReviewRule`, `getReviewRuleForFile`, `detectLanguage`, `getSupportedLanguages`, `parseDiff`, `getChangedFiles`, `findCodeInDiff`, `fillTemplate`, plus all code review types

### 📄 Attribution

Code review prompts, rule checklists, and pipeline concepts adapted from [Alibaba Open Code Review](https://github.com/alibaba/open-code-review) (Apache-2.0 License). Key adaptations:

- Go agent loop replaced with Nexus multi-model parallel execution
- Single-model tool-calling replaced with multi-model fusion + synthesis
- Anthropic/OpenAI client replaced with `z-ai-web-dev-sdk`
- Memory compression removed (Nexus uses synthesis instead)
- Re-location and review filter preserved as separate pipeline phases
- Language rule checklists preserved verbatim

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
