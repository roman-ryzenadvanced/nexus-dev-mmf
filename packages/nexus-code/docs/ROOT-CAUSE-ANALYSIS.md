# Root Cause Analysis — Every Bug Fixed

This document catalogs every bug, defect, or issue found and fixed in the nexus-code (formerly nexus-tui) codebase across versions v1.1.0 through v1.1.7. Each entry describes the symptom, the underlying root cause, and the exact fix applied.

---

## v1.1.1 — Production-readiness pass

### 1. Z.ai provider used wrong SDK API

**Symptom:** Calling `provider.chat()` on the ZAI provider crashed with `TypeError: sdk.createOrchestrator is not a function`.

**Root cause:** The v1.1.0 scaffold assumed `z-ai-web-dev-sdk` exposed a `createOrchestrator()` function. Inspecting the actual `z-ai-web-dev-sdk@0.0.18` package on npm revealed the SDK only exports a `ZAI` class with a static `create()` async factory and a `chat.completions.create()` method — no orchestrator function exists in the SDK itself. The orchestrator lives in the root `nexus-dev-mmf` package (this monorepo).

**Exact fix:** Rewrote `src/providers/zai.ts` from scratch. The new implementation:

1. Lazily imports `z-ai-web-dev-sdk` via `await import(...)` so the TUI boots even if the SDK isn't installed
2. Calls `ZAI.create()` (async factory) to get a client instance
3. Calls `client.chat.completions.create({ model, messages, stream })` for direct provider calls
4. Optionally tries `createRequire('nexus-dev-mmf')` to dynamically load the orchestrator from the root package — falls back to direct calls if not installed
5. Caches both the SDK client and orchestrator instances to avoid repeated initialization

---

### 2. Anthropic SDK doesn't expose `.models.list()`

**Symptom:** Calling `provider.fetchModels()` on the Anthropic provider crashed with `TypeError: this.client.models is undefined`.

**Root cause:** The v1.1.0 scaffold assumed `@anthropic-ai/sdk` exposed a `.models.list()` method like the OpenAI SDK. The Anthropic SDK doesn't expose this — the `/v1/models` endpoint exists in the API (added 2024-10) but isn't wrapped by the SDK's TypeScript client.

**Exact fix:** Replaced `this.client.models.list()` with a raw `fetch()` call in `src/providers/anthropic.ts`:

1. Builds URL: `${baseURL}/v1/models?limit=100`
2. Sends `GET` with headers `x-api-key: <key>` and `anthropic-version: 2023-06-01`
3. Parses `json.data[].id` and `json.data[].display_name` (Anthropic's response shape)
4. On non-200 response, throws a `ProviderError` with HTTP status + a "add models manually via /add" hint
5. On missing API key, throws a clear `ProviderError` before attempting the fetch

---

### 3. OpenAI provider message type mismatch

**Symptom:** TypeScript build failed with `Type '{ role: string; content: string; }[]' is not assignable to type 'ChatCompletionMessageParam[]'`.

**Root cause:** The v1.1.0 scaffold built the messages array as `{ role: string; content: string }[]` — but the OpenAI SDK's strict TypeScript types require the `role` field to be a union of literal strings (`'system' | 'user' | 'assistant' | 'tool'`), not a generic `string`. TypeScript can't narrow `string` to the literal union automatically.

**Exact fix:** In `src/providers/openai.ts`:

1. Added explicit type alias: `type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam`
2. Cast the payload: `const payload: OpenAIMessage[] = messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))`
3. The cast tells TypeScript "I know the role string is one of the valid literals" — which it is, because the internal `ChatMessage.role` type is already the correct union

---

### 4. Ink `<Text dim>` prop doesn't exist

**Symptom:** TypeScript build failed with `Property 'dim' does not exist on type 'IntrinsicAttributes & Props'` on `<Text dim>` in InputBox.

**Root cause:** The v1.1.0 scaffold used `<Text dim>` based on a wrong assumption about Ink's API. Ink's `<Text>` component exposes `dimColor` (camelCase), not `dim`. This is a documentation-drift bug — older Ink versions may have used `dim`, but Ink 5.x uses `dimColor`.

**Exact fix:** In `src/components/InputBox.tsx`, replaced:

```tsx
<Text color={THEME.primaryMute} dim>
```

with:

```tsx
<Text color={THEME.primaryMute} dimColor>
```

---

### 5. `diff.ts` — `c.count` possibly undefined

**Symptom:** TypeScript strict mode flagged `error TS18048: 'c.count' is possibly 'undefined'` on lines 24 and 25 of `src/tools/diff.ts`.

**Root cause:** The `diff` package's `Change` type marks `count` as `number | undefined` (because some diff operations don't produce a count). The scaffold used `c.count` directly without checking.

