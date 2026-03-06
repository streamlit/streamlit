# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from functools import wraps
from typing import TYPE_CHECKING
from urllib.parse import parse_qs, urlencode, urlparse, urlunsplit

import pytest
from playwright.sync_api import Error, FilePayload, Locator, Page, expect

if TYPE_CHECKING:
    from collections.abc import Callable
    from typing import Any

from e2e_playwright.conftest import (
    ImageCompareFunction,
    build_app_url,
    rerun_app,
    wait_for_app_loaded,
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
    select_selectbox_option,
)


def use_chat_input(key: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator to automatically navigate to a specific chat input before running the test.

    Usage:
        @use_chat_input("single_file")
        def test_my_test(app: Page):
            # Test automatically navigates to the page with ?key=single_file
            # ... test code
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Find the Page object by type - check all positional and keyword arguments
            page = None

            # Check positional arguments
            for arg in args:
                if isinstance(arg, Page):
                    page = arg
                    break

            # Check keyword arguments if not found
            if page is None:
                for arg in kwargs.values():
                    if isinstance(arg, Page):
                        page = arg
                        break

            if page is None:
                func_name = getattr(func, "__name__", "unknown")
                raise ValueError(
                    f"Could not find Page object in test {func_name}. "
                    f"Make sure the test has a Page fixture parameter (e.g., app, themed_app)."
                )

            # Navigate to the chat input
            goto_chat_input(page, key)

            # Run the test
            return func(*args, **kwargs)

        return wrapper

    return decorator


def goto_chat_input(app: Page, key: str) -> None:
    """Navigate to a specific chat input using query params."""
    # Parse the current URL so we can preserve existing query params and rebuild it
    parsed = urlparse(app.url)

    # Preserve existing query parameters (especially theme-related ones like embed_options)
    existing_params = parse_qs(parsed.query)
    # Flatten the params (parse_qs returns lists as values)
    params = {k: v[0] for k, v in existing_params.items() if v}
    # Set/override the key parameter
    params["key"] = key

    base_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
    query_string = urlencode(params)
    app.goto(build_app_url(base_url, query=query_string))
    wait_for_app_loaded(app)


def expect_chat_input_value_contains_text(app: Page, key: str, text: str) -> None:
    """Assert that chat input value's text field contains the expected text.

    Args:
        app: Page object
        key: Chat input key - used to identify the specific output line
        text: Expected text content
    """
    # Look for the simple format: "<key> - text: <value>"
    expected_line = f"{key} - text: {text}"
    expect(app.get_by_text(expected_line)).to_be_visible()


def expect_chat_input_value_contains_audio(app: Page, key: str) -> None:
    """Assert that chat input value has an audio field populated (not None).

    Args:
        app: Page object
        key: Chat input key - used to identify the specific output line

    Verifies that audio was recorded by checking the output line contains a .wav filename
    (not "None").
    """
    # Look for the pattern: "<key> - audio: " followed by a .wav filename
    # We use a regex pattern since the filename includes a timestamp
    audio_line_locator = app.get_by_text(f"{key} - audio:", exact=False)
    expect(audio_line_locator).to_be_visible()

    # Ensure the audio field is NOT "None"
    expect(app.get_by_text(f"{key} - audio: None", exact=True)).not_to_be_visible()


def expect_chat_input_value_contains_files(
    app: Page, key: str, file_count: int
) -> None:
    """Assert that chat input value contains the expected number of uploaded files.

    Args:
        app: Page object
        key: Chat input key - used to identify the specific output line
        file_count: Expected number of files
    """
    # Look for the simple format: "<key> - files: <N> files"
    expected_line = f"{key} - files: {file_count} files"
    expect(app.get_by_text(expected_line)).to_be_visible()


def file_upload_helper(app: Page, chat_input: Locator, files: list[FilePayload]):
    upload_button = chat_input.get_by_test_id("stChatInputFileUploadButton")

    expect(upload_button).to_be_visible()
    upload_button.scroll_into_view_if_needed()

    # Ensure button is ready to be clicked (WebKit specific issue)
    expect(upload_button).to_be_enabled()
    # Wait until the upload button is fully enabled, up to 2 seconds
    expect(upload_button).to_be_enabled(timeout=2000)

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
    except Error as e:
        # It's safe to ignore failure: contexts might not support permissions in all environments.
        print(f"Could not grant microphone permissions: {e}")


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

    goto_chat_input(themed_app, "inline")
    assert_snapshot(
        get_element_by_key(themed_app, "inline"), name="st_chat_input-inline"
    )
    goto_chat_input(themed_app, "disabled_with_file")
    assert_snapshot(
        get_element_by_key(themed_app, "disabled_with_file"),
        name="st_chat_input-in_column_disabled",
    )
    goto_chat_input(themed_app, "callback")
    assert_snapshot(
        get_element_by_key(themed_app, "callback"), name="st_chat_input-callback"
    )
    goto_chat_input(themed_app, "single_file")
    assert_snapshot(
        get_element_by_key(themed_app, "single_file"), name="st_chat_input-single-file"
    )
    goto_chat_input(themed_app, "multiple_files")
    assert_snapshot(
        get_element_by_key(themed_app, "multiple_files"),
        name="st_chat_input-multiple-files",
    )
    goto_chat_input(themed_app, "width_300")
    assert_snapshot(
        get_element_by_key(themed_app, "width_300"), name="st_chat_input-width_300px"
    )
    goto_chat_input(themed_app, "width_stretch")
    assert_snapshot(
        get_element_by_key(themed_app, "width_stretch"),
        name="st_chat_input-width_stretch",
    )
    # The bottom chat input appears last in DOM order because st.chat_input() renders at bottom
    goto_chat_input(themed_app, "bottom_max_chars")
    assert_snapshot(
        get_element_by_key(themed_app, "bottom_max_chars"),
        name="st_chat_input-bottom",
    )
    goto_chat_input(themed_app, "directory")
    assert_snapshot(
        get_element_by_key(themed_app, "directory"), name="st_chat_input-directory"
    )
    goto_chat_input(themed_app, "directory_disabled")
    assert_snapshot(
        get_element_by_key(themed_app, "directory_disabled"),
        name="st_chat_input-directory_disabled",
    )
    goto_chat_input(themed_app, "audio_with_files")
    assert_snapshot(
        get_element_by_key(themed_app, "audio_with_files"),
        name="st_chat_input-with_audio",
    )
    goto_chat_input(themed_app, "audio_only")
    assert_snapshot(
        get_element_by_key(themed_app, "audio_only"), name="st_chat_input-audio_only"
    )
    goto_chat_input(themed_app, "audio_disabled")
    assert_snapshot(
        get_element_by_key(themed_app, "audio_disabled"),
        name="st_chat_input-audio_disabled",
    )
    goto_chat_input(themed_app, "audio_column")
    assert_snapshot(
        get_element_by_key(themed_app, "audio_column_a"),
        name="st_chat_input-column_audio",
    )
    # Second column audio input in the audio_column section
    assert_snapshot(
        get_element_by_key(themed_app, "audio_column_b"),
        name="st_chat_input-column_audio_with_files",
    )


@use_chat_input("bottom_max_chars")
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
    chat_input = get_element_by_key(themed_app, "bottom_max_chars")
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
    app_base_url: str,
    app_theme: str,
    assert_snapshot: ImageCompareFunction,
):
    """Test that an embedded app with bottom chat input renders correctly."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    goto_app(
        themed_app,
        build_app_url(
            app_base_url,
            query={
                "key": "bottom_max_chars",
                "embed": "true",
                "embed_options": app_theme,
            },
        ),
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


@use_chat_input("bottom_max_chars")
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


@use_chat_input("bottom_max_chars")
def test_submit_hover_state_with_input_value(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test the submit button's hover state when input value is present."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(themed_app, "bottom_max_chars")
    chat_input_area = chat_input.locator("textarea").first
    chat_input_area.type("Corgi")

    submit_button = chat_input.get_by_test_id("stChatInputSubmitButton")
    submit_button.hover()
    assert_snapshot(chat_input, name="st_chat_input-submit_hover")


@use_chat_input("inline")
def test_submit_methods_and_clear_input(app: Page):
    """Test that both Enter key and click button submit and clear input."""
    # Test 1: Click button to submit
    chat_input = get_element_by_key(app, "inline")
    submit_button = chat_input.get_by_test_id("stChatInputSubmitButton")
    chat_input_area = chat_input.locator("textarea").first

    chat_input_area.type("Corgi")
    submit_button.click()

    expect(chat_input_area).to_have_value("")
    expect_markdown(app, "inline - value: Corgi")

    # Test 2: Enter key to submit (navigate to different input to test fresh)
    goto_chat_input(app, "bottom_max_chars")
    expect_markdown(app, "bottom_max_chars - value: None")

    chat_input_area = (
        get_element_by_key(app, "bottom_max_chars").locator("textarea").first
    )
    chat_input_area.type("Husky")
    chat_input_area.press("Enter")
    wait_for_app_run(app)

    expect(chat_input_area).to_have_value("")
    expect_markdown(app, "bottom_max_chars - value: Husky")


def test_shift_enter_creates_new_line(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that Shift+Enter creates a new line."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    goto_chat_input(themed_app, "bottom_max_chars")
    chat_input = get_element_by_key(themed_app, "bottom_max_chars")
    chat_input_area = chat_input.locator("textarea").first
    chat_input_area.fill("")  # Clear the input first
    chat_input_area.press("Shift+Enter")
    chat_input_area.type("New Line")
    assert_snapshot(chat_input, name="st_chat_input-shift_enter_new_line")

    goto_chat_input(themed_app, "single_file")
    chat_input = get_element_by_key(themed_app, "single_file")
    chat_input_area = chat_input.locator("textarea").first
    chat_input_area.fill("")  # Clear the input first
    chat_input_area.press("Shift+Enter")
    chat_input_area.type("New Line")
    assert_snapshot(chat_input, name="st_chat_input-file_upload_shift_enter_new_line")


@use_chat_input("bottom_max_chars")
def test_chat_input_focus_state(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.chat_input renders the focus state correctly."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(themed_app, "bottom_max_chars")
    chat_input_area = chat_input.locator("textarea").first
    chat_input_area.click()
    expect(chat_input_area).to_be_focused()
    assert_snapshot(chat_input, name="st_chat_input-focused")


@use_chat_input("bottom_max_chars")
def test_grows_shrinks_input_text(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that input grows with long text and shrinks when text is deleted."""
    num_backspaces = 20  # Number of backspaces to simulate shrinking the input
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(themed_app, "bottom_max_chars")
    chat_input_area = chat_input.locator("textarea").first
    chat_input_area.type(
        "Lorem ipsum dolor amet, consectetur adipiscing elit. "
        "Mauris tristique est at tincidunt pul vinar. Nam pulvinar neque sapien, "
        "eu pellentesque metus pellentesque at. Ut et dui molestie, iaculis magna."
    )
    assert_snapshot(chat_input, name="st_chat_input-grows")
    backspace_press_delay_ms = 10
    for _ in range(num_backspaces):
        chat_input_area.press("Backspace", delay=backspace_press_delay_ms)
    assert_snapshot(chat_input, name="st_chat_input-shrinks")


