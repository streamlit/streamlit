# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded


def handle_route_hostconfig_disable_fullscreen(route: Route) -> None:
    response = route.fetch()
    body = response.json()
    body["disableFullscreenMode"] = True
    route.fulfill(
        # Pass all fields from the response.
        response=response,
        # Override response body.
        json=body,
    )


def test_disable_fullscreen(
    page: Page, app_port: int, assert_snapshot: ImageCompareFunction
):
    """Test that fullscreen mode is disabled for elements when set via host-config"""
    page.route("**/_stcore/host-config", handle_route_hostconfig_disable_fullscreen)
    page.goto(f"http://localhost:{app_port}")
    wait_for_app_loaded(page)

    # check that the image does not have the fullscreen button
    expect(page.get_by_test_id("StyledFullScreenButton")).to_have_count(0)

    # Test that the toolbar is not shown when hovering over a dataframe
    dataframe_element = page.get_by_test_id("stDataFrame").nth(0)
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")

    # Hover over dataframe
    dataframe_element.hover()
    # Check that it is visible (expect waits)
    expect(dataframe_toolbar).to_have_css("opacity", "1")
    # Take a snapshot
    assert_snapshot(
        dataframe_toolbar, name="host_config-dataframe_disabled_fullscreen_mode"
    )
