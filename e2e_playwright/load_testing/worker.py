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

"""Worker process for load testing.

Each worker runs in a separate Python process with its own Playwright browser,
enabling true parallel load testing against a single Streamlit server.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Final

from playwright.sync_api import Page, expect, sync_playwright

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.load_testing.metrics_collector import SessionMetrics

if TYPE_CHECKING:
    from collections.abc import Callable

# Longer timeout for load tests since the server is under heavy concurrent load.
# This allows measuring performance under load rather than failing on slowness.
_LOAD_TEST_TIMEOUT_MS: Final[int] = 30000


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
    expect(button).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)

    _measure_rerun(page, metrics, button.click)

    expect(page.get_by_text("Clicked!")).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)


def _dataframe_app_interaction(page: Page, metrics: SessionMetrics) -> None:
    button = page.get_by_role("button", name="Load dataframe")
    expect(button).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)

    _measure_rerun(page, metrics, button.click)

    expect(page.get_by_text("Dataframe loaded!")).to_be_visible(
        timeout=_LOAD_TEST_TIMEOUT_MS
    )


def _widget_heavy_app_interaction(page: Page, metrics: SessionMetrics) -> None:
    # Using test-id based locators (the standard pattern for Streamlit e2e tests)
    # since get_by_label doesn't work with Streamlit's widget structure.
    input_container = page.get_by_test_id("stTextInput").filter(has_text="Input 0")
    expect(input_container).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)
    input_field = input_container.locator("input")

    def fill_and_submit() -> None:
        input_field.fill("test value")
        input_field.press("Enter")

    _measure_rerun(page, metrics, fill_and_submit)

    checkbox_container = page.get_by_test_id("stCheckbox").filter(has_text="Check 0")
    expect(checkbox_container).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)

    _measure_rerun(page, metrics, checkbox_container.click)


def _caching_app_interaction(page: Page, metrics: SessionMetrics) -> None:
    button = page.get_by_role("button", name="Rerun", exact=True)
    expect(button).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)

    for _ in range(3):
        _measure_rerun(page, metrics, button.click)


def _fragment_app_interaction(page: Page, metrics: SessionMetrics) -> None:
    frag_button = page.get_by_role("button", name="Increment")
    expect(frag_button).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)

    for _ in range(5):
        _measure_rerun(page, metrics, frag_button.click)

    full_button = page.get_by_role("button", name="Full rerun")
    expect(full_button).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)

    _measure_rerun(page, metrics, full_button.click)


def _many_messages_app_interaction(page: Page, metrics: SessionMetrics) -> None:
    # Wait for all messages to load (the last message indicates completion)
    last_message = page.get_by_text("Message 30:", exact=False)
    expect(last_message).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)

    # Click the rerun button and measure (exact=True to avoid matching "Rerun fragment")
    rerun_button = page.get_by_role("button", name="Rerun", exact=True)
    expect(rerun_button).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)

    _measure_rerun(page, metrics, rerun_button.click)

    # Verify messages are still visible after rerun
    expect(last_message).to_be_visible(timeout=_LOAD_TEST_TIMEOUT_MS)


_INTERACTION_FNS: Final[dict[str, Callable[[Page, SessionMetrics], None]]] = {
    "simple_app": _simple_app_interaction,
    "dataframe_app": _dataframe_app_interaction,
    "widget_heavy_app": _widget_heavy_app_interaction,
    "caching_app": _caching_app_interaction,
    "fragment_app": _fragment_app_interaction,
    "many_messages_app": _many_messages_app_interaction,
}


def run_worker_session(
    server_url: str,
    worker_id: int,
    scenario: str,
    timeout_sec: int = 120,
) -> SessionMetrics:
    """Execute one user session in a worker process."""
    metrics = SessionMetrics(session_id=f"worker_{worker_id}")
    try:
        interaction_fn = _INTERACTION_FNS[scenario]
    except KeyError:
        raise ValueError(
            f"Unknown scenario: {scenario!r}. "
            f"Available scenarios: {list(_INTERACTION_FNS.keys())}"
        ) from None

    try:
        with sync_playwright() as p:
            # Always use chromium for load testing consistency
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context()
                page = context.new_page()

                # Measure initial page load
                load_start = time.perf_counter()
                page.goto(server_url, timeout=timeout_sec * 1000)
                wait_for_app_run(page)
                metrics.initial_load_time_ms = (time.perf_counter() - load_start) * 1000

                # Run scenario-specific interactions
                interaction_fn(page, metrics)
                metrics.completed = True

            finally:
                browser.close()

    except Exception as e:
        metrics.errors.append(f"{type(e).__name__}: {e}")

    return metrics
