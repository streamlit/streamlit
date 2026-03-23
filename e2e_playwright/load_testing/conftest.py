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

"""Pytest fixtures and utilities for load testing."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Final

import pytest

from e2e_playwright.conftest import find_available_port, is_app_server_running
from e2e_playwright.load_testing.metrics_collector import (
    ServerMetricsSummary,
    SessionMetrics,
    aggregate_session_metrics,
)
from e2e_playwright.shared.git_utils import get_git_root

_SCENARIOS_DIR: Final = Path(__file__).parent / "scenarios"


@dataclass
class ResultsCollector:
    """Collects load test results across all scenarios for combined output."""

    scenarios: list[dict[str, Any]] = field(default_factory=list)
    _git_sha: str | None = None
    _git_branch: str | None = None
    _start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def add_scenario(
        self,
        scenario: str,
        server_metrics: ServerMetricsSummary,
        session_metrics: list[SessionMetrics],
        num_users: int,
        duration_seconds: float,
    ) -> None:
        """Add a scenario's results to the collector."""
        if self._git_sha is None:
            self._git_sha, self._git_branch = _get_git_info()

        session_summary = aggregate_session_metrics(session_metrics)

        self.scenarios.append(
            {
                "scenario": scenario,
                "concurrent_users": num_users,
                "server_metrics": {
                    "memory_rss_mb_start": round(server_metrics.memory_rss_mb_start, 2),
                    "memory_rss_mb_end": round(server_metrics.memory_rss_mb_end, 2),
                    "memory_rss_mb_peak": round(server_metrics.memory_rss_mb_peak, 2),
                    "memory_rss_mb_growth": round(
                        server_metrics.memory_rss_mb_growth, 2
                    ),
                    "memory_rss_mb_avg": round(server_metrics.memory_rss_mb_avg, 2),
                    "cpu_percent_avg": round(server_metrics.cpu_percent_avg, 2),
                    "cpu_percent_peak": round(server_metrics.cpu_percent_peak, 2),
                    "thread_count_max": server_metrics.thread_count_max,
                    "sample_count": server_metrics.sample_count,
                },
                "session_metrics": session_summary,
                "duration_seconds": round(duration_seconds, 2),
            }
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert collected results to a dictionary for JSON serialization."""
        return {
            "metadata": {
                "timestamp": self._start_time.isoformat(),
                "git_sha": self._git_sha or "unknown",
                "git_branch": self._git_branch or "unknown",
                "runner": os.environ.get("GITHUB_RUNNER", "local"),
            },
            "scenarios": self.scenarios,
        }

    def write(self, results_dir: Path) -> Path:
        """Write combined results to a single JSON file."""
        filepath = results_dir / "load-test-results.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, default=str)
        return filepath


# Override parent conftest's autouse app_server fixture - load tests manage their own servers
@pytest.fixture(scope="module", autouse=True)
def app_server() -> None:
    """No-op override of parent app_server fixture for load tests."""


def pytest_addoption(parser: pytest.Parser) -> None:
    """Register load testing command-line options."""
    parser.addoption(
        "--num-sessions",
        type=int,
        default=5,
        help="Number of user sessions to simulate (default: 5)",
    )
    parser.addoption(
        "--results-dir",
        type=str,
        default=None,
        help="Directory to write results JSON files",
    )


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers for load tests."""
    config.addinivalue_line("markers", "load_test: mark test as a load test")


@pytest.fixture(scope="session")
def num_sessions(request: pytest.FixtureRequest) -> int:
    """Return the number of user sessions configured via --num-sessions."""
    value = request.config.getoption("--num-sessions")
    if value < 1:
        raise ValueError("--num-sessions must be at least 1")
    return int(value)


@pytest.fixture(scope="session")
def results_dir(request: pytest.FixtureRequest) -> Path:
    """Return the directory for results output."""
    dir_opt = request.config.getoption("--results-dir")
    path = Path(dir_opt) if dir_opt else Path(__file__).parent / "results"
    path.mkdir(parents=True, exist_ok=True)
    return path


@pytest.fixture(scope="session")
def results_collector(
    results_dir: Path, request: pytest.FixtureRequest
) -> ResultsCollector:
    """Session-scoped fixture to collect results across all scenarios."""
    collector = ResultsCollector()
    # Store on config for access in pytest_sessionfinish hook
    request.config._load_test_collector = collector  # type: ignore[attr-defined]
    request.config._load_test_results_dir = results_dir  # type: ignore[attr-defined]
    return collector


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:  # noqa: ARG001
    """Write combined results at the end of the test session."""
    collector: ResultsCollector | None = getattr(
        session.config, "_load_test_collector", None
    )
    results_dir: Path | None = getattr(session.config, "_load_test_results_dir", None)
    if collector is not None and results_dir is not None and collector.scenarios:
        filepath = collector.write(results_dir)
        print(f"\nCombined results written to: {filepath}")


@pytest.fixture
def load_test_port() -> int:
    """Get an available port for the load test server."""
    return find_available_port()


def get_scenario_path(scenario_name: str) -> Path:
    """Get the path to a scenario script."""
    script_path = _SCENARIOS_DIR / f"{scenario_name}.py"
    if not script_path.exists():
        raise FileNotFoundError(f"Scenario script not found: {script_path}")
    return script_path


def start_load_test_server(
    port: int,
    scenario_path: Path,
    *,
    extra_env: dict[str, str] | None = None,
) -> subprocess.Popen[str]:
    """Start a Streamlit server for load testing.

    Stderr is redirected to DEVNULL to avoid pipe buffer exhaustion that could
    deadlock the server process. If startup fails, the server won't produce
    useful stderr output anyway since it would have crashed before emitting
    diagnostics. Stdout is also discarded (DEVNULL).
    """
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)

    args = [
        sys.executable,
        "-m",
        "streamlit",
        "run",
        str(scenario_path),
        "--server.headless=true",
        "--global.developmentMode=false",
        "--server.port",
        str(port),
        "--browser.gatherUsageStats=false",
        "--server.fileWatcherType=none",
    ]

    return subprocess.Popen(
        args,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )


def wait_for_server(port: int, timeout: int = 60) -> bool:
    """Wait for the server to become ready."""
    start = time.time()
    while time.time() - start < timeout:
        if is_app_server_running(port):
            return True
        time.sleep(0.5)
    return False


def _run_git_command(args: list[str]) -> str:
    """Run a git command and return output, or 'unknown' on failure."""
    try:
        return subprocess.check_output(args, cwd=get_git_root(), text=True).strip()
    except (subprocess.CalledProcessError, RuntimeError):
        return "unknown"


def _get_git_info() -> tuple[str, str]:
    """Get git SHA and branch name."""
    git_sha = _run_git_command(["git", "rev-parse", "HEAD"])
    git_branch = _run_git_command(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    return git_sha, git_branch
