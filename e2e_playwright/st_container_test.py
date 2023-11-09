# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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


def test_permits_multiple_out_of_order_elements(app: Page):
    """Test that st.container permits multiple out-of-order elements."""
    markdown_elements = app.get_by_test_id("stMarkdown")

    expect(markdown_elements.nth(0)).to_have_text("Line 2")
    expect(markdown_elements.nth(1)).to_have_text("Line 3")
    expect(markdown_elements.nth(2)).to_have_text("Line 1")
    expect(markdown_elements.nth(3)).to_have_text("Line 4")


def test_persists_widget_state_across_reruns(app: Page):
    """Test that st.container persists widget state across reruns."""
    checkbox_widget = app.get_by_test_id("stCheckbox").first
    checkbox_widget.click()

    expect(app.locator("h1").first).to_have_text("Checked!")

    app.get_by_test_id("stButton").first.locator("button").click()
    expect(app.locator("h2").first).to_have_text("Pressed!")
    expect(checkbox_widget.locator("input")).to_have_attribute("aria-checked", "true")


def test_renders_container_with_border(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.container(border=True) renders correctly with a border."""
    container_with_border = themed_app.get_by_test_id(
        "stVerticalBlockBorderWrapper"
    ).nth(3)
    assert_snapshot(container_with_border, name="st_container-has_border")
