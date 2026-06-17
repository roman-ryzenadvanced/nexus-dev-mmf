# Changelog

All notable changes to **nexus-dev-mmf** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.7] — 2026-06-17

### Changed — rebrand to **Nexus Code**

Full product rebrand from "nexus-tui" / "Nexus CLI" to **"Nexus Code"** / `nexus-code`. This is a pure branding rename — no functional changes.

#### Package + binary

- **CHANGED**: npm package name: `nexus-tui` → `nexus-code`
- **CHANGED**: Binary alias: adds `nexus-code` alongside the existing `nexus` primary
- **CHANGED**: `package.json` `description`: now starts with "Nexus Code — terminal AI coding assistant"
- **CHANGED**: Repository `directory` field: `packages/nexus-tui` → `packages/nexus-code`
- **CHANGED**: npm badge in README now points to `nexus-code`

#### In-app branding

- **CHANGED**: TUI header: `nexus-tui` → `nexus-code`
- **CHANGED**: Help overlay title: `nexus-tui — slash commands` → `nexus-code — slash commands`
- **CHANGED**: `/status` output header: `=== nexus-tui status ===` → `=== nexus-code status ===`
- **CHANGED**: Web UI HTML `<title>`: `nexus-tui · web` → `nexus-code · web`
- **CHANGED**: Web UI `<h1>`: `nexus-tui` → `nexus-code`
- **CHANGED**: Web UI server boot banner: `nexus-tui web mode` → `nexus-code web mode`
- **CHANGED**: Config wizard banner: `=== nexus-tui config wizard ===` → `=== nexus-code config wizard ===`
- **CHANGED**: Pipe mode error messages: `nexus-tui pipe mode` → `nexus-code pipe mode`
- **CHANGED**: Boot error messages: `Failed to boot nexus-tui` → `Failed to boot nexus-code`
- **CHANGED**: MCP `clientInfo.name`: `nexus-tui` → `nexus-code` (sent to MCP servers during handshake)
- **CHANGED**: Plugin example file comment: `Example nexus-tui plugin` → `Example nexus-code plugin`
- **CHANGED**: All "API keys are NEVER written to disk by nexus-tui" → "by nexus-code"

#### Documentation

- **CHANGED**: README — "terminal UI client (`nexus-tui`)" → "**Nexus Code** — a terminal AI coding assistant (`nexus-code`)"
- **CHANGED**: README — all `packages/nexus-tui/` paths → `packages/nexus-code/`
- **CHANGED**: README — `npm install -g nexus-tui` → `npm install -g nexus-code`
- **CHANGED**: README — documentation links renamed from "TUI —" prefix to "Nexus Code —"
- **CHANGED**: `docs/providers.md`: `nexus-tui supports` → `nexus-code supports`
- **CHANGED**: `docs/mcp.md`: `nexus-tui supports` → `nexus-code supports`

#### CI/CD

- **CHANGED**: All 3 GitHub Actions workflows updated to reference `packages/nexus-code/` instead of `packages/nexus-tui/`
- **CHANGED**: `publish.yml` npm summary: `nexus-tui@version` → `nexus-code@version`
- **CHANGED**: `release.yml` GitHub Release name: `nexus-tui vX.Y.Z` → `nexus-code vX.Y.Z`
- **CHANGED**: `publish.sh` script: all path references + commit message + tag instructions updated

#### Type definitions

- **CHANGED**: `src/types.ts` header comment: `nexus-tui — core type definitions` → `nexus-code — core type definitions`

### Migration notes

v1.1.6 → v1.1.7 is a **breaking rename** for npm consumers:

- `npm install -g nexus-tui` → `npm install -g nexus-code`
- The `nexus` binary still works — no change for existing CLI users
- The `nexus-code` binary is new (alias for `nexus`)
- Config file location (`~/.nexus/config.json`) is unchanged
- All slash commands, themes, plugins, sessions are unchanged
- If you `import` from `'nexus-tui'` in JS code, update to `'nexus-code'`

---

## [1.1.6] — 2026-06-17

### Added — close the gaps

Final closure pass: plugin commands are now wired into the slash command dispatcher (so `/help` lists them), web UI mode has full HTTP integration tests, the config wizard's interactive mode is tested with mocked readline, and the plugin loader has end-to-end tests verifying commands work via `runSlash()`. Coverage jumped from 56% to 65%.

#### Plugin commands wired into slash command dispatcher

- **NEW**: `PLUGIN_COMMANDS` mutable array — holds commands registered at runtime by plugins
- **NEW**: `registerPluginCommand(cmd)` — idempotent registration, refuses name collisions with builtin commands or existing plugin commands
- **NEW**: `unregisterPluginCommand(name)` — removes a plugin command by name
- **NEW**: `allCommands()` — returns `[...REGISTRY, ...PLUGIN_COMMANDS]` (used by `findCommand`, `/help`, `/status`)
- **NEW**: `clearPluginCommands()` — test helper, wipes the plugin command array
- **FIX**: `findCommand()` now searches both builtin + plugin commands — previously plugin commands loaded but weren't reachable via `/cmd`
- **FIX**: `/help` now lists plugin commands with a `(plugin)` marker — previously only builtin commands were shown
- **FIX**: `/help <plugin-cmd>` now shows detail for plugin commands (was returning "Unknown command")
- **NEW**: `App.tsx` plugin loader effect now calls `registerPluginCommand()` for each command in every loaded plugin — tools AND commands both register on boot

#### Web UI tests (11 new tests)

- **NEW**: `src/__tests__/web.test.ts` — full HTTP integration test suite for `nexus --web`
- **NEW**: Boots a real HTTP server on a random port, fires real `fetch()` requests against every endpoint
- **NEW**: Tests cover:
  - HTML UI is served at `/` with all expected DOM elements (`#messages`, `#input`, `#send`, `#provider`, `#mode`, `#no-mmfe`, `#clear`)
  - HTML contains tech-dark theme colors (`#0A0E1A`, `#06B6D4`, `#8B5CF6`)
  - HTML uses fetch + ReadableStream (NOT `new EventSource`)
  - `GET /api/config` returns version, activeProviderId, providers array with `hasKey` field
  - `GET /api/messages` returns array (empty initially)
  - `POST /api/clear` returns `{ ok: true }`
  - `POST /api/command` executes slash commands (verifies `/mode` returns "balanced")
  - `POST /api/command` returns 400 when command is missing
  - `POST /api/chat` returns 400 when message is missing
  - Unknown paths return 404 with `{ error: 'Not found' }`

#### Config wizard interactive-mode tests (7 new tests)

