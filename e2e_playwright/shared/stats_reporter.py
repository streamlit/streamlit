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
Pytest plugin for collecting and reporting E2E test statistics.

This plugin captures test execution statistics (test duration, status, etc.) and
outputs them to a JSON file that can be used for tracking test performance over time.

Usage:
    - By default, statistics are collected and saved to 'test-results/test-stats.json'
    - Use --stats-output=PATH to specify a custom output file path
    - Use --no-stats to disable statistics collection entirely

The output JSON file (schema_version "1.1") can be uploaded as a CI artifact
for historical performance tracking and analysis.

Schema version history:
    - 1.0: Initial schema with test results, durations, browser breakdown, etc.
    - 1.1: Added fixture statistics (setup/teardown durations, slowest_setup,
           slowest_teardown lists)
"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from statistics import mean, median
from typing import TYPE_CHECKING, Any, Final

import psutil
import pytest

if TYPE_CHECKING:
    from _pytest.config import Config
    from _pytest.reports import TestReport


@dataclass
class TestResult:
    """Holds the result of a single test."""

    nodeid: str
    outcome: str  # "passed", "failed", "skipped", "error"
    duration: float  # in seconds (call phase)
    browser: str | None = None
    rerun_count: int = 0
    worker_id: str | None = None
    setup_duration: float = 0.0  # fixture setup time
    teardown_duration: float = 0.0  # fixture teardown time


@dataclass
class WorkerStats:
    """Statistics for a single xdist worker."""

    test_count: int = 0
    total_runtime: float = 0.0
    memory_mb: float = 0.0  # Memory usage at end of worker session


@dataclass
class StatsCollector:
    """Collects test statistics during a pytest session."""

    results: list[TestResult] = field(default_factory=list)
    session_start_time: float = 0.0
    session_end_time: float = 0.0
    # Track reruns by nodeid
    rerun_counts: dict[str, int] = field(default_factory=dict)
    # Track outcome by nodeid (for deduplication across reruns)
    final_outcomes: dict[str, TestResult] = field(default_factory=dict)
    # Track per-worker statistics
    worker_stats: dict[str, WorkerStats] = field(default_factory=dict)
    # Track setup/teardown durations by nodeid (before TestResult is finalized)
    phase_durations: dict[str, dict[str, float]] = field(default_factory=dict)


_BROWSERS: Final[tuple[str, ...]] = ("chromium", "firefox", "webkit")
_BYTES_PER_MB: Final[int] = 1024 * 1024


def _extract_browser_from_nodeid(nodeid: str) -> str | None:
    """Extract browser name from test nodeid if parametrized with browser."""
    for browser in _BROWSERS:
        if (
            f"[{browser}]" in nodeid
            or f"-{browser}]" in nodeid
            or f"[{browser}-" in nodeid
        ):
            return browser
    return None


def _get_worker_id(report: TestReport | None = None) -> str:
    """Get the xdist worker ID for a test report.

    When running under xdist:
    - On workers: reads from PYTEST_XDIST_WORKER env var
    - On primary: extracts from report.node.gateway.id (forwarded reports)

    Returns 'primary' if not running under xdist.
    """
    # Try to get worker_id from the report's node attribute (xdist forwarded reports)
    if report is not None and hasattr(report, "node"):
        try:
            return str(report.node.gateway.id)
        except AttributeError:
            pass
    # Fall back to env var (works on workers, returns "primary" otherwise)
    return os.getenv("PYTEST_XDIST_WORKER", "primary")


