// ============================================================
// Pipe mode — when stdin is not a TTY, read all of stdin, run a single
// chat completion, print the result to stdout, and exit. No TUI.
//
// Usage:
//   echo "What is 2+2?" | nexus
//   cat code.ts | nexus --provider=openai --model=gpt-4o "explain this code"
//   nexus --pipe "What is the weather?"    # explicit pipe mode
// ============================================================

import { loadConfig } from './config/index.js';
import { buildProviders } from './providers/index.js';
import { sendChat } from './orchestrator/index.js';
import { BUILTIN_TOOLS } from './tools/index.js';
import { ToolRegistry } from './tools/protocol/index.js';
import type { ChatMessage } from './types.js';

export interface PipeOptions {
  /** Initial prompt from CLI args (optional — if absent, reads from stdin). */
  prompt?: string;
  /** Provider override. */
  provider?: string;
  /** Model override. */
  model?: string;
  /** Mode override. */
  mode?: 'speed' | 'balanced' | 'quality' | 'creative';
  /** Bypass MMFE. */
  noMMFE?: boolean;
  /** Config path override. */
  configPath?: string;
  /** Stream output token-by-token to stdout (default true). */
  stream?: boolean;
}

/** Read all of stdin as a string. Returns '' if stdin is a TTY (no piped input). */
function readStdin(): Promise<string> {
  return new Promise(resolve => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
    // Safety: if stdin never ends (e.g. terminal accidentally attached), give up after 30s.
    setTimeout(() => resolve(data.trim()), 30_000).unref?.();
  });
}

export async function runPipe(opts: PipeOptions = {}): Promise<void> {
  const config = await loadConfig(opts.configPath);

  if (opts.provider) config.activeProviderId = opts.provider;
  if (opts.model) config.activeModelId = opts.model;
  if (opts.mode) config.mode = opts.mode;
  if (typeof opts.noMMFE === 'boolean') config.useMMFE = !opts.noMMFE;

  const providers = buildProviders(config);

  // Compose the prompt: CLI arg + piped stdin (concatenated with separator).
  const piped = await readStdin();
  const promptParts: string[] = [];
  if (piped) promptParts.push(piped);
  if (opts.prompt) promptParts.push(opts.prompt);

  const prompt = promptParts.join('\n\n---\n\n').trim();
  if (!prompt) {
    console.error('nexus-code pipe mode: no input. Provide a prompt as an arg or via stdin.');
    process.exit(1);
  }

  const userMsg: ChatMessage = {
    id: `u_${Date.now()}`,
    role: 'user',
    content: prompt,
    ts: Date.now(),
  };

  // Set up tool registry with builtin tools so models can call them.
  const toolRegistry = new ToolRegistry();
  for (const tool of BUILTIN_TOOLS) toolRegistry.register(tool);

  const tools = toolRegistry.list().map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters as Record<string, unknown>,
  }));

  const stream = opts.stream !== false;

  try {
    const res = await sendChat(config, providers, [userMsg], {
      stream,
      mode: config.mode,
      model: config.activeModelId,
      noMMFE: !config.useMMFE,
      tools,
      maxToolRounds: 5,
      toolRegistry,
      onDelta: stream ? delta => process.stdout.write(delta) : undefined,
      retry: { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 8000 },
    });

    if (!stream) {
      // Non-streaming: print full response at once.
      process.stdout.write(res.message.content);
    } else {
      // Streaming already wrote deltas. If the response has additional
      // content not delivered via deltas (rare), print it now.
      if (res.message.content && process.stdout.write.length === 0) {
        process.stdout.write('\n');
      }
    }

    // Ensure trailing newline.
    process.stdout.write('\n');

    // Exit code reflects whether tool calls succeeded.
    const failedTools = res.message.toolCalls?.filter(tc => tc.status === 'error') ?? [];
    process.exit(failedTools.length > 0 ? 1 : 0);
  } catch (err) {
    console.error('nexus-code pipe mode failed:');
    console.error((err as Error).message || err);
    if (process.env.DEBUG) {
      console.error((err as Error).stack);
    }
    process.exit(1);
  }
}
