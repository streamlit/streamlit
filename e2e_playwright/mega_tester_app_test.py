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

import re
from typing import TYPE_CHECKING

import pytest
from playwright.sync_api import expect

from e2e_playwright.conftest import IframedPage, rerun_app, wait_for_app_run
from e2e_playwright.shared.app_utils import expect_no_skeletons

if TYPE_CHECKING:
    from playwright.sync_api import ConsoleMessage, FrameLocator, Page

    from e2e_playwright.shared.app_target import AppTarget


def is_expected_error(
    msg: ConsoleMessage, browser_name: str, *, uses_csp: bool
) -> bool:
    # Mapbox error is expected and should be ignored:
    if (
        msg.text == "Failed to load resource: net::ERR_CONNECTION_REFUSED"
        and "events.mapbox.com" in msg.location["url"]
    ):
        return True

    # There is an expected error with pydeck and firefox related to WebGL rendering
    # This seems to be an issue with firefox used with playwright:
    if re.search(r"deck:.*is null undefined", msg.text) and browser_name == "firefox":
        return True

    # TODO(lukasmasuch): Investigate why firefox is running into this eval issue:
    if (
        (
            "settings blocked a JavaScript eval (script-src) from being executed"
            in msg.text
        )
        and browser_name == "firefox"
        and uses_csp
    ):
        return True

    # TODO(lukasmasuch): Investigate why webkit is running into this blob: issue:
    return bool(
        msg.text == "Failed to load resource"
        and "blob:http://localhost:" in msg.location["url"]
        and browser_name == "webkit"
        and uses_csp
    )


@pytest.mark.external_test(upload_test_assets=True)
def test_no_console_errors(
    app_target: AppTarget,
    browser_name: str,
):
    """Test that the app does not log any console errors."""

    console_errors = []

    def on_console_message(msg: ConsoleMessage) -> None:
        # Possible message types: "log", "debug", "info", "error", "warning", ...
        if msg.type == "error" and not is_expected_error(
            msg, browser_name, uses_csp=False
        ):
            # Each console message has text, location, etc.
            console_errors.append(
                {
                    "message": msg.text,
                    "url": msg.location["url"],
                    "line": msg.location["lineNumber"],
                    "column": msg.location["columnNumber"],
                }
            )

    app_target.page.on("console", on_console_message)

    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app_target.locator_context, timeout=25000)

    # There should be only one exception in the app:
    expect(app_target.get_by_test_id("stException")).to_have_count(1)

    # Check that title is visible:
    expect(app_target.get_by_text("🎈 Mega tester app")).to_be_visible()

    # There should be no unexpected console errors:
    assert not console_errors, "Console errors were logged " + str(console_errors)


def test_mega_tester_app_in_iframe(iframed_app: IframedPage, browser_name: str):
    """Test that the mega tester app can be loaded within an iframe with CSP."""

    console_errors = []

    def on_console_message(msg: ConsoleMessage) -> None:
        # Possible message types: "log", "debug", "info", "error", "warning", ...
        if msg.type == "error" and not is_expected_error(
            msg, browser_name, uses_csp=True
        ):
            # Each console message has text, location, etc.
            console_errors.append(
                {
                    "message": msg.text,
                    "url": msg.location["url"],
                    "line": msg.location["lineNumber"],
                    "column": msg.location["columnNumber"],
                }
            )

    page: Page = iframed_app.page
    page.on("console", on_console_message)

    frame_locator: FrameLocator = iframed_app.open_app(None)

    wait_for_app_run(frame_locator)
    page.wait_for_load_state()

    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(frame_locator, timeout=25000)

    # Check that title is visible:
    expect(frame_locator.get_by_text("🎈 Mega tester app")).to_be_visible()
    # There should be only one exception in the app:
    expect(frame_locator.get_by_test_id("stException")).to_have_count(1)

    # Check that there are no dialogs (e.g. with errors) visible:
    expect(frame_locator.get_by_test_id("stDialog")).to_have_count(0)

    # There should be no unexpected console errors:
    assert not console_errors, "Console errors were logged " + str(console_errors)


@pytest.mark.performance
@pytest.mark.repeat(5)  # only repeat 5 times since otherwise it would take too long
def test_mega_tester_app_rendering_performance(app: Page):
    """Test the performance of the mega tester app rendering."""
    # Rerun the app 5 times:
    for _ in range(5):
        rerun_app(app)