class StatsReporterPlugin:
    """Pytest plugin that collects and reports test statistics."""

    def __init__(self, output_path: Path) -> None:
        self.output_path = output_path
        self.collector = StatsCollector()

    def pytest_sessionstart(self, session: pytest.Session) -> None:  # noqa: ARG002
        """Called at the start of the test session."""
        # Use perf_counter for elapsed time measurement (monotonic, not affected by
        # system clock adjustments like NTP or VM clock drift)
        self.collector.session_start_time = time.perf_counter()

    def pytest_runtest_logreport(self, report: TestReport) -> None:
        """Called after each test phase (setup, call, teardown)."""
        nodeid = report.nodeid

        if report.when == "setup":
            self.collector.phase_durations.setdefault(nodeid, {})["setup"] = (
                report.duration
            )
            if report.outcome == "failed":
                self._record_test_result(report, outcome="error")
            return

        if report.when == "teardown":
            self.collector.phase_durations.setdefault(nodeid, {})["teardown"] = (
                report.duration
            )
            if nodeid in self.collector.final_outcomes:
                self.collector.final_outcomes[
                    nodeid
                ].teardown_duration = report.duration
            if report.outcome == "failed":
                # If we already have a result from call phase, just update outcome to
                # "error" instead of creating a new result (which would have wrong
                # duration and create a duplicate entry)
                if nodeid in self.collector.final_outcomes:
                    self.collector.final_outcomes[nodeid].outcome = "error"
                else:
                    self._record_test_result(report, outcome="error")
            return

        if report.when == "call":
            outcome = (
                report.outcome
                if report.outcome in {"passed", "failed", "skipped"}
                else "error"
            )
            self._record_test_result(report, outcome=outcome)

    def _record_test_result(self, report: TestReport, outcome: str) -> None:
        """Record a test result from a report."""
        nodeid = report.nodeid
        browser = _extract_browser_from_nodeid(nodeid)
        worker_id = _get_worker_id(report)

        # Only count reruns for "call" phase to avoid false positives from
        # setup/teardown failures on the same test run.
        if report.when == "call" and nodeid in self.collector.final_outcomes:
            self.collector.rerun_counts[nodeid] = (
                self.collector.rerun_counts.get(nodeid, 0) + 1
            )

        # Get setup duration if available
        setup_duration = self.collector.phase_durations.get(nodeid, {}).get(
            "setup", 0.0
        )

        result = TestResult(
            nodeid=nodeid,
            outcome=outcome,
            duration=report.duration,
            browser=browser,
            rerun_count=self.collector.rerun_counts.get(nodeid, 0),
            worker_id=worker_id,
            setup_duration=setup_duration,
        )

        self.collector.final_outcomes[nodeid] = result
        self.collector.results.append(result)

        # Track per-worker statistics (only for tests that actually ran on workers)
        if report.when == "call" and outcome != "skipped" and worker_id != "primary":
            if worker_id not in self.collector.worker_stats:
                self.collector.worker_stats[worker_id] = WorkerStats()
            worker_stat = self.collector.worker_stats[worker_id]
            worker_stat.test_count += 1
            worker_stat.total_runtime += report.duration

    def pytest_testnodedown(self, node: Any, error: Any) -> None:  # noqa: ARG002
        """Merge worker stats when an xdist worker node goes down."""
        if hasattr(node, "workeroutput") and "worker_stats" in node.workeroutput:
            worker_data = node.workeroutput["worker_stats"]
            worker_id = worker_data.get("worker_id", "unknown")
            if worker_id not in self.collector.worker_stats:
                self.collector.worker_stats[worker_id] = WorkerStats()
            ws = self.collector.worker_stats[worker_id]
            ws.test_count += worker_data.get("test_count", 0)
            ws.total_runtime += worker_data.get("total_runtime", 0.0)
            ws.memory_mb = max(ws.memory_mb, worker_data.get("memory_mb", 0.0))

    @pytest.hookimpl(trylast=True)
    def pytest_sessionfinish(self, session: pytest.Session, exitstatus: int) -> None:
        """Generate the statistics JSON at the end of the test session."""
        worker_id = _get_worker_id()
        if worker_id != "primary" and hasattr(session.config, "workeroutput"):
            ws = self.collector.worker_stats.get(worker_id, WorkerStats())
            session.config.workeroutput["worker_stats"] = {
                "worker_id": worker_id,
                "test_count": ws.test_count,
                "total_runtime": ws.total_runtime,
                "memory_mb": self._get_current_process_memory(),
            }
            return  # Workers don't write the stats file

        self.collector.session_end_time = time.perf_counter()
        stats = self._compute_statistics(session, exitstatus)
        self._write_stats(stats)

    def _compute_statistics(
        self,
        session: pytest.Session,  # noqa: ARG002
        exitstatus: int,
    ) -> dict[str, Any]:
        """Compute aggregate statistics from collected test results."""
        final_results = list(self.collector.final_outcomes.values())

        # Basic counts
        total_tests = len(final_results)
        passed = sum(1 for r in final_results if r.outcome == "passed")
        failed = sum(1 for r in final_results if r.outcome == "failed")
        skipped = sum(1 for r in final_results if r.outcome == "skipped")
        errors = sum(1 for r in final_results if r.outcome == "error")

        # Rerun statistics
        tests_with_reruns = sum(1 for r in final_results if r.rerun_count > 0)
        total_reruns = sum(self.collector.rerun_counts.values())

        # Duration statistics (only for tests that actually ran)
        durations = [r.duration for r in final_results if r.outcome != "skipped"]
        setup_durations = [
            r.setup_duration for r in final_results if r.outcome != "skipped"
        ]
        teardown_durations = [
            r.teardown_duration for r in final_results if r.outcome != "skipped"
        ]
        total_duration = (
            self.collector.session_end_time - self.collector.session_start_time
        )

        duration_stats: dict[str, float | None] = {
            "total_test_time_seconds": sum(durations) if durations else 0.0,
            "mean_duration_seconds": mean(durations) if durations else None,
            "median_duration_seconds": median(durations) if durations else None,
            "min_duration_seconds": min(durations) if durations else None,
            "max_duration_seconds": max(durations) if durations else None,
            # Fixture setup/teardown statistics
            "total_setup_time_seconds": sum(setup_durations)
            if setup_durations
            else 0.0,
            "total_teardown_time_seconds": (
                sum(teardown_durations) if teardown_durations else 0.0
            ),
            "mean_setup_duration_seconds": (
                mean(setup_durations) if setup_durations else None
            ),
            "mean_teardown_duration_seconds": (
                mean(teardown_durations) if teardown_durations else None
            ),
        }

        # Per-browser breakdown
        browser_stats: dict[str, dict[str, int]] = {}
        for browser in _BROWSERS:
            browser_results = [r for r in final_results if r.browser == browser]
            if browser_results:
                browser_stats[browser] = {
                    "total": len(browser_results),
                    "passed": sum(1 for r in browser_results if r.outcome == "passed"),
                    "failed": sum(1 for r in browser_results if r.outcome == "failed"),
                    "skipped": sum(
                        1 for r in browser_results if r.outcome == "skipped"
                    ),
                    "errors": sum(1 for r in browser_results if r.outcome == "error"),
                }

        # Slowest tests (top 10)
        sorted_by_duration = sorted(
            [r for r in final_results if r.outcome != "skipped"],
            key=lambda r: r.duration,
            reverse=True,
        )[:10]
        slowest_tests = [
            {
                "nodeid": r.nodeid,
                "duration_seconds": r.duration,
                "setup_duration_seconds": r.setup_duration,
                "teardown_duration_seconds": r.teardown_duration,
                "browser": r.browser,
            }
            for r in sorted_by_duration
        ]

        # Slowest setup (top 10 by fixture setup time)
        sorted_by_setup = sorted(
            [
                r
                for r in final_results
                if r.outcome != "skipped" and r.setup_duration > 0
            ],
            key=lambda r: r.setup_duration,
            reverse=True,
        )[:10]
        slowest_setup = [
            {
                "nodeid": r.nodeid,
                "setup_duration_seconds": r.setup_duration,
                "browser": r.browser,
            }
            for r in sorted_by_setup
        ]

        # Slowest teardown (top 10 by fixture teardown time)
        sorted_by_teardown = sorted(
            [
                r
                for r in final_results
                if r.outcome != "skipped" and r.teardown_duration > 0
            ],
            key=lambda r: r.teardown_duration,
            reverse=True,
        )[:10]
        slowest_teardown = [
            {
                "nodeid": r.nodeid,
                "teardown_duration_seconds": r.teardown_duration,
                "browser": r.browser,
            }
            for r in sorted_by_teardown
        ]

        # Aggregate test durations by module/file
        module_durations: dict[str, dict[str, Any]] = {}
        for r in final_results:
            if r.outcome == "skipped":
                continue
            module = r.nodeid.split("::")[0]
            data = module_durations.setdefault(
                module, {"total_duration": 0.0, "test_count": 0}
            )
            data["total_duration"] += r.duration
            data["test_count"] += 1

        test_modules = sorted(
            [
                {
                    "module": mod,
                    "total_duration_seconds": data["total_duration"],
                    "test_count": data["test_count"],
                    "avg_duration_seconds": data["total_duration"] / data["test_count"],
                }
                for mod, data in module_durations.items()
            ],
            key=lambda x: x["total_duration_seconds"],  # noqa: FURB118
            reverse=True,
        )

        # Tests that required reruns
        rerun_tests = [
            {
                "nodeid": r.nodeid,
                "final_outcome": r.outcome,
                "rerun_count": r.rerun_count,
                "browser": r.browser,
            }
            for r in final_results
            if r.rerun_count > 0
        ]

        # Environment info
        env_info = {
            "python_version": sys.version,
            "platform": sys.platform,
            "pytest_version": pytest.__version__,
            "ci": os.getenv("CI", "false").lower() == "true",
            "github_run_id": os.getenv("GITHUB_RUN_ID"),
            "github_sha": os.getenv("GITHUB_SHA"),
            "github_ref": os.getenv("GITHUB_REF"),
        }

        # Compute xdist worker statistics
        xdist_stats = self._compute_worker_stats()

        return {
            "schema_version": "1.1",
            "summary": {
                "total_tests": total_tests,
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "errors": errors,
                "tests_with_reruns": tests_with_reruns,
                "total_reruns": total_reruns,
                "exit_status": exitstatus,
            },
            "duration": {
                "session_duration_seconds": total_duration,
                **duration_stats,
            },
            "browser_breakdown": browser_stats,
            "slowest_tests": slowest_tests,
            "slowest_setup": slowest_setup,
            "slowest_teardown": slowest_teardown,
            "test_modules": test_modules,
            "rerun_details": rerun_tests,
            "environment": env_info,
            "xdist_workers": xdist_stats,
            "memory": self._get_memory_stats(),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def _compute_worker_stats(self) -> dict[str, Any]:
        """Compute statistics for xdist workers."""
        worker_stats = self.collector.worker_stats
        if not worker_stats:
            return {}

        per_worker = {}
        for worker_id, ws in sorted(worker_stats.items()):
            per_worker[worker_id] = {
                "test_count": ws.test_count,
                "total_runtime_seconds": ws.total_runtime,
                "avg_test_duration_seconds": (
                    ws.total_runtime / ws.test_count if ws.test_count > 0 else 0.0
                ),
                "memory_mb": ws.memory_mb,
            }

        test_counts = [ws.test_count for ws in worker_stats.values()]
        runtimes = [ws.total_runtime for ws in worker_stats.values()]
        memories = [ws.memory_mb for ws in worker_stats.values() if ws.memory_mb > 0]

        return {
            "worker_count": len(worker_stats),
            "per_worker": per_worker,
            "aggregate": {
                "min_tests_per_worker": min(test_counts) if test_counts else 0,
                "max_tests_per_worker": max(test_counts) if test_counts else 0,
                "avg_tests_per_worker": mean(test_counts) if test_counts else 0.0,
                "min_runtime_seconds": min(runtimes) if runtimes else 0.0,
                "max_runtime_seconds": max(runtimes) if runtimes else 0.0,
                "avg_runtime_seconds": mean(runtimes) if runtimes else 0.0,
                "total_runtime_seconds": sum(runtimes) if runtimes else 0.0,
                "min_memory_mb": min(memories) if memories else 0.0,
                "max_memory_mb": max(memories) if memories else 0.0,
                "avg_memory_mb": mean(memories) if memories else 0.0,
                "total_memory_mb": sum(memories) if memories else 0.0,
            },
        }

    def _get_current_process_memory(self) -> float:
        """Get current process memory usage in MB."""
        try:
            return psutil.Process().memory_info().rss / _BYTES_PER_MB
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return 0.0

    def _get_memory_stats(self) -> dict[str, float]:
        """Get memory statistics for current process and xdist workers.

        Note: When using pytest-xdist, child worker processes have already exited
        by the time this method is called (at session finish). So we use the
        memory values reported by workers via workeroutput instead of trying
        to measure child processes directly.
        """
        try:
            process = psutil.Process()
            main_mem = process.memory_info()
            main_rss_mb = main_mem.rss / _BYTES_PER_MB
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            main_rss_mb = 0.0

        # Sum memory from xdist workers (captured before each worker exited)
        workers_rss_mb = sum(
            ws.memory_mb
            for ws in self.collector.worker_stats.values()
            if ws.memory_mb > 0
        )

        return {
            "main_process_rss_mb": main_rss_mb,
            "workers_rss_mb": workers_rss_mb,
            "total_rss_mb": main_rss_mb + workers_rss_mb,
        }

    def _write_stats(self, stats: dict[str, Any]) -> None:
        """Write statistics to JSON file."""
        try:
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.output_path, "w", encoding="utf-8") as f:
                json.dump(stats, f, indent=2)
            print(f"\nTest statistics written to: {self.output_path}")
        except OSError as e:
            print(
                f"\nWarning: Failed to write test statistics to {self.output_path}: {e}"
            )


def pytest_addoption(parser: pytest.Parser) -> None:
    """Register command-line options for the stats reporter."""
    group = parser.getgroup("stats_reporter", "Test statistics reporting")
    group.addoption(
        "--stats-output",
        action="store",
        default="test-results/test-stats.json",
        help="Path for the test statistics JSON output (default: test-results/test-stats.json)",
    )
    group.addoption(
        "--no-stats",
        action="store_true",
        default=False,
        help="Disable test statistics collection and reporting",
    )


def pytest_configure(config: Config) -> None:
    """Register the stats reporter plugin if not disabled."""
    if config.getoption("--no-stats", default=False):
        return

    output_path = Path(config.getoption("--stats-output"))
    # Make path relative to the e2e_playwright directory if not absolute
    if not output_path.is_absolute():
        # Get the root directory from where pytest is run
        rootdir = config.rootpath if hasattr(config, "rootpath") else Path.cwd()
        output_path = rootdir / output_path

    plugin = StatsReporterPlugin(output_path)
    config.pluginmanager.register(plugin, "stats_reporter")
