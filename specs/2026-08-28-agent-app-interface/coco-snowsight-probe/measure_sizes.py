"""Measure the MCP `interact` result size for each probe payload size.

Usage:

    python measure_sizes.py http://localhost:8501 1 64 256 1024
    MCP_AUTH='Snowflake Token="..."' python measure_sizes.py https://<ingress> 1 64

Prints one row per payload size: the HTTP body's bytes, and the bytes of the
result's `content[0].text`, which is what most MCP clients hand the model.
`structuredContent` carries the same JSON again, so the body is about twice the
text.
"""

# A command-line tool for any base URL the caller gives, and this folder is not a
# package.
# ruff: noqa: INP001, S310, T201

from __future__ import annotations

import json
import os
import sys
import time
import urllib.request

MCP_PATH = "/_stcore/agent/v1/mcp"


def call(base_url: str, arguments: dict) -> tuple[bytes, float]:
    message = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": "interact", "arguments": arguments},
    }
    headers = {"Content-Type": "application/json"}
    if auth := os.environ.get("MCP_AUTH"):
        headers["Authorization"] = auth
    request = urllib.request.Request(
        base_url.rstrip("/") + MCP_PATH,
        data=json.dumps(message).encode(),
        headers=headers,
        method="POST",
    )
    started = time.monotonic()
    with urllib.request.urlopen(request, timeout=300) as response:
        body = response.read()
    return body, time.monotonic() - started


def main() -> None:
    base_url, *sizes = sys.argv[1:]
    body, _ = call(base_url, {})
    session_id = json.loads(body)["result"]["structuredContent"]["session_id"]
    print("payload_kb\tbody_bytes\ttext_bytes\tseconds")
    for kb in sizes:
        body, seconds = call(
            base_url,
            {"session_id": session_id, "widget_state": {"payload_kb": int(kb)}},
        )
        text = json.loads(body)["result"]["content"][0]["text"]
        print(f"{kb}\t{len(body)}\t{len(text.encode())}\t{seconds:.2f}")


if __name__ == "__main__":
    main()