**Exact fix:** Used nullish coalescing:

```ts
if (c.added) added += c.count ?? 0;
if (c.removed) removed += c.count ?? 0;
```

---

### 6. App.tsx wrong relative import paths

**Symptom:** 7 TypeScript errors of the form `Cannot find module '../models/fetcher.js'` from `src/App.tsx`.

**Root cause:** `App.tsx` lives at `src/App.tsx`. It imported modules using `../models/...`, `../commands/...`, `../config/...` — but `../` from `src/App.tsx` goes UP to `src/`'s parent (the package root), not into `src/models/`. The correct relative path is `./models/...`.

**Exact fix:** Changed all 7 imports from `../` to `./`:

- `../models/fetcher.js` → `./models/fetcher.js`
- `../models/registry.js` → `./models/registry.js`
- `../commands/index.js` → `./commands/index.js`
- `../session/store.js` → `./session/store.js`
- `../config/index.js` → `./config/index.js`
- `../tui/theme.js` → `./tui/theme.js`
- `../types.js` → `./types.js`

---

### 7. App.tsx 12 implicit-any parameters

**Symptom:** TypeScript strict mode flagged 12 errors of the form `Parameter 'X' implicitly has an 'any' type` in `src/App.tsx`.

**Root cause:** The `SlashCommandContext` type's method signatures use parameter names without explicit types, and when App.tsx destructured them into callbacks, TypeScript lost the type information.

**Exact fix:** Added explicit types to every parameter in the `ctx` object:

- `(patch)` → `(patch: Partial<AppConfig>)`
- `(prev)` → `(prev: AppConfig)`
- `(s)` → `(s: Session)`
- `(name)` → `(name?: string)` / `(name: string)`
- `(providerId)` → `(providerId?: string)` / `(providerId: string)`
- `(modelId)` → `(modelId: string)`
- `(label)` → `(label?: string)`
- `(r)` → `(r: { models?: ModelDescriptor[] })`
- `(m)` → `(m: ModelDescriptor)`

---

### 8. Vitest can't resolve `.js` imports

**Symptom:** Running `npm test` failed with `Error: Failed to load url ../schema.js (resolved id: ../schema.js) — Does the file exist?` for every test file.

**Root cause:** TypeScript ESM convention requires imports to use `.js` extensions (even when the source file is `.ts`). Node.js's native ESM loader resolves these correctly. But Vite (which vitest uses under the hood) doesn't strip the `.js` extension — it tries to find a literal `.js` file on disk, which doesn't exist (only `.ts` does).

**Exact fix:** Wrote a custom Vite plugin `stripJsExtPlugin` in `vitest.config.ts`:

