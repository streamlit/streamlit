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

import os
import re
import tempfile
import wave

import pytest
from playwright.sync_api import Locator, Page, Route, expect

from e2e_playwright.conftest import IframedPage, ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_form_button,
    get_element_by_key,
)

# Audio input indices in test app
MAIN = 0
FORM = 1
FRAGMENT = 2
DISABLED = 3
HIDDEN_LABEL = 4
CALLBACK = 5
REMOUNT = 6
DEFAULT_RATE = 7
HIGH_QUALITY_48K = 8
BROWSER_DEFAULT = 9
WIDTH_STRETCH = 10
WIDTH_FIXED = 11


def grant_microphone_permissions(page: Page) -> None:
    """Grant microphone permissions where supported."""
    try:
        page.context.grant_permissions(["microphone"])
    except Exception:
        pass


def get_audio_input(app: Page, index: int) -> Locator:
    """Get audio input by index."""
    return app.get_by_test_id("stAudioInput").nth(index)


def record_and_stop(app: Page, index: int, duration_ms: int = 1500) -> None:
    """Record audio for duration and stop."""
    audio_input = get_audio_input(app, index)
    # Use exact matching to avoid ambiguity with other buttons
    audio_input.get_by_role("button", name="Record", exact=True).click()
    app.wait_for_timeout(duration_ms)
    audio_input.get_by_role("button", name="Stop recording", exact=True).click()


def verify_recording_exists(app: Page, index: int) -> None:
    """Verify audio input has a recording and is in correct state."""
    audio_input = get_audio_input(app, index)

    # Waveform should be visible
    waveform = audio_input.get_by_test_id("stAudioInputWaveSurfer")
    expect(waveform).to_be_visible()

    # Audio element should exist and have a source
    audio_element = audio_input.locator("audio")
    expect(audio_element).to_have_count(1)
    expect(audio_element).to_have_attribute("src", re.compile(r"blob:"))

    # Record button should be visible (allows re-recording)
    record_button = audio_input.get_by_role("button", name="Record", exact=True)
    expect(record_button).to_be_visible()
    expect(record_button).to_be_enabled()

    # Stop button should NOT be visible (not recording)
    stop_button = audio_input.get_by_role("button", name="Stop recording")
    expect(stop_button).not_to_be_visible()

    # Download button should be visible
    download_button = audio_input.get_by_role("button", name="Download as WAV")
    expect(download_button).to_be_visible()
    expect(download_button).to_be_enabled()

    # Clear button should be visible on hover
    audio_input.hover()
    clear_button = audio_input.get_by_role("button", name="Clear recording")
    expect(clear_button).to_be_visible()
    expect(clear_button).to_be_enabled()

    # Verify waveform has actual content (canvas elements present)
    canvas = waveform.locator("canvas")
    expect(canvas.first).to_be_visible()


def verify_no_recording(app: Page, index: int) -> None:
    """Verify audio input has no recording and is in initial state."""
    audio_input = get_audio_input(app, index)

    # Waveform should NOT be visible
    waveform = audio_input.get_by_test_id("stAudioInputWaveSurfer")
    expect(waveform).not_to_be_visible()

    # Record button should be visible and enabled
    record_button = audio_input.get_by_role("button", name="Record", exact=True)
    expect(record_button).to_be_visible()
    expect(record_button).to_be_enabled()

    # Stop button should NOT be visible
    stop_button = audio_input.get_by_role("button", name="Stop recording")
    expect(stop_button).not_to_be_visible()

    # Download button should NOT be visible (nothing to download)
    download_button = audio_input.get_by_role("button", name="Download as WAV")
    expect(download_button).not_to_be_visible()

    # Clear button should NOT be visible (nothing to clear)
    audio_input.hover()
    clear_button = audio_input.get_by_role("button", name="Clear recording")
    expect(clear_button).not_to_be_visible()

    # Audio element should NOT be visible
    audio_element = audio_input.locator("audio")
    expect(audio_element).not_to_be_visible()


