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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def _check_expected_elements_disabled(app: Page):
    # Verify that the app's widgets are disabled, non-widget elements enabled,
    # and sidebar page nav links are disabled

    # Widgets:
    # Checkbox - widget label disabled if input is disabled
    expect(app.get_by_test_id("stCheckbox").locator("input")).to_have_attribute(
        "disabled", ""
    )
    # Slider - Baseweb uses a div with role="slider"
    slider = app.get_by_test_id("stSlider").get_by_role("slider")
    expect(slider).to_have_attribute("disabled", "")

    # Try to interact with the slider
    app.get_by_test_id("stSlider").nth(0).hover()
    # click in middle
    app.mouse.down()
    expect(app.get_by_test_id("stMarkdown").first).to_contain_text("Value 1: 25")

    # Text area
    expect(app.get_by_test_id("stTextArea").locator("textarea")).to_have_attribute(
        "disabled", ""
    )
    # Button
    expect(app.get_by_test_id("stButton").locator("button")).to_have_attribute(
        "disabled", ""
    )
    # Radio
    expect(app.get_by_test_id("stRadio").locator("input").first).to_have_attribute(
        "disabled", ""
    )
    # Text input
    expect(app.get_by_test_id("stTextInput").locator("input")).to_have_attribute(
        "disabled", ""
    )
    # Selectbox
    expect(app.get_by_test_id("stSelectbox").locator("input")).to_have_attribute(
        "disabled", ""
    )
    # Time input
    expect(app.get_by_test_id("stTimeInput").locator("input")).to_have_attribute(
        "disabled", ""
    )
    # Date input
    expect(app.get_by_test_id("stDateInput").locator("input")).to_have_attribute(
        "disabled", ""
    )

    # Non-widget elements:
    # Link button
    expect(app.get_by_test_id("stLinkButton").locator("a")).not_to_be_disabled()
    # Tabs
    tabs = app.get_by_test_id("stTabs")
    tab_button = app.get_by_test_id("stTab").nth(1)
    expect(tab_button).to_contain_text("Tab 2")
    tab_button.click()
    tab_panel = tabs.get_by_test_id("stElementContainer").nth(1)
    expect(tab_panel).to_be_visible()
    expect(tab_panel).to_have_text("World")
    # Expander
    expander = app.get_by_test_id("stExpander")
    expect(expander).not_to_be_disabled()
    expander.click()
    expect(expander.get_by_test_id("stExpanderDetails")).to_be_visible()

    # Sidebar page nav links:
    sidebar_nav_links = app.get_by_test_id("stSidebarNavItems").get_by_role("link")
    expect(sidebar_nav_links).to_have_count(2)
    expect(sidebar_nav_links.nth(0)).to_have_attribute("disabled", "")
    expect(sidebar_nav_links.nth(1)).to_have_attribute("disabled", "")


def test_disconnected_states(app: Page, assert_snapshot: ImageCompareFunction):
    # Abort all requests to simulate runtime shutdown
    app.route("**", lambda route, _: route.abort())

    expect(app.get_by_test_id("stButton").locator("button")).not_to_have_attribute(
        "disabled", ""
    )
    expect(app.get_by_test_id("stMarkdown").first).to_contain_text("Value 1: 25")

    expect(app.get_by_test_id("stConnectionStatus")).not_to_be_visible()

    # disconnect the websocket connection
    app.evaluate("window.streamlitDebug.disconnectWebsocket()")

    expect(app.get_by_test_id("stConnectionStatus")).to_contain_text("Connecting")

    # Check that the expected elements are disabled/enabled
    _check_expected_elements_disabled(app)

    # After some time the disconnected dialog will appear.
    # It would be nicer to have this in a separate function, but we can't do that easily
    # because the runtime is shutdown for all test functions. We would need to start the
    # runtime again somehow or move this to a separate file.
    dialog = app.get_by_role("dialog")
    # the dialog might need a moment to appear after shutting down the runtime
    expect(dialog).to_be_visible(timeout=20000)
    # make sure that the close-x button is not focused
    dialog.blur(timeout=0)
    assert_snapshot(dialog, name="websocket_connection-disconnected_dialog")