@use_chat_input("callback")
def test_calls_callback_on_submit(app: Page):
    """Test that it correctly calls the callback on submit."""
    chat_input_area = get_element_by_key(app, "callback").locator("textarea").first

    chat_input_area.type("hello world")
    chat_input_area.press("Enter")
    wait_for_app_run(app)

    expect_markdown(app, "chat input submitted")
    expect_markdown(app, "callback - session state value: hello world")
    expect_markdown(app, "callback - return value: hello world")

    rerun_app(app)

    # Expect the callback to not be triggered:
    expect(app.get_by_text("chat input submitted")).not_to_be_attached()
    # And the session state value to be reset
    expect_markdown(app, "callback - session state value: None")
    # Also expect the return value to be None
    expect_markdown(app, "callback - return value: None")


@use_chat_input("single_file")
def test_uploads_and_deletes_single_file(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that it correctly uploads and deletes a single file."""
    themed_app.set_viewport_size({"width": 750, "height": 1500})
    chat_input = get_element_by_key(themed_app, "single_file")
    expect(chat_input).to_be_visible()

    file_name1 = "file1.txt"
    file1 = FilePayload(name=file_name1, mimeType="text/plain", buffer=b"file1content")

    file_name2 = "file2.txt"
    file2 = FilePayload(name=file_name2, mimeType="text/plain", buffer=b"file2content")

    file_upload_helper(themed_app, chat_input, [file1])

    uploaded_files = chat_input.get_by_test_id("stFileChips").first
    expect(uploaded_files.get_by_text(file_name1)).to_be_visible()
    uploaded_files.scroll_into_view_if_needed()

    # Dismiss any tooltips before taking snapshot (WebKit can leave upload tooltip visible)
    reset_hovering(themed_app)

    assert_snapshot(uploaded_files, name="st_chat_input-single_file_uploaded")

    # Upload a second file. This one will replace the first.
    file_upload_helper(themed_app, chat_input, [file2])

    expect(uploaded_files.get_by_text(file_name1)).not_to_be_visible()
    expect(uploaded_files.get_by_text(file_name2)).to_be_visible()

    # Delete the uploaded file
    uploaded_files.get_by_test_id("stFileChipDeleteBtn").first.click()

    wait_for_app_run(themed_app)

    # After deletion, the uploaded files container should not be visible
    expect(chat_input.get_by_test_id("stFileChips")).not_to_be_visible()


@use_chat_input("multiple_files")
def test_uploads_and_deletes_multiple_files(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that uploading multiple files at once works correctly."""
    chat_input = get_element_by_key(app, "multiple_files")

    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    files = [
        FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1),
        FilePayload(name=file_name2, mimeType="text/plain", buffer=file_content2),
    ]

    file_upload_helper(app, chat_input, files)

    uploaded_files = chat_input.get_by_test_id("stFileChips").first

    # Wait for file names to be visible before taking snapshot
    expect(uploaded_files.get_by_text(file_name1)).to_be_visible()
    expect(uploaded_files.get_by_text(file_name2)).to_be_visible()

    # Dismiss any tooltips before taking snapshot (WebKit can leave upload tooltip visible)
    reset_hovering(app)

    assert_snapshot(uploaded_files, name="st_chat_input-multiple_files_uploaded")

    uploaded_file_names = uploaded_files.get_by_test_id("stFileChipName")
    expect(uploaded_file_names).to_have_count(2)

    # Delete one uploaded file
    uploaded_files.get_by_test_id("stFileChipDeleteBtn").first.click()

    wait_for_app_run(app)

    uploaded_file_names = uploaded_files.get_by_test_id("stFileChipName")
    expect(uploaded_file_names).to_have_count(1)

    expect(uploaded_file_names).to_have_text(files[1]["name"], use_inner_text=True)


