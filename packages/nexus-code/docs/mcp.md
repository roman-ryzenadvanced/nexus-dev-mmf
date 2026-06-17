# MCP (Model Context Protocol) integration

nexus-code supports MCP servers as tool sources. Configure them under
`mcpServers` in `~/.nexus/config.json`:

## stdio transport

```json
{
  "mcpServers": [
    {
      "id": "fs",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/code"]
    }
  ]
}
```

## HTTP transport

```json
{
  "mcpServers": [
    {
      "id": "remote",
      "transport": "http",
      "url": "https://mcp.example.com/sse"
    }
  ]
}
```

## Listing servers

```
/mcp
```

Lists all configured MCP servers and their connection status.

## Invoking MCP tools

When MCP servers are connected, their tools appear in the
`tools` registry. Models that support tool calling (most GLM
models, GPT-4o, Claude 3+) can invoke them transparently
during a chat.

## Adding a server at runtime

Edit `~/.nexus/config.json` and restart the TUI. Runtime
hot-reload is planned for v1.2.
