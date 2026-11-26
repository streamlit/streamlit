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

from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING, Any
from urllib.parse import urlparse

import pytest

from e2e_playwright.conftest import build_app_url, wait_for_app_loaded, wait_until
from e2e_playwright.shared.app_utils import click_button

if TYPE_CHECKING:
    from collections.abc import Generator

    from playwright.sync_api import BrowserType, Page, Route

# Render timing is only measured for apps that aren't served from a local
# address. The test browser resolves this name to the local app server.
HOSTED_HOSTNAME = "render-timing.test"
# Hosts can only set HTTPS metrics URLs. Requests to it are intercepted, so
# they never leave the browser.
METRICS_URL = "https://metrics.render-timing.test/events"
DEFAULT_METRICS_URL = re.compile(
    r"^https://(data\.streamlit\.io|webhooks\.fivetran\.com)/"
)
# Every element in the app. Its grid layout fits the test viewport.
EXPECTED_VISIBLE_ELEMENTS = 11
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
}


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    return ["--browser.gatherUsageStats", "true"]


@pytest.fixture
def hosted_page(
    browser_type: BrowserType, browser_type_launch_args: dict[str, Any]
) -> Generator[Page, None, None]:
    """Return a page in a browser that resolves HOSTED_HOSTNAME locally."""
    browser = browser_type.launch(
        **{
            **browser_type_launch_args,
            "args": [
                *browser_type_launch_args.get("args", []),
                f"--host-resolver-rules=MAP {HOSTED_HOSTNAME} 127.0.0.1",
            ],
        }
    )
    yield browser.new_page()
    browser.close()


def _find_event(
    events: list[dict[str, Any]], name: str, run_index: int
) -> dict[str, Any] | None:
    return next(
        (
            event
            for event in events
            if event.get("event") == name and event.get("runIndex") == str(run_index)
        ),
        None,
    )


@pytest.mark.only_browser("chromium")
def test_reports_render_timing_for_each_run(
    hosted_page: Page, app_base_url: str
) -> None:
    """A hosted app reports a renderTiming event for each run, joined to the
    run's pageProfile event.
    """
    page = hosted_page
    events: list[dict[str, Any]] = []
    default_metrics_requests: list[str] = []
    console_errors: list[str] = []

    def record_event(route: Route) -> None:
        if route.request.method == "POST":
            events.append(json.loads(route.request.post_data or "{}"))
        route.fulfill(status=200, headers=CORS_HEADERS)

    def block_default_metrics(route: Route) -> None:
        default_metrics_requests.append(route.request.url)
        route.abort()

    page.add_init_script(
        f"window.__streamlit = {{ HOST_CONFIG: {{ metricsUrl: {json.dumps(METRICS_URL)} }} }}"
    )
    page.route(METRICS_URL, record_event)
    page.route(DEFAULT_METRICS_URL, block_default_metrics)
    page.on(
        "console",
        lambda message: (
            console_errors.append(message.text) if message.type == "error" else None
        ),
    )
    port = urlparse(app_base_url).port
    page.goto(build_app_url(f"http://{HOSTED_HOSTNAME}:{port}"))
    wait_for_app_loaded(page)

    wait_until(
        page, lambda: _find_event(events, "renderTiming", 0) is not None, timeout=10000
    )
    first_run = _find_event(events, "renderTiming", 0)
    assert first_run is not None
    first_profile = _find_event(events, "pageProfile", 0)
    assert first_profile is not None
    for milestone in ("appShellReadyMs", "connectedMs", "scriptFinishedMs"):
        assert milestone in first_profile, milestone
    timing = first_run["renderTiming"]
    assert int(timing["firstContentMs"]) <= int(timing["fullyLoadedMs"])
    assert int(first_profile["scriptFinishedMs"]) <= int(timing["fullyLoadedMs"])
    assert timing["visibleElements"] == EXPECTED_VISIBLE_ELEMENTS
    assert timing["viewportWidthBucket"] == 1280
    assert timing["viewportHeightBucket"] == 720
    assert timing["timedOut"] is False
    assert timing["timedOutElements"] == 0
    assert timing["wasHidden"] is False
    assert timing["wasSuperseded"] is False

    click_button(page, "Rerun")

    wait_until(
        page, lambda: _find_event(events, "renderTiming", 1) is not None, timeout=10000
    )
    rerun = _find_event(events, "renderTiming", 1)
    assert rerun is not None
    rerun_profile = _find_event(events, "pageProfile", 1)
    assert rerun_profile is not None
    assert "scriptFinishedMs" in rerun_profile
    assert "connectedMs" not in rerun_profile
    rerun_timing = rerun["renderTiming"]
    assert "inputDelayMs" in rerun_timing
    assert "fullyLoadedMs" in rerun_timing

    assert default_metrics_requests == []
    assert not [error for error in console_errors if "Render timing" in error]
