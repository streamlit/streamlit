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

"""
Fetch the top flaky E2E tests from recent playwright.yml CI runs.

This script analyzes successful playwright.yml workflow runs from the last N days,
downloads their test-stats.json artifacts, and identifies tests that required reruns.

Usage: uv run scripts/fetch_flaky_tests.py
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Final

_BROWSERS: Final = ("chromium", "firefox", "webkit")


def _run_gh_command(args: list[str]) -> str:
    """Run a gh CLI command and return the output."""
    result = subprocess.run(
        ["gh", *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(f"Error running gh command: {' '.join(args)}", file=sys.stderr)
        print(f"stderr: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    return result.stdout


def _fetch_successful_workflow_runs(
    days: int = 4, limit: int = 100
) -> list[dict[str, Any]]:
    """Fetch successful playwright.yml workflow runs from the last N days."""
    since_date = datetime.now(timezone.utc) - timedelta(days=days)

    output = _run_gh_command(
        [
            "run",
            "list",
            "--workflow=playwright.yml",
            "--status=success",
            f"--limit={limit}",
            "--json=databaseId,createdAt,headSha,displayTitle",
        ]
    )

    runs = json.loads(output)

    return [
        run
        for run in runs
        if datetime.fromisoformat(run["createdAt"].replace("Z", "+00:00")) >= since_date
    ]


def _download_test_stats(run_id: int, temp_dir: Path) -> dict[str, Any] | None:
    """Download and extract test-stats.json from a workflow run's artifact."""
    result = subprocess.run(
        [
            "gh",
            "run",
            "download",
            str(run_id),
            "--name=playwright_test_stats",
            f"--dir={temp_dir / str(run_id)}",
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        return None

    stats_file = temp_dir / str(run_id) / "test-stats.json"
    if not stats_file.exists():
        return None

    with open(stats_file, encoding="utf-8") as f:
        stats_data: dict[str, Any] = json.load(f)
        return stats_data


def _extract_flaky_tests(test_stats: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract tests that required reruns from test-stats.json."""
    return [
        {
            "nodeid": detail["nodeid"],
            "rerun_count": detail.get("rerun_count", 0),
            "browser": detail.get("browser", "unknown"),
            "final_outcome": detail.get("final_outcome", "unknown"),
        }
        for detail in test_stats.get("rerun_details", [])
        if detail.get("rerun_count", 0) > 0
    ]


def _normalize_test_name(nodeid: str) -> str:
    """Normalize test name by removing browser suffix for aggregation."""
    for browser in _BROWSERS:
        suffix = f"[{browser}]"
        if nodeid.endswith(suffix):
            return nodeid[: -len(suffix)]
    return nodeid


def _sort_key(item: dict[str, Any]) -> tuple[int, int]:
    """Sort by total reruns (descending), then browser rerun count (descending)."""
    return (-int(item["total_reruns"]), -int(item["browser_rerun_count"]))


def _aggregate_flaky_tests(
    all_flaky_tests: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Aggregate flaky tests across runs and count total reruns."""
    rerun_counts: Counter[str] = Counter()
    browser_rerun_counts: Counter[str] = Counter()
    browser_info: dict[str, set[str]] = {}

    for test in all_flaky_tests:
        normalized = _normalize_test_name(test["nodeid"])
        rerun_counts[normalized] += test["rerun_count"]
        browser_rerun_counts[normalized] += (
            1  # Counts browser-specific entries, not distinct CI runs
        )
        browser_info.setdefault(normalized, set()).add(test["browser"])

    results = [
        {
            "nodeid": nodeid,
            "total_reruns": total_reruns,
            "browser_rerun_count": browser_rerun_counts[nodeid],
            "browsers": sorted(browser_info[nodeid]),
        }
        for nodeid, total_reruns in rerun_counts.items()
    ]

    results.sort(key=_sort_key)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch top flaky E2E tests from recent CI runs"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=4,
        help="Number of days to look back (default: 4)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Maximum number of workflow runs to fetch (default: 100)",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=10,
        help="Number of top flaky tests to return (default: 10)",
    )
    parser.add_argument(
        "--min-reruns",
        type=int,
        default=2,
        help="Minimum total reruns to include (default: 2)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON",
    )
    args = parser.parse_args()

    print(
        f"Fetching successful playwright.yml runs from the last {args.days} days...",
        file=sys.stderr,
    )
    runs = _fetch_successful_workflow_runs(days=args.days, limit=args.limit)
    print(f"Found {len(runs)} successful runs", file=sys.stderr)

    if not runs:
        print("No successful runs found in the specified time range", file=sys.stderr)
        sys.exit(0)

    all_flaky_tests = []
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        for i, run in enumerate(runs):
            run_id = run["databaseId"]
            print(
                f"Processing run {i + 1}/{len(runs)} (ID: {run_id})...",
                file=sys.stderr,
            )

            test_stats = _download_test_stats(run_id, temp_path)
            if test_stats:
                flaky_tests = _extract_flaky_tests(test_stats)
                all_flaky_tests.extend(flaky_tests)
                if flaky_tests:
                    print(
                        f"  Found {len(flaky_tests)} tests with reruns",
                        file=sys.stderr,
                    )

    aggregated = _aggregate_flaky_tests(all_flaky_tests)
    filtered = [t for t in aggregated if t["total_reruns"] >= args.min_reruns]
    top_flaky = filtered[: args.top]

    if args.json:
        print(json.dumps(top_flaky, indent=2))
    else:
        print("\n" + "=" * 70)
        print(f"Top {len(top_flaky)} Flaky E2E Tests (last {args.days} days)")
        print("=" * 70)

        if not top_flaky:
            print("No flaky tests found with the specified criteria.")
        else:
            for i, test in enumerate(top_flaky, 1):
                print(f"\n{i}. {test['nodeid']}")
                print(f"   Total reruns: {test['total_reruns']}")
                print(f"   Browser rerun count: {test['browser_rerun_count']}")
                print(f"   Browsers affected: {', '.join(test['browsers'])}")

        print("\n" + "=" * 70)


if __name__ == "__main__":
    main()