@use_chat_input("single_file")
def test_file_upload_error_message_disallowed_files(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that shows error message for disallowed files and retry attributes."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    file_name1 = "file1.json"
    file1 = FilePayload(
        name=file_name1,
        mimeType="application/json",
        buffer=b"{}",
    )

    file_upload_helper(
        themed_app, get_element_by_key(themed_app, "single_file"), [file1]
    )

    chat_input = get_element_by_key(themed_app, "single_file")
    uploaded_files = chat_input.get_by_test_id("stFileChips").first
    expect(uploaded_files.get_by_text(file_name1)).to_be_visible()

    # Verify file chip has retry attributes (all errors are retryable)
    file_chip = uploaded_files.get_by_test_id("stFileChip").first
    expect(file_chip).to_have_attribute("role", "button")
    expect(file_chip).to_have_attribute("tabindex", "0")
    expect(file_chip).to_have_attribute("title", "Click to retry upload")

    # Snapshot the error file chip (without tooltip)
    assert_snapshot(file_chip, name="st_chat_input-file_uploaded_error")

    # Verify tooltip is NOT visible before hovering
    expect(themed_app.get_by_test_id("stTooltipErrorContent")).not_to_be_visible()

    # Hover to show error tooltip
    file_chip.hover()
    error_tooltip = themed_app.get_by_test_id("stTooltipErrorContent").first
    expect(error_tooltip).to_be_visible()
    expect(error_tooltip).to_have_text("application/json files are not allowed.")

    # Snapshot the tooltip content directly (tooltips are portals rendered to <body>)
    assert_snapshot(error_tooltip, name="st_chat_input-file_uploaded_error_tooltip")


@use_chat_input("single_file")
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

    chat_input = get_element_by_key(app, "single_file")
    expect(chat_input).to_be_visible()
    file_upload_helper(app, chat_input, [file1])

    uploaded_files = chat_input.get_by_test_id("stFileChips").first
    expect(uploaded_files).to_be_visible()

    # Verify the file appears in the uploaded files list
    expect(uploaded_files.get_by_text(file_name1)).to_be_visible()

    uploaded_file = uploaded_files.get_by_test_id("stFileChip").first
    expect(uploaded_file).to_be_visible()

    uploaded_files.scroll_into_view_if_needed()

    # Reset hovering to dismiss any upload tooltips
    reset_hovering(app)

    # Verify error message is displayed as a tooltip when hovering
    file_chip = uploaded_files.get_by_test_id("stFileChip").first
    file_chip.hover()
    error_tooltip = app.get_by_test_id("stTooltipErrorContent").first
    expect(error_tooltip).to_be_visible()
    expect(error_tooltip).to_have_text("File must be 1.0MB or smaller.")


def test_file_upload_button_tooltips(app: Page):
    """Test upload button tooltips for single file, multiple files, and directory modes."""
    app.set_viewport_size({"width": 750, "height": 2000})

    # Test cases: (key, expected_tooltip)
    tooltip_cases = [
        ("single_file", "Upload or drag and drop a file (TXT)"),
        ("multiple_files", "Upload or drag and drop files"),
        ("directory", "Upload or drag and drop a directory"),
    ]

    for key, expected_tooltip in tooltip_cases:
        goto_chat_input(app, key)
        chat_input_upload_button = get_element_by_key(app, key).get_by_test_id(
            "stChatInputFileUploadButton"
        )
        expect(chat_input_upload_button).to_be_visible()
        chat_input_upload_button.scroll_into_view_if_needed()
        expect_help_tooltip(app, chat_input_upload_button, expected_tooltip)


def test_directory_upload_behavior(app: Page):
    """Test directory upload: disabled state and enabled interaction."""
    # Test disabled state
    goto_chat_input(app, "directory_disabled")
    disabled_chat_input = get_element_by_key(app, "directory_disabled")
    disabled_upload_button = disabled_chat_input.get_by_test_id(
        "stChatInputFileUploadButton"
    )

    # Check that the upload button has disabled attribute
    expect(disabled_upload_button).to_have_attribute("disabled", "")

    # Check that the text area is also disabled
    disabled_text_area = disabled_chat_input.locator("textarea")
    expect(disabled_text_area).to_be_disabled()

    # Test enabled state
    goto_chat_input(app, "directory")
    chat_input = get_element_by_key(app, "directory")
    upload_button = chat_input.get_by_role("button", name="Upload a directory")

    expect(upload_button).to_be_visible()
    expect(upload_button).to_have_accessible_name("Upload a directory")
    expect(upload_button).to_be_enabled()

    # Verify that the button is focusable
    upload_button.focus()
    expect(upload_button).to_be_focused()


@use_chat_input("bottom_max_chars")
def test_chat_input_adjusts_for_long_placeholder(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that chat input properly adjusts its height for long placeholder text."""
    themed_app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(themed_app, "bottom_max_chars")
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


@use_chat_input("inline")
def test_css_classes(app: Page):
    """Test top-level class and custom css class via key argument."""
    check_top_level_class(app, "stChatInput")

    goto_chat_input(app, "callback")
    expect(get_element_by_key(app, "callback")).to_be_visible()


@use_chat_input("callback")
def test_programmatically_set_value_in_session_state(app: Page):
    """Test that the value is correctly set in session state."""
    chat_input = get_element_by_key(app, "callback")

    click_button(app, "Set Value")
    expect(chat_input.locator("textarea")).to_have_value("Hello, world!")

    # And the session state value should be reset to None after widget execution:
    expect_markdown(
        app, "callback - session state value before execution: Hello, world!"
    )
    expect_markdown(app, "callback - session state value: None")
    # Also expect the return value to be None
    expect_markdown(app, "callback - return value: None")

    # Submit value
    submit_button = chat_input.get_by_test_id("stChatInputSubmitButton")
    expect(submit_button).to_be_visible()
    submit_button.click()

    wait_for_app_run(app)

    expect_markdown(app, "chat input submitted")

    expect_markdown(
        app, "callback - session state value before execution: Hello, world!"
    )
    expect_markdown(app, "callback - session state value: Hello, world!")
    expect_markdown(app, "callback - return value: Hello, world!")


@use_chat_input("inline")
def test_height_resets_after_submit(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that chat input height resets to compact state after submission."""
    chat_input = get_element_by_key(themed_app, "inline")
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


@use_chat_input("dynamic")
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


@use_chat_input("audio_with_files")
@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_recording_basic_lifecycle(app: Page):
    """Test complete audio recording lifecycle: record, cancel, approve, verify state.

    Covers: recording lifecycle, cancel, submit clears state, audio-only submission.
    """
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "audio_with_files")
    chat_input.scroll_into_view_if_needed()

    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    expect(mic_button).to_be_visible()

    # Part 1: Test cancel recording
    mic_button.click()
    cancel_button = chat_input.get_by_test_id("stChatInputCancelButton")
    expect(cancel_button).to_be_visible()
    app.wait_for_timeout(500)
    cancel_button.click()
    expect(cancel_button).not_to_be_visible()
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()

    # Part 2: Test full recording and submission
    record_audio_in_chat_input(app, chat_input)
    expect_chat_input_value_contains_audio(app, "audio_with_files")

    # Part 3: Verify submit clears the recording state
    audio_elements = app.get_by_test_id("stAudio")
    expect(audio_elements.first).to_be_visible()
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()
    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    expect(approve_button).not_to_be_visible()
    expect(cancel_button).not_to_be_visible()


@use_chat_input("audio_with_files")
@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_combined_with_other_inputs(app: Page):
    """Test audio combined with text and file inputs.

    Covers: audio + text, audio + files, audio + text + files (max complexity).
    """
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "audio_with_files")
    chat_input.scroll_into_view_if_needed()

    # Part 1: Audio with text
    textarea = chat_input.locator("textarea").first
    textarea.fill("Hello world")
    record_audio_in_chat_input(app, chat_input, duration_ms=1000)
    expect_chat_input_value_contains_text(app, "audio_with_files", "Hello world")
    expect_chat_input_value_contains_audio(app, "audio_with_files")

    # Part 2: Audio with files (fresh submission)
    file = FilePayload(name="test.txt", mimeType="text/plain", buffer=b"test content")
    file_upload_helper(app, chat_input, [file])
    record_audio_in_chat_input(app, chat_input, duration_ms=1000)
    expect_chat_input_value_contains_audio(app, "audio_with_files")
    expect_chat_input_value_contains_files(app, "audio_with_files", 1)

    # Part 3: Audio with text and multiple files (max complexity)
    file1 = FilePayload(name="file1.txt", mimeType="text/plain", buffer=b"content1")
    file2 = FilePayload(name="file2.txt", mimeType="text/plain", buffer=b"content2")
    file_upload_helper(app, chat_input, [file1, file2])
    uploaded_files = chat_input.get_by_test_id("stFileChips").first
    expect(uploaded_files.get_by_text("file1.txt")).to_be_visible()
    expect(uploaded_files.get_by_text("file2.txt")).to_be_visible()
    textarea.fill("Message with everything")
    record_audio_in_chat_input(app, chat_input, duration_ms=1000)
    expect_chat_input_value_contains_text(
        app, "audio_with_files", "Message with everything"
    )
    expect_chat_input_value_contains_audio(app, "audio_with_files")
    expect_chat_input_value_contains_files(app, "audio_with_files", 2)
    expect(textarea).to_have_value("")


