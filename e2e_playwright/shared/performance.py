# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from __future__ import annotations

import datetime
import json
import os
import time
from contextlib import contextmanager
from typing import TYPE_CHECKING

from e2e_playwright.shared.git_utils import get_git_root

if TYPE_CHECKING:
    from playwright.sync_api import Page


# Observe long tasks, measure, marks, and paints with PerformanceObserver
# @see https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver
# @see https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserverEntryList#using_performanceobserverentrylist
CAPTURE_TRACES_SCRIPT = """
window.__stCapturedTraces = {};

function handleEntries(list) {
    const entries = list.getEntries();
    for (const entry of entries) {
        if (!window.__stCapturedTraces[entry.entryType]) {
            window.__stCapturedTraces[entry.entryType] = [];
        }
        window.__stCapturedTraces[entry.entryType].push(entry);
    }
}

new PerformanceObserver(handleEntries).observe({
    entryTypes: ['longtask', 'measure', 'mark', 'navigation', 'paint', 'long-animation-frame'],
});
"""

GET_CAPTURED_TRACES_SCRIPT = """
window.__stCapturedTraces.profiles = {};

for (const [key, value] of Object.entries(window.__streamlit_profiles__ || {})) {
    window.__stCapturedTraces.profiles[key] = {
        entries: value.buffer.filter(Boolean),
        totalWrittenEntries: value.totalWrittenEntries,
    };
}

JSON.stringify(window.__stCapturedTraces)
"""


def is_supported_browser(page: Page) -> bool:
    browser = page.context.browser
    browser_name = browser.browser_type.name if browser is not None else "unknown"
    # Only measure performance for Chromium browsers since it relies on
    # Chrome DevTools Protocol under the hood
    return browser_name == "chromium"


def start_capture_traces(page: Page):
    """Start capturing traces using the PerformanceObserver API."""
    if is_supported_browser(page):
        page.evaluate(CAPTURE_TRACES_SCRIPT)


@contextmanager
def with_cdp_session(page: Page):
    """
    Create a new Chrome DevTools Protocol session.
    Detach the session when the context manager exits.
    """
    if not is_supported_browser(page):
        raise RuntimeError(
            "Chrome DevTools Protocol is only supported on Chromium-based browsers."
        )

    client = page.context.new_cdp_session(page)
    yield client
    client.detach()


@contextmanager
def measure_performance(
    page: Page, *, test_name: str, cpu_throttling_rate: int | None = None
):
    """Measure the performance of the page using the native performance API from
    Chrome DevTools Protocol.

    @see https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.page.metrics.md

    Parameters
    ----------
        page : Page
            The page to measure performance on.
        cpu_throttling_rate : int | None, optional
            Throttling rate as a slowdown factor (1 is no throttle, 2 is 2x slowdown, etc).
            Defaults to None.
    """
    with with_cdp_session(page) as client:
        if cpu_throttling_rate is not None:
            client.send("Emulation.setCPUThrottlingRate", {"rate": cpu_throttling_rate})

        client.send("Performance.enable")

        # Start timing
        start_time = time.time()

        # Run the test
        yield

        # Calculate execution time
        execution_time = time.time() - start_time

        # Add custom metric for test execution time
        custom_metrics = [{"name": "TestExecutionTime", "value": execution_time}]

        # Get metrics from Chrome DevTools Protocol
        metrics_response = client.send("Performance.getMetrics")
        captured_traces_result = client.send(
            "Runtime.evaluate",
            {"expression": GET_CAPTURED_TRACES_SCRIPT},
        )["result"]
        captured_traces = captured_traces_result.get("value", "{}")
        parsed_captured_traces = json.loads(captured_traces)

        performance_results_dir = os.path.join(
            get_git_root(), ".benchmarks", "playwright"
        )

        # Ensure the directory exists
        os.makedirs(performance_results_dir, exist_ok=True)

        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")

        with open(
            os.path.join(performance_results_dir, f"{timestamp}_{test_name}.json"), "w"
        ) as f:
            json.dump(
                {
                    "metrics": metrics_response["metrics"] + custom_metrics,
                    "capturedTraces": parsed_captured_traces,
                },
                f,
            )