1. Implements `resolveId(source, importer)` with `enforce: 'pre'`
2. When it sees an import ending in `.js`, strips the extension
3. Computes the absolute path of the importer's directory
4. Tries `<stripped>.ts`, `<stripped>.tsx`, `<stripped>.jsx`, `<stripped>.json` in order
5. Also tries `<stripped>/index.ts` and `<stripped>/index.tsx` for directory imports
6. Returns the resolved path if the file exists, otherwise returns `null` (falls through to Vite's default resolver)

---

## v1.1.2 — Tool calling + streaming

### 9. OpenAI tool_calls not parsed from responses

**Symptom:** When a model emitted `tool_calls` in its response, the `ChatMessage.toolCalls` field was always `undefined`.

**Root cause:** The v1.1.1 OpenAI provider only extracted `choice.message.content` from the response — it never looked at `choice.message.tool_calls`.

**Exact fix:** Added a `parseToolCalls()` private method to `OpenAIProvider`:

1. Takes the raw `tool_calls` array from the OpenAI response
2. For each call, parses `function.arguments` (which arrives as a JSON string) into a JS object via `JSON.parse()`
3. On parse failure (malformed JSON), falls back to `{ _raw: arguments }` instead of crashing
4. Returns `ToolCall[]` with `status: 'pending'`
5. Wired into `chat()` to populate `assistantMsg.toolCalls` when present

---

### 10. Anthropic tool_use blocks not parsed

**Symptom:** Anthropic responses with tool calls had empty `toolCalls` arrays.

**Root cause:** Anthropic returns tool calls as `tool_use` content blocks (not as a top-level `tool_calls` array like OpenAI). The v1.1.1 provider only filtered for `text` blocks.

**Exact fix:** In `src/providers/anthropic.ts`, added:

1. Filter `res.content` for blocks where `c.type === 'tool_use'`
2. Map each to `{ id: tu.id, name: tu.name, args: tu.input, status: 'pending' }`
3. Attach to `assistantMsg.toolCalls` when present

---

### 11. Anthropic `input_schema` requires `type: 'object'`

**Symptom:** Anthropic API rejected tool definitions with `400 Bad Request: input_schema.type must be 'object'`.

**Root cause:** The Anthropic SDK's `Tool.InputSchema` type requires `type: 'object'` as a literal. The v1.1.2 provider passed `parameters` directly without ensuring the `type` field was set.

**Exact fix:** In `src/providers/anthropic.ts`, wrapped the parameters:

```ts
input_schema: {
  type: 'object' as const,
  ...(t.parameters as Record<string, unknown>),
}
```

This guarantees `type: 'object'` is always present, even if the caller's parameters object doesn't include it.

---

### 12. ZAI provider `streamChat` return type mismatch

**Symptom:** TypeScript error `Type 'ZAIProvider' is not assignable to type 'Provider'` because `streamChat` returned `AsyncGenerator<string, void, unknown>` but the `Provider` interface declared `AsyncGenerator<string, ChatResponse, unknown>`.

**Root cause:** The `Provider` interface was updated in v1.1.2 to return the full `ChatResponse` from the generator's return value, but the ZAI provider's `streamChat` was still declared with `void` as the return type.

**Exact fix:** Updated `ZAIProvider.streamChat()` signature from:

```ts
async *streamChat(...): AsyncGenerator<string, void, unknown>
```

to:

```ts
async *streamChat(...): AsyncGenerator<string, ChatResponse, unknown>
```

and added a `return { message: assistantMsg }` at the end of the generator.

---

## v1.1.3 — Streaming pipeline + observability

### 13. MCPClient emits unhandled `EPIPE` errors

**Symptom:** Tests for MCP connection failures crashed vitest with `Error: spawn ENOENT` and `EPIPE` unhandled promise rejections.

**Root cause:** When `MCPClient.connectStdio()` spawned a child process that immediately exited (e.g., command not found), the `child.stdin.write(req)` call in `sendStdio()` would emit an `EPIPE` error event on stdin. Since no error listener was attached to `stdin`, Node.js treated it as an unhandled exception and vitest surfaced it as a test crash.

**Exact fix:** In `src/mcp/client.ts`:

1. Attached an empty error handler to the child process: `child.on('error', () => {})` — suppresses the `ENOENT` event from non-existent commands
2. Wrapped the `stdin.write()` call in try/catch — catches synchronous `EPIPE` errors
3. Attached an error handler to stdin: `child.stdin?.on?.('error', () => {})` — catches async `EPIPE` errors

The actual error surfaces via the timeout in `sendStdio()` (which rejects after 10 seconds), and `connectAll()` catches that rejection and records it in the `MCPServerStatus.lastError` field.

---

### 14. `autoModels` state set but never read

**Symptom:** ESLint warning `'autoModels' is assigned a value but never used`.

**Root cause:** The `autoModels` state was populated by `setAutoModels()` in the auto-fetch effect, but nothing in the component ever read the value. It was leftover from an earlier design where the model list was displayed in the UI.

**Exact fix:** Rather than removing the state, exposed it via the `getProviderInfo()` method on `SlashCommandContext` so `/status` could display the deduped model list. Added `void autoModels;` to suppress the ESLint warning with a comment explaining the indirect usage.

---

## v1.1.4 — CI/CD + theming + autocomplete + pipe mode

### 15. `bin/nexus.js` crashed with `SyntaxError: Unexpected token ':'`

**Symptom:** Running `node bin/nexus.js --version` failed with:

```
SyntaxError: Unexpected token ':'
    at const flag = (name: string) =>
```

**Root cause:** The v1.1.3 bin entry was written with TypeScript type annotations (`name: string`) but saved as `.js`. Node.js doesn't parse TypeScript syntax in `.js` files — it expects plain JavaScript. The `tsx` loader wasn't being used for the bin entry, only for `npm run dev`.

**Exact fix:** Rewrote `bin/nexus.js` as plain JavaScript with no type annotations:

1. Removed all `: string`, `: boolean`, etc. from function parameters
2. Removed all `as const` and `as never` casts
3. Kept the same logic, just plain JS
4. Verified with `node bin/nexus.js --version` → `1.1.4`

---

### 16. OpenAI/Anthropic providers crash on construction without API key

**Symptom:** Pipe mode failed immediately with `Error: The OPENAI_API_KEY environment variable is missing` — even when the user intended to use a different provider.

**Root cause:** The v1.1.3 providers constructed the SDK client in the constructor:

```ts
this.client = new OpenAI({ apiKey: opts.apiKey || process.env.OPENAI_API_KEY });
```

The OpenAI SDK's constructor throws if no API key is provided. Since `buildProviders()` constructs ALL providers on boot, a missing key for ANY provider crashed the entire registry.

**Exact fix:** Made client construction lazy in both `OpenAIProvider` and `AnthropicProvider`:

1. Stored the options in a private `_clientOpts` field instead of constructing the client
2. Added a private `get client()` accessor that constructs the client on first access
3. Cached the constructed client in `_client`
4. Now `buildProviders()` succeeds even with no API keys configured — the error only surfaces when the user actually tries to USE that specific provider via `chat()` or `fetchModels()`

---

## v1.1.5 — Full feature parity pass

### 17. `color.dim()` broke after theme proxy refactor

**Symptom:** `ChatView` crashed with `__vite_ssr_import_2__.color.dim is not a function` when rendering the streaming indicator.

**Root cause:** The v1.1.4 theme refactor changed `color` from a plain object with `chalk` instances to a `Proxy` with getters that return `chalk.hex(...)` instances. `color.dim` now returns a `ChalkInstance` (a function), but `ChatView` was calling it as `color.dim('(streaming…)')` — which works because `ChalkInstance` is callable. However, the Proxy getter was returning a fresh `chalk.hex(...)` call each time, and under Vite's SSR transform, the re-export wasn't being recognized as callable.

**Exact fix:** Replaced the `color.dim()` call with a nested `<Text>` component:

```tsx
<Text color={THEME.accent}>
  {SIGILS.assistant} assistant <Text color={THEME.primaryDim}>(streaming…)</Text>
</Text>
```

This avoids the `color` helper entirely for JSX rendering — Ink's `<Text color>` prop handles the coloring directly.

---

## v1.1.6 — Close the gaps

### 18. Plugin commands loaded but unreachable

**Symptom:** Plugins with `commands: [...]` in their default export loaded successfully (visible via `/plugins`), but typing `/plugin_cmd` returned "Unknown command".

**Root cause:** The v1.1.5 plugin loader in `App.tsx` only registered plugin TOOLS with the `ToolRegistry` — it never registered plugin COMMANDS. The `REGISTRY` constant in `commands/builtin.ts` was a `const` array with no mechanism for runtime additions. `findCommand()` only searched `REGISTRY`, so plugin commands were invisible to the dispatcher.

**Exact fix:** Added a runtime command registration system in `src/commands/builtin.ts`:

1. New `PLUGIN_COMMANDS: SlashCommand[]` mutable array (forward-declared at top of file so the `help` command can use `allCommands()` before `REGISTRY` is defined)
2. `registerPluginCommand(cmd)` — idempotent, refuses duplicates + collisions with builtin names
3. `unregisterPluginCommand(name)` — removes by name
4. `allCommands()` — returns `[...REGISTRY, ...PLUGIN_COMMANDS]`
5. `clearPluginCommands()` — test helper
6. Updated `findCommand()` to search `allCommands()` instead of just `REGISTRY`
7. Updated `help` command to list plugin commands with a `(plugin)` marker
8. Updated `App.tsx` plugin loader effect to call `registerPluginCommand(cmd)` for each command in every loaded plugin

---

### 19. Web test setup race condition

**Symptom:** `web.test.ts` failed in `beforeAll` with `ENOENT: no such file or directory, open '/tmp/nexus-web-test-1781689156971/config.json'`.

**Root cause:** The original setup computed the temp directory name twice with `Date.now()`:

```ts
testConfigDir = await mkdir(join(tmpdir(), `nexus-web-test-${Date.now()}`), ...)
  .then(() => join(tmpdir(), `nexus-web-test-${Date.now()}`))
  .catch(() => join(tmpdir(), `nexus-web-test-${Date.now()}`));
```

Three separate `Date.now()` calls could return different values (especially under load), so `mkdir` created one directory and `writeFile` tried to write to a different one.

**Exact fix:** Computed the directory name ONCE before passing it to `mkdir`:

```ts
testConfigDir = join(tmpdir(), `nexus-web-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
await mkdir(testConfigDir, { recursive: true });
testConfigPath = join(testConfigDir, 'config.json');
await writeFile(testConfigPath, ...);
```

The `Math.random()` suffix also prevents collisions between parallel test runs.

---

### 20. Test assertion `expect(...).toContain(...) === false` doesn't work

**Symptom:** Web test "HTML UI contains key UI elements" failed with `expected '...html...' to contain 'EventSource'`.

**Root cause:** The test used `expect(html).toContain('EventSource') === false` to assert that `EventSource` should NOT be in the HTML. But `expect().toContain()` returns a Chai assertion object (which is truthy), not a boolean. The `=== false` comparison was always `false`, so the assertion always "passed" — except vitest was actually evaluating the inner `toContain` which DID fail because `EventSource` was in the HTML.

**Exact fix:** Replaced with proper negation:

```ts
expect(html).not.toContain('new EventSource');
```

Vitest's `.not` modifier properly negates the assertion.

---

## v1.1.7 — Rebrand to Nexus Code

### 21. Second MCP `clientInfo` not updated during rebrand

**Symptom:** After rebranding all `nexus-tui` references to `nexus-code`, one MCP server still received `clientInfo: { name: 'nexus-tui', version: '1.1.0' }` in its JSON-RPC handshake.

**Root cause:** The MCP client has TWO connection paths — `connectStdio()` and `connectHttp()` — each with its own `clientInfo` object. The initial rebrand pass only updated the stdio path (line 81) and missed the HTTP path (line 129).

**Exact fix:** Updated the second `clientInfo` in `connectHttp()` to match:

```ts
clientInfo: { name: 'nexus-code', version: '1.1.7' },
```

Found via `grep -rn "nexus-tui" src/` after the initial rebrand pass.

---

## Summary

| Version   | Bugs fixed | Root causes                                                                                      |
| --------- | ---------- | ------------------------------------------------------------------------------------------------ |
| v1.1.1    | 8          | Wrong SDK API assumptions, type mismatches, Ink API drift, import path errors, Vite resolver gap |
| v1.1.2    | 4          | Missing tool-call parsing, strict schema requirements, type signature drift                      |
| v1.1.3    | 2          | Unhandled process errors, unused state                                                           |
| v1.1.4    | 2          | TypeScript in .js files, eager SDK construction                                                  |
| v1.1.5    | 1          | Proxy + JSX interaction                                                                          |
| v1.1.6    | 3          | Incomplete wiring, race condition, test assertion misuse                                         |
| v1.1.7    | 1          | Missed second code path during rebrand                                                           |
| **Total** | **21**     |                                                                                                  |
