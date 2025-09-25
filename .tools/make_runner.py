#!/usr/bin/env python3
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""
MCP 'make' server for the Streamlit repo.

Features
- Discovers Make targets dynamically from the top-level Makefile.
- Prefers targets documented with "##" (help-style comments). Falls back to .PHONY,
  then to first-column targets if no docs/PHONY are found.
- Tools:
    * targets()  -> list[str]
    * describe(target) -> str
    * run(target, extra_args=None, cwd=None) -> combined stdout/stderr with exit_code
"""

from __future__ import annotations

import asyncio
import os
import re
from pathlib import Path

# Using the official MCP Python SDK's FastMCP interface.
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("make")  # Tools will appear to the model as: make.targets, make.run, etc.

# ---------- Target discovery ----------

_HELP_LINE = re.compile(r"^([A-Za-z0-9_.-]+):(?:[^#\n]*?)##\s*(.+)", re.MULTILINE)
_PHONY = re.compile(r"^\s*\.PHONY:\s*(.+)", re.MULTILINE)
_TARGET = re.compile(
    r"^([A-Za-z0-9_.-]+)\s*:\s*(?:[^=].*)?", re.MULTILINE
)  # non-pattern (skip variable assigns)


def _repo_root() -> Path:
    # Resolve to repo root; PROJECT_DIR is provided by .mcp.json (fallback to CWD)
    return Path(os.getenv("PROJECT_DIR", os.getcwd())).resolve()


def _parse_makefile_text(text: str) -> dict[str, str]:
    """Return a mapping: target -> doc (doc may be "").

    Order of preference:
        1) targets with trailing "## description"
        2) .PHONY list
        3) any first-column target definitions
    """
    docs: dict[str, str] = {}
    for m in _HELP_LINE.finditer(text):
        docs[m.group(1)] = m.group(2).strip()

    phony: set[str] = set()
    for m in _PHONY.finditer(text):
        for tok in m.group(1).split():
            if tok:
                phony.add(tok.strip())

    defs: set[str] = set()
    for m in _TARGET.finditer(text):
        tgt = m.group(1)
        if not tgt or tgt.startswith(".") or "%" in tgt:
            continue
        defs.add(tgt)

    if docs:
        # public, documented targets (best)
        final = {
            t: docs.get(t, "") for t in (set(docs.keys()) | (phony & set(docs.keys())))
        }
    elif phony:
        # fall back to .PHONY as public set
        final = dict.fromkeys(phony, "")
    else:
        # last resort: any first-column targets
        final = dict.fromkeys(defs, "")

    # Keep deterministic order
    return dict(sorted(final.items(), key=lambda kv: kv[0]))


def _discover_targets() -> dict[str, str]:
    mk = _repo_root() / "Makefile"
    if not mk.exists():
        return {}
    text = mk.read_text(encoding="utf-8", errors="ignore")
    return _parse_makefile_text(text)


# ---------- Tools ----------


@mcp.tool()
async def targets() -> list[str]:
    """Return available make targets (auto-discovered)."""
    return list(_discover_targets().keys())


@mcp.tool()
async def describe(target: str) -> str:
    """Return an optional description string for a target, if documented."""
    return _discover_targets().get(target, "")


@mcp.tool()
async def run(
    target: str, extra_args: list[str] | None = None, cwd: str | None = None
) -> str:
    """
    Run a discovered make target. Fails fast if the target isn't known.
    Returns echo of the command, exit_code, stdout, and stderr.
    """
    allowed = set(_discover_targets().keys())
    if target not in allowed:
        return f"error: unknown make target: {target}\nallowed: {sorted(allowed)}"

    workdir = Path(cwd).resolve() if cwd else _repo_root()
    cmd = ["make", target] + (list(extra_args) if extra_args else [])

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(workdir),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()

    return (
        f"$ {' '.join(cmd)} (cwd={workdir})\n"
        f"exit_code={proc.returncode}\n"
        f"--- stdout ---\n{out.decode(errors='ignore')}\n"
        f"--- stderr ---\n{err.decode(errors='ignore')}"
    )


if __name__ == "__main__":
    # Stdio transport works in Claude Code & most MCP clients.
    mcp.run(transport="stdio")
