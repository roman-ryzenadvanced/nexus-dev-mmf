# Slash command reference

All commands are invoked from inside the TUI by typing `/` followed
by the command name and any arguments. Commands are case-sensitive.

## /help `[command]`

List all slash commands, or show detailed help for one command.
Aliases: `/?`, `/h`.

## /mode `[speed|balanced|quality|creative]`

Show or set the active MMFE execution mode. Without an argument,
prints the current mode.

```
/mode                # show current mode
/mode quality        # switch to quality mode
/mode creative       # switch to creative mode
```

## /provider `[id]`

Show or switch the active provider. Without an argument, lists all
configured providers with their MMFE status.

```
/provider            # list providers
/provider openai     # switch to openai
/provider zai        # switch back to Z.ai
```

## /model `[id]`

Show or switch the active model for the current provider.

```
/model               # list models for active provider
/model glm-5.2       # switch model
```

## /fetch `[providerId]`

Re-fetch models from `/v1/models` on one or all providers.

```
/fetch               # fetch from all providers
/fetch openai        # fetch from openai only
```

## /add `<providerId> <modelId> `[`label`]

Manually register a model on a provider. Useful when auto-fetch
isn't available.

```
/add openai gpt-4o-mini GPT-4o mini
/add anthropic claude-3-opus-20240229 Claude 3 Opus
```

## /clear

Clear the current transcript. Session history is not affected.

## /save `[name]`

Save the current session to `~/.nexus/sessions/`. Without a name,
uses the session's auto-generated id.

```
/save                # save with auto id
/save debug-run      # save as "debug-run"
```

## /load `<name>`

Load a previously saved session.

```
/load debug-run
```

## /mmfe `[on|off]`

Toggle MMFE on or off at runtime. When off, calls bypass the
orchestrator and go straight to the provider (provider-unlocked
mode).

```
/mmfe                # show current state
/mmfe off            # bypass MMFE
/mmfe on             # route through MMFE again
```

## /exit

Quit the TUI. Aliases: `/quit`, `/q`. You can also press `Ctrl+C`
twice.

## Keyboard shortcuts

| Key                              | Action                         |
| -------------------------------- | ------------------------------ |
| `Enter`                          | Submit prompt or slash command |
| `↑` / `↓`                        | Navigate input history         |
| `Backspace`                      | Delete one character           |
| `Ctrl+C` (once, while streaming) | Abort current request          |
| `Ctrl+C` (twice, idle)           | Quit                           |
