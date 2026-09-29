# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""MCP adapter over Streamlit's agent JSON endpoint and PDF report helpers."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

from streamlit_mcp.client import AgentClient, AgentClientError
from streamlit_mcp.report import collect, write_report

DEFAULT_APP_URL = "http://127.0.0.1:8501"

mcp = FastMCP(
    "streamlit-mcp",
    instructions=(
        "Inspect a running Streamlit app through POST /_stcore/agent/v1/interact "
        "and generate a PDF report from the returned snapshot. The app must be "
        "started with --server.enableAgentApi true. The endpoint is loopback-only."
    ),
)

_app_url = os.environ.get("STREAMLIT_APP_URL", DEFAULT_APP_URL)
_session_id: str | None = None


def _client(app_url: str | None = None) -> AgentClient:
    global _app_url
    if app_url:
        _app_url = app_url
    return AgentClient(_app_url)


def _fail(exc: Exception) -> str:
    return _dumps({"error": type(exc).__name__, "message": str(exc)})


def _remember(snapshot: dict[str, Any]) -> dict[str, Any]:
    global _session_id
    session_id = snapshot.get("session_id")
    if isinstance(session_id, str):
        _session_id = session_id
    return snapshot


def _require_session(session_id: str | None) -> str:
    chosen = session_id or _session_id
    if not chosen:
        raise AgentClientError(
            "No session_id. Call inspect_app first or pass session_id."
        )
    return chosen


def _dumps(payload: Any) -> str:
    return json.dumps(payload, default=str, indent=2)


@mcp.tool()
def inspect_app(app_url: str | None = None) -> str:
    """Create an agent session and return a compact description of the app.

    Use this first. It returns title, metrics, widgets (keys and values),
    tables, charts, and available actions. Later tools reuse the session_id.
    """
    try:
        snapshot = _remember(_client(app_url).interact({}))
    except AgentClientError as exc:
        return _fail(exc)
    facts = collect(snapshot)
    return _dumps(
        {
            "session_id": facts["session_id"],
            "status": facts["status"],
            "title": facts["title"],
            "caption": facts["caption"],
            "page": facts["page"],
            "metrics": facts["metrics"],
            "widgets": facts["widgets"],
            "actions": facts["actions"],
            "tables": [
                {
                    "type": table["type"],
                    "location": table["location"],
                    "columns": table["columns"],
                    "row_count": table["row_count"],
                }
                for table in facts["tables"]
            ],
            "charts": [
                {
                    "type": chart["type"],
                    "location": chart["location"],
                    "alt": chart["alt"],
                    "columns": chart["columns"],
                    "value_count": len(chart["values"]),
                }
                for chart in facts["charts"]
            ],
            "element_counts": facts["counts"],
        }
    )


@mcp.tool()
def get_snapshot(session_id: str | None = None, app_url: str | None = None) -> str:
    """Return the full agent JSON snapshot for the current or given session."""
    try:
        snapshot = _remember(
            _client(app_url).interact({"session_id": _require_session(session_id)})
        )
    except AgentClientError as exc:
        return _fail(exc)
    return _dumps(snapshot)


@mcp.tool()
def set_widget_values(
    widget_state: dict[str, Any],
    session_id: str | None = None,
    app_url: str | None = None,
) -> str:
    """Patch widget keys on an existing session and return the compact app view.

    widget_state maps widget keys to JSON values, e.g. {"region": "Europe"}.
    Creating a session cannot include widget_state; call inspect_app first.
    """
    try:
        snapshot = _remember(
            _client(app_url).interact(
                {
                    "session_id": _require_session(session_id),
                    "widget_state": widget_state,
                }
            )
        )
    except AgentClientError as exc:
        return _fail(exc)
    return _dumps(collect(snapshot))


@mcp.tool()
def trigger_action(
    key: str,
    session_id: str | None = None,
    app_url: str | None = None,
) -> str:
    """Fire a trigger widget such as a button, then return the compact app view."""
    try:
        snapshot = _remember(
            _client(app_url).interact(
                {
                    "session_id": _require_session(session_id),
                    "trigger": {"key": key},
                }
            )
        )
    except AgentClientError as exc:
        return _fail(exc)
    return _dumps(collect(snapshot))


@mcp.tool()
def create_report(
    output_path: str | None = None,
    widget_state: dict[str, Any] | None = None,
    app_url: str | None = None,
) -> str:
    """Write a PDF briefing from the agent snapshot.

    Creates a fresh session, optionally applies widget_state, and renders the
    generic Streamlit-styled report (metrics, widgets, charts, tables).
    """
    target = Path(output_path) if output_path else Path.cwd() / "streamlit-report.pdf"
    patches = [widget_state] if widget_state else []
    try:
        written = write_report(
            _client(app_url).url,
            target,
            widget_patches=patches,
        )
    except AgentClientError as exc:
        return _fail(exc)
    return _dumps({"path": str(written.resolve())})


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="MCP adapter for Streamlit's agent JSON endpoint."
    )
    parser.add_argument(
        "--app-url",
        default=os.environ.get("STREAMLIT_APP_URL", DEFAULT_APP_URL),
        help="Streamlit origin or full interact URL (default 127.0.0.1:8501).",
    )
    parser.add_argument(
        "--transport",
        choices=("stdio", "http"),
        default=os.environ.get("STREAMLIT_MCP_TRANSPORT", "stdio"),
        help="stdio for a local spawn; http to listen on a port (Streamable HTTP).",
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("STREAMLIT_MCP_HOST", "127.0.0.1"),
        help="Bind address for --transport http (default 127.0.0.1).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("STREAMLIT_MCP_PORT", "8765")),
        help="Bind port for --transport http (default 8765).",
    )
    args, _unknown = parser.parse_known_args(argv)
    return args


def main() -> None:
    global _app_url
    args = parse_args()
    _app_url = args.app_url
    if args.transport == "stdio":
        mcp.run()
        return

    mcp.settings.host = args.host
    mcp.settings.port = args.port
    mcp_url = f"http://{args.host}:{args.port}{mcp.settings.streamable_http_path}"
    print(f"Streamlit MCP listening at {mcp_url}", file=sys.stderr)
    mcp.run(transport="streamable-http")


if __name__ == "__main__":
    main()
