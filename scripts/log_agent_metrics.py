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

"""Append Claude skill/subagent metrics as NDJSON in work-tmp/agent-metrics.

Usage:
    log_agent_metrics.py skill_invocation [skill-name]   # name from arg or payload
    log_agent_metrics.py subagent_invocation
    log_agent_metrics.py --stats
    log_agent_metrics.py --post
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Final

_METRICS_DIR: Final[str] = "work-tmp/agent-metrics"


def _get_git_branch(project_dir: str) -> str:
    """Return current git branch name, falling back to 'detached-<sha>' or 'unknown'."""
    try:
        branch = subprocess.check_output(
            ["git", "-C", project_dir, "rev-parse", "--abbrev-ref", "HEAD"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return "unknown"

    if branch != "HEAD":
        return branch

    try:
        sha = subprocess.check_output(
            ["git", "-C", project_dir, "rev-parse", "--short", "HEAD"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        return f"detached-{sha}"
    except Exception:
        return "unknown"


def _sanitize_branch(branch: str) -> str:
    """Sanitize branch name for use as a filename."""
    safe = re.sub(r"[/\s]", "_", branch)
    safe = re.sub(r"[^A-Za-z0-9_.-]", "", safe)
    return safe or "unknown"


def _read_payload() -> dict[str, Any]:
    """Parse JSON payload from stdin, returning empty dict on failure."""
    raw = sys.stdin.read()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _normalize_optional(value: Any) -> str | None:
    """Normalize empty/whitespace values to None for compact NDJSON records."""
    if isinstance(value, str):
        value = value.strip()
    if value:
        return str(value)
    return None


def _get_log_path(project_dir: str) -> Path:
    """Return the log file path for the current branch."""
    branch = _get_git_branch(project_dir)
    return Path(project_dir) / _METRICS_DIR / f"{_sanitize_branch(branch)}.ndjson"


def _get_stats(project_dir: str) -> dict[tuple[str, str], int] | None:
    """Return invocation counts from the log file for the current branch.

    Returns None if no metrics file exists.
    """
    from collections import Counter

    log_path = _get_log_path(project_dir)
    if not log_path.exists():
        return None

    counts: Counter[tuple[str, str]] = Counter()
    with log_path.open(encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if not stripped:
                continue
            try:
                entry = json.loads(stripped)
                entry_type = entry.get("type", "unknown")
                name = entry.get("name") or "unknown"
                counts[entry_type, name] += 1
            except json.JSONDecodeError:
                continue

    return dict(counts)


def _print_stats(project_dir: str) -> int:
    """Print invocation counts from the log file for the current branch.

    Output format (CSV-like): type,name,count
    """
    counts = _get_stats(project_dir)
    if counts is None:
        print(f"No metrics file found: {_get_log_path(project_dir)}", file=sys.stderr)
        return 1

    for (entry_type, name), count in sorted(counts.items()):
        print(f"{entry_type},{name},{count}")

    return 0


_METRICS_SECTION_START: Final[str] = "<!-- agent-metrics-start -->"
_METRICS_SECTION_END: Final[str] = "<!-- agent-metrics-end -->"


def _post_stats_to_pr(project_dir: str) -> int:
    """Post or update agent metrics in the current PR's body."""
    # Get stats
    counts = _get_stats(project_dir)
    if counts is None:
        print("No metrics to post.", file=sys.stderr)
        return 1

    if not counts:
        print("No metrics recorded yet.", file=sys.stderr)
        return 0

    # Build markdown table
    lines = [
        _METRICS_SECTION_START,
        "<details>",
        "<summary>Agent metrics</summary>",
        "",
        "| Type | Name | Count |",
        "|------|------|------:|",
    ]
    for (entry_type, name), count in sorted(counts.items()):
        lines.append(f"| {entry_type} | {name} | {count} |")
    lines.extend(["", "</details>", _METRICS_SECTION_END])
    metrics_section = "\n".join(lines)

    # Get current PR body
    try:
        pr_body = subprocess.check_output(
            ["gh", "pr", "view", "--json", "body", "--jq", ".body"],
            cwd=project_dir,
            text=True,
            stderr=subprocess.PIPE,
        ).rstrip("\n")
    except subprocess.CalledProcessError as e:
        print(f"Failed to get PR body: {e.stderr}", file=sys.stderr)
        return 1

    # Update or append metrics section
    pattern = re.compile(
        rf"{re.escape(_METRICS_SECTION_START)}.*?{re.escape(_METRICS_SECTION_END)}",
        re.DOTALL,
    )
    if pattern.search(pr_body):
        new_body = pattern.sub(metrics_section, pr_body)
    else:
        new_body = pr_body.rstrip() + "\n\n" + metrics_section

    # Update PR
    try:
        subprocess.run(
            ["gh", "pr", "edit", "--body", new_body],
            cwd=project_dir,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        print(f"Failed to update PR: {e.stderr}", file=sys.stderr)
        return 1

    print("Agent metrics posted to PR.")
    return 0


def main() -> int:
    """Log a skill or subagent invocation to an NDJSON file."""
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

    if len(sys.argv) > 1 and sys.argv[1] == "--stats":
        return _print_stats(project_dir)

    if len(sys.argv) > 1 and sys.argv[1] == "--post":
        return _post_stats_to_pr(project_dir)

    source_tag = sys.argv[1] if len(sys.argv) > 1 else "hook"
    explicit_name = sys.argv[2] if len(sys.argv) > 2 else ""

    payload = _read_payload()

    if source_tag == "skill_invocation":
        entry_type = "skill"
        # Use explicit name if provided, else extract from PreToolUse payload
        if explicit_name:
            name = explicit_name
        else:
            tool_input = payload.get("tool_input") or {}
            name = tool_input.get("skill") or ""
    elif source_tag == "subagent_invocation":
        entry_type = "subagent"
        name = explicit_name or str(payload.get("agent_type") or "")
    else:
        return 0

    branch = _get_git_branch(project_dir)
    log_path = Path(project_dir) / _METRICS_DIR / f"{_sanitize_branch(branch)}.ndjson"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    entry = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "branch": branch,
        "session_id": _normalize_optional(payload.get("session_id")),
        "type": entry_type,
        "name": _normalize_optional(name),
    }

    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=True, separators=(",", ":")) + "\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