- **NEW**: `src/__tests__/wizard-interactive.test.ts` — uses `vi.mock('node:readline')` to inject canned answers
- **NEW**: Verifies the wizard prompts for: provider, model, mode, MMFE on/off, theme
- **NEW**: Verifies user choices are written to the config file
- **NEW**: Verifies overwrite refusal when user answers 'n' to the overwrite prompt
- **NEW**: Edge-case tests: `configExists()` returns boolean, `ensureConfigDir()` doesn't throw, non-interactive mode writes all 3 providers, non-interactive mode refuses overwrite, non-interactive mode doesn't write API keys, non-interactive mode includes builtin GLM models for zai

#### Plugin loader integration tests (15 new tests)

- **NEW**: `src/__tests__/plugin-commands.test.ts` — comprehensive coverage of the plugin command registration system
- **NEW**: `registerPluginCommand` tests: adds to `allCommands()`, refuses duplicates, refuses collisions with builtin names
- **NEW**: `unregisterPluginCommand` tests: removes by name, returns false for unknown
- **NEW**: `clearPluginCommands` test: wipes all plugin commands, leaves builtin `REGISTRY` intact
- **NEW**: `runSlash` integration: executes plugin commands with args, executes with no args, returns "Unknown command" for unregistered, `/help` lists plugin commands with `(plugin)` marker, `/help <plugin-cmd>` shows detail
- **NEW**: End-to-end plugin load → register → execute: drops a real `.mjs` file in `~/.nexus/plugins/`, loads it via `loadPlugin()`, registers the command via `registerPluginCommand()`, executes via `runSlash('/plugin_echo hello')` → verifies `ECHO: hello`
- **NEW**: Plugin tool handler test: loads a plugin with a `plugin_calculate` tool, calls the handler with `{a:6, b:7}` → verifies `42`
- **NEW**: Multi-plugin load test: drops 3 plugins with mixed tools+commands, verifies `loadAllPlugins` aggregates them correctly
- **NEW**: `discoverPlugins` filter test: `.txt` files are ignored, only `.js`/`.mjs` returned

#### Coverage improvement

- **NEW**: Coverage jumped from **56% → 65%** (lines) — well above the 40% threshold
- **NEW**: `wizard.ts` now at ~87% coverage (was 0%)
- **NEW**: `plugins/loader.ts` now at ~75% coverage (was minimal)
- **NEW**: `web.ts` now exercises all HTTP endpoints + HTML rendering
- **NEW**: `commands/builtin.ts` plugin command infrastructure fully covered

#### Tests (230 passing, 8 skipped — up from 196 in v1.1.5)

| Suite | Tests | Coverage |
|---|---|---|
| `config.test.ts` | 14 | schema, load/save, env-merge |
| `registry.test.ts` | 8 | merge precedence, manual add/remove |
| `commands.test.ts` | 22 | all 20 builtin commands, aliases, errors |
| `session.test.ts` | 7 | newSession, save/load, list, delete |
| `modes.test.ts` | 7 | 4 modes, metadata, validation |
| `tools.test.ts` | 15 | ToolRegistry, error isolation, schema converters |
| `retry.test.ts` | 5 | retryable errors, maxRetries, onRetry |
| `orchestrator.test.ts` | 6 | tool-call loop, maxToolRounds, no-registry bypass |
| `providers.test.ts` | 14 | OpenAI + Anthropic request/response with mocked HTTP |
| `command-palette.test.ts` | 10 | filterEntries pure function |
| `mcp.test.ts` | 6 | Live filesystem MCP server + failure handling |
| `history.test.ts` | 9 | load/append/clear/search, duplicate suppression |
| `theme.test.ts` | 9 | 3 themes, distinct palettes, luminance checks |
| `autocomplete.test.ts` | 17 | slash command completion, history completion |
| `pipe.test.ts` | 3 | PipeOptions interface |
| `components.test.tsx` | 16 | StatusBar, HelpOverlay, ChatView Ink rendering |
| `plugins.test.ts` | 9 | loadPlugin, loadAllPlugins, writeExamplePlugin |
| `wizard.test.ts` | 5 | non-interactive mode basics |
| `wizard-interactive.test.ts` | 7 | mocked readline, edge cases |
| `new-commands.test.ts` | 9 | /diff, /branch, /init, /plugins |
| `web.test.ts` | 11 | HTTP server, all endpoints, HTML shape |
| `plugin-commands.test.ts` | 15 | register/unregister, runSlash integration, end-to-end |
| `smoke-real.test.ts` | 8 skipped | Real OpenAI + Anthropic + Z.ai calls (env-gated) |

### Migration notes

v1.1.5 → v1.1.6 is a drop-in upgrade:

- No breaking API changes
- Plugin commands now appear in `/help` automatically (previously loaded but invisible)
- All new tests are additive — no existing tests changed
- Coverage threshold unchanged (40%) — current 65% well above

---

## [1.1.5] — 2026-06-17

### Added — full feature parity pass

8-item backlog cleared: `/diff` command, multi-line input, config wizard + `nexus init`, plugin system, session branching, web UI mode, real Ink component tests, plus 44 new tests. The TUI is now feature-complete relative to the original opencode/MiMo-Code/better-clawd inspiration set.

#### `/diff` slash command

- **NEW**: `/diff <path> [against]` — shows git diff for a file (against `HEAD` by default, or any ref like `HEAD~1`)
- **NEW**: Falls back to file stats (size + mtime) when no git diff is available
- **NEW**: Reports clear error messages for missing files or git failures

#### Multi-line input

- **NEW**: `Shift+Enter` inserts a newline — compose multi-line prompts without submitting
- **NEW**: Status bar shows `N lines · Shift+Enter for newline · Enter to submit` when input is multi-line
- **NEW**: Single-line behavior unchanged (Enter submits as before)

#### Config wizard + `nexus init`

- **NEW**: `src/wizard.ts` — interactive (or `--yes` non-interactive) config generator
- **NEW**: `nexus init` CLI subcommand — generates `~/.nexus/config.json` interactively
- **NEW**: `nexus init --yes` — non-interactive mode, accepts all defaults
- **NEW**: `/init` slash command — re-runs the wizard from inside the TUI
- **NEW**: Prompts for: default provider, default model, MMFE mode, MMFE on/off, theme
- **NEW**: Always includes all 3 default providers (zai, openai, anthropic) so switching is easy later
- **NEW**: API keys NEVER written to disk — wizard explicitly documents env-var approach
- **NEW**: Refuses to overwrite existing config in non-interactive mode (use `--force` to override)

#### Plugin system

