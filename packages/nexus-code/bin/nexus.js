#!/usr/bin/env node
// ============================================================
// nexus-code v1.1.7 — CLI entry point (plain JS, no TypeScript syntax)
// Boots the Ink-based TUI client for the Nexus-Dev MMFE ecosystem.
// Supports pipe mode: `echo "prompt" | nexus` reads stdin and exits.
// ============================================================

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  await readFile(join(__dirname, '..', 'package.json'), 'utf8')
);

const args = process.argv.slice(2);

// --- Quick top-level flags ---
const flag = (name) => args.find((a) => a === name || a.startsWith(`${name}=`));
const flagVal = (name) => {
  const f = flag(name);
  return f && f.includes('=') ? f.split('=')[1] : true;
};

if (flag('--version') || flag('-v')) {
  console.log(pkg.version);
  process.exit(0);
}

// --- `nexus init` subcommand — run config wizard ---
if (args[0] === 'init') {
  const nonInteractive = flag('--yes') !== undefined || flag('-y') !== undefined;
  import('../dist/wizard.js')
    .then(({ runWizard }) => runWizard({ nonInteractive }))
    .then((summary) => {
      console.log(summary);
      process.exit(0);
    })
    .catch((err) => {
      console.error('nexus init failed:');
      console.error(err.stack || err.message || err);
      process.exit(1);
    });
  // Skip the rest
  process.argv = process.argv.slice(0, 1);
  // Hold the event loop open until the import resolves
  setInterval(() => {}, 1000);
}

// --- `nexus --web` — boot local HTTP server + browser UI ---
if (flag('--web') !== undefined) {
  const portArg = flagVal('--port');
  const port = typeof portArg === 'string' ? parseInt(portArg, 10) : 3000;
  import('../dist/web.js')
    .then(({ runWebServer }) => runWebServer({ port }))
    .catch((err) => {
      console.error('nexus --web failed:');
      console.error(err.stack || err.message || err);
      process.exit(1);
    });
  // Skip the rest
  process.argv = process.argv.slice(0, 1);
  setInterval(() => {}, 1000);
}

if (flag('--help') || flag('-h')) {
  console.log(`
  nexus-code v${pkg.version}
  ${pkg.description}

  USAGE
    nexus                       # boot the TUI in current directory
    nexus init [--yes]          # generate ~/.nexus/config.json (interactive)
    nexus <prompt>              # boot with an initial prompt pre-filled
    echo "prompt" | nexus       # pipe mode: read stdin, respond, exit
    nexus --pipe <prompt>       # explicit pipe mode
    nexus --web                 # boot local HTTP server + browser UI
    nexus --provider=<id>       # boot with a specific provider active
    nexus --model=<id>          # boot with a specific model active
    nexus --mode=<mode>         # boot with MMFE mode preset (speed|balanced|quality|creative)
    nexus --no-mmfe             # bypass MMFE, call the provider directly
    nexus --config=<path>       # use a custom config file
    nexus --version             # print version
    nexus --help                # this message

  PIPE MODE
    When stdin is not a TTY (or --pipe is passed), nexus reads all of
    stdin as the prompt, sends one chat completion, prints the response
    to stdout, and exits. Useful for scripting:

      echo "What is 2+2?" | nexus
      cat code.ts | nexus --provider=openai --model=gpt-4o "explain this"
      nexus --pipe "Sum 1 to 10" --no-mmfe

  ENVIRONMENT
    NEXUS_CONFIG                path to config (defaults to ~/.nexus/config.json)
    OPENAI_API_KEY              auto-detected for the openai provider
    ANTHROPIC_API_KEY           auto-detected for the anthropic provider
    ZAI_API_KEY                 auto-detected for the zai (MMFE) provider

  SLASH COMMANDS (inside the TUI)
    /help                       list all slash commands
    /mode <speed|balanced|quality|creative>
    /provider <id>              switch active provider
    /model <id>                 switch active model
    /models                     list known models (auto + manual)
    /fetch                      re-fetch models from /v1/models
    /add <provider> <model>     manually register a model
    /clear                      clear the chat transcript
    /save [name]                save the current session
    /load <name>                load a saved session
    /diff <path>                show a diff for a file
    /mcp                        list MCP servers
    /status                     full system snapshot
    /history [query]            search past prompts
    /theme [name]               switch color theme
    /diff <path> [against]      show file diff (vs HEAD by default)
    /branch <msgId|idx>         fork conversation from a past message
    /init                       re-run config wizard
    /tools                      list registered tools
    /exit                       quit (or press Ctrl+C twice)

  More: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/tree/main/packages/nexus-code
`);
  process.exit(0);
}

// --- Detect pipe mode ---
const pipeMode = !process.stdin.isTTY || flag('--pipe') !== undefined;

if (pipeMode) {
  const cleanedArgs = args.filter((a) => !a.startsWith('--pipe'));
  const prompt = cleanedArgs.find((a) => !a.startsWith('-'));

  import('../dist/pipe.js')
    .then(({ runPipe }) =>
      runPipe({
        prompt,
        provider: typeof flagVal('--provider') === 'string' ? flagVal('--provider') : undefined,
        model: typeof flagVal('--model') === 'string' ? flagVal('--model') : undefined,
        mode: typeof flagVal('--mode') === 'string' ? flagVal('--mode') : undefined,
        noMMFE: flag('--no-mmfe') !== undefined,
        configPath: typeof flagVal('--config') === 'string' ? flagVal('--config') : undefined,
        stream: true,
      })
    )
    .catch((err) => {
      console.error('Failed to boot nexus-code pipe mode:');
      console.error(err.stack || err.message || err);
      process.exit(1);
    });
} else {
  import('../dist/index.js')
    .then(async () => {
      const { runTUI } = await import('../dist/index.js');
      return runTUI({
        initialPrompt: args.find((a) => !a.startsWith('-')),
        provider: typeof flagVal('--provider') === 'string' ? flagVal('--provider') : undefined,
        model: typeof flagVal('--model') === 'string' ? flagVal('--model') : undefined,
        mode: typeof flagVal('--mode') === 'string' ? flagVal('--mode') : undefined,
        useMMFE: !flag('--no-mmfe'),
        configPath: typeof flagVal('--config') === 'string' ? flagVal('--config') : undefined,
      });
    })
    .catch((err) => {
      console.error('Failed to boot nexus-code:');
      console.error(err.stack || err.message || err);
      process.exit(1);
    });
}