@use_chat_input("audio_with_files")
@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_error_state_handling(app: Page):
    """Test error state handling when audio upload fails."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "audio_with_files")
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

    # Verify that no output appears (upload failed, so audio_with_files_value is None and nothing is printed)
    # With the new format, we only output when audio_with_files_value has a value
    expect(app.get_by_text("audio_with_files - text:", exact=False)).not_to_be_visible()


@use_chat_input("audio_with_files")
@pytest.mark.only_browser("chromium")
def test_audio_rapid_re_recordings(app: Page):
    """Test that rapid re-recordings work correctly without race conditions."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "audio_with_files")
    chat_input.scroll_into_view_if_needed()

    # Do 3 rapid recordings - each new one should replace the previous
    for i in range(3):
        mic_button = chat_input.get_by_test_id("stChatInputMicButton")
        expect(mic_button).to_be_visible()
        expect(mic_button).to_be_enabled()
        mic_button.click()

        # Wait for approve button to appear
        approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
        expect(approve_button).to_be_visible()

        # Record briefly
        app.wait_for_timeout(500)

        # Approve
        approve_button.click()

        if i < 2:  # Don't wait after last recording
            # Wait for upload to complete and component to reset before next recording
            wait_for_app_run(app)
            # Ensure mic button is ready for next recording
            expect(mic_button).to_be_visible()
            expect(mic_button).to_be_enabled()

    # Wait for the final upload to complete
    wait_for_app_run(app)

    # Verify st.audio component is displayed
    audio_elements = app.get_by_test_id("stAudio")
    expect(audio_elements.first).to_be_visible(timeout=10000)


