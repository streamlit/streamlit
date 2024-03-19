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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


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
    # This one should not have scrolling activated:
    expect(container_with_border).not_to_have_css("overflow", "auto")


def test_renders_scroll_container(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.container(height=<pixels>) renders a scroll container."""

    scroll_container = app.get_by_test_id("stVerticalBlockBorderWrapper").nth(4)
    expect(scroll_container).to_have_css("overflow", "auto")
    expect(scroll_container).to_have_css("height", "200px")
    expect(scroll_container).to_have_attribute("data-test-scroll-behavior", "normal")
    assert_snapshot(scroll_container, name="st_container-scroll_container")

    scroll_container_empty = app.get_by_test_id("stVerticalBlockBorderWrapper").nth(5)
    expect(scroll_container_empty).to_have_css("overflow", "auto")
    expect(scroll_container_empty).to_have_css("height", "100px")
    expect(scroll_container_empty).to_have_attribute(
        "data-test-scroll-behavior", "normal"
    )
    assert_snapshot(scroll_container_empty, name="st_container-scroll_container_empty")

    # This one should be pinned to the bottom:
    scroll_container_chat = app.get_by_test_id("stVerticalBlockBorderWrapper").nth(6)
    expect(scroll_container_chat).to_have_css("overflow", "auto")
    expect(scroll_container_chat).to_have_css("height", "200px")
    expect(scroll_container_chat).to_have_attribute(
        "data-test-scroll-behavior", "scroll-to-bottom"
    )
    assert_snapshot(scroll_container_chat, name="st_container-scroll_container_chat")


def test_correctly_handles_first_chat_message(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.container(height=<pixels>) correctly handles the scroll
    behaviour change when adding the first chat message ."""

    # Click button to add a chat message to the empty container:
    app.get_by_test_id("stButton").nth(2).locator("button").click()

    wait_for_app_run(app)

    # Wait for the stVerticalBlockBorderWrapper container to switch to scroll-to-bottom:
    expect(app.get_by_test_id("stVerticalBlockBorderWrapper").nth(5)).to_have_attribute(
        "data-test-scroll-behavior", "scroll-to-bottom"
    )

    assert_snapshot(
        app.get_by_test_id("stVerticalBlockBorderWrapper").nth(5),
        name="st_container-added_chat_message",
    )