- **NEW**: `src/plugins/loader.ts` — discovers + loads custom tools + commands from `~/.nexus/plugins/*.js` (or `.mjs`)
- **NEW**: Each plugin default-exports `{ name?, tools?, commands? }` — tools get registered with the `ToolRegistry`, commands get added to the slash command registry
- **NEW**: `ensurePluginsDir()` creates `~/.nexus/plugins/` on boot
- **NEW**: `writeExamplePlugin()` drops a sample `example.js` (with `timestamp` tool + `ping` command) when no plugins exist
- **NEW**: `/plugins` slash command — lists loaded plugins with tool/command counts + errors
- **NEW**: Plugin load failures (syntax errors, missing default export) are caught and surfaced via `/plugins` — they don't crash the TUI
- **NEW**: Tools without handlers are filtered out; commands without `run` functions are filtered out

#### Session branching

- **NEW**: `/branch <messageId | index>` — forks the conversation from a past message
- **NEW**: Accepts either a message id (`msg_123`) or a 1-based numeric index (`5`)
- **NEW**: Truncates the transcript to everything before the target message
- **NEW**: Returns clear "Kept N message(s), dropped M" summary
- **NEW**: Suggests `/save` first if you want to preserve the original session

#### Web UI mode

- **NEW**: `nexus --web [--port=3000]` — boots a local HTTP server with a browser-based chat UI
- **NEW**: `src/web.ts` — `runWebServer()` with full HTTP server + SSE streaming
- **NEW**: Single-page HTML/CSS/JS UI served at `/` — tech-dark theme matching the TUI
- **NEW**: REST endpoints:
  - `GET /api/config` — current provider + model + mode info
  - `GET /api/messages` — message history
  - `POST /api/chat` — SSE-streamed chat completion (tokens arrive as `data: {"type":"delta","delta":"..."}` events)
  - `POST /api/command` — slash command execution
  - `POST /api/clear` — clear transcript
- **NEW**: UI features:
  - Provider + mode + MMFE toggle selectors in header
  - Streaming token-by-token rendering
  - Markdown code block rendering
  - Tool call display (`⚙ tool_name(args) → status`)
  - Quality score badge on completion
  - Clear button
  - Multi-line input (Shift+Enter for newline)
  - Slash command support

#### Real Ink component tests

- **NEW**: `src/__tests__/components.test.tsx` — 16 tests covering `<StatusBar>`, `<HelpOverlay>`, `<ChatView>`
- **NEW**: StatusBar tests verify mmfe/mode/provider/model labels, streaming indicator, quality score, latency, model used, token counts
- **NEW**: ChatView tests verify empty state, user/assistant/tool messages, streaming buffer, routing decisions (shown/hidden), multi-message ordering
- **NEW**: HelpOverlay test verifies all command names render with border

#### Other improvements

- **NEW**: StatusBar now renders token counts (`42↑ 17↓`) when `lastMessage.tokens` is present
- **FIX**: `ChatView` streaming indicator no longer uses `color.dim()` (which broke with the theme proxy) — uses `<Text color>` instead

#### Tests (196 passing, 8 skipped — up from 152 in v1.1.4)

| Suite | Tests | Coverage |
|---|---|---|
| `config.test.ts` | 14 | schema, load/save, env-merge |
| `registry.test.ts` | 8 | merge precedence, manual add/remove |
| `commands.test.ts` | 22 | all 20 slash commands, aliases, errors |
| `session.test.ts` | 7 | newSession, save/load, list, delete |
| `modes.test.ts` | 7 | 4 modes, metadata, validation |
| `tools.test.ts` | 15 | ToolRegistry, error isolation, schema converters |
| `retry.test.ts` | 5 | retryable errors, maxRetries, onRetry |
| `orchestrator.test.ts` | 6 | tool-call loop, maxToolRounds, no-registry bypass |
| `providers.test.ts` | 14 | OpenAI + Anthropic request/response with mocked HTTP |
| `command-palette.test.ts` | 10 | filterEntries pure function |
| `mcp.test.ts` | 6 | Live filesystem MCP server + failure handling |
| `history.test.ts` | 9 | load/append/clear/search, duplicate suppression |
| `theme.test.ts` | 9 | 3 themes, distinct palettes, luminance checks |
| `autocomplete.test.ts` | 17 | slash command completion, history completion |
| `pipe.test.ts` | 3 | PipeOptions interface |
| `components.test.tsx` | 16 | StatusBar, HelpOverlay, ChatView Ink rendering |
| `plugins.test.ts` | 9 | loadPlugin, loadAllPlugins, writeExamplePlugin, error handling |
| `wizard.test.ts` | 5 | non-interactive mode, key stripping, overwrite refusal |
| `new-commands.test.ts` | 9 | /diff, /branch, /init, /plugins discovery + execution |
| `smoke-real.test.ts` | 8 skipped | Real OpenAI + Anthropic + Z.ai calls (env-gated) |

#### Slash command registry (now 20 commands)

Added 4 new commands: `/diff`, `/branch`, `/init`, `/plugins`.

### Migration notes

v1.1.4 → v1.1.5 is a drop-in upgrade:

- No breaking API changes
- `nexus init` is a new subcommand — doesn't affect existing `nexus` invocation
- `nexus --web` is opt-in — doesn't affect TUI mode
- Plugin directory (`~/.nexus/plugins/`) is created automatically on first run if missing
- Multi-line input (Shift+Enter) doesn't change single-line behavior
- All new slash commands are additive — no existing commands changed

---

## [1.1.4] — 2026-06-17

### Added — CI/CD + theming + autocomplete + pipe mode

End-to-end CI/CD pipeline (3 GitHub Actions workflows), three TUI color themes with runtime switching, tab autocomplete for slash commands and input history, and pipe mode for scripting (`echo "prompt" | nexus`). Plus Anthropic streaming tool-call capture, coverage thresholds, and lazy provider client construction.

#### CI/CD — three GitHub Actions workflows

- **NEW**: `.github/workflows/ci.yml` — runs typecheck + lint + build + test on Node 18, 20, 22 for every push/PR touching `packages/nexus-tui/**`. Uploads coverage artifact on Node 20.
- **NEW**: `.github/workflows/publish.yml` — on `v*.*.*` tag push: installs, typechecks, lints, builds, tests, then `npm publish --provenance --access public`. Requires `NPM_PUBLISH_TOKEN` secret + `npm-publish` environment.
- **NEW**: `.github/workflows/release.yml` — on `v*.*.*` tag push: extracts the matching section from `CHANGELOG.md` and creates a GitHub Release with those notes.
- **NEW**: All three workflows use `working-directory: packages/nexus-tui` so they're scoped correctly for the monorepo layout.

#### Theming — three palettes + runtime switching

- **NEW**: `src/tui/theme.ts` rewritten with three named themes:
  - `tech-dark` (default) — cyan + violet on deep navy
  - `editorial-light` — slate + indigo on off-white
  - `hacker-terminal` — phosphor green on pure black
