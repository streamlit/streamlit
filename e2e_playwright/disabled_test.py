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

import pytest
from playwright.sync_api import Page, expect


def test_disconnecting_disables_widgets_correctly(app: Page):
    expect(app.get_by_test_id("stButton").locator("button")).not_to_have_attribute(
        "disabled", ""
    )
    expect(app.get_by_test_id("stMarkdown").first).to_contain_text("Value 1: 25")

    expect(app.get_by_test_id("stConnectionStatus")).not_to_be_visible()
    app.evaluate("window.streamlitDebug.shutdownRuntime()")
    expect(app.get_by_test_id("stConnectionStatus")).not_to_be_visible()
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
