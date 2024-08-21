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

from e2e_playwright.conftest import ImageCompareFunction, rerun_app, wait_for_app_loaded
from e2e_playwright.shared.app_utils import check_top_level_class


def test_chat_input_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the st.chat_input widgets are correctly rendered via screenshot matching."""
    chat_input_widgets = app.get_by_test_id("stChatInput")
    expect(chat_input_widgets).to_have_count(4)

    assert_snapshot(chat_input_widgets.nth(0), name="st_chat_input-inline")
    assert_snapshot(chat_input_widgets.nth(1), name="st_chat_input-in_column_disabled")
    assert_snapshot(chat_input_widgets.nth(2), name="st_chat_input-callback")
    assert_snapshot(chat_input_widgets.nth(3), name="st_chat_input-bottom")


def test_max_characters_enforced(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the max_chars parameter is enforced."""
    long_text = (
        "Lorem ipsum dolor amet, consectetur adipiscing elit. Mauris tristique est at "
        "tincidunt pul vinar. Nam pulvinar neque sapien, eu pellentesque metus pellentesque "
        "at. Ut et dui molestie, iaculis magna sed. This text should not appear in the input."
    )
    chat_input = themed_app.get_by_test_id("stChatInput").nth(3)
    chat_input_area = chat_input.locator("textarea")

    chat_input_area.type(long_text)

    expected_text = (
        "Lorem ipsum dolor amet, consectetur adipiscing elit. Mauris tristique est at "
        "tincidunt pul vinar. Nam pulvinar neque sapien, eu pellentesque metus pellentesque "
        "at. Ut et dui molestie, iaculis magna se"
    )
    expect(chat_input_area).to_have_value(expected_text)
    assert_snapshot(chat_input, name="st_chat_input-max_chars")


def test_embedded_app_with_bottom_chat_input(
    page: Page, app_port: int, assert_snapshot: ImageCompareFunction
):
    """Test that an embedded app with bottom chat input renders correctly."""
    page.goto(f"http://localhost:{app_port}/?embed=true")
    wait_for_app_loaded(page, embedded=True)

    app_view_block = page.get_by_test_id("stAppViewBlockContainer")
    # Bottom padding should be 16px (1rem):
    expect(app_view_block).to_have_css("padding-bottom", "16px")
    bottom_block = page.get_by_test_id("stBottomBlockContainer")
    # Bottom padding should be 32px (2rem):
    expect(bottom_block).to_have_css("padding-bottom", "32px")
    # Top padding should be 16px (1rem):
    expect(bottom_block).to_have_css("padding-top", "16px")

    # There shouldn't be an iframe resizer anchor:
    expect(page.get_by_test_id("IframeResizerAnchor")).to_be_hidden()
    # The scroll container should be switched to scroll to bottom:
    expect(page.get_by_test_id("ScrollToBottomContainer")).to_be_attached()

    assert_snapshot(
        page.get_by_test_id("stAppViewContainer"),
        name="st_chat_input-app_embedded_with_bottom",
    )


def test_app_with_bottom_chat_input(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that an app with bottom chat input renders correctly."""
    app_view_block = app.get_by_test_id("stAppViewBlockContainer")
    # Bottom padding should be 16px (1rem):
    expect(app_view_block).to_have_css("padding-bottom", "16px")

    bottom_block = app.get_by_test_id("stBottomBlockContainer")
    # Bottom padding should be 55px:
    expect(bottom_block).to_have_css("padding-bottom", "55px")
    # Top padding should be 16px (1rem):
    expect(bottom_block).to_have_css("padding-top", "16px")

    # There shouldn't be an iframe resizer anchor:
    expect(app.get_by_test_id("IframeResizerAnchor")).to_be_hidden()
    # The scroll container should be switched to scroll to bottom:
    expect(app.get_by_test_id("ScrollToBottomContainer")).to_be_attached()

    assert_snapshot(app.get_by_test_id("stBottom"), name="st_chat_input-app_bottom")


def test_enter_submits_clears_input(app: Page):
    """Test that pressing Enter submits and clears the input."""
    markdown_output = app.get_by_test_id("stMarkdown").nth(3)
    expect(markdown_output).to_have_text(
        "Chat input 4 (bottom, max_chars) - value: None"
    )

    chat_input_area = app.get_by_test_id("stChatInputTextArea").nth(3)
    chat_input_area.type("Corgi")
    chat_input_area.press("Enter")
    expect(chat_input_area).to_have_value("")

    expect(markdown_output).to_have_text(
        "Chat input 4 (bottom, max_chars) - value: Corgi"
    )


def test_shift_enter_creates_new_line(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that Shift+Enter creates a new line."""
    chat_input = app.get_by_test_id("stChatInput").nth(3)
    chat_input_area = chat_input.locator("textarea")
    chat_input_area.fill("")  # Clear the input first
    chat_input_area.press("Shift+Enter")
    chat_input_area.type("New Line")
    assert_snapshot(chat_input, name="st_chat_input-shift_enter_new_line")


def test_click_button_to_submit_clears_input(app: Page):
    """Test that clicking the button submits and clears the input."""
    chat_input = app.get_by_test_id("stChatInput").nth(0)
    submit_button = chat_input.get_by_test_id("stChatInputSubmitButton")
    chat_input_area = chat_input.locator("textarea")

    chat_input_area.type("Corgi")
    submit_button.click()

    expect(chat_input_area).to_have_value("")

    markdown_output = app.get_by_test_id("stMarkdown").nth(0)
    expect(markdown_output).to_have_text("Chat input 1 (inline) - value: Corgi")


def test_chat_input_focus_state(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.chat_input renders the focus state correctly."""
    chat_input = themed_app.get_by_test_id("stChatInput").nth(3)
    chat_input_area = chat_input.locator("textarea")
    chat_input_area.click()
    expect(chat_input_area).to_be_focused()
    assert_snapshot(chat_input, name="st_chat_input-focused")


def test_grows_shrinks_input_text(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that input grows with long text and shrinks when text is deleted."""
    chat_input = app.get_by_test_id("stChatInput").nth(3)
    chat_input_area = chat_input.locator("textarea")
    chat_input_area.type(
        "Lorem ipsum dolor amet, consectetur adipiscing elit. "
        "Mauris tristique est at tincidunt pul vinar. Nam pulvinar neque sapien, "
        "eu pellentesque metus pellentesque at. Ut et dui molestie, iaculis magna."
    )
    assert_snapshot(chat_input, name="st_chat_input-grows")
    for _ in range(20):
        chat_input_area.press("Backspace", delay=10)
    assert_snapshot(chat_input, name="st_chat_input-shrinks")


def test_calls_callback_on_submit(app: Page):
    """Test that it correctly calls the callback on submit."""
    chat_input_area = app.get_by_test_id("stChatInputTextArea").nth(2)

    chat_input_area.type("hello world")
    chat_input_area.press("Enter")

    markdown_output = app.get_by_test_id("stMarkdown").nth(2)
    expect(app.get_by_test_id("stText").nth(0)).to_have_text(
        "chat input submitted",
        use_inner_text=True,
    )
    expect(markdown_output).to_have_text(
        "Chat input 3 (callback) - value: hello world",
        use_inner_text=True,
    )

    rerun_app(app)

    # Expect the callback to not be triggered:
    expect(app.get_by_test_id("stText")).not_to_be_attached()
    # And the session state value to be reset
    expect(markdown_output).to_have_text(
        "Chat input 3 (callback) - value: None",
        use_inner_text=True,
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stChatInput")
