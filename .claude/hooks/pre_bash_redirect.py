#!/usr/bin/env python3
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

"""Enforce shell policy for shared Claude/Cursor hook flows.

Hook wiring:
- Claude: `.claude/settings.json` -> `PreToolUse` matcher `Bash`
- Cursor: enable third-party Claude config so Cursor executes the same
  `PreToolUse` hook from `.claude/settings.json` (`.cursor/hooks.json` is
  metrics-only in this repo).

Exit code semantics (as of Claude Code hooks):
- exit 0: allow tool call
- exit 2: BLOCK; stderr is fed back to Claude so it corrects its plan automatically
"""

import json
import re
import sys

# Pattern to match pytest commands, including:
#   - pytest
#   - python -m pytest
#   - python3 -m pytest
#   - uv run pytest
#   - uv run python -m pytest
#   - with optional whitespace variations
PYTEST_PATTERN = re.compile(
    r"""
    ^                       # start of string
    (?:uv\s+run\s+)?        # optional 'uv run' prefix
    (?:                     # non-capturing group for optional python invocation
        python              # 'python'
        (?:3)?              # optional '3'
        \s+                 # whitespace
        -m                  # '-m'
        \s+                 # whitespace
    )?
    pytest                  # 'pytest'
    \b                      # word boundary
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Commands that must be run via `uv run`
UV_RUN_COMMANDS = ("python", "python3", "pytest", "ruff", "mypy", "ty", "streamlit")


def _extract_command(payload: dict[str, object]) -> str:
    """Extract command from Claude/Cursor hook payloads.

    Returns an empty string if this payload is not a shell hook invocation.
    """
    event_name = payload.get("hook_event_name")

    if event_name == "PreToolUse":
        # Claude payload: {"tool_name":"Bash","tool_input":{"command":"..."}}
        if payload.get("tool_name") != "Bash":
            return ""
        tool_input = payload.get("tool_input")
        if isinstance(tool_input, dict):
            command = tool_input.get("command", "")
            return command if isinstance(command, str) else ""
        return ""

    # Fallback for compatibility if event names are omitted or changed.
    # Also covers Cursor-style payloads with top-level `command`.
    command = payload.get("command")
    if isinstance(command, str):
        return command
    tool_input = payload.get("tool_input")
    if isinstance(tool_input, dict):
        maybe_command = tool_input.get("command", "")
        return maybe_command if isinstance(maybe_command, str) else ""
    return ""


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception as e:
        # Fail secure: block (exit 2) if we can't parse input to verify safety.
        print(  # noqa: T201
            f"Policy: Failed to parse hook input ({type(e).__name__}: {e}). "
            f"Blocking tool call for safety.",
            file=sys.stderr,
        )
        sys.exit(2)

    cmd = _extract_command(payload)
    if not cmd:
        sys.exit(0)
    norm = re.sub(r"\s+", " ", cmd).strip()

    # Check if this is a pytest command targeting e2e_playwright
    if PYTEST_PATTERN.search(norm) and "e2e_playwright" in norm:
        print(  # noqa: T201
            f"Policy: Bash('{norm}') is blocked.\n"
            f"E2E tests should use 'make run-e2e-test <filename>' instead.\n",
            file=sys.stderr,
        )
        sys.exit(2)

    # Check if command starts with a Python tool that requires `uv run`
    first_word = norm.split()[0] if norm else ""
    if first_word in UV_RUN_COMMANDS:
        print(  # noqa: T201
            f"Policy: Bash('{norm}') is blocked.\n"
            f"Use 'uv run {norm}' instead of running '{first_word}' directly.\n",
            file=sys.stderr,
        )
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
