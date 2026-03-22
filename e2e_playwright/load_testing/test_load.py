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

r"""Load test suite for Streamlit server performance testing.

Uses multiprocessing to run concurrent Playwright browser sessions against
a single Streamlit server, measuring server metrics and response times.

Run with:
    uv run pytest e2e_playwright/load_testing/test_load.py --num-sessions=50
"""

from __future__ import annotations

import multiprocessing
import subprocess
import time
from dataclasses import dataclass
from multiprocessing import Pool
from typing import TYPE_CHECKING, Final

import pytest

from e2e_playwright.load_testing.conftest import (
    get_scenario_path,
    start_load_test_server,
    wait_for_server,
    write_results,
)
from e2e_playwright.load_testing.metrics_collector import (
    MetricsCollector,
    SessionMetrics,
    compute_percentile,
)
from e2e_playwright.load_testing.worker import run_worker_session

if TYPE_CHECKING:
    from collections.abc import Generator
    from pathlib import Path


@dataclass(frozen=True)
class ScenarioConfig:
    """Configuration for a load test scenario."""

    name: str
    max_failure_rate: float = 0.1
    require_zero_failures: bool = False


_SCENARIOS: Final[list[ScenarioConfig]] = [
    ScenarioConfig("simple_app", require_zero_failures=True),
    ScenarioConfig("dataframe_app"),
    ScenarioConfig("widget_heavy_app"),
    ScenarioConfig("caching_app"),
    ScenarioConfig("fragment_app"),
]


def _run_worker_with_args(args: tuple[str, int, str, int]) -> SessionMetrics:
    """Wrapper to unpack args tuple for apply_async."""
    server_url, worker_id, scenario, timeout_sec = args
    return run_worker_session(server_url, worker_id, scenario, timeout_sec)


def _run_concurrent_load_test(
    server_url: str,
    scenario: str,
    num_users: int,
    timeout_sec: int = 120,
) -> list[SessionMetrics]:
    """Run concurrent user sessions using multiprocessing."""
    worker_args = [(server_url, i, scenario, timeout_sec) for i in range(num_users)]
    results: list[SessionMetrics] = []

    with Pool(processes=num_users) as pool:
        async_results = [
            pool.apply_async(_run_worker_with_args, (args,)) for args in worker_args
        ]

        for i, ar in enumerate(async_results):
            try:
                # Extra buffer for pool overhead
                result = ar.get(timeout=timeout_sec + 30)
                results.append(result)
            except multiprocessing.TimeoutError:
                results.append(
                    SessionMetrics(
                        session_id=f"worker_{i}",
                        errors=[f"Worker timed out after {timeout_sec}s"],
                    )
                )
            except Exception as e:
                results.append(
                    SessionMetrics(
                        session_id=f"worker_{i}",
                        errors=[f"{type(e).__name__}: {e}"],
                    )
                )

    return results


@pytest.fixture
def scenario_server(
    load_test_port: int,
    request: pytest.FixtureRequest,
) -> Generator[tuple[subprocess.Popen[str], str, int], None, None]:
    """Start a Streamlit server for the current scenario."""
    scenario_name = request.param
    scenario_path = get_scenario_path(scenario_name)
    process = start_load_test_server(load_test_port, scenario_path)

    if not wait_for_server(load_test_port):
        # Capture stderr for diagnostics before cleanup
        stderr_output = ""
        if process.stderr:
            stderr_output = process.stderr.read() or ""
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
        error_msg = f"Server failed to start on port {load_test_port}"
        if stderr_output:
            error_msg += f"\nServer stderr:\n{stderr_output}"
        pytest.fail(error_msg)

    yield process, f"http://localhost:{load_test_port}", process.pid

    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


@pytest.mark.load_test
@pytest.mark.performance
@pytest.mark.only_browser("chromium")
@pytest.mark.parametrize(
    ("scenario_server", "scenario_config"),
    [(s.name, s) for s in _SCENARIOS],
    indirect=["scenario_server"],
    ids=[s.name for s in _SCENARIOS],
)
def test_scenario_load(
    scenario_server: tuple[subprocess.Popen[str], str, int],
    scenario_config: ScenarioConfig,
    num_sessions: int,
    results_dir: Path,
) -> None:
    """Test a scenario under concurrent user load."""
    _, app_url, server_pid = scenario_server
    metrics_collector = MetricsCollector(server_pid)

    test_start = time.perf_counter()
    metrics_collector.start()

    session_results = _run_concurrent_load_test(
        app_url, scenario_config.name, num_sessions
    )

    server_metrics = metrics_collector.stop()
    test_duration = time.perf_counter() - test_start

    results_path = write_results(
        results_dir,
        scenario_config.name,
        server_metrics,
        session_results,
        num_sessions,
        test_duration,
    )
    print(f"Results written to: {results_path}")

    # Validate results
    completed = [s for s in session_results if s.completed]
    failed = [s for s in session_results if not s.completed]

    if scenario_config.require_zero_failures:
        assert len(failed) == 0, (
            f"{len(failed)} sessions failed: {[s.errors for s in failed]}"
        )
        # P95 load time should be under 10 seconds
        load_times = sorted([s.initial_load_time_ms for s in completed])
        if load_times:
            p95_load_time = compute_percentile(load_times, 0.95)
            assert p95_load_time < 10000, f"P95 load time {p95_load_time}ms exceeds 10s"
    else:
        assert len(completed) > 0, "No sessions completed successfully"
        failure_rate = len(failed) / len(session_results)
        assert failure_rate <= scenario_config.max_failure_rate, (
            f"Failure rate {failure_rate:.1%} exceeds "
            f"{scenario_config.max_failure_rate:.0%}"
        )
