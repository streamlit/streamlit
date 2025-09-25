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
PreToolUse(Bash) hook: block raw pytest/npx/uv and redirect to make targets.

Exit code semantics (as of Claude Code hooks):
- exit 0: allow tool call
- exit 2: BLOCK; stderr is fed back to Claude so it corrects its plan automatically
"""

import json
import re
import sys

BLOCK = [
    # pytest (direct or via python -m)
    (re.compile(r"^(?:python(?:3)?\s+-m\s+)?pytest\b", re.IGNORECASE), "test"),
    # npx (let model map to an appropriate make target, e.g., frontend build/lint)
    (re.compile(r"^npx\b", re.IGNORECASE), None),
    # uv (environment/package runs should be codified as make targets)
    (re.compile(r"^uv\b", re.IGNORECASE), None),
]


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    if payload.get("hook_event_name") != "PreToolUse":
        sys.exit(0)
    if payload.get("tool_name") != "Bash":
        sys.exit(0)

    cmd = (payload.get("tool_input") or {}).get("command", "") or ""
    norm = re.sub(r"\s+", " ", cmd).strip()

    for pat, suggested in BLOCK:
        if pat.search(norm):
            if suggested:
                # Provide a concrete hint (e.g., pytest -> test)
                print(  # noqa: T201
                    f"Policy: Bash('{norm}') is blocked.\n"
                    f"Use make commands instead:\n"
                    f"  - Run 'make help' to see available targets\n",
                    file=sys.stderr,
                )
            else:
                # Generic redirect (npx/uv): force the model to pick an allowed target
                print(  # noqa: T201
                    f"Policy: Bash('{norm}') is blocked.\n"
                    f"Use make commands instead:\n"
                    f"  - Run 'make help' to see available targets\n"
                    f"  - Pick the appropriate make target for this task",
                    file=sys.stderr,
                )
            sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
