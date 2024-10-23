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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def test_disconnected_states(app: Page, assert_snapshot: ImageCompareFunction):
    expect(app.get_by_test_id("stButton").locator("button")).not_to_have_attribute(
        "disabled", ""
    )
    expect(app.get_by_test_id("stMarkdown").first).to_contain_text("Value 1: 25")

    expect(app.get_by_test_id("stConnectionStatus")).not_to_be_visible()

    # activating this will disable all elements and simulate runtime shutdown
    app.evaluate("window.streamlitDebug.shutdownRuntime()")
    expect(app.get_by_test_id("stConnectionStatus")).to_contain_text("Connecting")

    expect(app.get_by_test_id("stButton").locator("button")).to_have_attribute(
        "disabled", ""
    )
    expect(app.get_by_test_id("stCheckbox").locator("input")).to_have_attribute(
        "disabled", ""
    )
    expect(app.get_by_test_id("stDateInput").locator("input")).to_have_attribute(
        "disabled", ""
    )
    expect(app.get_by_test_id("stRadio").locator("input").first).to_have_attribute(
        "disabled", ""
    )
    expect(app.get_by_test_id("stSelectbox").locator("input")).to_have_attribute(
        "disabled", ""
    )
    expect(app.get_by_test_id("stTextArea").locator("textarea")).to_have_attribute(
        "disabled", ""
    )
    expect(app.get_by_test_id("stTextInput").locator("input")).to_have_attribute(
        "disabled", ""
    )
    expect(app.get_by_test_id("stTimeInput").locator("input")).to_have_attribute(
        "disabled", ""
    )

    app.get_by_test_id("stSlider").nth(0).hover()
    # click in middle
    app.mouse.down()

    expect(app.get_by_test_id("stMarkdown").first).to_contain_text("Value 1: 25")

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
