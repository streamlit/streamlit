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

"""E2E tests for st.bottom container."""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def test_bottom_container_exists(app: Page):
    """Test that the bottom container is rendered."""
    bottom = app.get_by_test_id("stBottom")
    expect(bottom).to_be_visible()


def test_bottom_container_has_elements(app: Page):
    """Test that elements are rendered inside the bottom container."""
    bottom = app.get_by_test_id("stBottom")

    # Check text elements are in bottom
    expect(bottom.get_by_text("Bottom text 1")).to_be_visible()
    expect(bottom.get_by_text("Bottom text 2")).to_be_visible()

    # Check button is in bottom
    expect(bottom.get_by_role("button", name="Bottom button")).to_be_visible()

    # Check markdown is in bottom
    expect(bottom.get_by_text("Bottom markdown")).to_be_visible()


def test_bottom_container_accumulates_elements(app: Page):
    """Test that multiple with st.bottom blocks accumulate elements."""
    bottom = app.get_by_test_id("stBottom")

    # Both text elements from separate with blocks should be present
    text1 = bottom.get_by_text("Bottom text 1")
    text2 = bottom.get_by_text("Bottom text 2")

    expect(text1).to_be_visible()
    expect(text2).to_be_visible()


def test_bottom_container_supports_columns(app: Page):
    """Test that columns work inside the bottom container."""
    bottom = app.get_by_test_id("stBottom")

    expect(bottom.get_by_text("Column 1 in bottom")).to_be_visible()
    expect(bottom.get_by_text("Column 2 in bottom")).to_be_visible()


def test_chat_input_in_bottom_renders_inline(app: Page):
    """Test that chat_input inside st.bottom renders inline (not auto-repositioned)."""
    bottom = app.get_by_test_id("stBottom")

    # The chat input with key "chat_in_bottom" should be inside the bottom container
    # and rendered inline (position="inline")
    chat_input = bottom.get_by_test_id("stChatInput").filter(
        has=app.locator('[data-testid="stChatInputTextArea"]')
    )
    expect(chat_input.first).to_be_visible()


def test_chat_input_in_main_auto_positions_to_bottom(app: Page):
    """Test that chat_input in main still auto-positions to bottom (regression test)."""
    # The chat input from main should also appear in the bottom area
    # Both chat inputs should be visible
    chat_inputs = app.get_by_test_id("stChatInput")
    expect(chat_inputs).to_have_count(2)


def test_main_content_is_separate_from_bottom(app: Page):
    """Test that main content is not in the bottom container."""
    main_block = app.get_by_test_id("stMainBlockContainer")
    bottom = app.get_by_test_id("stBottom")

    # Title should be in main block container, not in bottom
    expect(main_block.get_by_role("heading", name="st.bottom Test App")).to_be_visible()

    # Title should not be in bottom
    expect(
        bottom.get_by_role("heading", name="st.bottom Test App")
    ).not_to_be_attached()


def test_bottom_container_is_sticky(app: Page):
    """Test that the bottom container stays visible when scrolling."""
    bottom = app.get_by_test_id("stBottom")

    # Scroll down
    app.evaluate("window.scrollTo(0, document.body.scrollHeight)")

    # Bottom should still be visible
    expect(bottom).to_be_visible()


def test_bottom_container_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Visual snapshot test for the bottom container."""
    bottom = themed_app.get_by_test_id("stBottom")
    expect(bottom.get_by_text("Bottom text 1")).to_be_visible()
    assert_snapshot(bottom, name="st_bottom-container")
