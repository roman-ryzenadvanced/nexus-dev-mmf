# Features — Complete Catalog

This document catalogs every feature in nexus-code, organized by category. Each entry includes the version it was added, a brief description, and how to use it.

---

## Multi-provider support

### Three provider kinds (v1.1.0)

| Provider | Kind | Use case |
|---|---|---|
| Z.ai | `zai` | MMFE-native — routes through the Multi-Model Fusion Engine |
| OpenAI-compatible | `openai` | OpenAI, OpenRouter, Together, Groq, Ollama, vLLM, llama.cpp |
| Anthropic | `anthropic` | Anthropic API + any Anthropic-compatible endpoint |

**How to use:** Configure in `~/.nexus/config.json` under `providers`. Switch at runtime with `/provider <id>`.

### Auto-fetch models (v1.1.0)

Fetches the model list from the provider's `/v1/models` endpoint.

**How to use:** `/fetch [providerId]` — fetches from one or all providers.

### Manual model registration (v1.1.0)

For providers that don't expose `/v1/models`, or to add custom model aliases.

**How to use:** `/add <providerId> <modelId> [label]` — e.g., `/add openai gpt-4o-mini GPT-4o mini`

### Provider-unlocked mode (v1.1.0)

Bypass the MMFE orchestrator and call the provider directly.

**How to use:** `/mmfe off` — toggle at runtime. Or `--no-mmfe` flag at boot.

### Lazy provider construction (v1.1.4)

Providers no longer crash on construction when their API key is missing — the SDK client is constructed on first use, not in the constructor.

---

## MMFE orchestrator

### Four execution modes (v1.1.0)

| Mode | Behavior | Use case |
|---|---|---|
| `speed` | Prioritizes glm-5, glm-5v-turbo | Drafts, rapid iteration |
| `balanced` *(default)* | Spreads across all models | Most prompts |
| `quality` | Prioritizes glm-5.2, glm-5.2-1m | Final deliverables |
| `creative` | Biases toward glm-4.7 | Writing, brainstorming |

**How to use:** `/mode [speed|balanced|quality|creative]` or `--mode=<mode>` at boot.

### Six GLM models (v1.1.0)

| Model | Tier | Strengths |
|---|---|---|
| `glm-5.2-1m` | Flagship | Advanced reasoning, 1M context |
| `glm-5.2` | Flagship | Balanced quality-speed |
| `glm-5.1` | Standard | Nuanced language, summarization |
| `glm-5` | Fast | Speed, efficiency |
| `glm-5v-turbo` | Fast | Vision support |
| `glm-4.7` | Creative | Creative generation, code synthesis |

### Routing decisions panel (v1.1.0)

When MMFE is on, each response includes per-subtask routing decisions with confidence scores, displayed inline below the assistant message.

### Quality score (v1.1.0)

Each MMFE-routed response includes a quality score (0-100), shown in the status bar.

### Retry + error recovery (v1.1.1)

Exponential backoff with jitter on retryable HTTP status codes (408, 429, 500, 502, 503, 504). Non-retryable errors (400, 401, 403, 404) fail fast.

**How to use:** Automatic. Retry attempts surface in the UI as amber `↻ retry N: <error> (waiting Xms)` messages.

---

## Tool calling

### Provider-agnostic tool protocol (v1.1.2)

Pass `tools=[...]` to any provider. The orchestrator handles execution.

**Supported by:** OpenAI (function-calling schema), Anthropic (input_schema), Z.ai (pass-through).

### 5 builtin tools (v1.1.1)

| Tool | Purpose |
|---|---|
| `read_file` | Read file contents (size-capped at 200KB) |
| `write_file` | Overwrite a file |
| `shell` | Execute shell commands with cwd + timeout |
| `diff` | Generate unified diff |
| `apply_diff` | Apply new content to a file |

### Multi-round tool execution loop (v1.1.2)

When a model emits `toolCalls`, the orchestrator executes them, appends results as tool messages, and re-calls the provider — up to `maxToolRounds` (default 5).

**How to use:** Automatic when `toolRegistry` is passed to `sendChat()`.

