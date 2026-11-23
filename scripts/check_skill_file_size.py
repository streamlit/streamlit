#!/usr/bin/env python

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

"""Check that every bundled agent skill file fits in one Cortex Code read.

Cortex Code replaces any tool output longer than 500 lines or 50,000
characters with a short tail preview. Its Read tool returns a file as one
``<n>... <line>`` row per line, plus an empty row after a trailing newline,
so an agent that reads a skill file over these limits sees only its last
few lines.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

if __name__ not in {"__main__", "__mp_main__"}:
    raise SystemExit(
        "This file is intended to be executed as an executable program. You cannot use "
        f"it as a module. To run this script, run the ./{__file__} command"
    )

_SKILLS_DIR = "lib/streamlit/.agents/"
# Scripts that skills tell agents to run, not read.
_EXCLUDED_DIRS = (
    "lib/streamlit/.agents/meta-skill/developing-with-streamlit/scripts/",
)
_MAX_READ_ROWS = 500
_MAX_READ_CHARS = 50_000


def _read_tool_output(text: str) -> str:
    return "\n".join(f"{n}... {line}" for n, line in enumerate(text.split("\n"), 1))


def _problem(text: str) -> str | None:
    output = _read_tool_output(text)
    if output.count("\n") + 1 > _MAX_READ_ROWS:
        lines = len(text.splitlines())
        return f"{lines} lines; keep it under {_MAX_READ_ROWS} lines"
    # Cortex Code measures length in UTF-16 code units (JavaScript strings).
    chars = len(output.encode("utf-16-le")) // 2
    if chars > _MAX_READ_CHARS:
        return (
            f"{chars:,} characters as read, with line numbers; "
            f"keep it under {_MAX_READ_CHARS:,}"
        )
    return None


def main() -> None:
    files = subprocess.check_output(["git", "ls-files", _SKILLS_DIR], text=True)
    too_large = 0
    for fileloc in sorted(files.splitlines()):
        if fileloc.startswith(_EXCLUDED_DIRS):
            continue
        try:
            text = Path(fileloc).read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        problem = _problem(text)
        if problem:
            print(f"{fileloc}: {problem}.")
            too_large += 1

    if too_large:
        print(
            f"\n{too_large} agent skill file(s) are too large for Cortex Code's Read "
            "tool, which shows longer files only as a tail preview. Split or trim them."
        )
        sys.exit(1)


main()
