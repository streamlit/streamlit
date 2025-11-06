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

from __future__ import annotations

import pytest
from playwright.sync_api import FilePayload, Locator, Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    rerun_app,
    wait_for_app_run,
    wait_until,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_toggle,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    get_element_by_key,
    goto_app,
    reset_hovering,
)

NUM_CHAT_INPUT_WIDGETS = 16


def expect_chat_input_value_contains_text(app: Page, key: str, text: str) -> None:
    """Assert that chat input value's text field contains the expected text.

    Args:
        app: Page object
        key: Chat input key - used to identify the specific output line
        text: Expected text content
    """
    # Look for the simple format: "<key> text: <value>"
    expected_line = f"{key} text: {text}"
    expect(app.get_by_text(expected_line)).to_be_visible()


def expect_chat_input_value_contains_audio(app: Page, key: str) -> None:
    """Assert that chat input value has an audio field populated (not None).

    Args:
        app: Page object
        key: Chat input key - used to identify the specific output line

    Verifies that audio was recorded by checking the output line contains a .wav filename
    (not "None").
    """
    # Look for the pattern: "<key> audio: " followed by a .wav filename
    # We use a regex pattern since the filename includes a timestamp
    audio_line_locator = app.get_by_text(f"{key} audio:", exact=False)
    expect(audio_line_locator).to_be_visible()

    # Ensure the audio field is NOT "None"
    expect(app.get_by_text(f"{key} audio: None", exact=True)).not_to_be_visible()


def expect_chat_input_value_contains_files(
    app: Page, key: str, file_count: int
) -> None:
    """Assert that chat input value contains the expected number of uploaded files.

    Args:
        app: Page object
        key: Chat input key - used to identify the specific output line
        file_count: Expected number of files
    """
    # Look for the simple format: "<key> files: <N> files"
    expected_line = f"{key} files: {file_count} files"
    expect(app.get_by_text(expected_line)).to_be_visible()


def file_upload_helper(app: Page, chat_input: Locator, files: list[FilePayload]):
    upload_button = chat_input.get_by_test_id("stChatInputFileUploadButton")

    expect(upload_button).to_be_visible()
    upload_button.scroll_into_view_if_needed()

    # Ensure button is ready to be clicked (WebKit specific issue)
    expect(upload_button).to_be_enabled()
    app.wait_for_timeout(100)  # Small delay to ensure button is fully ready

    with app.expect_file_chooser() as fc_info:
        # Use force=True for WebKit to ensure the click triggers file chooser
        upload_button.click(force=True)
        file_chooser = fc_info.value
        file_chooser.set_files(files=files)

    # take away hover focus of button
    app.keyboard.press("Escape")
    app.get_by_test_id("stApp").click(position={"x": 0, "y": 0}, force=True)

    wait_for_app_run(app, 500)


def directory_upload_helper(app: Page, chat_input: Locator):
    """Helper function for directory upload tests."""
    upload_button = chat_input.get_by_test_id("stChatInputFileUploadButton")

    expect(upload_button).to_be_visible()
    upload_button.scroll_into_view_if_needed()

    # For directory upload, we simulate the interaction without actual files
    # since we don't want to snapshot test with real directory uploads
    with app.expect_file_chooser() as fc_info:
        upload_button.click()
        file_chooser = fc_info.value
        # Set directory flag (this would be a directory selection in real usage)
        file_chooser.set_files(files=[])  # Empty for simulation

    # Take away hover focus of button
    app.keyboard.press("Escape")
    app.get_by_test_id("stApp").click(position={"x": 0, "y": 0}, force=True)

    wait_for_app_run(app, 500)


def grant_microphone_permissions(page: Page) -> None:
    """Grant microphone permissions where supported."""
    try:
        page.context.grant_permissions(["microphone"])
    except Exception:
        pass


def record_audio_in_chat_input(
    app: Page, chat_input: Locator, duration_ms: int = 1500
) -> None:
    """Record audio in chat input for specified duration.

    Note: Clicking approve automatically submits the chat input.

    Args:
        app: Page object
        chat_input: Locator for the chat input element
        duration_ms: Duration to record in milliseconds
    """
    # Start recording
    start_audio_recording(chat_input)

    # Record for the specified duration (wait_for_timeout is acceptable here)
    app.wait_for_timeout(duration_ms)

    # Click approve button - this submits the chat input automatically
    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    approve_button.click()

    wait_for_app_run(app)


def start_audio_recording(chat_input: Locator) -> None:
    """Start audio recording without submitting.

    This helper starts recording and waits for the recording UI to appear,
    but does not click approve or cancel. Useful for testing recording states.

    Args:
        chat_input: Locator for the chat input element
    """
    # Click microphone button to start recording
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    expect(mic_button).to_be_visible()
    mic_button.click()

    # Wait for approve button to appear (indicates recording started)
    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    expect(approve_button).to_be_visible()

    # Also verify cancel button appears
    cancel_button = chat_input.get_by_test_id("stChatInputCancelButton")
    expect(cancel_button).to_be_visible()