### Tool call UI feedback (v1.1.2)

Tool call activity surfaces as cyan `⚙ tool_name(args) → ok` messages.

### `/tools` command (v1.1.2)

List all registered tools (builtin + MCP + plugin).

---

## Streaming

### Token streaming — all 3 providers (v1.1.2)

`Provider.streamChat()` async generator yields token deltas as they arrive.

**How to use:** Automatic — `App.tsx` calls `sendChatStream()` which uses `streamChat()` when available.

### Tool call capture from streams (v1.1.3, v1.1.4)

- **OpenAI:** Accumulates `tool_calls` deltas across chunks (id + name on first chunk, arguments appended on subsequent chunks)
- **Anthropic:** Extracts `tool_use` blocks from `finalMessage()` after streaming completes

### Streaming + tool execution loop (v1.1.3)

`sendChatStream()` re-streams each follow-up response in the tool-call loop — each round yields its own tokens to `onDelta`.

---

## Slash commands (20 builtin + plugin commands)

### Builtin commands

| Command | Version | Purpose |
|---|---|---|
| `/help [command]` | v1.1.0 | List commands or show detail |
| `/mode [mode]` | v1.1.0 | Show/set MMFE mode |
| `/provider [id]` | v1.1.0 | Show/switch provider |
| `/model [id]` | v1.1.0 | Show/switch model |
| `/fetch [providerId]` | v1.1.0 | Auto-fetch models from `/v1/models` |
| `/add <provider> <model> [label]` | v1.1.0 | Manually register a model |
| `/clear` | v1.1.0 | Clear transcript |
| `/save [name]` | v1.1.0 | Save session |
| `/load <name>` | v1.1.0 | Load saved session |
| `/mmfe [on\|off]` | v1.1.0 | Toggle MMFE |
| `/exit` | v1.1.0 | Quit |
| `/status` | v1.1.3 | Full system snapshot |
| `/tools` | v1.1.3 | List registered tools |
| `/mcp` | v1.1.3 | List MCP servers |
| `/history [query]` | v1.1.3 | Search input history |
| `/theme [name]` | v1.1.4 | Switch color theme |
| `/diff <path> [against]` | v1.1.5 | Show git diff |
| `/branch <msgId\|idx>` | v1.1.5 | Fork conversation |
| `/init` | v1.1.5 | Re-run config wizard |
| `/plugins` | v1.1.5 | List loaded plugins |

### Command palette (v1.1.2)

`Ctrl+P` opens a fuzzy-filterable list of all slash commands. ↑/↓ navigate, ↵ pick, ESC cancel.

### Tab autocomplete (v1.1.4)

`Tab` completes slash command names + aliases, or history entries for free text. Cycle through multiple candidates with repeated Tab.

### Plugin commands (v1.1.5, wired in v1.1.6)

Plugins can register custom slash commands. They appear in `/help` with a `(plugin)` marker and are executable via `runSlash()`.

---

## Themes (v1.1.4)

| Theme | Description |
|---|---|
| `tech-dark` *(default)* | Cyan + violet on deep navy |
| `editorial-light` | Slate + indigo on off-white |
| `hacker-terminal` | Phosphor green on pure black |

**How to use:** `/theme [name]` — persisted to `config.ui.theme`.

---

## Input + history

### Multi-line input (v1.1.5)

`Shift+Enter` inserts a newline. Status bar shows line count when multi-line.

### Input history persistence (v1.1.3)

Every submitted prompt is saved to `~/.nexus/history.json` (500-entry cap). ↑/↓ navigates the history.

### `/history` command (v1.1.3)

`/history [query]` — shows last 20 entries with timestamps + provider; optional substring filter.

### Consecutive duplicate suppression (v1.1.3)

Re-submitting the same prompt twice in a row doesn't create two history entries.

---

## Session management

### Session persistence (v1.1.0)

Save/load chat transcripts to `~/.nexus/sessions/*.json`.

**How to use:** `/save [name]` + `/load <name>`.

### Session branching (v1.1.5)

Fork the conversation from a past message.

