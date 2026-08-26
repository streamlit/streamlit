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

"""E2E tests for st.App running the mega_tester_app.py script via streamlit run.

This test verifies that st.App works correctly when run with `streamlit run`
and can successfully execute a complex Streamlit script without console errors.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from playwright.sync_api import expect

from e2e_playwright.shared.app_utils import expect_no_skeletons

if TYPE_CHECKING:
    from playwright.sync_api import ConsoleMessage, Page


def is_expected_error(msg: ConsoleMessage, browser_name: str) -> bool:
    """Check if a console error is expected and should be ignored."""
    # Mapbox error is expected and should be ignored:
    if (
        msg.text == "Failed to load resource: net::ERR_CONNECTION_REFUSED"
        and "events.mapbox.com" in msg.location["url"]
    ):
        return True

    # There is an expected error with pydeck and firefox related to WebGL rendering
    # This seems to be an issue with firefox used with playwright:
    return bool(
        re.search(r"deck:.*is null undefined", msg.text) and browser_name == "firefox"
    )


def test_no_console_errors(app: Page, browser_name: str):
    """Test that st.App running mega_tester_app does not log any console errors."""

    console_errors: list[dict[str, str | int]] = []

    def on_console_message(msg: ConsoleMessage) -> None:
        # Possible message types: "log", "debug", "info", "error", "warning", ...
        if msg.type == "error" and not is_expected_error(msg, browser_name):
            console_errors.append(
                {
                    "message": msg.text,
                    "url": msg.location["url"],
                    "line": msg.location["lineNumber"],
                    "column": msg.location["columnNumber"],
                }
            )

    app.on("console", on_console_message)

    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    # There should be only one exception in the app (the st.exception demo):
    expect(app.get_by_test_id("stException")).to_have_count(1)

    # Check that title is visible:
    expect(app.get_by_text("🎈 Mega tester app")).to_be_visible()

    # There should be no unexpected console errors:
    assert not console_errors, "Console errors were logged " + str(console_errors)
