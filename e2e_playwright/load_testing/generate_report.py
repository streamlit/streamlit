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

"""Generate summary reports from load test results.

Usage:
    uv run python e2e_playwright/load_testing/generate_report.py \
        --results-dir=e2e_playwright/load_testing/results \
        --output=e2e_playwright/load_testing/results/summary.md
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


def _load_results(results_dir: Path) -> list[dict[str, Any]]:
    """Load all JSON result files from the results directory."""
    results = []
    for filepath in sorted(results_dir.glob("*.json")):
        with open(filepath, encoding="utf-8") as f:
            data = json.load(f)
            data["_filepath"] = str(filepath)
            results.append(data)
    return results


def _format_duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes = int(seconds // 60)
    secs = seconds % 60
    return f"{minutes}m {secs:.0f}s"


def _format_memory(mb: float) -> str:
    if mb >= 1024:
        return f"{mb / 1024:.2f} GB"
    return f"{mb:.1f} MB"


def _generate_scenario_table(results: list[dict[str, Any]]) -> str:
    if not results:
        return "No results found.\n"

    lines = [
        "| Scenario | Users | Duration | P95 Load (ms) | Memory Peak | CPU Avg | Success Rate |",
        "|----------|-------|----------|---------------|-------------|---------|--------------|",
    ]

    for result in results:
        meta = result.get("metadata", {})
        server = result.get("server_metrics", {})
        session = result.get("session_metrics", {})
        test_info = result.get("test_info", {})

        scenario = meta.get("scenario", "unknown")
        users = meta.get("concurrent_users", 0)
        duration = _format_duration(test_info.get("total_duration_s", 0))
        p95_load = f"{session.get('initial_load_time_ms', {}).get('p95', 0):.0f}"
        memory_peak = _format_memory(server.get("memory_rss_mb_peak", 0))
        cpu_avg = f"{server.get('cpu_percent_avg', 0):.1f}%"

        completed = session.get("sessions_completed", 0)
        total = session.get("total_sessions", 0)
        success_rate = f"{(completed / total * 100) if total else 0:.1f}%"

        lines.append(
            f"| {scenario} | {users} | {duration} | {p95_load} | "
            f"{memory_peak} | {cpu_avg} | {success_rate} |"
        )

    return "\n".join(lines) + "\n"


def _generate_detailed_section(result: dict[str, Any]) -> str:
    meta = result.get("metadata", {})
    server = result.get("server_metrics", {})
    session = result.get("session_metrics", {})

    scenario = meta.get("scenario", "unknown")
    load_times = session.get("initial_load_time_ms", {})
    rerun_times = session.get("rerun_time_ms", {})

    lines = [
        f"### {scenario}",
        "",
        "**Server Metrics:**",
        f"- Memory Start: {_format_memory(server.get('memory_rss_mb_start', 0))}",
        f"- Memory End: {_format_memory(server.get('memory_rss_mb_end', 0))}",
        f"- Memory Peak: {_format_memory(server.get('memory_rss_mb_peak', 0))}",
        f"- Memory Growth: {_format_memory(server.get('memory_rss_mb_growth', 0))}",
        f"- CPU Average: {server.get('cpu_percent_avg', 0):.1f}%",
        f"- CPU Peak: {server.get('cpu_percent_peak', 0):.1f}%",
        f"- Max Threads: {server.get('thread_count_max', 0)}",
        "",
        "**Load Times (ms):**",
        f"- Min: {load_times.get('min', 0):.0f}",
        f"- P50: {load_times.get('p50', 0):.0f}",
        f"- P95: {load_times.get('p95', 0):.0f}",
        f"- P99: {load_times.get('p99', 0):.0f}",
        f"- Max: {load_times.get('max', 0):.0f}",
        "",
    ]

    if rerun_times and rerun_times.get("p50", 0) > 0:
        lines.extend(
            [
                "**Rerun Times (ms):**",
                f"- Min: {rerun_times.get('min', 0):.0f}",
                f"- P50: {rerun_times.get('p50', 0):.0f}",
                f"- P95: {rerun_times.get('p95', 0):.0f}",
                f"- Max: {rerun_times.get('max', 0):.0f}",
                "",
            ]
        )

    errors = session.get("errors", [])
    if errors:
        lines.extend(
            [
                "**Errors:**",
                *[f"- {error}" for error in errors[:5]],
                "",
            ]
        )

    return "\n".join(lines)


def _generate_report(results: list[dict[str, Any]]) -> str:
    if not results:
        return "# Load Test Results\n\nNo results found.\n"

    first_meta = results[0].get("metadata", {})
    timestamp = first_meta.get("timestamp", datetime.now().isoformat())
    git_sha = first_meta.get("git_sha", "unknown")
    git_branch = first_meta.get("git_branch", "unknown")

    lines = [
        "# Load Test Results",
        "",
        f"**Timestamp:** {timestamp}",
        f"**Branch:** {git_branch}",
        f"**Commit:** {git_sha[:8] if len(git_sha) >= 8 else git_sha}",
        "",
        "## Summary",
        "",
        _generate_scenario_table(results),
        "",
        "## Detailed Results",
        "",
    ]

    for result in results:
        lines.append(_generate_detailed_section(result))

    return "\n".join(lines)


def main() -> int:
    """Main entry point for the report generator."""
    parser = argparse.ArgumentParser(description="Generate load test summary report")
    parser.add_argument(
        "--results-dir",
        type=Path,
        required=True,
        help="Directory containing JSON result files",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output path for the markdown summary",
    )
    args = parser.parse_args()

    if not args.results_dir.exists():
        print(f"Results directory not found: {args.results_dir}")
        return 1

    results = _load_results(args.results_dir)
    if not results:
        print(f"No JSON result files found in: {args.results_dir}")
        return 1

    report = _generate_report(results)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"Report written to: {args.output}")
    print(f"Processed {len(results)} result files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