def verify_recording_in_progress(
    app: Page, index: int, has_previous_recording: bool = False
) -> None:
    """Verify audio input is actively recording.

    Args:
        app: Page object
        index: Index of audio input
        has_previous_recording: If True, old waveform may still be visible during recording
    """
    audio_input = get_audio_input(app, index)

    # Record button should NOT be visible during recording
    record_button = audio_input.get_by_role("button", name="Record", exact=True)
    expect(record_button).not_to_be_visible()

    # Stop button SHOULD be visible
    stop_button = audio_input.get_by_role("button", name="Stop recording", exact=True)
    expect(stop_button).to_be_visible()
    expect(stop_button).to_be_enabled()

    # Download and clear should NOT be available during recording
    download_button = audio_input.get_by_role("button", name="Download as WAV")
    expect(download_button).not_to_be_visible()

    clear_button = audio_input.get_by_role("button", name="Clear recording")
    expect(clear_button).not_to_be_visible()

    if not has_previous_recording:
        # Waveform should NOT be visible for first recording
        waveform = audio_input.get_by_test_id("stAudioInputWaveSurfer")
        expect(waveform).not_to_be_visible()

        # No audio element during first recording
        audio_element = audio_input.locator("audio")
        expect(audio_element).not_to_be_visible()


def test_audio_input_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that audio input widgets are correctly rendered via screenshot matching."""
    expect(themed_app.get_by_test_id("stAudioInput")).to_have_count(12)

    assert_snapshot(get_audio_input(themed_app, MAIN), name="st_audio_input-default")
    assert_snapshot(
        get_audio_input(themed_app, DISABLED), name="st_audio_input-disabled"
    )
    assert_snapshot(
        get_audio_input(themed_app, HIDDEN_LABEL), name="st_audio_input-hidden_label"
    )
    assert_snapshot(
        get_audio_input(themed_app, WIDTH_STRETCH),
        name="st_audio_input-width_stretch",
    )
    assert_snapshot(
        get_audio_input(themed_app, WIDTH_FIXED), name="st_audio_input-width_300px"
    )


def test_check_top_level_class(app: Page):
    """Check that custom CSS class is applied via key."""
    audio_input = get_element_by_key(app, "the_audio_input")
    expect(audio_input).to_be_visible()
    check_top_level_class(app, "stAudioInput")


def test_help_tooltip(app: Page):
    """Test that help tooltip appears on hover."""
    audio_input = get_audio_input(app, MAIN)
    help_button = audio_input.locator("[data-testid='stTooltipIcon']")

    # Help icon should be visible
    expect(help_button).to_be_visible()

    # Hover over help icon
    help_button.hover()

    # Tooltip should appear with the help text
    tooltip = app.locator("[data-testid='stTooltipContent']")
    expect(tooltip).to_be_visible()
    expect(tooltip).to_have_text("This is the help text")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_recording_lifecycle(app: Page):
    """Test complete recording lifecycle: record, stop, clear, re-record."""
    grant_microphone_permissions(app)

    # Record
    record_and_stop(app, MAIN)
    wait_for_app_run(app)
    verify_recording_exists(app, MAIN)
    expect(app.get_by_text("Audio Input 1: True")).to_be_visible()

    # Verify WAV analysis shows
    expect(app.get_by_text("Channels:")).to_be_visible()
    expect(app.get_by_text("Frame Rate (Sample Rate):")).to_be_visible()
    expect(app.get_by_text("Duration:")).to_be_visible()

    # Clear
    audio_input = get_audio_input(app, MAIN)
    audio_input.hover()
    audio_input.get_by_role("button", name="Clear recording").click()
    wait_for_app_run(app)
    verify_no_recording(app, MAIN)
    expect(app.get_by_text("Audio Input 1: False")).to_be_visible()

    # Re-record (should auto-clear)
    audio_input.get_by_role("button", name="Record", exact=True).click()
    verify_recording_in_progress(
        app, MAIN, has_previous_recording=True
    )  # Verify recording state
    expect(
        app.get_by_text("Audio Input 1: False")
    ).to_be_visible()  # Old recording cleared
    app.wait_for_timeout(1500)
    audio_input.get_by_role("button", name="Stop recording").click()
    wait_for_app_run(app)
    verify_recording_exists(app, MAIN)
    expect(app.get_by_text("Audio Input 1: True")).to_be_visible()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_form_clears_on_submit(app: Page):
    """Test audio input in form clears after submit."""
    grant_microphone_permissions(app)
    record_and_stop(app, FORM, 1000)
    wait_for_app_run(app)
    verify_recording_exists(app, FORM)

    click_form_button(app, "Submit")
    wait_for_app_run(app)
    verify_no_recording(app, FORM)


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_fragment_isolation(app: Page):
    """Test fragment doesn't trigger full rerun."""
    grant_microphone_permissions(app)
    expect(app.get_by_text("Runs: 1")).to_be_visible()

    record_and_stop(app, FRAGMENT)
    wait_for_app_run(app)
    verify_recording_exists(app, FRAGMENT)

    # Should still be 1 run (fragment isolated)
    expect(app.get_by_text("Runs: 1")).to_be_visible()
    expect(app.get_by_text("Audio Input in Fragment:")).not_to_have_text("None")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_callback_triggered(app: Page):
    """Test on_change callback fires."""
    grant_microphone_permissions(app)
    expect(app.get_by_text("Audio Input Changed: False")).to_be_visible()
    record_and_stop(app, CALLBACK)
    wait_for_app_run(app)
    expect(app.get_by_text("Audio Input Changed: True")).to_be_visible()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_high_quality_sample_rate(app: Page):
    """Test 48kHz recording configuration."""
    grant_microphone_permissions(app)
    audio_input = get_audio_input(app, HIGH_QUALITY_48K)
    audio_input.scroll_into_view_if_needed()

    record_and_stop(app, HIGH_QUALITY_48K, duration_ms=2000)
    wait_for_app_run(app)

    expect(app.get_by_text("48 kHz recorded")).to_be_visible()

    # Download and verify actual sample rate
    audio_input = get_audio_input(app, HIGH_QUALITY_48K)
    with app.expect_download() as download_info:
        audio_input.get_by_role("button", name="Download as WAV").click()

    download = download_info.value
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        download.save_as(tmp.name)
        with wave.open(tmp.name, "rb") as wav:
            assert wav.getframerate() == 48000
        os.unlink(tmp.name)