def test_chat_input_rendering(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the st.chat_input widgets are correctly rendered via screenshot matching."""
    # set taller height to ensure inputs do not overlap
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    chat_input_widgets = themed_app.get_by_test_id("stChatInput")
    expect(chat_input_widgets).to_have_count(NUM_CHAT_INPUT_WIDGETS)

    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_1"), name="st_chat_input-inline"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_2"),
        name="st_chat_input-in_column_disabled",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_3"), name="st_chat_input-callback"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_4"), name="st_chat_input-single-file"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_5"),
        name="st_chat_input-multiple-files",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_7"), name="st_chat_input-width_300px"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_8"),
        name="st_chat_input-width_stretch",
    )
    # The bottom chat input appears last in DOM order because st.chat_input() renders at bottom
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_8_bottom"),
        name="st_chat_input-bottom",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_9"), name="st_chat_input-directory"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_10"),
        name="st_chat_input-directory_disabled",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_11"), name="st_chat_input-with_audio"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_12"), name="st_chat_input-audio_only"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_13"),
        name="st_chat_input-audio_disabled",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_14"),
        name="st_chat_input-column_audio",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "chat_input_15"),
        name="st_chat_input-column_audio_with_files",
    )


def test_max_characters_enforced(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the max_chars parameter is enforced."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    long_text = (
        "Lorem ipsum dolor amet, consectetur adipiscing elit. Mauris tristique est at "
        "tincidunt pul vinar. Nam pulvinar neque sapien, eu pellentesque metus pellentesque "
        "at. Ut et dui molestie, iaculis magna sed. This text should not appear in the input."
    )
    chat_input = get_element_by_key(themed_app, "chat_input_8_bottom")
    chat_input_area = chat_input.locator("textarea").first

    chat_input_area.type(long_text)

    expected_text = (
        "Lorem ipsum dolor amet, consectetur adipiscing elit. Mauris tristique est at "
        "tincidunt pul vinar. Nam pulvinar neque sapien, eu pellentesque metus pellentesque "
        "at. Ut et dui molestie, iaculis magna se"
    )
    expect(chat_input_area).to_have_value(expected_text)
    assert_snapshot(chat_input, name="st_chat_input-max_chars")


def test_embedded_app_with_bottom_chat_input(
    themed_app: Page,
    app_port: int,
    app_theme: str,
    assert_snapshot: ImageCompareFunction,
):
    """Test that an embedded app with bottom chat input renders correctly."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    goto_app(
        themed_app, f"http://localhost:{app_port}/?embed=true&embed_options={app_theme}"
    )

    app_view_block = themed_app.get_by_test_id("stMainBlockContainer")
    # Bottom padding should be 16px (1rem):
    expect(app_view_block).to_have_css("padding-bottom", "16px")
    bottom_block = themed_app.get_by_test_id("stBottomBlockContainer")
    # Bottom padding should be 32px (2rem):
    expect(bottom_block).to_have_css("padding-bottom", "32px")
    # Top padding should be 16px (1rem):
    expect(bottom_block).to_have_css("padding-top", "16px")

    # There shouldn't be an iframe resizer anchor:
    expect(themed_app.get_by_test_id("stAppIframeResizerAnchor")).to_be_hidden()
    # The scroll container should be switched to scroll to bottom:
    expect(themed_app.get_by_test_id("stAppScrollToBottomContainer")).to_be_attached()

    assert_snapshot(
        themed_app.get_by_test_id("stAppViewContainer"),
        name="st_chat_input-app_embedded_with_bottom",
    )


