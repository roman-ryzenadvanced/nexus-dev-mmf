# Pull Request: nexus-code v1.1.7 — Rebrand + Full Feature Parity

## Summary

Full rebrand from `nexus-tui` / "Nexus CLI" to **Nexus Code** / `nexus-code`, consolidating all work from v1.1.0 through v1.1.7 into a single PR.

This PR delivers a production-ready, feature-complete terminal AI coding assistant with 230 passing tests, 65% coverage, 0 TypeScript errors, and 0 ESLint warnings.

## Changes

### Rebrand (v1.1.7)

- npm package renamed: `nexus-tui` → `nexus-code`
- Binary: adds `nexus-code` alias (keeps `nexus` as primary)
- All in-app branding strings updated (header, help, status, wizard, web UI, pipe mode, errors)
- All docs, CI workflows, publish script paths updated
- MCP `clientInfo.name` updated (both stdio + HTTP transports)

### Features (cumulative v1.1.0 → v1.1.7)

- **3 providers**: OpenAI-compatible, Anthropic native, Z.ai MMFE-native
- **20 builtin slash commands** + plugin commands auto-registered
- **5 builtin tools** + plugin tools + MCP tools
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
- **CI/CD** — 3 GitHub Actions workflows
- **Retry + error recovery** (exponential backoff)
- **ESLint** — 0 warnings
- **Coverage thresholds** enforced (40% min, currently 65%)

### Bug fixes (21 total)

See [`docs/ROOT-CAUSE-ANALYSIS.md`](./docs/ROOT-CAUSE-ANALYSIS.md) for the full root-cause analysis of every bug fixed.

Key fixes:
- Z.ai provider rewritten to match real `z-ai-web-dev-sdk@0.0.18` API
- Anthropic `fetchModels()` uses raw `fetch()` (SDK doesn't expose `.models.list()`)
- OpenAI/Anthropic providers use lazy SDK construction (no crash on missing API key)
- `bin/nexus.js` rewritten as plain JS (was crashing on TS annotations)
- MCPClient suppresses unhandled `EPIPE`/`ENOENT` errors
- Plugin commands wired into `/help` + `runSlash` dispatcher
- OpenAI + Anthropic streaming captures tool calls from responses

## Quality gates — all green

| Gate | Result |
|---|---|
| TypeScript strict typecheck | **0 errors** |
| `npm run build` | **40 JS files, clean output** |
| `npm run lint` | **0 problems** |
| `npm test` | **230 passing + 8 skipped** (env-gated) |
| `npm run test:coverage` | **64.65% lines** (threshold 40%) |
| CLI boot | `nexus --version` → **`1.1.7`** |

## Test plan

- [ ] `npm install` succeeds
- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` produces `dist/` with 40 JS files
- [ ] `npm test` passes all 230 tests (8 skipped without env vars)
- [ ] `npm run test:coverage` reports ≥40% lines
- [ ] `node bin/nexus.js --version` prints `1.1.7`
- [ ] `node bin/nexus.js --help` shows updated branding
- [ ] `echo "test" | node bin/nexus.js --pipe` boots pipe mode without crashing
- [ ] (Optional) `OPENAI_API_KEY=sk-... npm run test:smoke` passes real-API tests

## Documentation

- [`docs/FEATURES.md`](./docs/FEATURES.md) — every feature, version added, how to use
- [`docs/TESTS.md`](./docs/TESTS.md) — every test suite, what it covers, how to run
- [`docs/ROOT-CAUSE-ANALYSIS.md`](./docs/ROOT-CAUSE-ANALYSIS.md) — every bug, root cause, exact fix
- [`docs/RELEASE-NOTES-v1.1.7.md`](./docs/RELEASE-NOTES-v1.1.7.md) — consolidated release notes
- [`docs/providers.md`](./docs/providers.md) — provider configuration reference
- [`docs/commands.md`](./docs/commands.md) — slash command reference
- [`docs/mcp.md`](./docs/mcp.md) — MCP integration guide
- [`docs/architecture.md`](./docs/architecture.md) — module map + data flow diagram
- [`src/__tests__/README.md`](./src/__tests__/README.md) — in-repo test documentation

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

## Breaking changes

- npm package name changed: `nexus-tui` → `nexus-code`
- JS import path changed: `'nexus-tui'` → `'nexus-code'`
- The `nexus` binary is unchanged — existing CLI users are not affected

## Checklist

- [x] All code follows the existing code style
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] `npm run build` passes
- [x] `npm test` passes
- [x] Coverage ≥ 40%
- [x] CHANGELOG.md updated
- [x] README.md updated
- [x] Documentation written (FEATURES, TESTS, ROOT-CAUSE-ANALYSIS, RELEASE-NOTES)
- [x] CI workflows updated
- [x] No secrets committed
