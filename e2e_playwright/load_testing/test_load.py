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

Note: pytest-xdist (-n auto) parallelizes at the test-item level, running
different scenarios in parallel (each starting its own server). Within each
scenario, multiple users run concurrently via multiprocessing Pool against
a single shared server.

Run with:
    uv run pytest e2e_playwright/load_testing/test_load.py --num-sessions=50
"""

from __future__ import annotations

import multiprocessing
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from multiprocessing import Pool
from pathlib import Path
from tempfile import TemporaryFile
from typing import IO, TYPE_CHECKING, Final
from unittest.mock import MagicMock

import pytest

from e2e_playwright.conftest import is_port_available
from e2e_playwright.load_testing import conftest as load_conftest
from e2e_playwright.load_testing.conftest import (
    ResultsCollector,
    _format_server_startup_failure,
    get_scenario_path,
    start_healthy_load_test_server,
    terminate_process,
)
from e2e_playwright.load_testing.metrics_collector import (
    MetricsCollector,
    SessionMetrics,
)
from e2e_playwright.load_testing.worker import run_worker_session

if TYPE_CHECKING:
    from collections.abc import Generator


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
    ScenarioConfig("many_messages_app"),
]


@pytest.mark.skipif(
    sys.platform == "darwin",
    reason="macOS SO_REUSEADDR allows binding over live client ephemeral ports",
)
def test_port_availability_check_rejects_active_client_port() -> None:
    """Ensure active ephemeral client ports aren't selected for a server.

    On Linux CI (where the load-test flake was observed), SO_REUSEADDR still
    cannot bind over a live client ephemeral port. On macOS/BSD, SO_REUSEADDR
    can, matching Streamlit's server socket options — so skip there.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("localhost", 0))
        listener.listen()

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
            client.connect(listener.getsockname())
            connection, _ = listener.accept()
            with connection:
                client_port = client.getsockname()[1]
                assert not is_port_available(client_port, "localhost")


def _write_log(text: str) -> IO[str]:
    log_file = TemporaryFile("w+", encoding="utf-8")
    log_file.write(text)
    log_file.flush()
    return log_file


def test_startup_failure_message_includes_returncode_and_log_tail() -> None:
    """Startup failure text includes port, returncode, and a truncated log tail."""
    log_file = _write_log(
        "keep-me-out\n" + "\n".join(f"log-line-{i}" for i in range(100)) + "\n"
    )
    try:
        message = _format_server_startup_failure(12345, 1, log_file)
    finally:
        log_file.close()

    assert "port 12345" in message
    assert "returncode=1" in message
    assert "up to 80 lines" in message
    assert "log-line-99" in message
    assert "log-line-20" in message
    assert "keep-me-out" not in message
    assert "log-line-19" not in message


def test_startup_failure_message_when_process_still_running() -> None:
    """A hung server is reported as still running rather than a returncode."""
    log_file = _write_log("still starting\n")
    try:
        message = _format_server_startup_failure(9999, None, log_file)
    finally:
        log_file.close()

    assert "port 9999" in message
    assert "process was still running" in message
    assert "still starting" in message
    assert "returncode=" not in message


def test_unhealthy_server_failure_includes_logs_and_returncode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed health check surfaces captured logs and the process returncode."""
    log_file = _write_log("Address already in use\nPort 30000 is already in use\n")
    fake_process = MagicMock()
    fake_process.poll.return_value = 1

    monkeypatch.setattr(load_conftest, "find_available_port", lambda: 30000)
    monkeypatch.setattr(
        load_conftest,
        "start_load_test_server",
        lambda *args, **kwargs: (fake_process, log_file),
    )
    monkeypatch.setattr(load_conftest, "wait_for_server", lambda *args, **kwargs: False)
    monkeypatch.setattr(
        load_conftest, "terminate_process", lambda *args, **kwargs: None
    )

    with pytest.raises(RuntimeError) as exc_info:
        start_healthy_load_test_server(Path("app.py"), max_attempts=1)

    message = str(exc_info.value)
    assert "30000" in message
    assert "Attempt 1: port 30000 (returncode=1)" in message
    assert "returncode=1" in message
    assert "Address already in use" in message
    assert log_file.closed


def test_unhealthy_server_failure_lists_each_attempt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Earlier failed logs are closed; the error includes the last attempt's tail."""
    logs: list[IO[str]] = []

    def _start_fake_server(
        *_args: object, **_kwargs: object
    ) -> tuple[MagicMock, IO[str]]:
        log_file = _write_log(f"log-for-attempt-{len(logs)}\n")
        fake_process = MagicMock()
        fake_process.poll.return_value = 1 if len(logs) == 0 else None
        logs.append(log_file)
        return fake_process, log_file

    monkeypatch.setattr(
        load_conftest, "find_available_port", MagicMock(side_effect=[30000, 30001])
    )
    monkeypatch.setattr(load_conftest, "start_load_test_server", _start_fake_server)
    monkeypatch.setattr(load_conftest, "wait_for_server", lambda *args, **kwargs: False)
    monkeypatch.setattr(
        load_conftest, "terminate_process", lambda *args, **kwargs: None
    )

    with pytest.raises(RuntimeError) as exc_info:
        start_healthy_load_test_server(Path("app.py"), max_attempts=2)

    message = str(exc_info.value)
    assert "Attempt 1: port 30000 (returncode=1)" in message
    assert "Attempt 2: port 30001 (process was still running)" in message
    assert "log-for-attempt-1" in message
    assert "log-for-attempt-0" not in message
    assert logs[0].closed
    assert logs[1].closed