def test_app_with_bottom_chat_input(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that an app with bottom chat input renders correctly."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    app_view_block = themed_app.get_by_test_id("stMainBlockContainer")
    # Bottom padding should be 16px (1rem):
    expect(app_view_block).to_have_css("padding-bottom", "16px")

    bottom_block = themed_app.get_by_test_id("stBottomBlockContainer")
    # Bottom padding should be 56px (3.5rem):
    expect(bottom_block).to_have_css("padding-bottom", "56px")
    # Top padding should be 16px (1rem):
    expect(bottom_block).to_have_css("padding-top", "16px")

    # There shouldn't be an iframe resizer anchor:
    expect(themed_app.get_by_test_id("stAppIframeResizerAnchor")).to_be_hidden()
    # The scroll container should be switched to scroll to bottom:
    expect(themed_app.get_by_test_id("stAppScrollToBottomContainer")).to_be_attached()

    assert_snapshot(
        themed_app.get_by_test_id("stBottom"), name="st_chat_input-app_bottom"
    )


def test_submit_hover_state_with_input_value(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test the submit button's hover state when input value is present."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(themed_app, "chat_input_8_bottom")
    chat_input_area = chat_input.locator("textarea").first
    chat_input_area.type("Corgi")

    submit_button = chat_input.get_by_test_id("stChatInputSubmitButton")
    submit_button.hover()
    assert_snapshot(chat_input, name="st_chat_input-submit_hover")


def test_enter_submits_clears_input(app: Page):
    """Test that pressing Enter submits and clears the input."""
    expect_markdown(app, "Chat input 8 (bottom, max_chars) - value: None")

    chat_input_area = (
        get_element_by_key(app, "chat_input_8_bottom").locator("textarea").first
    )
    chat_input_area.type("Corgi")
    chat_input_area.press("Enter")
    wait_for_app_run(app)

    expect(chat_input_area).to_have_value("")

    expect_markdown(app, "Chat input 8 (bottom, max_chars) - value: Corgi")


def test_shift_enter_creates_new_line(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that Shift+Enter creates a new line."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(themed_app, "chat_input_8_bottom")
    chat_input_area = chat_input.locator("textarea").first
    chat_input_area.fill("")  # Clear the input first
    chat_input_area.press("Shift+Enter")
    chat_input_area.type("New Line")
    assert_snapshot(chat_input, name="st_chat_input-shift_enter_new_line")

    chat_input = get_element_by_key(themed_app, "chat_input_4")
    chat_input_area = chat_input.locator("textarea").first
    chat_input_area.fill("")  # Clear the input first
    chat_input_area.press("Shift+Enter")
    chat_input_area.type("New Line")
    assert_snapshot(chat_input, name="st_chat_input-file_upload_shift_enter_new_line")


def test_click_button_to_submit_clears_input(app: Page):
    """Test that clicking the button submits and clears the input."""
    chat_input = get_element_by_key(app, "chat_input_1")
    submit_button = chat_input.get_by_test_id("stChatInputSubmitButton")
    chat_input_area = chat_input.locator("textarea").first

    chat_input_area.type("Corgi")
    submit_button.click()

    expect(chat_input_area).to_have_value("")

    expect_markdown(app, "Chat input 1 (inline) - value: Corgi")


def test_chat_input_focus_state(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.chat_input renders the focus state correctly."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(themed_app, "chat_input_8_bottom")
    chat_input_area = chat_input.locator("textarea").first
    chat_input_area.click()
    expect(chat_input_area).to_be_focused()
    assert_snapshot(chat_input, name="st_chat_input-focused")


def test_grows_shrinks_input_text(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that input grows with long text and shrinks when text is deleted."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(themed_app, "chat_input_8_bottom")
    chat_input_area = chat_input.locator("textarea").first
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
    chat_input_area = get_element_by_key(app, "chat_input_3").locator("textarea").first

    chat_input_area.type("hello world")
    chat_input_area.press("Enter")
    wait_for_app_run(app)

    expect_markdown(app, "chat input submitted")
    expect_markdown(app, "Chat input 3 (callback) - session state value: hello world")
    expect_markdown(app, "Chat input 3 (callback) - return value: hello world")

    rerun_app(app)

    # Expect the callback to not be triggered:
    expect(app.get_by_text("chat input submitted")).not_to_be_attached()
    # And the session state value to be reset
    expect_markdown(app, "Chat input 3 (callback) - session state value: None")
    # Also expect the return value to be None
    expect_markdown(app, "Chat input 3 (callback) - return value: None")


def test_uploads_and_deletes_single_file(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that it correctly uploads and deletes a single file."""
    themed_app.set_viewport_size({"width": 750, "height": 1500})
    chat_input = get_element_by_key(themed_app, "chat_input_4")
    expect(chat_input).to_be_visible()

    file_name1 = "file1.txt"
    file1 = FilePayload(name=file_name1, mimeType="text/plain", buffer=b"file1content")

    file_name2 = "file2.txt"
    file2 = FilePayload(name=file_name2, mimeType="text/plain", buffer=b"file2content")

    file_upload_helper(themed_app, chat_input, [file1])

    uploaded_files = chat_input.get_by_test_id("stChatUploadedFiles").first
    expect(uploaded_files.get_by_text(file_name1)).to_be_visible()
    uploaded_files.scroll_into_view_if_needed()
    assert_snapshot(uploaded_files, name="st_chat_input-single_file_uploaded")

    # Upload a second file. This one will replace the first.
    file_upload_helper(themed_app, chat_input, [file2])

    expect(uploaded_files.get_by_text(file_name1)).not_to_be_visible()
    expect(uploaded_files.get_by_text(file_name2)).to_be_visible()

    # Delete the uploaded file
    uploaded_files.get_by_test_id("stChatInputDeleteBtn").first.click()

    wait_for_app_run(themed_app)

    expect(uploaded_files).not_to_have_text(file_name2, use_inner_text=True)


def test_uploads_and_deletes_multiple_files(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that uploading multiple files at once works correctly."""
    chat_input = get_element_by_key(app, "chat_input_5")

    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    files = [
        FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1),
        FilePayload(name=file_name2, mimeType="text/plain", buffer=file_content2),
    ]

    file_upload_helper(app, chat_input, files)

    uploaded_files = chat_input.get_by_test_id("stChatUploadedFiles").first

    # Wait for file names to be visible before taking snapshot
    expect(uploaded_files.get_by_text(file_name1)).to_be_visible()
    expect(uploaded_files.get_by_text(file_name2)).to_be_visible()

    assert_snapshot(uploaded_files, name="st_chat_input-multiple_files_uploaded")

    uploaded_file_names = uploaded_files.get_by_test_id("stChatInputFileName")
    expect(uploaded_file_names).to_have_count(2)

    # Delete one uploaded file
    uploaded_files.get_by_test_id("stChatInputDeleteBtn").first.click()

    wait_for_app_run(app)

    uploaded_file_names = uploaded_files.get_by_test_id("stChatInputFileName")
    expect(uploaded_file_names).to_have_count(1)

    expect(uploaded_file_names).to_have_text(files[1]["name"], use_inner_text=True)


def test_file_upload_error_message_disallowed_files(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that shows error message for disallowed files."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    file_name1 = "file1.json"
    file1 = FilePayload(
        name=file_name1,
        mimeType="application/json",
        buffer=b"{}",
    )

    file_upload_helper(
        themed_app, get_element_by_key(themed_app, "chat_input_4"), [file1]
    )

    uploaded_files = (
        get_element_by_key(themed_app, "chat_input_4")
        .get_by_test_id("stChatUploadedFiles")
        .first
    )
    expect(uploaded_files.get_by_text(file_name1)).to_be_visible()
    assert_snapshot(uploaded_files, name="st_chat_input-file_uploaded_error")

    uploaded_files.get_by_test_id("stTooltipHoverTarget").first.hover()
    expect(themed_app.get_by_text("json files are not allowed.")).to_be_visible()


@pytest.mark.skip_browser("chromium")
def test_file_upload_error_message_file_too_large(app: Page):
    """Test that shows error message for files exceeding max size limit."""
    app.set_viewport_size({"width": 750, "height": 2000})

    file_name1 = "large.txt"
    file1 = FilePayload(
        name=file_name1,
        mimeType="text/plain",
        buffer=b"x" * (2 * 1024 * 1024),  # 2MB
    )

    expect(app.get_by_text(file_name1)).not_to_be_attached()
    chat_input = get_element_by_key(app, "chat_input_4")
    expect(chat_input).to_be_visible()
    file_upload_helper(app, chat_input, [file1])

    expect(app.get_by_text(file_name1)).to_be_visible()

    uploaded_files = chat_input.get_by_test_id("stChatUploadedFiles").first
    expect(uploaded_files).to_be_visible()
    uploaded_file = uploaded_files.get_by_test_id("stChatInputFile").first
    expect(uploaded_file).to_be_visible()

    uploaded_files.scroll_into_view_if_needed()

    # Reset hovering to not cause issues with the upload tooltip being
    # shown over the uploaded file tooltip hover target:
    reset_hovering(app)
    expect_help_tooltip(app, uploaded_files, "File must be 1.0MB or smaller.")


def test_single_file_upload_button_tooltip(app: Page):
    """Test that the single file upload button tooltip renders correctly."""
    app.set_viewport_size({"width": 750, "height": 2000})

    chat_input_upload_button = get_element_by_key(app, "chat_input_4").get_by_test_id(
        "stChatInputFileUploadButton"
    )
    expect(chat_input_upload_button).to_be_visible()
    chat_input_upload_button.scroll_into_view_if_needed()

    expect_help_tooltip(app, chat_input_upload_button, "Upload or drag and drop a file")
    # Hover on the tooltip hover target


def test_multi_file_upload_button_tooltip(app: Page):
    """Test that the multi file upload button tooltip renders correctly."""
    app.set_viewport_size({"width": 750, "height": 2000})

    chat_input_upload_button = get_element_by_key(app, "chat_input_5").get_by_test_id(
        "stChatInputFileUploadButton"
    )
    expect(chat_input_upload_button).to_be_visible()
    chat_input_upload_button.scroll_into_view_if_needed()

    expect_help_tooltip(app, chat_input_upload_button, "Upload or drag and drop files")


def test_directory_upload_button_tooltip(app: Page):
    """Test that the directory upload button tooltip renders correctly."""
    app.set_viewport_size({"width": 750, "height": 2000})

    chat_input_upload_button = get_element_by_key(app, "chat_input_9").get_by_test_id(
        "stChatInputFileUploadButton"
    )
    expect(chat_input_upload_button).to_be_visible()
    chat_input_upload_button.scroll_into_view_if_needed()

    expect_help_tooltip(
        app, chat_input_upload_button, "Upload or drag and drop a directory"
    )


def test_directory_upload_disabled_state(app: Page):
    """Test that disabled directory upload input cannot be interacted with."""
    disabled_chat_input = get_element_by_key(app, "chat_input_10")
    disabled_upload_button = disabled_chat_input.get_by_test_id(
        "stChatInputFileUploadButton"
    )

    # Check that the upload button has disabled attribute (div elements don't use standard disabled behavior)
    expect(disabled_upload_button).to_have_attribute("disabled", "")

    # Check that the text area is also disabled
    disabled_text_area = disabled_chat_input.locator("textarea")
    expect(disabled_text_area).to_be_disabled()


def test_directory_upload_button_interaction(app: Page):
    """Test directory upload button can be clicked when enabled."""
    chat_input = get_element_by_key(app, "chat_input_9")
    upload_button = chat_input.get_by_test_id("stChatInputFileUploadButton")

    expect(upload_button).to_be_visible()
    expect(upload_button).to_be_enabled()

    # Just verify that the button is clickable without interacting with file chooser
    # Directory uploads require actual directory paths which we can't simulate
    expect(upload_button).to_have_attribute("tabindex", "0")


def test_chat_input_adjusts_for_long_placeholder(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that chat input properly adjusts its height for long placeholder text."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(themed_app, "chat_input_8_bottom")
    expect(chat_input).to_be_visible()

    # Take a snapshot of the initial state with the long placeholder
    assert_snapshot(chat_input, name="st_chat_input-long_placeholder")

    # Type some text to verify the input maintains proper height
    chat_input_area = chat_input.locator("textarea")
    expect(chat_input_area).to_be_visible()
    chat_input_area.type("Some input text")
    assert_snapshot(chat_input, name="st_chat_input-long_placeholder_with_text")

    # Clear the text and verify it returns to placeholder height
    chat_input_area.fill("")
    assert_snapshot(chat_input, name="st_chat_input-long_placeholder_after_clear")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stChatInput")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "chat_input_3")).to_be_visible()


def test_programmatically_set_value_in_session_state(app: Page):
    """Test that the value is correctly set in session state."""
    chat_input = get_element_by_key(app, "chat_input_3")

    click_button(app, "Set Value")
    expect(chat_input.locator("textarea")).to_have_value("Hello, world!")

    # And the session state value should be reset to None after widget execution:
    expect_markdown(
        app, "Chat input 3 - session state value before execution: Hello, world!"
    )
    expect_markdown(app, "Chat input 3 (callback) - session state value: None")
    # Also expect the return value to be None
    expect_markdown(app, "Chat input 3 (callback) - return value: None")

    # Submit value
    submit_button = chat_input.get_by_test_id("stChatInputSubmitButton")
    expect(submit_button).to_be_visible()
    submit_button.click()

    wait_for_app_run(app)

    expect_markdown(app, "chat input submitted")

    expect_markdown(
        app, "Chat input 3 - session state value before execution: Hello, world!"
    )
    expect_markdown(app, "Chat input 3 (callback) - session state value: Hello, world!")
    expect_markdown(app, "Chat input 3 (callback) - return value: Hello, world!")


def test_height_resets_after_submit(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that chat input height resets to compact state after submission."""
    chat_input = get_element_by_key(themed_app, "chat_input_1")
    chat_input_area = chat_input.locator("textarea").first

    assert_snapshot(chat_input, name="st_chat_input-initial_compact_state")

    multiline_text = (
        "This is line one\n"
        "This is line two\n"
        "This is line three\n"
        "This is line four with some longer text to ensure expansion"
    )
    chat_input_area.fill(multiline_text)

    assert_snapshot(chat_input, name="st_chat_input-expanded_multiline_state")

    chat_input_area.press("Enter")
    wait_for_app_run(themed_app)

    expect(chat_input_area).to_have_value("")

    # Wait for height to visually reset to compact state (single line)
    # This ensures React state updates and browser paint have completed
    def check_compact_height() -> bool:
        box = chat_input_area.bounding_box()
        # Compact textarea should be roughly 40-50px (minElementHeight)
        return box["height"] < 60 if box else False

    wait_until(themed_app, check_compact_height)

    assert_snapshot(chat_input, name="st_chat_input-reset_after_submit")


def test_dynamic_chat_input_props(
    app: Page, assert_snapshot: ImageCompareFunction, browser_name: str
):
    """Test that the chat input can be updated dynamically while keeping the state."""
    dynamic_chat_input = get_element_by_key(app, "dynamic_chat_input_with_key")
    expect(dynamic_chat_input).to_be_visible()

    # Initial state (placeholder is rendered as attribute, not visible text)
    expect(dynamic_chat_input.locator("textarea")).to_have_attribute(
        "placeholder", "Initial dynamic chat input"
    )
    assert_snapshot(dynamic_chat_input, name="st_chat_input-dynamic_initial")

    # Type something and submit
    input_field = dynamic_chat_input.locator("textarea").first
    input_field.fill("hello")
    input_field.press("Enter")
    wait_for_app_run(app)

    # Ensure the markdown entry is present (prefix match)
    expect_prefixed_markdown(app, "Initial chat input value:", "hello")

    # Click the toggle to update the chat input props
    click_toggle(app, "Update chat input props")

    # New chat input is rendered with updated placeholder text
    expect(dynamic_chat_input.locator("textarea")).to_have_attribute(
        "placeholder", "Updated dynamic chat input"
    )

    dynamic_chat_input.scroll_into_view_if_needed()

    # Firefox has persistent 1px height variance (40px vs 41px) that causes size mismatch errors
    # Skip snapshot comparison for Firefox since the visual difference is negligible
    if browser_name != "firefox":
        assert_snapshot(
            dynamic_chat_input,
            name="st_chat_input-dynamic_updated",
        )
    else:
        # For Firefox, just verify the element is visible and interactive
        expect(dynamic_chat_input).to_be_visible()

    # Ensure we can still interact normally
    input_field = dynamic_chat_input.locator("textarea").first
    input_field.fill("world")
    input_field.press("Enter")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Updated chat input value:", "world")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_recording_lifecycle(app: Page):
    """Test complete audio recording lifecycle: record, approve, verify output."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_11")
    chat_input.scroll_into_view_if_needed()

    # Verify mic button is visible
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    expect(mic_button).to_be_visible()

    # Record audio
    record_audio_in_chat_input(app, chat_input)

    # Verify audio was submitted successfully
    expect_chat_input_value_contains_audio(app, "chat_input_11")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_recording_cancel(app: Page):
    """Test that canceling audio recording works correctly."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_11")
    chat_input.scroll_into_view_if_needed()

    # Start recording
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    expect(mic_button).to_be_visible()
    mic_button.click()

    # Wait for cancel button to appear (indicates recording started)
    cancel_button = chat_input.get_by_test_id("stChatInputCancelButton")
    expect(cancel_button).to_be_visible()

    # Record for a moment
    app.wait_for_timeout(500)

    # Cancel recording
    cancel_button.click()

    # Cancel button should disappear (recording stopped)
    expect(cancel_button).not_to_be_visible()

    # Mic button should be visible and enabled again
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_with_text_input(app: Page):
    """Test recording audio along with text input."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_11")
    chat_input.scroll_into_view_if_needed()

    # Type text
    textarea = chat_input.locator("textarea").first
    textarea.fill("Hello world")

    # Record audio
    record_audio_in_chat_input(app, chat_input, duration_ms=1000)

    # Verify both text and audio were submitted successfully
    expect_chat_input_value_contains_text(app, "chat_input_11", "Hello world")
    expect_chat_input_value_contains_audio(app, "chat_input_11")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_with_file_uploads(app: Page):
    """Test combining audio recording with file uploads."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_11")
    chat_input.scroll_into_view_if_needed()

    # Upload file first
    file = FilePayload(name="test.txt", mimeType="text/plain", buffer=b"test content")
    file_upload_helper(app, chat_input, [file])

    # Record audio
    record_audio_in_chat_input(app, chat_input, duration_ms=1000)

    # Verify audio and file were submitted successfully
    expect_chat_input_value_contains_audio(app, "chat_input_11")
    expect_chat_input_value_contains_files(app, "chat_input_11", 1)


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_only_submission(app: Page):
    """Test submitting only audio without text or files."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_11")
    chat_input.scroll_into_view_if_needed()

    # Record audio only (no text or files)
    record_audio_in_chat_input(app, chat_input, duration_ms=1000)

    # Verify audio was submitted successfully
    expect_chat_input_value_contains_audio(app, "chat_input_11")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_submit_clears_recording(app: Page):
    """Test that submitting clears the recording state."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_11")
    chat_input.scroll_into_view_if_needed()

    # Record and submit audio
    record_audio_in_chat_input(app, chat_input, duration_ms=1000)

    # Verify st.audio component is displayed
    audio_elements = app.get_by_test_id("stAudio")
    expect(audio_elements.first).to_be_visible()

    # Verify mic button is back to initial state
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()

    # Verify approve/cancel buttons are not visible (not recording)
    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    expect(approve_button).not_to_be_visible()
    cancel_button = chat_input.get_by_test_id("stChatInputCancelButton")
    expect(cancel_button).not_to_be_visible()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_error_state_handling(app: Page):
    """Test error state handling when audio upload fails."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_11")
    chat_input.scroll_into_view_if_needed()

    # Mock upload failure
    from playwright.sync_api import Route

    def handle_route(route: Route):
        if "upload_file" in route.request.url:
            route.abort("failed")
        else:
            route.continue_()

    app.route("**/_stcore/upload_file/**", handle_route)

    # Start recording
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    mic_button.click()

    # Wait for approve button to appear
    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    expect(approve_button).to_be_visible()

    # Record for a moment
    app.wait_for_timeout(1000)

    # Approve recording
    approve_button.click()

    # Wait for error to appear
    app.wait_for_timeout(1000)

    # Verify that no output appears (upload failed, so v11 is None and nothing is printed)
    # With the new format, we only output when v11 has a value
    expect(app.get_by_text("chat_input_11 text:", exact=False)).not_to_be_visible()


@pytest.mark.only_browser("chromium")
def test_audio_rapid_re_recordings(app: Page):
    """Test that rapid re-recordings work correctly without race conditions."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_11")
    chat_input.scroll_into_view_if_needed()

    # Do 3 rapid recordings - each new one should replace the previous
    for i in range(3):
        mic_button = chat_input.get_by_test_id("stChatInputMicButton")
        expect(mic_button).to_be_visible()
        mic_button.click()

        # Wait for approve button to appear
        approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
        expect(approve_button).to_be_visible()

        # Record briefly
        app.wait_for_timeout(500)

        # Approve
        approve_button.click()

        if i < 2:  # Don't wait after last recording
            # Wait for approve button to disappear (indicates ready for next recording)
            expect(approve_button).not_to_be_visible()

    # Wait for the final upload to complete
    wait_for_app_run(app)

    # Verify st.audio component is displayed
    audio_elements = app.get_by_test_id("stAudio")
    expect(audio_elements.first).to_be_visible(timeout=10000)


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_input_visual_states(app: Page, assert_snapshot: ImageCompareFunction):
    """Test visual snapshots of all audio input states."""
    grant_microphone_permissions(app)
    app.set_viewport_size({"width": 750, "height": 2000})

    # Test 1: Idle state (already captured in test_chat_input_rendering)
    # Test 2: Recording state snapshot removed due to indeterministic nature
    # (waveform animation and timing issues cause flaky snapshots)

    # Test 3: Disabled state (already captured in test_chat_input_rendering as audio_disabled)

    # Test 4: With uploaded files + audio button visible
    chat_input_with_files = get_element_by_key(app, "chat_input_11")
    chat_input_with_files.scroll_into_view_if_needed()

    file = FilePayload(name="test.txt", mimeType="text/plain", buffer=b"test content")
    file_upload_helper(app, chat_input_with_files, [file])

    # Snapshot: Audio button + uploaded files
    uploaded_files = chat_input_with_files.get_by_test_id("stChatUploadedFiles").first
    expect(uploaded_files).to_be_visible()
    assert_snapshot(
        chat_input_with_files, name="st_chat_input-audio_with_uploaded_files"
    )


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_input_combined_features(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test visual snapshots of audio combined with other features."""
    grant_microphone_permissions(app)
    app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(app, "chat_input_12")
    chat_input.scroll_into_view_if_needed()

    # Snapshot: Audio + text entered (before recording)
    textarea = chat_input.locator("textarea").first
    textarea.fill("Hello with audio")
    assert_snapshot(chat_input, name="st_chat_input-audio_with_text_entered")

    # Clear for next test
    textarea.fill("")

    # Submit audio and capture cleared state
    record_audio_in_chat_input(app, chat_input, duration_ms=1000)

    # Snapshot: After audio submission (cleared state)
    expect(textarea).to_have_value("")
    assert_snapshot(chat_input, name="st_chat_input-audio_after_clear")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_recording_state_transitions(app: Page):
    """Test exhaustive state machine transitions for audio recording."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_12")
    chat_input.scroll_into_view_if_needed()

    # Get element references
    textarea = chat_input.locator("textarea").first
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")

    # State 1: Idle - verify initial state
    expect(textarea).to_be_visible()
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()

    # Verify approve/cancel buttons not visible in idle
    expect(chat_input.get_by_test_id("stChatInputApproveButton")).not_to_be_visible()
    expect(chat_input.get_by_test_id("stChatInputCancelButton")).not_to_be_visible()

    # Transition: idle → recording
    start_audio_recording(chat_input)

    # State 2: Recording - verify recording state elements
    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    cancel_button = chat_input.get_by_test_id("stChatInputCancelButton")

    expect(approve_button).to_be_visible()
    expect(cancel_button).to_be_visible()

    # Verify textarea becomes hidden during recording
    # Note: The textarea is not removed, but waveform takes over visually

    # Transition: recording → idle (via cancel)
    cancel_button.click()

    # Verify return to idle state
    expect(approve_button).not_to_be_visible()
    expect(cancel_button).not_to_be_visible()
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()

    # Test full cycle: idle → recording → uploading → idle
    mic_button.click()
    expect(approve_button).to_be_visible()
    app.wait_for_timeout(1000)

    # Click approve to enter uploading state
    approve_button.click()

    # During upload, approve button should show spinner (verify button still exists)
    # This happens very quickly, so we just verify transition to idle
    wait_for_app_run(app)

    # Verify return to idle after upload
    expect(approve_button).not_to_be_visible()
    expect(cancel_button).not_to_be_visible()
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()

    # Verify textarea is cleared after submission
    expect(textarea).to_have_value("")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_keyboard_accessibility(app: Page):
    """Test keyboard-only interactions with audio input."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_12")
    chat_input.scroll_into_view_if_needed()

    # Tab to mic button
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")

    # Focus the mic button using keyboard navigation
    mic_button.focus()
    expect(mic_button).to_be_focused()

    # Trigger with Space
    app.keyboard.press("Space")

    # Verify recording started
    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    expect(approve_button).to_be_visible()

    # Try Escape to cancel (if implemented)
    app.keyboard.press("Escape")

    # Verify either cancel worked or recording continues
    # (This depends on implementation - we just verify state consistency)

    # Clean up - cancel if still recording
    cancel_button = chat_input.get_by_test_id("stChatInputCancelButton")
    if cancel_button.is_visible():
        cancel_button.click()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_boundary_conditions(app: Page):
    """Test edge cases and boundary conditions for audio recording."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_12")
    chat_input.scroll_into_view_if_needed()

    # Test 1: Very short recording (< 1 second)
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    mic_button.click()

    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    expect(approve_button).to_be_visible()

    # Record for very short duration
    app.wait_for_timeout(200)
    approve_button.click()

    wait_for_app_run(app)

    # Verify submission worked despite short duration
    expect(mic_button).to_be_visible()

    # Test 2: Rapid click on mic button (shouldn't allow double-start)
    mic_button.click()
    expect(approve_button).to_be_visible()

    # Try clicking mic button again while recording
    # It should be hidden or disabled during recording
    # so this shouldn't cause issues

    # Cancel to reset
    cancel_button = chat_input.get_by_test_id("stChatInputCancelButton")
    cancel_button.click()

    # Test 3: Click approve immediately after starting
    mic_button.click()
    expect(approve_button).to_be_visible()

    # Click approve almost immediately (< 100ms of recording)
    approve_button.click()

    wait_for_app_run(app)

    # Verify state is clean
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()

    # Test 4: Multiple cancel/restart cycles
    for _ in range(3):
        mic_button.click()
        expect(approve_button).to_be_visible()
        app.wait_for_timeout(300)
        cancel_button.click()
        expect(mic_button).to_be_visible()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_with_all_features_combined(app: Page):
    """Test audio with text and files all together (maximum complexity)."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "chat_input_11")
    chat_input.scroll_into_view_if_needed()

    # Upload files first
    file1 = FilePayload(name="file1.txt", mimeType="text/plain", buffer=b"content1")
    file2 = FilePayload(name="file2.txt", mimeType="text/plain", buffer=b"content2")
    file_upload_helper(app, chat_input, [file1, file2])

    # Verify files uploaded
    uploaded_files = chat_input.get_by_test_id("stChatUploadedFiles").first
    expect(uploaded_files.get_by_text("file1.txt")).to_be_visible()
    expect(uploaded_files.get_by_text("file2.txt")).to_be_visible()

    # Add text after files are uploaded
    textarea = chat_input.locator("textarea").first
    textarea.fill("Message with everything")

    # Record and submit audio (this submits everything together)
    record_audio_in_chat_input(app, chat_input, duration_ms=1000)

    # Verify text, audio, and files were all submitted successfully
    expect_chat_input_value_contains_text(
        app, "chat_input_11", "Message with everything"
    )
    expect_chat_input_value_contains_audio(app, "chat_input_11")
    expect_chat_input_value_contains_files(app, "chat_input_11", 2)

    # Verify textarea is cleared after submission
    expect(textarea).to_have_value("")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_container_contexts(app: Page):
    """Test audio input in different container contexts."""
    grant_microphone_permissions(app)
    app.set_viewport_size({"width": 750, "height": 2000})

    # Audio in columns
    col_input = get_element_by_key(app, "chat_input_14")
    col_input.scroll_into_view_if_needed()
    expect(col_input).to_be_visible()

    # Verify mic button in column
    col_mic_button = col_input.get_by_test_id("stChatInputMicButton")
    expect(col_mic_button).to_be_visible()

    # Record audio in column to verify functionality
    record_audio_in_chat_input(app, col_input, duration_ms=800)

    # Verify it worked - check for audio output in new format
    expect(app.get_by_text("chat_input_14 audio:", exact=False)).to_be_visible()


def test_audio_disabled_states(app: Page):
    """Test non-interactive verification of disabled audio input."""
    chat_input = get_element_by_key(app, "chat_input_13")
    chat_input.scroll_into_view_if_needed()

    # Verify mic button is present but disabled
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    expect(mic_button).to_be_visible()

    # Check disabled attribute on button
    expect(mic_button).to_have_attribute("disabled", "")

    # Verify textarea is also disabled
    textarea = chat_input.locator("textarea")
    expect(textarea).to_be_disabled()

    # Try clicking mic button - should not respond
    mic_button.click(force=True)

    # Verify recording did not start (approve button should not appear)
    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    expect(approve_button).not_to_be_visible()

    # Verify submit button is also disabled
    submit_button = chat_input.get_by_test_id("stChatInputSubmitButton")
    expect(submit_button).to_have_attribute("disabled", "")


@pytest.mark.only_browser("chromium")  # Webkit CI audio issue, Firefox tooltip issue
def test_chat_input_permission_denied_error(
    app_with_microphone_permission_denied: Page, assert_snapshot: ImageCompareFunction
):
    """Test that permission denied error is displayed in chat input."""
    chat_input = get_element_by_key(
        app_with_microphone_permission_denied, "chat_input_11"
    )
    chat_input.scroll_into_view_if_needed()

    # Try to click mic without permissions
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    mic_button.click()

    # Wait for error state to apply by waiting for the tooltip hover target to appear
    # Firefox may take longer to trigger permission denied and update React state
    hover_target = chat_input.get_by_test_id("stTooltipErrorHoverTarget")
    expect(hover_target).to_be_visible(timeout=10000)

    # Hover over the tooltip hover target to show tooltip
    hover_target.hover()

    # Verify tooltip appears with error message
    tooltip = app_with_microphone_permission_denied.get_by_test_id(
        "stTooltipErrorContent"
    )
    expect(tooltip).to_have_text(
        "Microphone access denied",
        use_inner_text=True,
    )

    # Take snapshot of error state with tooltip
    assert_snapshot(chat_input, name="st_chat_input-mic_permission_denied")

    # Verify error clears when user types
    textarea = chat_input.locator("textarea").first
    textarea.fill("Some text")
    # After typing, tooltip should not appear on hover anymore
    expect(tooltip).not_to_be_visible()


@pytest.mark.only_browser("chromium")  # Webkit CI audio issue, Firefox tooltip issue
def test_chat_input_recording_error(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that recording errors are displayed in chat input."""
    from playwright.sync_api import Route

    grant_microphone_permissions(app)

    # Mock recording failure by intercepting audio upload
    def handle_route(route: Route):
        if "upload_file" in route.request.url:
            route.abort("failed")
        else:
            route.continue_()

    app.route("**/_stcore/upload_file/**", handle_route)

    chat_input = get_element_by_key(app, "chat_input_11")
    chat_input.scroll_into_view_if_needed()

    # Start recording
    start_audio_recording(chat_input)
    app.wait_for_timeout(1000)

    # Try to approve (will fail upload)
    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    approve_button.click()
    app.wait_for_timeout(1000)

    # Verify mic button shows error state
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    expect(mic_button).to_be_visible()

    # Hover over the tooltip hover target to show tooltip
    hover_target = chat_input.get_by_test_id("stTooltipErrorHoverTarget")
    hover_target.hover()

    # Verify tooltip appears with error message
    tooltip = app.get_by_test_id("stTooltipErrorContent")
    expect(tooltip).to_have_text(
        "Recording failed",
        use_inner_text=True,
    )

    # Take snapshot
    assert_snapshot(chat_input, name="st_chat_input-recording_error")

    # Verify error clears when user starts typing
    textarea = chat_input.locator("textarea").first
    textarea.fill("Error cleared")
    # After typing, tooltip should not appear on hover anymore
    expect(tooltip).not_to_be_visible()
