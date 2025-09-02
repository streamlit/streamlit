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

from playwright.sync_api import Page, Route, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_until,
)
from e2e_playwright.shared.app_utils import goto_app


def handle_route_hostconfig_disable_fullscreen_and_error_dialogs(route: Route) -> None:
    response = route.fetch()
    body = response.json()
    body["disableFullscreenMode"] = True
    body["blockErrorDialogs"] = True
    route.fulfill(
        # Pass all fields from the response.
        response=response,
        # Override response body.
        json=body,
    )


def test_disable_fullscreen(
    page: Page, app_port: int, assert_snapshot: ImageCompareFunction
):
    """Test that fullscreen mode is disabled for elements when set via host-config."""
    page.route(
        "**/_stcore/host-config",
        handle_route_hostconfig_disable_fullscreen_and_error_dialogs,
    )
    goto_app(page, f"http://localhost:{app_port}")

    # Test that the toolbar is not shown when hovering over a dataframe
    dataframe_element = page.get_by_test_id("stDataFrame").nth(0)
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")

    # Hover over dataframe
    dataframe_element.hover()

    expect(page.get_by_role("button", name="Fullscreen")).not_to_be_attached()

    # Check that it is visible (expect waits)
    expect(dataframe_toolbar).to_have_css("opacity", "1")
    # Take a snapshot
    assert_snapshot(
        dataframe_toolbar, name="host_config-dataframe_disabled_fullscreen_mode"
    )


def test_block_error_dialogs(page: Page, app_port: int):
    """Test that error dialogs are blocked and sent to host when set via host-config."""
    # Need to be more specific about the route to allow for successful redirect
    page.route(
        f"http://localhost:{app_port}/_stcore/host-config",
        handle_route_hostconfig_disable_fullscreen_and_error_dialogs,
    )

    # Initial load of page
    goto_app(page, f"http://localhost:{app_port}")

    # Capture console messages
    messages = []
    page.on("console", lambda msg: messages.append(msg))

    # Navigate to a non-existent page to trigger page not found error
    page.goto(f"http://localhost:{app_port}/nonexistent_page")

    # Wait until the expected error is logged - console should include 2 404 errors
    # (health & host-config) then the page not found error
    wait_until(
        page,
        lambda: any(
            "The page that you have requested does not seem to exist. Running the app's main page."
            in message.text
            for message in messages
        ),
    )

    # Verify no error dialog is shown
    expect(page.get_by_role("dialog")).not_to_be_attached()