- **NEW**: `setTheme(name)`, `getThemeName()`, `listThemes()`, `getTheme()` exports
- **NEW**: `/theme [name]` slash command — list themes, switch active, persist to `config.ui.theme`
- **NEW**: `App.tsx` applies persisted theme on boot + whenever `config.ui.theme` changes via `useEffect`
- **NEW**: `color` helper now uses a `Proxy`-style getter pattern so `setTheme()` takes effect immediately without re-importing modules

#### Tab autocomplete

- **NEW**: `onTab` prop on `<InputBox>` — receives current input, returns string array of candidates
- **NEW**: `handleTab` in `App.tsx` — slash command completion (matches command names + aliases, case-insensitive) + history-based completion for free text (most recent first, deduped, capped at 8)
- **NEW**: Tab cycling — when multiple candidates match, repeated Tab presses cycle through them
- **NEW**: Candidates cleared on any other keypress or on submit

#### Pipe mode

- **NEW**: `src/pipe.ts` — `runPipe()` function: reads all of stdin as prompt, sends one chat completion, prints response to stdout, exits
- **NEW**: `bin/nexus.js` detects pipe mode automatically when stdin is not a TTY (or `--pipe` flag is set)
- **NEW**: Supports all CLI overrides (`--provider`, `--model`, `--mode`, `--no-mmfe`, `--config`)
- **NEW: Composes stdin + CLI arg prompt** — `cat code.ts | nexus "explain this"` concatenates them with a separator
- **NEW**: Streaming by default — tokens written to stdout as they arrive
- **NEW**: Exit code 1 if any tool call in the response errored, 0 otherwise
- **NEW**: Tool registry wired in — pipe mode can call builtin tools (read_file, write_file, shell, diff, apply_diff)

#### Anthropic streaming tool-call capture

- **FIX**: `AnthropicProvider.streamChat()` now extracts `tool_use` content blocks from `finalMessage()` after streaming completes — returns them as `ChatMessage.toolCalls` in the final `ChatResponse`
- **NEW**: Also captures `usage` (input/output tokens) from the final message

#### Coverage thresholds

- **NEW**: `vitest.config.ts` coverage config with enforced minimums: 40% lines, 40% functions, 35% branches, 40% statements
- **NEW**: `npm run test:coverage` script — runs tests with coverage + threshold enforcement
- **NEW**: Coverage excludes TUI components (App.tsx, components/, tui/) since they require a full Ink testing rig
- **NEW**: Current coverage: **61% lines** — well above the 40% threshold
- **NEW**: Coverage reporter outputs `text`, `json-summary`, and `html`

#### Lazy provider client construction

- **FIX**: `OpenAIProvider` and `AnthropicProvider` now defer SDK client construction until first use (via a private `get client()` accessor) — previously the OpenAI/Anthropic SDK constructor would throw on `new Provider()` if no API key was set, crashing the entire provider registry. Now the registry can be built without any API keys, and the error surfaces only when the user actually tries to use that provider.
- **NEW**: `npm run test:smoke` script — runs only the env-gated smoke tests (`src/__tests__/smoke-real.test.ts`)

#### README badges

- **NEW**: 5 shields.io badges at the top of README: CI status, npm version, coverage %, license, Node version requirement

#### Tests (152 passing, 8 skipped — up from 123 in v1.1.3)

| Suite | Tests | Coverage |
|---|---|---|
| `config.test.ts` | 14 | schema, load/save, env-merge |
| `registry.test.ts` | 8 | merge precedence, manual add/remove |
| `commands.test.ts` | 22 | all 16 slash commands, aliases, errors |
| `session.test.ts` | 7 | newSession, save/load, list, delete |
| `modes.test.ts` | 7 | 4 modes, metadata, validation |
| `tools.test.ts` | 15 | ToolRegistry, error isolation, schema converters |
| `retry.test.ts` | 5 | retryable errors, maxRetries, onRetry |
| `orchestrator.test.ts` | 6 | tool-call loop, maxToolRounds, no-registry bypass |
| `providers.test.ts` | 14 | OpenAI + Anthropic request/response with mocked HTTP |
| `command-palette.test.ts` | 10 | filterEntries pure function |
| `mcp.test.ts` | 6 | Live filesystem MCP server + failure handling |
| `history.test.ts` | 9 | load/append/clear/search, duplicate suppression |
| `theme.test.ts` | 8 | 3 themes, distinct palettes, luminance checks |
| `autocomplete.test.ts` | 18 | slash command completion, history completion, edge cases |
| `pipe.test.ts` | 3 | PipeOptions interface |
| `smoke-real.test.ts` | 8 skipped | Real OpenAI + Anthropic + Z.ai calls (env-gated) |

#### Slash command registry (now 16 commands)

Added 1 new command: `/theme`.

### Fixed

- `bin/nexus.js` rewritten as plain JS (no TypeScript annotations) — previously `node bin/nexus.js` failed with `SyntaxError: Unexpected token ':'` because Node.js doesn't parse TS syntax in `.js` files
- OpenAI/Anthropic provider constructors no longer crash when no API key is set — construction is lazy
- Anthropic `streamChat()` now captures tool calls from `finalMessage()` (was previously discarding them)

### Migration notes

v1.1.3 → v1.1.4 is a drop-in upgrade:

- No breaking API changes
- Pipe mode is opt-in via `--pipe` flag OR detected automatically when stdin isn't a TTY
- Theme switching is persisted to `config.ui.theme` (existing field — already in schema)
- Tab autocomplete is keyboard-activated — doesn't interfere with existing input flow
- CI workflows are scoped to `packages/nexus-tui/**` paths — won't trigger for changes outside the TUI package

---

## [1.1.3] — 2026-06-17

### Added — streaming pipeline + observability + smoke tests

End-to-end wiring of `streamChat()` into the live TUI, tool-call capture from streaming responses, a `/status` slash command for full observability, input history persistence across sessions, an ESLint config with zero warnings, and real-API smoke tests gated behind env vars.

#### Streaming pipeline — fully wired end-to-end

- **NEW**: `sendChatStream()` in the orchestrator — uses `provider.streamChat()` when available, falls back to `sendChat()` (non-streaming) for providers that don't implement it
- **NEW**: `runStreamWithRetry()` — retries streaming calls with the same exponential-backoff + retryable-status-code logic as `chatWithRetry()`
- **NEW**: `App.tsx` now calls `sendChatStream()` instead of `sendChat()` — tokens stream to the UI via the async generator path
- **NEW**: Tool-call execution loop in `sendChatStream()` — when a streamed response includes toolCalls AND a registry is provided, the orchestrator executes them and re-streams the follow-up response (each round yields its own tokens to `onDelta`)
- **NEW**: OpenAI `streamChat()` now **captures tool calls from streaming responses** — accumulates `tool_calls` deltas across chunks (id + name on first chunk, arguments appended on subsequent chunks), parses them into `ToolCall[]`, and returns them in the final `ChatResponse`
- **NEW**: `App.tsx` passes `providerId` to `<InputBox>` for history stamping

