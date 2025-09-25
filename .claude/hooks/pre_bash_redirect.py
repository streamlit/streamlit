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
PreToolUse(Bash) hook: block pytest commands for e2e_playwright and redirect to make targets.

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
#   - with optional whitespace variations
PYTEST_PATTERN = re.compile(
    r"""
    ^                       # start of string
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

    # Check if this is a pytest command targeting e2e_playwright
    if PYTEST_PATTERN.search(norm) and "e2e_playwright" in norm:
        print(  # noqa: T201
            f"Policy: Bash('{norm}') is blocked.\n"
            f"E2E tests should use make commands instead:\n"
            f"  - Run 'make help' to see available targets\n"
            f"  - Use 'make run-e2e-test <filename>' for e2e tests\n",
            file=sys.stderr,
        )
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
