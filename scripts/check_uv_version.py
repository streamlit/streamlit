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

"""Fail loudly when the local `uv` is older than the repo's `required-version`.

`[tool.uv] required-version` cannot enforce itself. uv reads the whole
`[tool.uv]` table in one "settings discovery" pass, and a value it does not
understand takes the *entire table* down with a warning rather than an error.
Our table contains `exclude-newer = "24 hours"`, a relative form only newer uv
can parse, so on an older uv every setting is silently discarded --
`required-version` included. uv then sees the lockfile's timestamp cutoff as
removed, re-resolves from scratch, and rewrites `uv.lock`:

    warning: Failed to parse `pyproject.toml` during settings discovery:
      failed to parse year in date "24 hours": ...
    Ignoring existing lockfile due to removal of timestamp cutoff

The floor that exists to prevent this is disabled by the very key that needs
it. This script closes that loop from outside uv, so the failure is an error
with a fix in it instead of a warning nobody reads and a dirty `uv.lock`.

Dropping the table also drops `environments` and `override-dependencies`, so
the re-resolved lock is wrong on top of being noisy, and the 24h cooldown that
`exclude-newer` exists to enforce is not applied at all.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
PYPROJECT = REPO_ROOT / "pyproject.toml"
PRE_COMMIT_CONFIG = REPO_ROOT / ".pre-commit-config.yaml"

# Bump instructions live next to `required-version` in pyproject.toml.
INSTALL_HINT = (
    "Fix it with:\n"
    "    uv self update\n"
    "or, if uv was not installed with the standalone installer:\n"
    "    curl -LsSf https://astral.sh/uv/install.sh | sh"
)


def _release(version: str) -> tuple[int, ...]:
    """Parse `0.11.8` into `(0, 11, 8)`, ignoring any pre-release suffix."""
    match = re.match(r"\s*v?(\d+(?:\.\d+)*)", version)
    if not match:
        raise ValueError(f"cannot parse version: {version!r}")
    return tuple(int(part) for part in match.group(1).split("."))


def _pad(left: tuple[int, ...], right: tuple[int, ...]) -> tuple[tuple, tuple]:
    width = max(len(left), len(right))
    return (
        left + (0,) * (width - len(left)),
        right + (0,) * (width - len(right)),
    )


def _satisfies(version: str, specifier: str) -> bool:
    """Evaluate a comma-separated PEP 440 style specifier without `packaging`.

    `packaging` lives in the dev environment, and this check has to run *before*
    that environment can be trusted -- an old uv is exactly how it gets built
    wrong. Only the operators uv's `required-version` accepts are supported.
    """
    got = _release(version)
    for raw_clause in specifier.split(","):
        clause = raw_clause.strip()
        if not clause:
            continue
        match = re.match(r"(>=|<=|==|!=|>|<)?\s*(.+)", clause)
        if not match:
            raise ValueError(f"cannot parse specifier clause: {clause!r}")
        operator, want_raw = match.group(1) or "==", match.group(2)
        want = _release(want_raw.rstrip(".*"))
        left, right = _pad(got, want)
        if operator == ">=" and not left >= right:
            return False
        if operator == ">" and not left > right:
            return False
        if operator == "<=" and not left <= right:
            return False
        if operator == "<" and not left < right:
            return False
        if operator == "==" and left != right:
            return False
        if operator == "!=" and left == right:
            return False
    return True


def _required_version() -> str | None:
    """Read `[tool.uv] required-version` from the root pyproject.toml.

    tomllib is 3.11+; `make python-init` can run on an older interpreter, so
    fall back to a line match rather than making the guard itself the thing
    that breaks.
    """
    text = PYPROJECT.read_text(encoding="utf-8")
    try:
        import tomllib

        return tomllib.loads(text).get("tool", {}).get("uv", {}).get("required-version")
    except ImportError:
        match = re.search(
            r"^required-version\s*=\s*[\"'](.+?)[\"']", text, re.MULTILINE
        )
        return match.group(1) if match else None


def _pre_commit_uv_rev() -> str | None:
    """Read the pinned `astral-sh/uv-pre-commit` rev.

    The `uv-lock` hook runs its own pinned uv, not the one on PATH, so it is a
    second way an old uv can rewrite `uv.lock`.
    """
    text = PRE_COMMIT_CONFIG.read_text(encoding="utf-8")
    match = re.search(
        r"repo:\s*https://github\.com/astral-sh/uv-pre-commit\s*\n"
        r"(?:\s*#.*\n)*"
        r"\s*rev:\s*[\"']?v?([0-9][^\s\"']*)",
        text,
    )
    return match.group(1) if match else None


def _installed_version() -> str | None:
    uv = shutil.which("uv")
    if uv is None:
        return None
    result = subprocess.run(
        [uv, "--version"], capture_output=True, text=True, check=False
    )
    match = re.search(r"(\d+\.\d+\.\d+)", result.stdout)
    return match.group(1) if match else None


def main() -> int:
    required = _required_version()
    if required is None:
        print(
            "error: could not find `[tool.uv] required-version` in pyproject.toml.\n"
            "       If it was removed on purpose, drop this check too "
            "(scripts/check_uv_version.py).",
            file=sys.stderr,
        )
        return 1

    installed = _installed_version()
    if installed is None:
        print(
            "error: `uv` is not installed or did not report a version.\n"
            + INSTALL_HINT,
            file=sys.stderr,
        )
        return 1

    failed = False

    if not _satisfies(installed, required):
        print(
            f"error: uv {installed} does not satisfy the repo's required-version "
            f"`{required}`.\n"
            "\n"
            "       uv will NOT tell you this itself. `required-version` lives in the\n"
            '       same `[tool.uv]` table as `exclude-newer = "24 hours"`, which an\n'
            "       older uv cannot parse -- so it discards the whole table (the\n"
            "       version floor, `environments`, and `override-dependencies` with\n"
            "       it), warns, then re-resolves and rewrites `uv.lock`.\n"
            "\n"
            "       Symptoms: a dirty `uv.lock` you did not touch, and the `uv-lock`\n"
            '       pre-commit hook failing with "files were modified by this hook".\n'
            "\n" + INSTALL_HINT,
            file=sys.stderr,
        )
        failed = True

    hook_rev = _pre_commit_uv_rev()
    if hook_rev is None:
        print(
            "error: could not find the pinned `astral-sh/uv-pre-commit` rev in "
            ".pre-commit-config.yaml.",
            file=sys.stderr,
        )
        failed = True
    elif not _satisfies(hook_rev, required):
        print(
            f"error: the `astral-sh/uv-pre-commit` rev pinned in "
            f".pre-commit-config.yaml is {hook_rev}, which does not satisfy "
            f"`{required}`.\n"
            "       That hook owns `uv.lock`, and it runs its own pinned uv rather\n"
            "       than the one on PATH -- so it would rewrite the lock on every\n"
            "       commit. Raise the rev to a release that satisfies the floor.",
            file=sys.stderr,
        )
        failed = True

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