#### Observability — `/status` command

- **NEW**: `/status` slash command — prints a full system snapshot:
  - Version, MMFE state, mode, session info
  - All configured providers with key presence (`key✓`/`key✗`) and active marker
  - Active provider's registered models (deduped, capped at 12 with "… and N more" overflow)
  - MCP server statuses with tool counts
  - Config + session directory paths
- **NEW**: `getProviderInfo()` method on `SlashCommandContext` — exposes active provider + deduped model list
- **NEW**: `getMcpStatuses()` method on `SlashCommandContext` — exposes MCP connection state

#### Input history persistence

- **NEW**: `src/session/history.ts` — `loadHistory()`, `appendHistory()`, `clearHistory()`, `searchHistory(query)`
- **NEW**: History persisted to `~/.nexus/history.json` (capped at 500 entries)
- **NEW**: Each entry stamped with `{ text, ts, providerId }` for cross-provider context
- **NEW**: `<InputBox>` loads history on mount via `useEffect`, appends on every submit, ↑/↓ arrow navigation now traverses the persisted history
- **NEW**: Consecutive duplicate suppression — re-submitting the same prompt twice in a row doesn't create two history entries
- **NEW**: `/history [query]` slash command — shows last 20 entries with timestamps + provider; optional substring filter

#### ESLint — zero warnings

- **NEW**: `.eslintrc.json` with `@typescript-eslint/recommended` baseline
- **NEW**: `npm run lint` runs clean (0 errors, 0 warnings) across all source files
- **NEW**: Sensible rule relaxations: `no-explicit-any: off`, `no-empty-function: off`, `argsIgnorePattern: ^_`
- **NEW**: `ignorePatterns` excludes `dist/`, `node_modules/`, `coverage/`, config files, and `__tests__/`

#### Real-API smoke tests (env-gated)

