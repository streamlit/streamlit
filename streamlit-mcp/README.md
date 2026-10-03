# streamlit-mcp

PoC MCP adapter for Streamlit's loopback agent JSON endpoint. It lives
**outside** `lib/` and talks to a running app over HTTP:

```text
Agent  --stdio or HTTP MCP-->  streamlit-mcp  --POST JSON-->  /_stcore/agent/v1/interact
```

PDF reports reuse the generic snapshot renderer (the same helper previously
used as `work-tmp/agent-report/build_report.py`).

## Run an app with the agent API

```bash
uv run streamlit run work-tmp/agent_demo.py \
  --server.headless true --global.developmentMode false \
  --server.port 8506 --server.enableAgentApi true
```

## Start the MCP server

Stdio (Cursor/Claude spawn the process):

```bash
cd streamlit-mcp
uv run streamlit-mcp --app-url http://127.0.0.1:8506
```

HTTP, so an agent can connect by URL:

```bash
cd streamlit-mcp
uv run streamlit-mcp --app-url http://127.0.0.1:8506 --transport http --port 8765
```

That listens at `http://127.0.0.1:8765/mcp`. Or set `STREAMLIT_APP_URL`,
`STREAMLIT_MCP_TRANSPORT`, `STREAMLIT_MCP_HOST`, and `STREAMLIT_MCP_PORT`.
`--app-url` can be the app origin or the full interact URL.

Cursor (`mcp.json`) for stdio:

```json
{
  "mcpServers": {
    "streamlit": {
      "command": "uv",
      "args": [
        "--directory",
        "/absolute/path/to/streamlit/streamlit-mcp",
        "run",
        "streamlit-mcp",
        "--app-url",
        "http://127.0.0.1:8506"
      ]
    }
  }
}
```

Cursor (`mcp.json`) for a server you already started with `--transport http`:

```json
{
  "mcpServers": {
    "streamlit": {
      "url": "http://127.0.0.1:8765/mcp"
    }
  }
}
```

## Tools

| Tool | Purpose |
|---|---|
| `inspect_app` | Create a session and return title, widgets, metrics, tables, charts |
| `get_snapshot` | Return the full agent JSON tree |
| `set_widget_values` | Patch widget keys on the current session |
| `trigger_action` | Click a trigger widget by key |
| `create_report` | Write a Streamlit-styled PDF from the snapshot |

The endpoint is opt-in and loopback-only. This adapter does not add
authentication of its own.