def test_disabled_cannot_interact(app: Page):
    """Test disabled audio input cannot be interacted with."""
    audio_input = get_audio_input(app, DISABLED)
    record_button = audio_input.get_by_role("button", name="Record", exact=True)
    expect(record_button).to_be_disabled()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_remount_persistence(app: Page):
    """Test value persists across remount."""
    grant_microphone_permissions(app)
    audio_input = get_audio_input(app, REMOUNT)
    audio_input.scroll_into_view_if_needed()

    record_and_stop(app, REMOUNT)
    wait_for_app_run(app)
    expect(app.get_by_text("audio_input-after-sleep: True")).to_be_visible()

    # Trigger remount
    click_button(app, "Create some elements to unmount component")
    wait_for_app_run(app)

    # Should still be true
    expect(app.get_by_text("audio_input-after-sleep: True")).to_be_visible()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_download_file(app: Page):
    """Test that the audio file can be downloaded."""
    grant_microphone_permissions(app)
    record_and_stop(app, FORM)  # Use the helper function
    wait_for_app_run(app)

    audio_input = get_audio_input(app, FORM)
    with app.expect_download() as download_info:
        audio_input.get_by_role("button", name="Download as WAV").click()

    download = download_info.value
    assert download.suggested_filename == "recording.wav"


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_download_in_iframe(iframed_app: IframedPage):
    """Test that the audio file can be downloaded within an iframe."""
    page = iframed_app.page
    grant_microphone_permissions(page)
    frame = iframed_app.open_app(None)

    # Manual record/stop for frame (helper uses get_audio_input which expects Page)
    audio_input = frame.get_by_test_id("stAudioInput").nth(FORM)
    audio_input.get_by_role("button", name="Record", exact=True).click()
    page.wait_for_timeout(1500)
    audio_input.get_by_role("button", name="Stop recording", exact=True).click()
    wait_for_app_run(frame)

    with page.expect_download() as download_info:
        audio_input.get_by_role("button", name="Download as WAV").click()

    download = download_info.value
    assert download.suggested_filename == "recording.wav"


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_error_state_handling(app: Page, assert_snapshot: ImageCompareFunction):
    """Test error state handling."""
    grant_microphone_permissions(app)
    audio_input = get_audio_input(app, MAIN)

    # Mock upload failure
    def handle_route(route: Route):
        if "upload_file" in route.request.url:
            route.abort("failed")
        else:
            route.continue_()

    app.route("**/_stcore/upload_file/**", handle_route)

    audio_input.get_by_role("button", name="Record", exact=True).click()
    app.wait_for_timeout(1500)
    audio_input.get_by_role("button", name="Stop recording", exact=True).click()
    app.wait_for_timeout(1000)

    expect(
        audio_input.get_by_text("An error has occurred, please try again.")
    ).to_be_visible()
    assert_snapshot(audio_input, name="st_audio_input-error_state")
