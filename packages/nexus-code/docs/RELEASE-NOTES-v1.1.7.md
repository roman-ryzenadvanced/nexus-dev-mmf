# Release Notes — v1.1.7

**Nexus Code** v1.1.7 — the rebrand release. Formerly `nexus-tui` / "Nexus CLI", now **Nexus Code** / `nexus-code`.

This release consolidates all work from v1.1.0 through v1.1.7 into a single PR. No functional changes in v1.1.7 itself — it's a pure branding rename on top of the v1.1.6 codebase.

---

## What's new (cumulative v1.1.0 → v1.1.7)

### Core capabilities

- **3 providers**: OpenAI-compatible, Anthropic native, Z.ai MMFE-native
- **20 builtin slash commands** + plugin commands auto-registered
- **5 builtin tools** (read_file, write_file, shell, diff, apply_diff) + plugin tools + MCP tools
- **MCP client** (stdio + HTTP transports) with live integration tests
- **Streaming** for all 3 providers with tool-call capture
- **Tool-call execution loop** (multi-round, maxToolRounds=5)
- **3 themes** (tech-dark, editorial-light, hacker-terminal)
- **Command palette** (Ctrl+P) + **tab autocomplete**
- **Pipe mode** (`echo "prompt" | nexus`)
- **Web UI mode** (`nexus --web`) — full HTTP server + browser chat UI
- **Config wizard** (`nexus init` / `/init`) — interactive + non-interactive
- **Plugin system** (`~/.nexus/plugins/*.mjs`)
- **Session branching** (`/branch <msgId|idx>`)
- **Input history persistence** (`~/.nexus/history.json`)
- **CI/CD** — 3 GitHub Actions workflows (CI matrix on Node 18/20/22, npm publish on tag, GitHub Release with auto-extracted changelog)
- **Retry + error recovery** (exponential backoff, retryable status codes)
- **ESLint** — 0 warnings
- **Coverage thresholds** enforced (40% min, currently 65%)

### Rebrand (v1.1.7)

- npm package: `nexus-tui` → `nexus-code`
- Binary: adds `nexus-code` alias (keeps `nexus` as primary)
- All in-app branding strings updated
- All docs, CI workflows, publish script paths updated
- MCP `clientInfo.name` updated (both stdio + HTTP transports)

---

## Quality gates — all green

| Gate | Result |
|---|---|
| TypeScript strict typecheck | **0 errors** |
| `npm run build` | **40 JS files, clean output** |
| `npm run lint` | **0 problems** |
| `npm test` | **230 passing + 8 skipped** (env-gated) |
| `npm run test:coverage` | **64.65% lines** (threshold 40%) |
| CLI boot | `nexus --version` → **`1.1.7`** |

---

## Test growth across versions

| Version | Tests | Suites | Lint | Coverage |
|---|---|---|---|---|
| v1.1.0 | 0 | 0 | n/a | n/a |
| v1.1.1 | 78 | 7 | n/a | n/a |
| v1.1.2 | 114 | 11 | n/a | n/a |
| v1.1.3 | 123 | 13 | 0 | n/a |
| v1.1.4 | 152 | 16 | 0 | 61% |
| v1.1.5 | 196 | 20 | 0 | 56% |
| v1.1.6 | 230 | 23 | 0 | 65% |
| **v1.1.7** | **230 + 8 skipped** | **23** | **0** | **65%** |

---

## Bugs fixed (21 total)

See [`docs/ROOT-CAUSE-ANALYSIS.md`](./ROOT-CAUSE-ANALYSIS.md) for the full root-cause analysis of every bug fixed across v1.1.0 → v1.1.7.

| Version | Bugs fixed | Key fixes |
|---|---|---|
| v1.1.1 | 8 | Z.ai SDK API, Anthropic fetchModels, OpenAI types, Ink dim prop, diff count, App.tsx imports, implicit anys, Vite resolver |
| v1.1.2 | 4 | OpenAI tool_calls parsing, Anthropic tool_use blocks, input_schema type, streamChat return type |
| v1.1.3 | 2 | MCPClient EPIPE, unused autoModels state |
| v1.1.4 | 2 | bin/nexus.js TS syntax, eager SDK construction |
| v1.1.5 | 1 | color.dim Proxy + JSX interaction |
| v1.1.6 | 3 | Plugin commands not wired, web test race condition, test assertion misuse |
| v1.1.7 | 1 | Missed second MCP clientInfo during rebrand |

---

## Migration guide

### For npm consumers

```bash
# Old
npm install -g nexus-tui

# New
npm install -g nexus-code
```

### For CLI users

No change — the `nexus` binary still works. `nexus-code` is a new alias.

### For JS importers

```js
// Old
import { runTUI } from 'nexus-tui';

// New
import { runTUI } from 'nexus-code';
```

### For config file users

No change — `~/.nexus/config.json` location and schema are unchanged.

### For plugin authors

No change — plugin format (`~/.nexus/plugins/*.mjs` with default export) is unchanged.

---

## Documentation

- [`docs/FEATURES.md`](./FEATURES.md) — every feature, version added, how to use
- [`docs/TESTS.md`](./TESTS.md) — every test suite, what it covers, how to run
- [`docs/ROOT-CAUSE-ANALYSIS.md`](./ROOT-CAUSE-ANALYSIS.md) — every bug, root cause, exact fix
- [`docs/providers.md`](./providers.md) — provider configuration reference
- [`docs/commands.md`](./commands.md) — slash command reference
- [`docs/mcp.md`](./mcp.md) — MCP integration guide
- [`docs/architecture.md`](./architecture.md) — module map + data flow diagram
