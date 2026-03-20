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

r"""Main load test suite for Streamlit server performance testing.

This module contains load tests that simulate concurrent users interacting
with various Streamlit app scenarios to measure server performance.

NOTE: Playwright's sync API is not thread-safe, so sessions run sequentially
within each test. For true concurrent load, use pytest-xdist (-n auto) in CI
to run multiple browser workers in parallel, or reduce --concurrent-users for
local testing.

Run with:
    uv run pytest e2e_playwright/load_testing/test_load.py \
        --concurrent-users=50
"""

from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

import pytest
from playwright.sync_api import Browser, Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.load_testing.conftest import (
    get_scenario_path,
    start_load_test_server,
    wait_for_server,
    write_results,
)
from e2e_playwright.load_testing.metrics_collector import (
    MetricsCollector,
    SessionMetrics,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Generator
    from pathlib import Path


def _run_user_session(
    browser: Browser,
    app_url: str,
    session_num: int,
    interaction_fn: Callable[[Page, SessionMetrics], None],
) -> SessionMetrics:
    """Run a single user session and collect metrics."""
    metrics = SessionMetrics(session_id=f"session_{session_num}")
    context = None

    try:
        context = browser.new_context()
        page = context.new_page()

        load_start = time.perf_counter()
        page.goto(app_url, timeout=60000)
        wait_for_app_run(page)
        metrics.initial_load_time_ms = (time.perf_counter() - load_start) * 1000

        interaction_fn(page, metrics)
        metrics.completed = True

    except Exception as e:
        metrics.errors.append(str(e))

    finally:
        if context:
            context.close()

    return metrics


# --- Interaction functions for each scenario ---


def _measure_rerun(
    page: Page, metrics: SessionMetrics, action: Callable[[], None]
) -> None:
    """Execute an action and measure the rerun time."""
    start = time.perf_counter()
    action()
    wait_for_app_run(page)
    metrics.rerun_times_ms.append((time.perf_counter() - start) * 1000)


def _simple_app_interaction(page: Page, metrics: SessionMetrics) -> None:
    button = page.get_by_role("button", name="Click me")
    expect(button).to_be_visible(timeout=10000)

    _measure_rerun(page, metrics, button.click)

    expect(page.get_by_text("Clicked!")).to_be_visible(timeout=10000)


def _dataframe_app_interaction(page: Page, metrics: SessionMetrics) -> None:
    button = page.get_by_role("button", name="Load dataframe")
    expect(button).to_be_visible(timeout=10000)

    _measure_rerun(page, metrics, button.click)

    expect(page.get_by_text("Dataframe loaded!")).to_be_visible(timeout=10000)


def _widget_heavy_app_interaction(page: Page, metrics: SessionMetrics) -> None:
    input_field = page.get_by_test_id("stTextInput").first.locator("input")
    expect(input_field).to_be_visible(timeout=10000)

    def fill_and_submit() -> None:
        input_field.fill("test value")
        input_field.press("Enter")

    _measure_rerun(page, metrics, fill_and_submit)

    checkbox = page.get_by_test_id("stCheckbox").first
    expect(checkbox).to_be_visible(timeout=10000)

    _measure_rerun(page, metrics, checkbox.click)


def _caching_app_interaction(page: Page, metrics: SessionMetrics) -> None:
    button = page.get_by_role("button", name="Rerun")
    expect(button).to_be_visible(timeout=10000)

    for _ in range(3):
        _measure_rerun(page, metrics, button.click)


def _fragment_app_interaction(page: Page, metrics: SessionMetrics) -> None:
    frag_button = page.get_by_role("button", name="Increment")
    expect(frag_button).to_be_visible(timeout=10000)

    for _ in range(5):
        _measure_rerun(page, metrics, frag_button.click)

    full_button = page.get_by_role("button", name="Full rerun")
    expect(full_button).to_be_visible(timeout=10000)

    _measure_rerun(page, metrics, full_button.click)


_INTERACTION_FNS: Final[dict[str, Callable[[Page, SessionMetrics], None]]] = {
    "simple_app": _simple_app_interaction,
    "dataframe_app": _dataframe_app_interaction,
    "widget_heavy_app": _widget_heavy_app_interaction,
    "caching_app": _caching_app_interaction,
    "fragment_app": _fragment_app_interaction,
}


# --- Load test execution ---


def _run_load_test(
    browser: Browser,
    app_url: str,
    scenario: str,
    num_users: int,
    metrics_collector: MetricsCollector,
) -> list[SessionMetrics]:
    """Run a load test with sequential user sessions.

    Sessions run sequentially because Playwright's sync API is not thread-safe.
    For concurrent load, use pytest-xdist in CI to run multiple browser workers.
    """
    interaction_fn = _INTERACTION_FNS.get(scenario, _simple_app_interaction)
    session_results: list[SessionMetrics] = []

    metrics_collector.start()

    for i in range(num_users):
        result = _run_user_session(browser, app_url, i, interaction_fn)
        session_results.append(result)

    return session_results


# --- Scenario configuration ---


@dataclass(frozen=True)
class ScenarioConfig:
    """Configuration for a load test scenario."""

    name: str
    max_failure_rate: float = 0.1
    require_zero_failures: bool = False


_SCENARIOS: Final[list[ScenarioConfig]] = [
    ScenarioConfig("dataframe_app"),
    ScenarioConfig("simple_app", require_zero_failures=True),
    ScenarioConfig("widget_heavy_app"),
    ScenarioConfig("caching_app"),
    ScenarioConfig("fragment_app"),
]


# --- Shared fixture ---


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
        process.terminate()
        pytest.fail(f"Server failed to start on port {load_test_port}")

    yield process, f"http://localhost:{load_test_port}", process.pid

    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


# --- Load tests ---


@pytest.mark.load_test
@pytest.mark.parametrize(
    ("scenario_server", "scenario_config"),
    [(s.name, s) for s in _SCENARIOS],
    indirect=["scenario_server"],
    ids=[s.name for s in _SCENARIOS],
)
def test_scenario_load(
    scenario_server: tuple[subprocess.Popen[str], str, int],
    scenario_config: ScenarioConfig,
    concurrent_users: int,
    results_dir: Path,
    browser: Browser,
) -> None:
    """Test a scenario under concurrent user load."""
    _process, app_url, server_pid = scenario_server
    metrics_collector = MetricsCollector(server_pid)

    test_start = time.perf_counter()
    session_results = _run_load_test(
        browser, app_url, scenario_config.name, concurrent_users, metrics_collector
    )
    test_duration = time.perf_counter() - test_start

    server_metrics = metrics_collector.stop()

    results_path = write_results(
        results_dir,
        scenario_config.name,
        server_metrics,
        session_results,
        concurrent_users,
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
        p95_idx = int(len(load_times) * 0.95)
        p95_load_time = load_times[p95_idx] if load_times else 0
        assert p95_load_time < 10000, f"P95 load time {p95_load_time}ms exceeds 10s"
    else:
        assert len(completed) > 0, "No sessions completed successfully"
        failure_rate = len(failed) / len(session_results)
        assert failure_rate < scenario_config.max_failure_rate, (
            f"Failure rate {failure_rate:.1%} exceeds "
            f"{scenario_config.max_failure_rate:.0%}"
        )
