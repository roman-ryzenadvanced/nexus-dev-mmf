# AGENTS.md — nexus-dev-mmf

Guidance for AI coding agents (Claude Code, Codex, etc.) working on this repo.

## What this project is

`nexus-dev-mmf` (Multi-Model Fusion Engine) is a **Node.js / TypeScript library**
that orchestrates multiple LLM providers (ZAI/GLM, OpenAI, Anthropic, Google,
FreeModel) through a decompose → route → execute-in-parallel → synthesize
pipeline. It is **not** a web app — no Next.js, no Prisma, no NextAuth.

It also ships `packages/nexus-code`, a workspace package containing an Ink/React
TUI terminal client built on top of the engine.

## Package manager: npm

This repo uses **npm**, not bun/yarn/pnpm.

- Lockfile: `package-lock.json`
- `engines.node: >=18`
- The `npm build-verify` / `npm dev` commands do **not** apply here. Use the
  npm scripts below.

## Development commands

### Build & verify (run before every commit)

```bash
npm install              # install deps (npm, not bun)
npm run build-verify     # format + tsc --noEmit + lint:fix + build + test  (MUST pass before commit)
```

`build-verify` is the gate. If it fails, fix it before committing. Do not use
`--no-verify` to bypass it — it exists precisely to keep the pipeline green.

### Individual steps

```bash
npm run build            # tsc (emits to dist/)
npm run format           # prettier --write .
npm run lint             # eslint .
npm run lint:fix         # eslint --fix .
npx tsc --noEmit --pretty# typecheck without emitting
npm test                 # tsx --test tests/runner.mjs (115 unit/routing tests)
npm run test:quick       # same, with QUICK=1 (skips API integration tests)
npm run build:all        # build root + packages/nexus-code
npm run test:all         # root tests + nexus-code tests
```

### Running the CLI / TUI

```bash
npm start                # node dist/cli.js
npm run nexus-code       # cd packages/nexus-code && node bin/nexus.js
```

## Testing notes

- Unit + routing tests live in `tests/runner.mjs` and run via `tsx` (the runner
  imports `.ts` directly, so plain `node --test` will fail — keep `tsx`).
- `Integration Tests (API Calls)` are **skipped automatically** when no
  `ZAI_API_KEY` / `~/.z-ai-config` is present, so the suite stays green in
  credential-free environments (CI, fresh clones). They run when a key exists.
- Do **not** hardcode model counts in tests: the registry grows over time.
  Assert presence of known models, not exact totals.

## Architecture

### Engine (root `src/`)

```
src/
├── core/           orchestrator, MTP engine, model registry, config, events
├── decomposer/     splits a query into subtasks
├── router/         adaptive routing (picks model per subtask)
├── synthesis/      merges parallel results
├── providers/      LLMProvider adapters + ProviderRouter
├── code-review/    multi-model code review engine
├── design-skill/   UI/UX design-skill engine (AI SLOPE elimination)
├── index.ts        public API surface
└── cli.ts          CLI entrypoint
```

### Providers (`src/providers/`)

Every provider implements the `LLMProvider` interface (`types.ts`) and is
registered in `provider-router.ts` via the `createProviderInstance` factory +
the `validProviders` prefix list. Adding a provider = 4 edits:

1. Add the id to the `ProviderId` union in `types.ts`.
2. Create `<name>-provider.ts` implementing `LLMProvider`.
3. Register it in `createProviderInstance` + `validProviders` in `provider-router.ts`.
4. Export it from `src/providers/index.ts` and `src/index.ts`.

Current providers: `zai`, `zai-anthropic`, `openai`, `freemodel`, `anthropic`, `google`.

### Workspace package (`packages/nexus-code/`)

Has **its own** `tsconfig.json`, `package.json`, `.eslintrc.json`, and Vitest
tests. It is excluded from the root ESLint config on purpose — don't try to
lint it from the root. Build/test it separately:

```bash
npm run build:nexus-code
npm run test:nexus-code
```

## TypeScript conventions

- **No path aliases** (`tsconfig.json` has no `paths`). Use relative imports.
  Internal imports use the `.js` extension even though the source is `.ts`
  (ESM + `moduleResolution: bundler`).
- The project compiles to ESM (`"type": "module"`). `module: ES2022`.
- `strict: true`. Avoid `any` where a real type exists (the lint allows it,
  but prefer precision).

## Lint / format specifics

- ESLint is **flat-config** (`eslint.config.mjs`, ESLint 9). Plugins must be
  declared explicitly in the `plugins:` block (flat-config does not pick them
  up from `extends`).
- `@typescript-eslint/no-unused-vars` and `prefer-readonly` are set to `warn`
  (not `error`) because the existing codebase has pre-existing violations.
  Don't bump them back to `error` without cleaning up the codebase first.
- Prettier is part of `build-verify` — committing will reformat the tree.
  Prefer to keep formatting-only changes in a separate commit when possible.

## Secrets / environment

- `.env` is gitignored and **untracked**. Never stage it. API keys go in
  environment variables: `ZAI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `FREEMODEL_API_KEY`, `GOOGLE_API_KEY`, etc.
- Do not log or commit real API keys. If a key appears in a diff, stop and
  remove it before committing.

## Commits / PRs

- One logical change per commit. Functional changes separate from formatting
  when feasible.
- PRs target `main` on `roman-ryzenadvanced/nexus-dev-mmf`.
- `npm run build-verify` **must** pass before pushing.
