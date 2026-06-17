# Provider quick-reference

nexus-code supports three provider kinds. Each is configured in
`~/.nexus/config.json` under the `providers` array.

## 1. `zai` — Z.ai (MMFE native)

The default. Routes through the Multi-Model Fusion Engine when
`useMMFE: true`. Calls go through `z-ai-web-dev-sdk`'s
`createOrchestrator().process()`.

```json
{
  "id": "zai",
  "kind": "zai",
  "name": "Z.ai (MMFE native)",
  "mmfe": true,
  "defaultModel": "glm-5.2"
}
```

API key: set `ZAI_API_KEY` env var or omit (SDK auto-configures via
`.z-ai-config`).

## 2. `openai` — OpenAI-compatible

Works with OpenAI, OpenRouter, Together, Groq, Anyscale, local
llama.cpp / vLLM / Ollama (with the OpenAI adapter), and any endpoint
exposing `/v1/chat/completions` + `/v1/models`.

```json
{
  "id": "openrouter",
  "kind": "openai",
  "name": "OpenRouter",
  "baseURL": "https://openrouter.ai/api/v1",
  "apiKey": "sk-or-...",
  "mmfe": false,
  "defaultModel": "anthropic/claude-3.5-sonnet"
}
```

API key: set `OPENAI_API_KEY` for the `openai` id, or inline `apiKey`
for other OpenAI-compatible providers.

### Auto-fetching models

```
/fetch openrouter
```

Calls `GET {baseURL}/models` and merges results into the registry.

### Manual model add

```
/add openrouter mistralai/mistral-large Mistral Large 2
```

## 3. `anthropic` — Anthropic native

Works with the Anthropic API and any Anthropic-compatible endpoint.

```json
{
  "id": "anthropic",
  "kind": "anthropic",
  "name": "Anthropic",
  "baseURL": "https://api.anthropic.com",
  "apiKey": "sk-ant-...",
  "mmfe": false,
  "defaultModel": "claude-3-5-sonnet-20241022"
}
```

API key: set `ANTHROPIC_API_KEY` env var or inline `apiKey`.

### When `/v1/models` isn't exposed

Some Anthropic-compatible endpoints don't expose the models endpoint.
In that case, `/fetch` will return an error — register models manually:

```
/add anthropic claude-3-opus-20240229 Claude 3 Opus
```

## Provider-unlocked mode (MMFE bypass)

Set `mmfe: false` on a provider, OR toggle at runtime:

```
/mmfe off
```

In unlocked mode, calls go straight to the provider — no orchestrator
decomposition, no routing, no quality score. Useful when you want a
single deterministic model response.

## Mixing providers

You can have multiple providers active simultaneously and switch on
the fly:

```
/provider zai
/provider openrouter
/provider ollama-local
```

Each provider keeps its own active model — switching providers
remembers your last model choice for that provider.