def test_start_load_test_server_closes_log_if_spawn_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed Popen closes the temp log so it is not leaked."""
    log_file = MagicMock()
    monkeypatch.setattr(load_conftest, "TemporaryFile", lambda *a, **k: log_file)
    monkeypatch.setattr(
        subprocess,
        "Popen",
        MagicMock(side_effect=OSError("process limit")),
    )

    with pytest.raises(OSError, match="process limit"):
        load_conftest.start_load_test_server(12345, Path("app.py"))

    log_file.close.assert_called_once()


def _run_worker_with_args(args: tuple[str, int, str, int]) -> SessionMetrics:
    """Wrapper to unpack args tuple for pool.apply_async."""
    server_url, worker_id, scenario, timeout_sec = args
    return run_worker_session(server_url, worker_id, scenario, timeout_sec)


def _run_concurrent_load_test(
    server_url: str,
    scenario: str,
    num_users: int,
    timeout_sec: int = 120,
) -> list[SessionMetrics]:
    """Run concurrent user sessions using multiprocessing.

    Uses a global deadline to avoid worst-case O(num_users * timeout) wait time
    when multiple workers hang. Each worker's timeout is computed relative to
    the global deadline.
    """
    if num_users > 100:
        import warnings

        warnings.warn(
            f"Running with {num_users} users may exhaust system resources. "
            "Each user spawns a separate Playwright browser process.",
            ResourceWarning,
            stacklevel=2,
        )

    worker_args = [(server_url, i, scenario, timeout_sec) for i in range(num_users)]
    results: list[SessionMetrics] = []

    # Global deadline: worker timeout + 30s buffer for pool overhead
    global_deadline = time.monotonic() + timeout_sec + 30

    with Pool(processes=num_users) as pool:
        async_results = [
            pool.apply_async(_run_worker_with_args, (args,)) for args in worker_args
        ]

        for i, ar in enumerate(async_results):
            # Compute remaining time until global deadline
            remaining = max(0.1, global_deadline - time.monotonic())
            try:
                result = ar.get(timeout=remaining)
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
    request: pytest.FixtureRequest,
) -> Generator[tuple[subprocess.Popen[str], str, int], None, None]:
    """Start a Streamlit server for the current scenario."""
    scenario_name = request.param
    scenario_path = get_scenario_path(scenario_name)
    try:
        process, port, log_file = start_healthy_load_test_server(scenario_path)
    except RuntimeError as exc:
        pytest.fail(str(exc))

    # Note: Direct localhost URL construction is intentional here. Load tests manage
    # their own server lifecycle outside the standard e2e fixtures (app_base_url, etc.)
    yield process, f"http://localhost:{port}", process.pid

    try:
        terminate_process(process)
    finally:
        log_file.close()


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
    results_collector: ResultsCollector,
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

    # Add results to collector (combined file written at session end)
    results_collector.add_scenario(
        scenario_config.name,
        server_metrics,
        session_results,
        num_sessions,
        test_duration,
    )

    # Validate results
    completed = [s for s in session_results if s.completed]
    failed = [s for s in session_results if not s.completed]

    if scenario_config.require_zero_failures:
        assert len(failed) == 0, (
            f"{len(failed)} sessions failed: {[s.errors for s in failed]}"
        )
    else:
        assert len(completed) > 0, "No sessions completed successfully"
        failure_rate = len(failed) / len(session_results)
        assert failure_rate <= scenario_config.max_failure_rate, (
            f"Failure rate {failure_rate:.1%} exceeds "
            f"{scenario_config.max_failure_rate:.0%}"
        )
