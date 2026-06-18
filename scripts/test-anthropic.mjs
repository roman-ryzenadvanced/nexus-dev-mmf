#!/usr/bin/env node
/**
 * Nexus-Dev MMFE — Anthropic provider smoke test (custom base URL)
 *
 * Validates the AnthropicProvider against a custom ANTHROPIC_BASE_URL —
 * e.g. a proxy, gateway, or any Anthropic Messages-compatible endpoint
 * (LiteLLM, Claude Code proxy, OpenRouter, etc.). Useful to confirm that
 * your ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL combo works with this
 * project's Anthropic adapter before wiring it into the orchestrator.
 *
 * Usage:
 *   # cmd.exe
 *   set ANTHROPIC_API_KEY=sk-...
 *   set ANTHROPIC_BASE_URL=https://your-anthropic-proxy.example.com
 *   node scripts/test-anthropic.mjs [model]
 *
 *   # PowerShell
 *   $env:ANTHROPIC_API_KEY = "sk-..."
 *   $env:ANTHROPIC_BASE_URL = "https://your-anthropic-proxy.example.com"
 *   node scripts/test-anthropic.mjs [model]
 *
 *   # Default model (if no arg): claude-haiku-4-5-20251001
 *
 * What this does:
 *   - Initializes AnthropicProvider from ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL
 *   - Runs a healthCheck (max_tokens: 1)
 *   - Sends "Say OK in one word" and prints content + token usage
 *   - On failure, prints the raw HTTP status + body so you can diagnose
 *     (wrong base URL, auth scheme, model id, CORS, etc.)
 */

import { AnthropicProvider } from '../src/index.js';

// User-Agent sent to identify as a Claude Code client. Mirrors the ZAI
// Anthropic provider + OpenClaw's kimi-coding provider: Anthropic-compatible
// translators (proxies, gateways) built for Claude Code consumption tend to
// recognize this UA.
const CLAUDE_CODE_USER_AGENT = 'claude-code/0.1.0';

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Per the Anthropic convention, the base URL must NOT include /v1 — the
  // provider appends /v1/messages itself. Accept a base with or without a
  // trailing slash.
  const baseURL = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
  const model = process.argv[2] ?? 'claude-haiku-4-5-20251001';

  console.log('─── Anthropic provider smoke test (custom base URL) ───');
  console.log(`baseURL:    ${baseURL}`);
  console.log(`apiKey:     ${apiKey ? `${apiKey.slice(0, 6)}…${apiKey.slice(-4)} (${apiKey.length} chars)` : '(MISSING)'}`);
  console.log(`endpoint:   ${baseURL.replace(/\/+$/, '')}/v1/messages`);
  console.log(`User-Agent: ${CLAUDE_CODE_USER_AGENT}`);
  console.log(`model:      ${model}`);

  if (!apiKey) {
    console.error('\n✗ ANTHROPIC_API_KEY is not set. Aborting.');
    process.exit(1);
  }

  const provider = new AnthropicProvider();
  await provider.initialize({ provider: 'anthropic', apiKey, baseURL });

  // healthCheck first — cheap probe (max_tokens: 1)
  console.log('\n[1/2] healthCheck() …');
  const healthy = await provider.healthCheck();
  console.log(`     ${healthy ? '✓ healthy' : '✗ unhealthy (auth or connectivity issue)'}`);

  // Real completion
  console.log(`\n[2/2] complete() — ${model}, "Say OK in one word" …`);
  try {
    const result = await provider.complete(model, [{ role: 'user', content: 'Say OK in one word.' }], { maxTokens: 16, temperature: 0 });
    console.log('     ✓ success');
    console.log(`     model:    ${result.model}`);
    console.log(`     content:  "${result.content.trim()}"`);
    if (result.usage) {
      console.log(`     usage:    in=${result.usage.promptTokens} out=${result.usage.completionTokens} total=${result.usage.totalTokens}`);
    }
    console.log('\n═══ ALL GOOD ═══');
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.log('     ✗ failed');
    console.log('     error:', msg);
    console.log('\n─── diagnostic ───');
    if (/404/.test(msg)) {
      console.log('• 404: base URL path is likely wrong. Anthropic uses ${baseURL}/messages.');
      console.log('  Make sure ANTHROPIC_BASE_URL ends with /v1 (or whatever version the proxy expects).');
    } else if (/401|403/.test(msg)) {
      console.log('• 401/403: auth failed. Note this provider sends x-api-key (Anthropic standard).');
      console.log('  If your proxy expects Authorization: Bearer instead, it will reject x-api-key.');
    } else if (/model/i.test(msg)) {
      console.log('• Model not available. Try a different model id as the script argument.');
    }
    process.exit(2);
  }

  await provider.shutdown();
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(3);
});