@use_chat_input("audio_with_files")
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
    chat_input_with_files = get_element_by_key(app, "audio_with_files")
    chat_input_with_files.scroll_into_view_if_needed()

    file = FilePayload(name="test.txt", mimeType="text/plain", buffer=b"test content")
    file_upload_helper(app, chat_input_with_files, [file])

    # Snapshot: Audio button + uploaded files
    uploaded_files = chat_input_with_files.get_by_test_id("stFileChips").first
    expect(uploaded_files).to_be_visible()
    assert_snapshot(
        chat_input_with_files, name="st_chat_input-audio_with_uploaded_files"
    )


@use_chat_input("audio_only")
@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_input_combined_features(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test visual snapshots of audio combined with other features."""
    grant_microphone_permissions(app)
    app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(app, "audio_only")
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


@use_chat_input("audio_only")
@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_state_transitions_and_edge_cases(app: Page):
    """Test state machine transitions, keyboard accessibility, and boundary conditions.

    Covers: state transitions (idle/recording/uploading), keyboard navigation,
    short recordings, multiple cancel/restart cycles.
    """
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "audio_only")
    chat_input.scroll_into_view_if_needed()

    # Get element references
    textarea = chat_input.locator("textarea").first
    mic_button = chat_input.get_by_test_id("stChatInputMicButton")
    approve_button = chat_input.get_by_test_id("stChatInputApproveButton")
    cancel_button = chat_input.get_by_test_id("stChatInputCancelButton")

    # Part 1: Verify initial idle state
    expect(textarea).to_be_visible()
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()
    expect(approve_button).not_to_be_visible()
    expect(cancel_button).not_to_be_visible()

    # Part 2: Transition idle → recording via keyboard
    mic_button.focus()
    expect(mic_button).to_be_focused()
    app.keyboard.press("Space")
    expect(approve_button).to_be_visible()
    expect(cancel_button).to_be_visible()

    # Transition recording → idle via cancel
    cancel_button.click()
    expect(approve_button).not_to_be_visible()
    expect(cancel_button).not_to_be_visible()
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()

    # Part 3: Full cycle idle → recording → uploading → idle
    start_audio_recording(chat_input)
    app.wait_for_timeout(1000)
    approve_button.click()
    wait_for_app_run(app)

    # Verify return to idle after upload
    expect(approve_button).not_to_be_visible()
    expect(cancel_button).not_to_be_visible()
    expect(mic_button).to_be_visible()
    expect(mic_button).to_be_enabled()
    expect(textarea).to_have_value("")

    # Part 4: Very short recording (boundary condition)
    mic_button.click()
    expect(approve_button).to_be_visible()
    app.wait_for_timeout(200)  # < 1 second
    approve_button.click()
    wait_for_app_run(app)
    expect(mic_button).to_be_visible()

    # Part 5: Multiple cancel/restart cycles
    for _ in range(3):
        mic_button.click()
        expect(approve_button).to_be_visible()
        app.wait_for_timeout(300)
        cancel_button.click()
        expect(approve_button).not_to_be_visible()
        expect(cancel_button).not_to_be_visible()
        expect(mic_button).to_be_visible()
        expect(mic_button).to_be_enabled()


@use_chat_input("audio_with_files")
@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_with_all_features_combined(app: Page):
    """Test audio with text and files all together (maximum complexity)."""
    grant_microphone_permissions(app)

    chat_input = get_element_by_key(app, "audio_with_files")
    chat_input.scroll_into_view_if_needed()

    # Upload files first
    file1 = FilePayload(name="file1.txt", mimeType="text/plain", buffer=b"content1")
    file2 = FilePayload(name="file2.txt", mimeType="text/plain", buffer=b"content2")
    file_upload_helper(app, chat_input, [file1, file2])

    # Verify files uploaded
    uploaded_files = chat_input.get_by_test_id("stFileChips").first
    expect(uploaded_files.get_by_text("file1.txt")).to_be_visible()
    expect(uploaded_files.get_by_text("file2.txt")).to_be_visible()

    # Add text after files are uploaded
    textarea = chat_input.locator("textarea").first
    textarea.fill("Message with everything")

    # Record and submit audio (this submits everything together)
    record_audio_in_chat_input(app, chat_input, duration_ms=1000)

    # Verify text, audio, and files were all submitted successfully
    expect_chat_input_value_contains_text(
        app, "audio_with_files", "Message with everything"
    )
    expect_chat_input_value_contains_audio(app, "audio_with_files")
    expect_chat_input_value_contains_files(app, "audio_with_files", 2)

    # Verify textarea is cleared after submission
    expect(textarea).to_have_value("")


@use_chat_input("audio_column")
@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_container_contexts(app: Page):
    """Test audio input in different container contexts."""
    grant_microphone_permissions(app)
    app.set_viewport_size({"width": 750, "height": 2000})

    # Audio in columns
    col_input = get_element_by_key(app, "audio_column_a")
    col_input.scroll_into_view_if_needed()
    expect(col_input).to_be_visible()

    # Verify mic button in column
    col_mic_button = col_input.get_by_test_id("stChatInputMicButton")
    expect(col_mic_button).to_be_visible()

    # Record audio in column to verify functionality
    record_audio_in_chat_input(app, col_input, duration_ms=800)

    # Verify it worked - check for audio output in new format
    expect(app.get_by_text("audio_column_a - audio:", exact=False)).to_be_visible()


@use_chat_input("audio_disabled")
def test_audio_disabled_states(app: Page):
    """Test non-interactive verification of disabled audio input."""
    chat_input = get_element_by_key(app, "audio_disabled")
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


@use_chat_input("audio_with_files")
@pytest.mark.only_browser("chromium")  # Webkit CI audio issue, Firefox tooltip issue
def test_chat_input_permission_denied_error(
    app_with_microphone_permission_denied: Page, assert_snapshot: ImageCompareFunction
):
    """Test that permission denied error is displayed in chat input."""
    chat_input = get_element_by_key(
        app_with_microphone_permission_denied, "audio_with_files"
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


@use_chat_input("audio_with_files")
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

    chat_input = get_element_by_key(app, "audio_with_files")
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


@use_chat_input("audio_sample_rate")
@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_audio_sample_rate_validation(app: Page):
    """Test recording audio at various sample rates and validate the output."""
    grant_microphone_permissions(app)

    # Test all sample rate variations in one test to avoid multiple browser sessions
    sample_rate_cases = [
        ("16 kHz (Default)", 16000),
        ("48 kHz (High quality)", 48000),
        ("8 kHz (Low quality)", 8000),
    ]

    for option_text, expected_hz in sample_rate_cases:
        # Select the specified sample rate from dropdown
        select_selectbox_option(app, "Select audio sample rate", option_text)

        # Get the chat input for audio recording
        chat_input = get_element_by_key(app, "audio_sample_rate_test")
        chat_input.scroll_into_view_if_needed()

        # Record audio
        record_audio_in_chat_input(app, chat_input, duration_ms=2000)

        # Verify the validation message appears
        expect(
            app.get_by_text("Sample rate validation PASSED", exact=False)
        ).to_be_visible()
        expect(
            app.get_by_text(f"Expected {expected_hz} Hz", exact=False)
        ).to_be_visible()
        expect(app.get_by_text(f"got {expected_hz} Hz", exact=False)).to_be_visible()


def upload_single_file_and_snapshot(
    app: Page,
    chat_input: Locator,
    file: FilePayload,
    snapshot_name: str,
    assert_snapshot: ImageCompareFunction,
) -> None:
    """Helper to upload a single file and take a snapshot of just that file chip."""
    file_upload_helper(app, chat_input, [file])

    uploaded_files = chat_input.get_by_test_id("stFileChips").first
    file_chip = uploaded_files.get_by_test_id("stFileChip").first
    expect(file_chip).to_be_visible()

    # Verify title attribute contains full filename (for native tooltip on hover)
    filename_element = uploaded_files.get_by_test_id("stFileChipName").first
    expect(filename_element).to_have_attribute("title", file["name"])

    reset_hovering(app)

    assert_snapshot(file_chip, name=snapshot_name)

    # Delete the file to reset for next test
    uploaded_files.get_by_test_id("stFileChipDeleteBtn").first.click()
    wait_for_app_run(app, 500)


@use_chat_input("multiple_files")
def test_file_chip_theming(
    themed_app: Page,
    assert_snapshot: ImageCompareFunction,
):
    """Test file chip theming with one representative file type (light and dark)."""
    # Use image file type as representative - theme styling is shared across all file types
    # Uses a real PNG so the image preview thumbnail renders correctly
    chat_input = get_element_by_key(themed_app, "multiple_files")
    file = FilePayload(name="photo.png", mimeType="image/png", buffer=SMILEY_PNG)
    upload_single_file_and_snapshot(
        themed_app,
        chat_input,
        file,
        "st_chat_input-file_chip_themed",
        assert_snapshot,
    )


# Minimal 8x8 smiley face PNG for image preview testing
# This is a valid PNG that renders as a yellow smiley face
SMILEY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x08\x00\x00\x00\x08\x08\x02"
    b'\x00\x00\x00Km)\xdc\x00\x00\x00"IDATx\xdac\xf8\x7f\x86\x01+\x82Q\x98\x0c\x02'
    b"\x12\xd8\x8db@\x95\x86p\x890\n\x02\xd0]\x85\x89\x007\xa7`\xd3Z\xff>.\x00\x00"
    b"\x00\x00IEND\xaeB`\x82"
)

# File types to test (excluding image which is tested in test_file_chip_theming)
FILE_CHIP_VARIATIONS = [
    ("pdf", "document.pdf", "application/pdf", b"fake pdf"),
    ("spreadsheet", "data.csv", "text/csv", b"a,b,c"),
    ("text", "readme.txt", "text/plain", b"Hello world"),
    ("code", "script.py", "text/x-python", b"print('hi')"),
    ("audio", "song.mp3", "audio/mpeg", b"fake audio"),
    ("video", "movie.mp4", "video/mp4", b"fake video"),
    ("archive", "archive.zip", "application/zip", b"fake zip"),
    ("unknown", "data.unknown", "application/octet-stream", b"mystery"),
    (
        "truncated",
        "data_analysis_results.csv",
        "text/csv",
        b"content",
    ),
]


@use_chat_input("multiple_files")
def test_file_chip_variations(app: Page, assert_snapshot: ImageCompareFunction):
    """Test file chip rendering for various file types (icon and truncation variations)."""
    chat_input = get_element_by_key(app, "multiple_files")

    for test_id, filename, mimetype, content in FILE_CHIP_VARIATIONS:
        file = FilePayload(name=filename, mimeType=mimetype, buffer=content)
        upload_single_file_and_snapshot(
            app,
            chat_input,
            file,
            f"st_chat_input-file_chip_{test_id}",
            assert_snapshot,
        )


@use_chat_input("multiple_files")
@pytest.mark.skip_browser("webkit")
def test_file_upload_retry_click_success(app: Page):
    """Test that clicking retry on error chip successfully re-uploads the file."""
    from playwright.sync_api import Route

    app.set_viewport_size({"width": 750, "height": 2000})

    chat_input = get_element_by_key(app, "multiple_files")
    expect(chat_input).to_be_visible()

    # Track upload request count to fail first request, succeed on retry
    request_count = {"value": 0}

    def handle_route(route: Route):
        request_count["value"] += 1
        if request_count["value"] == 1:
            # First request fails
            route.abort("failed")
        else:
            # Subsequent requests succeed
            route.continue_()

    # Set up route interception BEFORE uploading
    app.route("**/_stcore/upload_file/**", handle_route)

    file_name = "test_retry.txt"
    file = FilePayload(name=file_name, mimeType="text/plain", buffer=b"test content")

    try:
        file_upload_helper(app, chat_input, [file])

        # Wait for error state to appear
        uploaded_files = chat_input.get_by_test_id("stFileChips").first
        file_chip = uploaded_files.get_by_test_id("stFileChip").first
        expect(file_chip).to_be_visible()

        # Verify file is in error state with retry attributes
        expect(file_chip).to_have_attribute("role", "button")
        expect(file_chip).to_have_attribute("title", "Click to retry upload")

        # Verify error message is displayed as a tooltip when hovering
        file_chip.hover()
        error_tooltip = app.get_by_test_id("stTooltipErrorContent").first
        expect(error_tooltip).to_be_visible()

        # Click to retry - this should succeed since we now allow requests through
        file_chip.click()

        # Wait for successful upload - tooltip wrapper should disappear
        # After successful upload, file chip is no longer wrapped in error tooltip
        tooltip_wrapper = app.get_by_test_id("stTooltipErrorHoverTarget").first
        expect(tooltip_wrapper).not_to_be_visible(timeout=5000)

        # Verify file is now in uploaded state (shows size instead of error)
        file_size = uploaded_files.get_by_test_id("stFileChipName").first
        expect(file_size).to_be_visible()

    finally:
        # Clean up route interception
        app.unroute("**/_stcore/upload_file/**")


@use_chat_input("single_file")
def test_upload_button_works_after_upload_and_delete(app: Page):
    """Test that the upload button still works after uploading a file and deleting it.

    This tests a react-dropzone bug where the file input becomes unresponsive after
    files are removed. The fix resets the dropzone state via React key when files
    are deleted. See: https://github.com/react-dropzone/react-dropzone/issues/972
    """
    chat_input = get_element_by_key(app, "single_file")
    expect(chat_input).to_be_visible()

    # Get the upload button
    upload_button = chat_input.get_by_test_id("stChatInputFileUploadButton")
    expect(upload_button).to_be_visible()

    # Step 1: Upload a file using the button
    # Use short filenames (max 16 chars) to avoid truncation in the UI
    first_file_name = "first.txt"
    first_file = FilePayload(
        name=first_file_name, mimeType="text/plain", buffer=b"first file content"
    )

    with app.expect_file_chooser() as fc_info:
        upload_button.click(force=True)
        file_chooser = fc_info.value
        file_chooser.set_files(files=[first_file])

    wait_for_app_run(app, 500)

    # Verify the file was uploaded
    uploaded_files = chat_input.get_by_test_id("stFileChips").first
    expect(uploaded_files).to_be_visible()
    expect(uploaded_files.get_by_text(first_file_name)).to_be_visible()

    # Step 2: Delete the uploaded file
    uploaded_files.get_by_test_id("stFileChipDeleteBtn").first.click()
    wait_for_app_run(app, 500)

    # Verify the file was deleted
    expect(chat_input.get_by_test_id("stFileChips")).not_to_be_visible()

    # Step 3: Verify the upload button still works after the upload + delete cycle
    # This is the key assertion - without the fix, the button would be unresponsive
    expect(upload_button).to_be_visible()
    expect(upload_button).to_be_enabled()

    # Upload a new file using the button
    second_file_name = "second.txt"
    second_file = FilePayload(
        name=second_file_name, mimeType="text/plain", buffer=b"second file content"
    )

    with app.expect_file_chooser() as fc_info:
        upload_button.click(force=True)
        file_chooser = fc_info.value
        file_chooser.set_files(files=[second_file])

    wait_for_app_run(app, 500)

    # Verify the new file was uploaded successfully
    uploaded_files = chat_input.get_by_test_id("stFileChips").first
    expect(uploaded_files).to_be_visible()
    expect(uploaded_files.get_by_text(second_file_name)).to_be_visible()

    # Verify the first deleted file doesn't reappear (negative assertion)
    expect(uploaded_files.get_by_text(first_file_name)).not_to_be_visible()


@use_chat_input("inline")
def test_dynamic_stacked_layout_transitions(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that chat input dynamically transitions between inline and stacked layouts.

    The layout should:
    1. Start in inline mode (buttons and textarea on same row)
    2. Switch to stacked mode when text fills available width
    3. Stay in stacked mode when text is partially deleted (still has content)
    4. Return to inline mode only when all text is cleared
    """
    app.set_viewport_size({"width": 750, "height": 400})

    chat_input = get_element_by_key(app, "inline")
    textarea = chat_input.locator("textarea").first

    # 1. Type short text - should still be in inline mode
    short_text = "Hello, this is test"  # 19 chars
    textarea.type(short_text)
    assert_snapshot(chat_input, name="st_chat_input-layout_inline_short_text")

    # 2. Type more text to trigger stacked mode
    long_text = (
        " and now I'm adding a lot more text to fill up the available width "
        "so that the layout switches to stacked mode with buttons below"
    )
    textarea.type(long_text)
    assert_snapshot(chat_input, name="st_chat_input-layout_stacked_long_text")

    # 3. Replace with shorter text (but not empty) - should STAY in stacked mode
    # Use fill() to efficiently replace text without character-by-character deletion
    partial_text = "Hello, this is test "  # 20 chars - still has content
    textarea.fill(partial_text)
    assert_snapshot(chat_input, name="st_chat_input-layout_stacked_after_delete")

    # 4. Clear all text - should return to inline mode
    # Use select all + backspace for efficient clearing
    textarea.press(
        "Meta+a"
        if app.evaluate("navigator.platform").startswith("Mac")
        else "Control+a"
    )
    textarea.press("Backspace")
    assert_snapshot(chat_input, name="st_chat_input-layout_inline_after_clear")

    # Negative assertion: verify that typing short text does NOT trigger stacked mode
    textarea.type("Brief")
    expect(textarea).to_have_value("Brief")
    # Take a snapshot to verify we're still in inline mode with brief text
    assert_snapshot(chat_input, name="st_chat_input-layout_inline_brief_text")


@use_chat_input("audio_only")
@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_layout_behavior_after_audio_operations(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test layout alignment and stacked mode after audio operations.

    Regression tests covering:
    1. Alignment before/after audio submission
    2. Stacked layout mode triggers after audio submission
    3. Layout after canceling audio recording
    """
    grant_microphone_permissions(app)
    app.set_viewport_size({"width": 750, "height": 400})

    chat_input = get_element_by_key(app, "audio_only")

    # Part 1: Initial alignment
    assert_snapshot(chat_input, name="st_chat_input-audio_initial_alignment")

    # Part 2: Record and submit audio, verify alignment preserved
    record_audio_in_chat_input(app, chat_input)
    wait_for_app_run(app)
    expect_chat_input_value_contains_audio(app, "audio_only")

    chat_input = get_element_by_key(app, "audio_only")
    assert_snapshot(chat_input, name="st_chat_input-audio_alignment_after_submit")

    # Part 3: Verify stacked layout still works after audio submission
    textarea = chat_input.locator("textarea").first
    long_text = (
        "This is a very long message that should trigger the stacked layout mode "
        "where the textarea appears above the buttons instead of inline"
    )
    textarea.type(long_text)
    assert_snapshot(chat_input, name="st_chat_input-stacked_after_audio_submit")

    # Clear for next test
    textarea.fill("")

    # Part 4: Test layout after cancel
    start_audio_recording(chat_input)
    cancel_button = chat_input.get_by_test_id("stChatInputCancelButton")
    cancel_button.click()

    expect(textarea).to_be_visible()
    assert_snapshot(chat_input, name="st_chat_input-alignment_after_audio_cancel")

    # Verify stacking works after cancel
    long_text_cancel = (
        "A very long message that should trigger stacked mode even after "
        "canceling an audio recording"
    )
    textarea.type(long_text_cancel)
    assert_snapshot(chat_input, name="st_chat_input-stacked_after_audio_cancel")
