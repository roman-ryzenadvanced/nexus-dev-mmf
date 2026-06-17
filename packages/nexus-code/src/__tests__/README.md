# Tests

This directory contains all test suites for nexus-code.

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

# Run in watch mode
npx vitest
```

## Test files

| File | Tests | Covers |
|---|---|---|
| `config.test.ts` | 14 | Schema parsing, load/save, env-merge, key-stripping |
| `registry.test.ts` | 8 | Model registry merge precedence, manual add/remove |
| `commands.test.ts` | 22 | All 20 builtin slash commands, aliases, error paths |
| `session.test.ts` | 7 | newSession, save/load, list, delete |
| `modes.test.ts` | 7 | 4 MMFE modes, metadata, validation |
| `tools.test.ts` | 15 | ToolRegistry, error isolation, schema converters |
| `retry.test.ts` | 5 | Retryable errors, maxRetries, onRetry callback |
| `orchestrator.test.ts` | 6 | Tool-call loop, maxToolRounds, no-registry bypass |
| `providers.test.ts` | 14 | OpenAI + Anthropic request/response with mocked HTTP |
| `command-palette.test.ts` | 10 | filterEntries pure function |
| `mcp.test.ts` | 6 | **Live** filesystem MCP server + failure handling |
| `history.test.ts` | 9 | load/append/clear/search, duplicate suppression |
| `theme.test.ts` | 9 | 3 themes, distinct palettes, luminance checks |
| `autocomplete.test.ts` | 17 | Slash command + history completion |
| `pipe.test.ts` | 3 | PipeOptions interface |
| `components.test.tsx` | 16 | StatusBar, HelpOverlay, ChatView Ink rendering |
| `plugins.test.ts` | 9 | loadPlugin, loadAllPlugins, writeExamplePlugin |
| `wizard.test.ts` | 5 | Non-interactive mode basics |
| `wizard-interactive.test.ts` | 7 | Mocked readline, edge cases |
| `new-commands.test.ts` | 9 | /diff, /branch, /init, /plugins |
| `web.test.ts` | 11 | **Live** HTTP server, all endpoints, HTML shape |
| `plugin-commands.test.ts` | 15 | Register/unregister, runSlash integration, end-to-end |
| `smoke-real.test.ts` | 8 skipped | Real OpenAI + Anthropic + Z.ai calls (env-gated) |

**Total:** 238 tests (230 passing + 8 env-gated skipped)

## Full documentation

See [`../docs/TESTS.md`](../docs/TESTS.md) for complete documentation of every test suite, including what each test covers and how to interpret results.

## Coverage

Current coverage: **64.65% lines** (threshold: 40%)

Run `npm run test:coverage` to generate a fresh coverage report. HTML report lands in `coverage/`.

## CI

Tests run automatically on every push and pull request via `.github/workflows/ci.yml`, matrixed across Node.js 18, 20, and 22.
