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
        help="Number of user sessions to simulate sequentially (default: 5)",
    )
    # Keep --concurrent-users as an alias for backwards compatibility
    parser.addoption(
        "--concurrent-users",
        type=int,
        default=None,
        help="Alias for --num-sessions (deprecated)",
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
def concurrent_users(request: pytest.FixtureRequest) -> int:
    """Return the number of user sessions configured via CLI.

    Supports both --num-sessions (preferred) and --concurrent-users (deprecated alias).
    Validates that the value is at least 1 to prevent ZeroDivisionError.
    """
    # Prefer --num-sessions, fall back to --concurrent-users for backwards compatibility
    num_sessions = request.config.getoption("--num-sessions")
    concurrent = request.config.getoption("--concurrent-users")

    if concurrent is not None:
        num_sessions = concurrent

    if num_sessions < 1:
        raise ValueError("--num-sessions must be at least 1")

    return int(num_sessions)


@pytest.fixture(scope="session")
def results_dir(request: pytest.FixtureRequest) -> Path:
    """Return the directory for results output."""
    dir_opt = request.config.getoption("--results-dir")
    path = Path(dir_opt) if dir_opt else Path(__file__).parent / "results"
    path.mkdir(parents=True, exist_ok=True)
    return path


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
    """Start a Streamlit server for load testing."""
    env = {**os.environ.copy(), **(extra_env or {})}

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


def _get_git_info() -> tuple[str, str]:
    """Get git SHA and branch name."""
    git_root = get_git_root()

    try:
        git_sha = subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=git_root,
            text=True,
        ).strip()
    except subprocess.CalledProcessError:
        git_sha = "unknown"

    try:
        git_branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=git_root,
            text=True,
        ).strip()
    except subprocess.CalledProcessError:
        git_branch = "unknown"

    return git_sha, git_branch


def write_results(
    results_dir: Path,
    scenario: str,
    server_metrics: ServerMetricsSummary,
    session_metrics: list[SessionMetrics],
    num_users: int,
    duration_seconds: float,
) -> Path:
    """Write load test results to a JSON file."""
    git_sha, git_branch = _get_git_info()
    session_summary = aggregate_session_metrics(session_metrics)

    results: dict[str, Any] = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "git_sha": git_sha,
            "git_branch": git_branch,
            "scenario": scenario,
            "concurrent_users": num_users,
            "runner": os.environ.get("GITHUB_RUNNER", "local"),
        },
        "server_metrics": {
            "memory_rss_mb_start": round(server_metrics.memory_rss_mb_start, 2),
            "memory_rss_mb_end": round(server_metrics.memory_rss_mb_end, 2),
            "memory_rss_mb_peak": round(server_metrics.memory_rss_mb_peak, 2),
            "memory_rss_mb_growth": round(server_metrics.memory_rss_mb_growth, 2),
            "memory_rss_mb_avg": round(server_metrics.memory_rss_mb_avg, 2),
            "cpu_percent_avg": round(server_metrics.cpu_percent_avg, 2),
            "cpu_percent_peak": round(server_metrics.cpu_percent_peak, 2),
            "thread_count_max": server_metrics.thread_count_max,
            "sample_count": server_metrics.sample_count,
        },
        "session_metrics": session_summary,
        "test_info": {
            "total_duration_s": round(duration_seconds, 2),
        },
    }

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filepath = results_dir / f"{scenario}_{timestamp}.json"

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)

    return filepath
