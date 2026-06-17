# Tests — Complete Documentation

This document describes every test suite in the nexus-code codebase, what it covers, how to run it, and how to interpret results.

## Quick start

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run only real-API smoke tests (requires env vars)
OPENAI_API_KEY=sk-... npm run test:smoke

# Run a specific suite
npm test -- src/__tests__/commands.test.ts

# Run in watch mode (during development)
npx vitest
```

## Test framework

- **Runner:** [Vitest](https://vitest.dev/) v2.1.x
- **Environment:** Node.js (no jsdom — pure backend tests)
- **Coverage:** `@vitest/coverage-v8` (V8 native, fast)
- **Mocking:** `vi.mock()` for module mocks, `vi.fn()` for function mocks
- **Assertion library:** Vitest's built-in `expect` (Chai-compatible)

## Configuration

Test config lives in `vitest.config.ts`:
- **Include:** `src/__tests__/**/*.test.{ts,tsx}`
- **Timeout:** 30 seconds (MCP integration tests need time to spawn subprocesses)
- **Coverage thresholds:** 40% minimum for lines/functions/branches/statements
- **Coverage excludes:** `__tests__/`, `*.d.ts`, `index.tsx`, `bin/`, `App.tsx`, `components/`, `tui/` (TUI components are tested via `ink-testing-library` in `components.test.tsx`)

A custom Vite plugin `stripJsExtPlugin` resolves TypeScript `.js` import extensions to `.ts` source files — required because the codebase uses Node ESM convention (`import './foo.js'` in `.ts` files).

---

## Test suites

### 1. `config.test.ts` — 14 tests

**Covers:** `src/config/index.ts` + `src/config/schema.ts`

| Area | What's tested |
|---|---|
| Schema parsing | Valid config parses correctly; defaults fill for missing fields; invalid mode rejected; invalid provider kind rejected |
| Defaults | 3 default providers (zai, openai, anthropic); 6 builtin GLM models |
| Load/save round-trip | Save → load preserves all fields |
| API key stripping | `saveConfig()` never writes `apiKey` to disk |
| Env var merge | `OPENAI_API_KEY` env var auto-merged into provider config |
| Corrupt JSON | `loadConfig()` falls back to defaults on parse failure |
| Helper functions | `getActiveProvider()` returns correct provider; throws for unknown id; `getAllModels()` merges manual + builtin |

### 2. `registry.test.ts` — 8 tests

**Covers:** `src/models/registry.ts`

| Area | What's tested |
|---|---|
| Build registry | Returns builtin models when no manual/auto; merges auto-fetched with builtin |
| Merge precedence | Auto wins over builtin (no duplicates) |
| Manual add | `addManualModel()` adds new model; idempotent (no duplicates) |
| Manual remove | `removeManualModel()` removes by provider+id |
| Find model | `findModel()` locates by provider+id; returns undefined for nonexistent |
| Builtin integrity | All 6 builtin models have `providerId: 'zai'` |

### 3. `commands.test.ts` — 22 tests

**Covers:** `src/commands/builtin.ts` — all 20 builtin slash commands

| Area | What's tested |
|---|---|
| Registry | 20 builtin commands; every command has name + description + usage; names are unique |
| `findCommand` | Finds by name; finds by alias; returns undefined for unknown; handles no-args |
| `/mode` | Shows current mode; sets valid mode; rejects invalid mode |
| `/provider` | Lists providers; switches to valid id; rejects unknown |
| `/mmfe` | Shows current state; toggles on/off |
| `/add` | Adds model with label; rejects missing args; rejects unknown provider |
| `/help` | Lists all commands; shows detail for specific command; rejects unknown |
| Unknown commands | Returns "Unknown command" error |

### 4. `session.test.ts` — 7 tests

**Covers:** `src/session/store.ts`

| Area | What's tested |
|---|---|
| `newSession` | Returns session with sensible defaults; accepts overrides |
| Save/load round-trip | `saveSession()` + `loadSession()` preserves messages + mode |
| Load nonexistent | Returns null |
| List sessions | `listSessions()` includes saved sessions |
| Delete session | `deleteSession()` removes; returns false for nonexistent |

### 5. `modes.test.ts` — 7 tests

**Covers:** `src/orchestrator/modes.ts`

| Area | What's tested |
|---|---|
| Mode list | Exactly 4 modes: speed, balanced, quality, creative |
| Metadata | Every mode has label, tagline, preferredModels, color |
| Mode preferences | Balanced prefers all 5 standard GLM models; quality prefers 2 flagships; creative biases toward glm-4.7 |
| Validation | `isMode()` validates correctly; `describeMode()` returns correct format |

### 6. `tools.test.ts` — 15 tests

**Covers:** `src/tools/protocol/index.ts` + `src/tools/builtin.ts`

| Area | What's tested |
|---|---|
| `ToolRegistry` | Starts empty; registers + retrieves; rejects duplicates; unregisters; clears |
| Execute | Calls handler + returns ok status; returns error for unknown tool; catches handler errors |
| `toToolMessage` | Converts tool call to ChatMessage with role='tool' |
| Schema converters | `toOpenAITools()` wraps in function format; `toAnthropicTools()` uses input_schema format |
| Builtin tools | 5 tools (read_file, write_file, shell, diff, apply_diff); unique names; all have handlers |

### 7. `retry.test.ts` — 5 tests

**Covers:** `src/providers/retry.ts`

| Area | What's tested |
|---|---|
| Success | First-attempt success when no errors |
| Retryable status | Retries on 429 + eventually succeeds |
| Non-retryable | Fails fast on 400 (no retries) |
| Max retries | Gives up after maxRetries cap |
| `onRetry` callback | Invoked with attempt number + error + next delay |

### 8. `orchestrator.test.ts` — 6 tests

**Covers:** `src/orchestrator/index.ts` — tool-call execution loop

| Area | What's tested |
|---|---|
| No tool calls | Returns response immediately when no toolCalls in response |
| Single tool call | Executes + continues with follow-up response |
| Multi-round chain | Chains 3 tool rounds, each executing + re-calling |
| `maxToolRounds` cap | Stops at maxRounds even if model keeps calling tools |
| Error handling | Tool handler errors surface as `status: 'error'` |
| No registry | Doesn't execute tools when no `toolRegistry` provided |

### 9. `providers.test.ts` — 14 tests

**Covers:** `src/providers/openai.ts` + `src/providers/anthropic.ts` — with mocked HTTP

| Area | What's tested |
|---|---|
| OpenAI request | Correct model + messages; includes tools when provided |
| OpenAI response parsing | Parses tool_calls; handles malformed arguments |
| OpenAI tool messages | Converts role='tool' to tool_call_id format |
| OpenAI errors | Throws ProviderError on API failure |
| OpenAI fetchModels | Calls `/v1/models` |
| Anthropic request | System separated from turns; tools with input_schema.type=object |
| Anthropic response | Parses tool_use blocks |
| Anthropic tool messages | Converts to tool_result blocks |
| Anthropic fetchModels | Sends x-api-key + anthropic-version headers; handles 404 |
| Anthropic missing key | Throws clear error |

### 10. `command-palette.test.ts` — 10 tests

**Covers:** `src/components/CommandPalette.tsx` — pure logic

| Area | What's tested |
|---|---|
| Entries | 20 commands; unique names; every entry has name + description + preview |
| `filterEntries` | Returns all when empty query; matches by name (case-insensitive); matches by description; matches multiple; returns empty for no match; matches partial strings; handles custom entry lists |

### 11. `mcp.test.ts` — 6 tests

**Covers:** `src/mcp/client.ts` — **live integration tests**

| Area | What's tested |
|---|---|
| Live filesystem MCP | Connects to `@modelcontextprotocol/server-filesystem` via npx; lists tools (read_file, list_directory); invokes a tool through the registered handler |
| Connection failures | Reports error when command doesn't exist; reports error when stdio command missing; reports error when http URL missing |
| `listStatuses` | Returns all configured servers |

### 12. `history.test.ts` — 9 tests

**Covers:** `src/session/history.ts`

| Area | What's tested |
|---|---|
| Load | Returns empty when file doesn't exist |
| Append | Adds entry + persists; skips consecutive duplicates; allows non-consecutive duplicates |
| Clear | Empties the file |
| Search | Returns all with empty query; filters by substring (case-insensitive); returns empty for no match |
| Provider stamping | Preserves providerId when provided |

### 13. `theme.test.ts` — 9 tests

**Covers:** `src/tui/theme.ts`

| Area | What's tested |
|---|---|
| Theme list | 3 themes (tech-dark, editorial-light, hacker-terminal) |
| Token completeness | Every theme has all 12 required color tokens (bg, bgSoft, bgElev, line, primary, primaryDim, primaryMute, accent, accent2, success, warn, danger) |
| Default | Defaults to tech-dark |
| Switching | `setTheme()` switches active theme; `getTheme()` returns active tokens |
| Distinct palettes | All 3 themes have different bg + accent colors |
| Hacker theme | Monochrome-ish (accent = primary = success) |
| Luminance | editorial-light bg luminance > 0.5; tech-dark bg luminance < 0.2 |

### 14. `autocomplete.test.ts` — 17 tests

**Covers:** Tab autocomplete logic (pure function extracted from App.tsx)

| Area | What's tested |
|---|---|
| Slash command completion | `/mo` → mode + model; `/h` → help + history; single match; unknown prefix; aliases; caps at 8; case-insensitive; `/m` matches 4 commands |
| History completion | Most recent first; dedupes; case-insensitive; empty when no match; empty when history empty; caps at 8; prefix-only matching |
| Empty input | Returns empty (no slash, no history); returns all history |

### 15. `pipe.test.ts` — 3 tests

**Covers:** `src/pipe.ts` — interface shape

| Area | What's tested |
|---|---|
| `PipeOptions` | Valid interface; all fields optional; mode accepts all 4 values |

### 16. `components.test.tsx` — 16 tests

**Covers:** `src/components/StatusBar.tsx` + `HelpOverlay.tsx` + `ChatView.tsx` — via `ink-testing-library`

| Area | What's tested |
|---|---|
| StatusBar | Renders config labels; streaming indicator; mmfe:off state; quality score; model used; token counts |
| HelpOverlay | Renders all command names; renders with border |
| ChatView | Empty state; user message; assistant message with model + latency; streaming buffer; tool message; routing decisions (shown/hidden); multi-message ordering |

### 17. `plugins.test.ts` — 9 tests

**Covers:** `src/plugins/loader.ts`

| Area | What's tested |
|---|---|
| `PLUGINS_DIR` | Located under `~/.nexus/plugins` |
| `ensurePluginsDir` | Creates directory if missing |
| `discoverPlugins` | Returns empty when no plugins |
| `loadPlugin` | Returns error for nonexistent file; loads valid plugin with tools + commands; handles missing default export; handles syntax errors; filters out tools without handlers |
| `loadAllPlugins` | Aggregates multiple plugins |
| `writeExamplePlugin` | Creates example.js; idempotent (doesn't overwrite) |

### 18. `wizard.test.ts` — 5 tests

**Covers:** `src/wizard.ts` — non-interactive mode

| Area | What's tested |
|---|---|
| Non-interactive | Generates valid config; doesn't write API keys; refuses overwrite |
| Helpers | `configExists()` returns boolean; `ensureConfigDir()` doesn't throw |

### 19. `wizard-interactive.test.ts` — 7 tests

**Covers:** `src/wizard.ts` — interactive mode with mocked readline

| Area | What's tested |
|---|---|
| Interactive mode | `vi.mock('node:readline')` injects canned answers; verifies user choices written to config; verifies overwrite refusal |
| Edge cases | Non-interactive writes all 3 providers; refuses overwrite; doesn't write API keys; includes builtin GLM models for zai |

### 20. `new-commands.test.ts` — 9 tests

**Covers:** `/diff`, `/branch`, `/init`, `/plugins` commands

| Area | What's tested |
|---|---|
| Registry | All 4 new commands present in REGISTRY |
| `findCommand` | Locates each new command with args |
| Command shape | Every new command has `run()` + description + usage |
| `/diff` | Shows usage when no path; reports file not found; shows git diff when file exists |
| `/branch` | Shows usage when no target; reports not found for unknown id; branches by numeric index; branches by message id |

### 21. `web.test.ts` — 11 tests

**Covers:** `src/web.ts` — **live HTTP integration tests**

| Area | What's tested |
|---|---|
| Server boot | `runWebServer` is a function; boots HTTP server; serves HTML UI at `/` |
| HTML UI | Contains `<!DOCTYPE html>`, `nexus-code`, all DOM element IDs (#messages, #input, #send, #provider, #mode, #no-mmfe, #clear); uses tech-dark theme colors; uses fetch + ReadableStream (not EventSource) |
| REST endpoints | `GET /api/config` returns config; `GET /api/messages` returns array; `POST /api/clear` returns ok; `POST /api/command` executes slash commands; `POST /api/command` returns 400 when missing; `POST /api/chat` returns 400 when missing; unknown paths return 404 |

### 22. `plugin-commands.test.ts` — 15 tests

**Covers:** Plugin command registration + `runSlash` integration

| Area | What's tested |
|---|---|
| `registerPluginCommand` | Adds to allCommands(); refuses duplicates; refuses builtin name collisions |
| `unregisterPluginCommand` | Removes by name; returns false for unknown |
| `clearPluginCommands` | Wipes all; leaves REGISTRY intact |
| `runSlash` integration | Executes plugin commands with args; with no args; returns Unknown for unregistered; `/help` lists plugin commands with `(plugin)` marker; `/help <cmd>` shows detail |
| End-to-end | Drops real `.mjs` file → `loadPlugin()` → `registerPluginCommand()` → `runSlash('/plugin_echo hello')` → verifies `ECHO: hello` |
| Plugin tool handler | Loads plugin with `plugin_calculate` tool, calls handler with `{a:6, b:7}` → verifies `42` |
| Multi-plugin | `loadAllPlugins` aggregates 3 plugins with mixed tools+commands |
| `discoverPlugins` | `.txt` files ignored, only `.js`/`.mjs` returned |

### 23. `smoke-real.test.ts` — 8 tests (skipped by default)

**Covers:** Real API calls to OpenAI, Anthropic, Z.ai

**Skipped unless env vars are set:**
- `OPENAI_API_KEY` → runs OpenAI smoke tests
- `ANTHROPIC_API_KEY` → runs Anthropic smoke tests
- `ZAI_API_KEY` → runs Z.ai smoke tests

| Area | What's tested |
|---|---|
| OpenAI | Chat completion; `streamChat()` token streaming; `/v1/models` fetch |
| Anthropic | Chat with system prompt; `streamChat()` token streaming; `/v1/models` fetch |
| Z.ai | Direct chat (MMFE bypassed); builtin model roster fetch |

Run with:
```bash
OPENAI_API_KEY=sk-... ANTHROPIC_API_KEY=sk-ant-... npm run test:smoke
```

---

## Test statistics

| Metric | Value |
|---|---|
| Total test files | 23 (22 passing + 1 skipped when no env vars) |
| Total tests | 238 (230 passing + 8 skipped) |
| Coverage (lines) | 64.65% |
| Coverage (functions) | 78% |
| Coverage (branches) | 62.91% |
| Coverage threshold | 40% (passes) |
| Test timeout | 30 seconds |
| Typical run time | ~23 seconds (MCP integration tests dominate) |

## Continuous integration

The `.github/workflows/ci.yml` workflow runs the full test suite on every push and pull request, matrixed across Node.js 18, 20, and 22. Coverage artifacts are uploaded from the Node 20 run.