**How to use:** `/branch <messageId | index>` — accepts message id or 1-based numeric index.

---

## MCP (Model Context Protocol)

### MCP client runtime (v1.1.1)

Connects to MCP servers via stdio or HTTP transports.

**How to configure:** Add `mcpServers` array to `~/.nexus/config.json`:
```json
{
  "mcpServers": [
    { "id": "fs", "transport": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"] }
  ]
}
```

### Auto-registration of MCP tools (v1.1.1)

Tools discovered via `tools/list` are registered with the `ToolRegistry` under prefixed names (`mcp_<serverId>_<toolName>`).

### `/mcp` command (v1.1.3)

Lists all configured MCP servers with connection status, tool count, and last error.

---

## Plugin system (v1.1.5)

### Plugin loader

Discovers + loads custom tools + commands from `~/.nexus/plugins/*.js` (or `.mjs`).

Each plugin default-exports:
```js
export default {
  name: 'my-plugin',
  tools: [{ name, description, parameters, handler }],
  commands: [{ name, description, usage, run }],
};
```

### `ensurePluginsDir()` + `writeExamplePlugin()`

Creates `~/.nexus/plugins/` on boot. Drops a sample `example.js` (with `timestamp` tool + `ping` command) when no plugins exist.

### `/plugins` command

Lists loaded plugins with tool/command counts + errors.

### Error isolation (v1.1.5)

Plugin load failures (syntax errors, missing default export) are caught and surfaced via `/plugins` — they don't crash the TUI.

---

## Pipe mode (v1.1.4)

Read all of stdin as prompt, send one chat completion, print response to stdout, exit.

**How to use:**
```bash
echo "What is 2+2?" | nexus
cat code.ts | nexus --provider=openai --model=gpt-4o "explain this"
nexus --pipe "Sum 1 to 10" --no-mmfe
```

- Composes stdin + CLI arg prompt with separator
- Streaming by default — tokens to stdout as they arrive
- Exit code 1 if any tool call errored
- Tool registry wired in

---

## Web UI mode (v1.1.5)

Boots a local HTTP server with a browser-based chat UI.

**How to use:** `nexus --web [--port=3000]`

### REST API

| Endpoint | Method | Purpose |
|---|---|---|
| `/` | GET | Single-page HTML chat UI |
| `/api/config` | GET | Current provider + model + mode info |
| `/api/messages` | GET | Message history |
| `/api/chat` | POST | SSE-streamed chat completion |
| `/api/command` | POST | Slash command execution |
| `/api/clear` | POST | Clear transcript |

### UI features

- Provider + mode + MMFE toggle selectors
- Streaming token-by-token rendering
- Markdown code block rendering
- Tool call display
- Quality score badge
- Clear button
- Multi-line input (Shift+Enter)
- Slash command support
- Tech-dark theme matching the TUI

---

## Config wizard (v1.1.5)

Interactive (or `--yes` non-interactive) config generator.

**How to use:**
```bash
nexus init           # interactive
nexus init --yes     # non-interactive, accept defaults
/init                 # re-run from inside TUI
```

- Prompts for: provider, model, mode, MMFE on/off, theme
- Always includes all 3 default providers
- API keys NEVER written to disk
- Refuses overwrite in non-interactive mode

---

## CI/CD (v1.1.4)

### Three GitHub Actions workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | Push/PR to `packages/nexus-code/**` | Typecheck + lint + build + test on Node 18/20/22 |
| `publish.yml` | `v*.*.*` tag push | `npm publish --provenance --access public` |
| `release.yml` | `v*.*.*` tag push | GitHub Release with auto-extracted CHANGELOG section |

---

## Quality gates

| Gate | Tool | Threshold |
|---|---|---|
| TypeScript strict | `tsc --noEmit` | 0 errors |
| Lint | ESLint + `@typescript-eslint` | 0 problems |
| Build | `tsc -p tsconfig.json` | Clean `dist/` output |
| Tests | Vitest | All passing (8 env-gated skipped) |
| Coverage | `@vitest/coverage-v8` | 40% minimum (current: 65%) |