- **NEW**: `src/__tests__/smoke-real.test.ts` — actually calls provider APIs and verifies response shape
- **NEW**: Tests skip automatically unless the matching env var is set (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ZAI_API_KEY`)
- **NEW**: OpenAI smoke: chat completion, `streamChat()` token streaming, `/v1/models` fetch
- **NEW**: Anthropic smoke: chat with system prompt, `streamChat()` token streaming, `/v1/models` fetch
- **NEW**: Z.ai smoke: direct chat (MMFE bypassed), builtin model roster fetch
- Run with: `OPENAI_API_KEY=sk-... npm test -- smoke-real`

#### Tests (123 passing, 8 skipped — up from 114 in v1.1.2)

| Suite | Tests | Coverage |
|---|---|---|
| `config.test.ts` | 14 | schema, load/save, env-merge, key-stripping |
| `registry.test.ts` | 8 | merge precedence, manual add/remove |
| `commands.test.ts` | 22 | all 15 slash commands, aliases, error paths |
| `session.test.ts` | 7 | newSession, save/load, list, delete |
| `modes.test.ts` | 7 | 4 modes, metadata, validation |
| `tools.test.ts` | 15 | ToolRegistry, error isolation, schema converters |
| `retry.test.ts` | 5 | retryable errors, maxRetries, onRetry |
| `orchestrator.test.ts` | 6 | tool-call loop, maxToolRounds, no-registry bypass |
| `providers.test.ts` | 14 | OpenAI + Anthropic request/response with mocked HTTP |
| `command-palette.test.ts` | 10 | filterEntries pure function, edge cases |
| `mcp.test.ts` | 6 | Live filesystem MCP server + failure handling |
| `history.test.ts` | 9 | load/append/clear/search, duplicate suppression |
| `smoke-real.test.ts` | 8 skipped | Real OpenAI + Anthropic + Z.ai calls (env-gated) |

#### Slash command registry (now 15 commands)

Added 4 new commands: `/status`, `/tools`, `/mcp` (now real command, was inline), `/history`.

### Fixed

- MCPClient no longer emits unhandled `EPIPE` errors when writing to stdin of a child process that already exited — wraps the `write()` in try/catch and attaches an error handler to `stdin`
- All ESLint warnings resolved: unused imports/vars removed, `_ctx`/`_args` underscore prefix convention enforced
- `autoModels` state in `App.tsx` now properly referenced (was set but never read — now exposed via `getProviderInfo()`)

### Migration notes

v1.1.2 → v1.1.3 is a drop-in upgrade:

- No breaking API changes
- Existing `sendChat()` callers are unaffected — `sendChatStream()` is a separate function
- History file (`~/.nexus/history.json`) is created automatically on first prompt submit
- ESLint config is opt-in — `npm run lint` now works but isn't required for the build

---

## [1.1.2] — 2026-06-17

### Added — tool calling + streaming + command palette + integration tests

End-to-end implementation of provider-agnostic tool calling, streaming responses for all three providers, a command palette for quick slash-command access, and a full integration test suite including live tests against `@modelcontextprotocol/server-filesystem`.

#### Tool calling — provider-agnostic, multi-round

- **NEW**: `ToolDefinitionInput` type added to `ChatRequestOptions` — pass `tools: [...]` to any provider
- **NEW**: OpenAI provider wires `tools=[...]` into chat requests using OpenAI's function-calling schema (`{ type: 'function', function: { name, description, parameters } }`)
- **NEW**: Anthropic provider wires `tools=[...]` into chat requests using Anthropic's tool schema (`{ name, description, input_schema }`) with `input_schema.type: 'object'` enforced
- **NEW**: Z.ai provider passes `tools` through to the underlying ZAI SDK call
- **NEW**: OpenAI provider parses `tool_calls` from responses and surfaces them as `ChatMessage.toolCalls`
- **NEW**: Anthropic provider parses `tool_use` content blocks from responses
- **NEW**: OpenAI provider converts internal `tool` messages back to OpenAI's `tool_call_id` format on subsequent requests
- **NEW**: Anthropic provider converts internal `tool` messages back to `tool_result` content blocks
- **NEW**: Anthropic provider converts assistant messages with `toolCalls` to `tool_use` content blocks
- **NEW**: Tool-call execution loop in the orchestrator — when a model response includes `toolCalls` AND a `toolRegistry` is provided, the orchestrator executes each call via `toolRegistry.execute()`, appends the result as a tool message, and re-calls the provider. Continues until the model stops emitting tool calls or `maxToolRounds` (default 5) is reached
- **NEW**: `onToolCall` callback in `OrchestratorOptions` — surfaces each executed tool call to the UI with name, args, status, and result
- **NEW**: Tool call activity surfaced in the TUI as cyan `⚙ tool_name(args) → ok` messages
- **NEW**: `maxToolRounds` option (default 5) — prevents infinite tool-call loops

#### Streaming — all three providers

- **NEW**: `Provider.streamChat()` interface — `AsyncGenerator<string, ChatResponse, unknown>` that yields token deltas and returns the full ChatResponse
- **NEW**: `OpenAIProvider.streamChat()` — uses OpenAI's `stream: true` mode, yields `delta.content` chunks
- **NEW**: `AnthropicProvider.streamChat()` — uses `client.messages.stream()`, subscribes to `text` events
- **NEW**: `ZAIProvider.streamChat()` — uses ZAI SDK's `stream: true` mode, yields `delta.content` chunks
- **NEW**: Streaming responses also support tools (the stream yields text deltas; tool calls are parsed from the final response)

#### Command palette (Ctrl+P)

- **NEW**: `<CommandPalette />` Ink component — fuzzy-filterable list of all slash commands
- **NEW**: `PALETTE_ENTRIES` constant — exported list of all commands for testing
- **NEW**: `filterEntries()` pure function — filters entries by name or description (case-insensitive)
- **NEW**: Ctrl+P global shortcut — toggles the palette from anywhere in the TUI
- **NEW**: ↑/↓ arrow navigation through filtered results
- **NEW**: ↵ picks the selected command and runs it through the slash command bus
- **NEW**: ESC closes the palette without action
- **NEW**: Live preview of the selected command's usage string
- **NEW**: "No commands match" empty state

#### Integration tests

- **NEW**: Live MCP integration test — spawns `@modelcontextprotocol/server-filesystem` via npx, verifies the MCPClient can connect, list tools (`read_file`, `list_directory`, etc.), and invoke a tool through the registered handler
- **NEW**: Mocked HTTP integration tests for OpenAI provider — verify request construction (model, messages, tools, tool_call_id format) and response parsing (tool_calls, malformed arguments, API errors)
- **NEW**: Mocked HTTP integration tests for Anthropic provider — verify request construction (system separation, tools with input_schema.type=object, tool_result blocks) and response parsing (tool_use blocks, display_name → label)
- **NEW**: Anthropic fetchModels test — verifies `x-api-key` + `anthropic-version` headers, 404 error handling, missing-key error

#### Tests (114 total, all passing — up from 78 in v1.1.1)

| Suite | Tests | Coverage |
|---|---|---|
| `config.test.ts` | 14 | schema, load/save, env-merge, key-stripping, corrupt-JSON |
| `registry.test.ts` | 8 | merge precedence, manual add/remove, findModel |
| `commands.test.ts` | 22 | all 11 slash commands, aliases, error paths |
| `session.test.ts` | 7 | newSession, save/load, list, delete |
| `modes.test.ts` | 7 | 4 modes, metadata, validation |
| `tools.test.ts` | 15 | ToolRegistry, error isolation, schema converters, 5 builtin tools |
| `retry.test.ts` | 5 | retryable/non-retryable errors, maxRetries cap, onRetry callback |
| `orchestrator.test.ts` | 6 | tool-call execution loop: single call, multi-round chain, maxToolRounds cap, error handling, no-registry bypass |
| `providers.test.ts` | 14 | OpenAI + Anthropic request construction + response parsing with mocked HTTP |
| `command-palette.test.ts` | 10 | filterEntries pure function, edge cases, custom entry lists |
| `mcp.test.ts` | 6 | Live filesystem MCP server integration + failure-handling tests |

### Fixed

- MCPClient now attaches an `error` handler to spawned child processes — non-existent commands no longer emit unhandled `ENOENT` errors that crashed vitest
- `package.json` duplicate `engines` key removed
- Anthropic `Tool.InputSchema` requires `type: 'object'` — provider now always wraps parameters with `{ type: 'object', ...params }`
- `Provider.streamChat` interface signature updated to `AsyncGenerator<string, ChatResponse, unknown>` — matches all three provider implementations
- `ChatRequestOptions.tools` and `ChatRequestOptions.maxToolRounds` added to the type system

### Migration notes

v1.1.1 → v1.1.2 is a drop-in upgrade:

- No breaking API changes
- `tools` and `maxToolRounds` are optional — existing calls without tools continue to work unchanged
- The tool-call execution loop only activates when `toolRegistry` is passed to `sendChat()` — existing callers without a registry see no behavior change
- Streaming via `streamChat()` is opt-in — the existing `chat()` method with `stream: true` still works
- Command palette is keyboard-activated (Ctrl+P) — doesn't interfere with existing input flow

---

## [1.1.1] — 2026-06-17

### Added — production-readiness pass on `nexus-tui`

End-to-end hardening of the `nexus-tui` package: all TypeScript errors fixed, build pipeline green, test suite added, provider-agnostic tool calling protocol implemented, MCP client runtime wired in, retry + error recovery integrated.

#### Build & quality

- **NEW**: `npm run build` now produces clean `dist/` output (32 JS files, no errors)
- **NEW**: `npm test` runs 78 vitest tests across 7 suites, all passing
- **NEW**: `npm run typecheck` exits clean (0 errors under strict mode)
- **NEW**: `vitest.config.ts` with a custom Vite plugin that resolves TS-style `.js` imports to `.ts` source files (required for the Node ESM import convention to work under Vite)

#### Tests (78 total, all passing)

| Suite | Tests | Coverage |
|---|---|---|
| `config.test.ts` | 14 | schema parsing, defaults, round-trip save/load, API-key stripping, env-var merge, corrupt-JSON fallback |
| `registry.test.ts` | 8 | model registry merge precedence (auto > manual > builtin), manual add/remove, findModel |
| `commands.test.ts` | 22 | all 11 slash commands, alias resolution, error paths, help detail |
| `session.test.ts` | 7 | newSession defaults + overrides, save/load round-trip, list, delete |
| `modes.test.ts` | 7 | 4 modes, metadata completeness, mode validation, describeMode format |
| `tools.test.ts` | 14 | ToolRegistry register/unregister/execute, error handling, schema converters, 5 builtin tools |
| `retry.test.ts` | 5 | first-attempt success, retryable status codes, non-retryable errors, max-retries cap, onRetry callback |

#### Tool calling protocol (`src/tools/protocol/index.ts`)

- **NEW**: `ToolDefinition` interface — name, description, JSON-Schema parameters, async handler
- **NEW**: `ToolRegistry` class — register, unregister, get, list, clear, execute, toToolMessage
- **NEW**: `toOpenAITools()` — converts internal tool defs to OpenAI function-calling schema
- **NEW**: `toAnthropicTools()` — converts internal tool defs to Anthropic tool schema
- **NEW**: Error isolation — tool handler exceptions are caught and surfaced as `{ status: 'error', result: { error: msg } }` instead of crashing the chat loop

#### Builtin tools (`src/tools/builtin.ts`)

5 tools registered automatically on TUI boot:

| Tool | Purpose |
|---|---|
| `read_file` | Read file contents (size-capped at 200KB default) |
| `write_file` | Overwrite a file with new content |
| `shell` | Execute shell commands with cwd + timeout |
| `diff` | Generate unified diff between current and proposed content |
| `apply_diff` | Apply new content to a file |

#### MCP client runtime (`src/mcp/client.ts`)

- **NEW**: `MCPClient` class — manages multiple MCP server connections
- **NEW**: stdio transport — spawns child process, JSON-RPC over stdin/stdout, `initialize` → `notifications/initialized` → `tools/list` handshake
- **NEW**: HTTP transport — POST JSON-RPC bodies, supports any MCP-compatible HTTP endpoint
- **NEW**: Automatic tool registration — tools discovered via `tools/list` are registered with the `ToolRegistry` under prefixed names (`mcp_<serverId>_<toolName>`)
- **NEW**: `/mcp` slash command — lists all configured MCP servers with connection status, tool count, and last error
- **NEW**: `/tools` slash command — lists all registered tools (builtin + MCP)
- **NEW**: Clean shutdown — `disconnectAll()` called on TUI unmount

#### Retry + error recovery (`src/providers/retry.ts`)

- **NEW**: `chatWithRetry()` wrapper — exponential backoff with jitter, configurable max retries
- **NEW**: Retryable status codes by default: 408, 429, 500, 502, 503, 504
- **NEW**: Non-retryable errors (400, 401, 403, 404, etc.) fail fast without burning retries
- **NEW**: `onRetry` callback — surfaces retry attempts to the UI with the error message and next delay
- **NEW**: Integrated into `sendChat()` so all provider calls (MMFE-routed and direct) benefit from retry

#### Z.ai provider — real SDK shape (`src/providers/zai.ts`)

- **FIX**: Rewrote to match the actual `z-ai-web-dev-sdk@0.0.18` API (`ZAI.create()` async factory + `chat.completions.create({model, messages, stream})`)
- **NEW**: Lazy SDK loading via dynamic import — TUI boots even if SDK isn't installed
- **NEW**: Optional MMFE orchestrator integration — tries to `createRequire('nexus-dev-mmf')` dynamically; falls back to direct provider calls if orchestrator isn't available
- **NEW**: `streamChat()` async generator — yields token deltas from the SDK's streaming response
- **NEW**: Cached client + orchestrator instances — avoids repeated SDK initialization

#### Anthropic provider — raw fetch for /v1/models (`src/providers/anthropic.ts`)

- **FIX**: Replaced `client.models.list()` (not exposed by the SDK) with raw `fetch()` against `GET /v1/models` with `x-api-key` + `anthropic-version` headers
- **NEW**: Graceful error path — returns a clear "add models manually via /add" message when the endpoint doesn't expose `/v1/models`

#### OpenAI provider — strict typing (`src/providers/openai.ts`)

- **FIX**: Cast message array to `OpenAI.Chat.Completions.ChatCompletionMessageParam[]` to satisfy strict TS
- **NEW**: Explicit `OpenAIMessage` type alias for clarity

#### App.tsx integration

- **NEW**: `ToolRegistry` instance created once on boot, populated with 5 builtin tools
- **NEW**: `MCPClient` boots on mount, connects to all configured servers, registers their tools
- **NEW**: Retry attempts surface in the UI as amber `↻ retry N: <error> (waiting Xms)` messages
- **NEW**: Header now shows live tool count + MCP server count
- **NEW**: `/mcp` and `/tools` slash commands wired inline (don't go through the builtin registry)

### Fixed

- All 26 TypeScript errors from the v1.1.0 scaffold now resolved
- Vite resolver handles Node-ESM `.js` extension convention via custom plugin
- `diff.ts` — `c.count` possibly undefined, now `c.count ?? 0`
- `InputBox.tsx` — `<Text dim>` prop doesn't exist in Ink, replaced with `<Text dimColor>`
- `App.tsx` — wrong relative import paths (`../models/` instead of `./models/`)
- `App.tsx` — 12 implicit-any parameters now explicitly typed

### Migration notes

v1.1.0 → v1.1.1 is a drop-in upgrade:

- No breaking API changes
- `npm install && npm run build && npm test` all pass clean
- Existing config files in `~/.nexus/config.json` continue to work unchanged
- New `mcpServers` config field is optional — empty array by default

---

## [1.1.0] — 2026-06-17

### Added — `nexus-tui` terminal UI client

A new package (`packages/nexus-tui`) providing an Ink + TypeScript terminal UI client for chatting with GLM, OpenAI, Anthropic, and any OpenAI-compatible endpoint — with the Multi-Model Fusion Engine built in.

Inspired by [`opencode`](https://github.com/anomalyco/opencode), [`MiMo-Code`](https://github.com/XiaomiMiMo/MiMo-Code), and [`better-clawd`](https://github.com/x1xhlol/better-clawd), with all Nexus-MMFE features built in and provider unlocked.

#### Providers

- **NEW**: `OpenAIProvider` — works with OpenAI, OpenRouter, Together, Groq, Anyscale, local llama.cpp / vLLM / Ollama (OpenAI adapter), and any endpoint exposing `/v1/chat/completions` + `/v1/models`
- **NEW**: `AnthropicProvider` — native Anthropic SDK integration, supports any Anthropic-compatible endpoint
- **NEW**: `ZAIProvider` — wraps `z-ai-web-dev-sdk`, routes through the MMFE orchestrator when MMFE is on, calls the model directly when MMFE is off
- **NEW**: `BaseProvider` abstract class — unified interface for `fetchModels()` + `chat()` so new providers can be added in <50 lines

#### Model management

- **NEW**: Auto-fetch models from `/v1/models` for any OpenAI-compatible or Anthropic provider
- **NEW**: Manual model registration via `/add <providerId> <modelId> [label]` slash command
- **NEW**: Manual model registration via `manualModels` array in `~/.nexus/config.json`
- **NEW**: Builtin model registry pre-populated with all six GLM models
- **NEW**: Registry precedence: `auto > manual > builtin` (auto wins because it's freshest)

#### MMFE integration

- **NEW**: `sendChat()` orchestrator bridge — single entry point regardless of provider or MMFE state
- **NEW**: Runtime mode switching (`/mode speed|balanced|quality|creative`) without restarting the TUI
- **NEW**: Provider-unlocked mode (`/mmfe off`) — bypass the orchestrator for direct provider calls
- **NEW**: Routing decision panel — per-subtask model assignment + confidence score, rendered inline below each assistant message
- **NEW**: Quality score display in the status bar after each MMFE-routed response

#### Slash commands

11 builtins:

| Command | Purpose |
|---|---|
| `/help [command]` | List commands or show detail for one |
| `/mode [speed\|balanced\|quality\|creative]` | Show/set MMFE mode |
| `/provider [id]` | Show/switch active provider |
| `/model [id]` | Show/switch active model |
| `/fetch [providerId]` | Auto-fetch models from `/v1/models` |
| `/add <providerId> <modelId> [label]` | Manually register a model |
| `/clear` | Clear the chat transcript |
| `/save [name]` | Save the current session |
| `/load <name>` | Load a saved session |
| `/mmfe [on\|off]` | Toggle MMFE on/off |
| `/exit` | Quit the TUI |

#### TUI features

- **NEW**: Streaming response rendering with token-by-token output
- **NEW**: Input history navigation (↑/↓ arrow keys, up to 100 entries)
- **NEW**: Session persistence to `~/.nexus/sessions/*.json`
- **NEW**: File context tools (`readContextFile`, `writeContextFile`)
- **NEW**: Shell exec tool (sandboxed `spawn` with timeout + abort signal)
- **NEW**: Diff view (`diffFile`, `applyDiff`) using the `diff` package
- **NEW**: MCP (Model Context Protocol) support — stdio + HTTP transports, configured via `mcpServers` in config
- **NEW**: Tech-dark theme matching the MMFE brand (cyan + violet on deep navy)
- **NEW**: Minimal markdown renderer (headings, code blocks, lists, links, inline code, bold/italic)

#### Config + persistence

- **NEW**: `~/.nexus/config.json` schema (zod-validated)
- **NEW**: API keys never written to disk — env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ZAI_API_KEY`) auto-merged at runtime
- **NEW**: Config hot-reload — changes via slash commands persist immediately
- **NEW**: Five example providers in `examples/config.json` (zai, openai, anthropic, ollama-local, openrouter)

#### Documentation

- **NEW**: `docs/providers.md` — provider configuration reference
- **NEW**: `docs/commands.md` — slash command reference
- **NEW**: `docs/mcp.md` — MCP integration guide
- **NEW**: `docs/architecture.md` — module map + data flow diagram
- **NEW**: Updated root `README.md` with TUI section + integration recipes for Claude, Cursor, LangChain, AutoGen, and chat.z.ai

### Changed

- Repository restructured as a monorepo: orchestrator lives at root, TUI lives under `packages/nexus-tui`
- Root `README.md` reorganized with dual-package structure (orchestrator + TUI)
- Root `package.json` updated with `workspaces` field pointing at `packages/*`

### Migration notes

Existing v1.0 users upgrading to v1.1.0:

- The orchestrator SDK API is **unchanged** — `createOrchestrator()` + `orchestrator.process()` work identically
- The `nexus-dev` CLI is **unchanged** — same flags, same behavior
- To install the new TUI: `npm install -g nexus-tui` (or run from source via `packages/nexus-tui`)

---

## [1.0.0] — 2025-09-15

### Added — Initial release

- Multi-Model Fusion Engine: Decomposer → Adaptive Router → Parallel Executor → Synthesizer
- Six GLM models: `glm-5.2-1m`, `glm-5.2`, `glm-5.1`, `glm-5`, `glm-5v-turbo`, `glm-4.7`
- Four execution modes: `speed`, `balanced`, `quality`, `creative`
- Adaptive Router (ARL) with per-subtask confidence scoring and alternative model selection
- Parallel execution up to `maxParallelSubTasks: 6` with retry-on-failure
- Synthesizer jointly owned by `glm-5.2` (coherence) and `glm-4.7` (creative stitching)
- `nexus-dev` CLI with `--mode`, `--parallel`, `--verbose`, `--no-thinking` flags
- z-ai-web-dev-sdk integration (backend-only)
- Pipeline lifecycle events: `received`, `decomposing`, `routing`, `executing`, `synthesizing`, `completed`, `failed`
- Configuration options: `defaultMode`, `maxParallelSubTasks`, `enableThinking`, `subTaskTimeout`, `verboseRouting`, `maxDecompositionDepth`, `qualityThreshold`, `enableRetry`, `maxRetries`
- Result object: `answer`, `modelsUsed`, `qualityScore`, `routingDecisions`
- MIT license

---

## Release history

| Version | Date | Highlights |
|---|---|---|
| 1.1.7 | 2026-06-17 | **Rebrand to Nexus Code** — package renamed `nexus-tui` → `nexus-code`, all branding strings updated, CI/CD paths updated, no functional changes |
| 1.1.6 | 2026-06-17 | Plugin commands wired into `/help` + `runSlash`, web UI HTTP integration tests (11), wizard interactive-mode tests (7), plugin loader end-to-end tests (15), coverage 56% → 65%, 230 tests |
| 1.1.5 | 2026-06-17 | `/diff` + `/branch` + `/init` + `/plugins` commands, multi-line input (Shift+Enter), config wizard, plugin system, web UI mode (`nexus --web`), real Ink component tests, 196 tests |
| 1.1.4 | 2026-06-17 | CI/CD (3 workflows), 3 TUI themes + `/theme`, tab autocomplete, pipe mode (`echo "prompt" \| nexus`), Anthropic streaming tool-call capture, coverage thresholds, lazy provider clients, 152 tests |
| 1.1.3 | 2026-06-17 | Streaming pipeline wired end-to-end, tool-call capture from streams, `/status` + `/history` commands, input history persistence, ESLint zero warnings, real-API smoke tests (env-gated) |
| 1.1.2 | 2026-06-17 | Tool calling (provider-agnostic, multi-round), streaming for all 3 providers, command palette (Ctrl+P), 114 tests including live MCP integration |
| 1.1.1 | 2026-06-17 | Production-readiness: 0 TS errors, 78 tests passing, tool calling protocol, MCP client runtime, retry + error recovery |
| 1.1.0 | 2026-06-17 | `nexus-code` terminal UI client; multi-provider (OpenAI + Anthropic + Z.ai); auto-fetch models; slash commands; MCP support; session persistence |
| 1.0.0 | 2025-09-15 | Initial release: MMFE orchestrator, six GLM models, four modes, `nexus-dev` CLI |

---

## Link references

[1.1.7]: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/releases/tag/v1.1.7
[1.1.6]: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/releases/tag/v1.1.6
[1.1.5]: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/releases/tag/v1.1.5
[1.1.4]: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/releases/tag/v1.1.4
[1.1.3]: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/releases/tag/v1.1.3
[1.1.2]: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/releases/tag/v1.1.2
[1.1.1]: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/releases/tag/v1.1.1
[1.1.0]: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/releases/tag/v1.1.0
[1.0.0]: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/releases/tag/v1.0.0
