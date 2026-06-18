# Architecture

```
┌──────────────────────────────────────────────────────────┐
│                       TUI (Ink + React)                  │
│   ChatView  ·  InputBox  ·  StatusBar  ·  HelpOverlay    │
└─────────────────────────┬────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │   Slash Command Bus   │
              │  /mode /model /fetch  │
              └───────────┬───────────┘
                          │
                  ┌───────┴───────┐
                  │  Orchestrator │  (sendChat)
                  │    Bridge     │
                  └───────┬───────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐    ┌──────▼──────┐    ┌─────▼─────┐
   │  Z.ai   │    │   OpenAI    │    │ Anthropic │
   │ MMFE    │    │ compatible  │    │  native   │
   │ (z-ai-  │    │  (openai)   │    │(@anthropic│
   │ sdk)    │    │             │    │  /sdk)    │
   └────┬────┘    └──────┬──────┘    └─────┬─────┘
        │                │                 │
        │      ┌─────────┴─────────┐       │
        │      │  /v1/chat/compl.  │       │
        │      │  /v1/models       │       │
        │      └───────────────────┘       │
        │                                  │
   ┌────▼──────────────────────────────────▼────┐
   │       Model Registry (builtin + manual +   │
   │              auto-fetched)                 │
   └─────────────────────────────────────────────┘
```

## Module map

| Path                | Responsibility                                      |
| ------------------- | --------------------------------------------------- |
| `bin/nexus.js`      | CLI entry — parses flags, boots TUI                 |
| `src/index.tsx`     | Renders the Ink app, loads config                   |
| `src/App.tsx`       | Root component — wires all subsystems               |
| `src/types.ts`      | Shared TypeScript types                             |
| `src/config/`       | Schema + load/save + env merge                      |
| `src/providers/`    | Provider abstraction (base, openai, anthropic, zai) |
| `src/orchestrator/` | MMFE bridge — `sendChat()` unified entry            |
| `src/models/`       | Auto-fetcher + registry                             |
| `src/commands/`     | Slash command registry + builtins                   |
| `src/components/`   | Ink TUI components                                  |
| `src/tools/`        | fs / shell / diff utilities                         |
| `src/session/`      | Save/load chat sessions                             |
| `src/tui/`          | Theme + markdown renderer                           |

## Data flow

1. User types input in `InputBox`.
2. If input starts with `/`, route to `runSlash()` → builtin command.
3. Otherwise, build a `ChatMessage[]` and call `sendChat()`.
4. `sendChat()` checks `config.useMMFE` and the active provider's `mmfe` flag:
   - **MMFE on + Z.ai provider**: routes through `createOrchestrator().process()`
   - **MMFE off / direct provider**: calls `provider.chat()` straight through
5. Streaming deltas arrive via `onDelta` callback → `streamBuffer` state → `ChatView` re-renders.
6. On completion, the final `ChatMessage` (with routing + quality score if MMFE) is appended to the transcript.
7. `StatusBar` reflects the new state (latency, quality, model used).

## Extension points

- **New provider kind**: implement `BaseProvider`, register in `createProvider()`.
- **New slash command**: add to `src/commands/builtin.ts` `REGISTRY` array.
- **New tool**: implement in `src/tools/`, expose via tool-calling protocol.
- **New MMFE mode**: add to `ALL_MODES` and `MODE_METADATA` in `src/orchestrator/modes.ts`.
