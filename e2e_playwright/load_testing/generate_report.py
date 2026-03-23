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

"""Generate markdown summary reports from load test results.

Usage:
    uv run python e2e_playwright/load_testing/generate_report.py \
        --results-dir=e2e_playwright/load_testing/results \
        --output=e2e_playwright/load_testing/results/summary.md
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _load_results(
    results_dir: Path,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """Load results from the results directory.

    Returns a tuple of (metadata, scenarios). Supports both:
    - New combined format: single load-test-results.json with metadata and scenarios array
    - Legacy format: multiple per-scenario JSON files

    For combined format, returns the metadata dict and scenarios list.
    For legacy format, returns None for metadata and list of per-scenario dicts.
    """
    combined_file = results_dir / "load-test-results.json"
    if combined_file.exists():
        with open(combined_file, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("metadata"), data.get("scenarios", [])

    # Fall back to legacy per-scenario files
    scenarios = []
    for filepath in sorted(results_dir.glob("*.json")):
        if filepath.name == "load-test-results.json":
            continue
        with open(filepath, encoding="utf-8") as f:
            result = json.load(f)
        # Convert legacy format to new scenario format
        scenarios.append(
            {
                "scenario": result.get("metadata", {}).get("scenario", "unknown"),
                "concurrent_users": result.get("metadata", {}).get(
                    "concurrent_users", 0
                ),
                "server_metrics": result.get("server_metrics", {}),
                "session_metrics": result.get("session_metrics", {}),
                "duration_seconds": result.get("test_info", {}).get(
                    "total_duration_s", 0
                ),
            }
        )
    # Extract metadata from first legacy result if available
    metadata = None
    if scenarios:
        first_file = next(results_dir.glob("*.json"), None)
        if first_file:
            with open(first_file, encoding="utf-8") as f:
                first_result = json.load(f)
            metadata = {
                "timestamp": first_result.get("metadata", {}).get("timestamp"),
                "git_sha": first_result.get("metadata", {}).get("git_sha"),
                "git_branch": first_result.get("metadata", {}).get("git_branch"),
                "runner": first_result.get("metadata", {}).get("runner"),
            }
    return metadata, scenarios


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


def _generate_scenario_table(scenarios: list[dict[str, Any]]) -> str:
    if not scenarios:
        return "No results found.\n"

    lines = [
        "| Scenario | Users | Duration | P95 Load (ms) | Memory Peak | CPU Avg | Success Rate |",
        "|----------|-------|----------|---------------|-------------|---------|--------------|",
    ]

    for scenario in scenarios:
        server = scenario.get("server_metrics", {})
        session = scenario.get("session_metrics", {})

        name = scenario.get("scenario", "unknown")
        users = scenario.get("concurrent_users", 0)
        duration = _format_duration(scenario.get("duration_seconds", 0))
        p95_load = f"{session.get('initial_load_time_ms', {}).get('p95', 0):.0f}"
        memory_peak = _format_memory(server.get("memory_rss_mb_peak", 0))
        cpu_avg = f"{server.get('cpu_percent_avg', 0):.1f}%"

        completed = session.get("sessions_completed", 0)
        total = session.get("total_sessions", 0)
        success_rate = f"{(completed / total * 100) if total else 0:.1f}%"

        lines.append(
            f"| {name} | {users} | {duration} | {p95_load} | "
            f"{memory_peak} | {cpu_avg} | {success_rate} |"
        )

    return "\n".join(lines) + "\n"


def _generate_detailed_section(scenario: dict[str, Any]) -> str:
    server = scenario.get("server_metrics", {})
    session = scenario.get("session_metrics", {})

    name = scenario.get("scenario", "unknown")
    load_times = session.get("initial_load_time_ms", {})
    rerun_times = session.get("rerun_time_ms", {})

    lines = [
        f"### {name}",
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


def _generate_report(
    metadata: dict[str, Any] | None, scenarios: list[dict[str, Any]]
) -> str:
    if not scenarios:
        return "# Load Test Results\n\nNo results found.\n"

    metadata = metadata or {}
    timestamp = metadata.get("timestamp", datetime.now(timezone.utc).isoformat())
    git_sha = metadata.get("git_sha", "unknown")
    git_branch = metadata.get("git_branch", "unknown")

    lines = [
        "# Load Test Results",
        "",
        f"**Timestamp:** {timestamp}",
        f"**Branch:** {git_branch}",
        f"**Commit:** {git_sha[:8] if len(git_sha) >= 8 else git_sha}",
        "",
        "## Summary",
        "",
        _generate_scenario_table(scenarios),
        "",
        "## Detailed Results",
        "",
    ]

    for scenario in scenarios:
        lines.append(_generate_detailed_section(scenario))

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

    metadata, scenarios = _load_results(args.results_dir)
    if not scenarios:
        print(f"No JSON result files found in: {args.results_dir}")
        return 1

    report = _generate_report(metadata, scenarios)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"Report written to: {args.output}")
    print(f"Processed {len(scenarios)} scenarios")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
