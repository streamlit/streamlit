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
import tempfile
import wave

import pytest
from playwright.sync_api import FrameLocator, Locator, Page, Route, expect

from e2e_playwright.conftest import IframedPage, ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_form_button,
    expect_help_tooltip,
    get_element_by_key,
)


def stop_recording(audio_input: Locator, app: Page):
    """Stop recording audio and wait for the recording to complete."""
    audio_input.get_by_role("button", name="Stop recording").click()
    app.wait_for_timeout(5000)  # ci seems to be very slow so adding wait here


def ensure_waveform_is_not_rendered(audio_input: Locator):
    expect(audio_input.get_by_test_id("stAudioInputWaveSurfer")).not_to_be_visible()

    time_code = audio_input.get_by_test_id("stAudioInputWaveformTimeCode")
    expect(time_code).to_have_text("00:00")

    audio_input.hover()
    expect(
        audio_input.get_by_role("button", name="Clear recording")
    ).not_to_be_visible()


def ensure_waveform_rendered(audio_input: Locator):
    # Check for the waveform and time code
    wavesurfer = audio_input.get_by_test_id("stAudioInputWaveSurfer")
    expect(wavesurfer).to_be_visible()

    # Check that WaveSurfer has actually rendered content with a canvas
    # A properly rendered waveform must have at least one canvas element
    # WaveSurfer may create multiple canvases for waveform and progress
    canvas = wavesurfer.locator("canvas")
    expect(canvas.first).to_be_visible()
    # Ensure there's at least one canvas (not zero which would indicate no rendering)
    canvas_count = canvas.count()
    assert canvas_count > 0, "No canvas elements found - waveform not rendered"

    time_code = audio_input.get_by_test_id("stAudioInputWaveformTimeCode")
    expect(time_code).to_be_visible()
    expect(time_code).not_to_have_text("00:00")

    audio_input.hover()
    expect(audio_input.get_by_role("button", name="Clear recording")).to_be_visible()
    expect(audio_input.get_by_role("button", name="Download as WAV")).to_be_visible()


def test_audio_input_renders(app: Page):
    """Test that the audio input component is rendered the correct number of times."""
    audio_input_elements = app.get_by_test_id("stAudioInput")
    count = 12  # Expected number of audio input elements

    # Verify that the expected number of elements is rendered
    expect(audio_input_elements).to_have_count(count)

    # Check each element is visible
    for i in range(count):
        expect(audio_input_elements.nth(i)).to_be_visible()


def test_check_top_level_class(app: Page):
    """Check that the top-level class 'stAudioInput' is correctly applied."""
    check_top_level_class(app, "stAudioInput")


def test_custom_css_class_via_key(app: Page):
    """Test that a custom CSS class can be applied to the audio input component via the key."""
    expect(get_element_by_key(app, "the_audio_input")).to_be_visible()


def test_audio_input_default_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Take a snapshot of the default state of the audio input element for visual regression."""
    audio_input_element = themed_app.get_by_test_id("stAudioInput").first
    assert_snapshot(audio_input_element, name="st_audio_input-default")


def test_audio_input_disabled_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Take a snapshot of the disabled audio input element for visual regression."""
    disabled_audio_input_element = themed_app.get_by_test_id("stAudioInput").nth(3)
    assert_snapshot(disabled_audio_input_element, name="st_audio_input-disabled")


# Webkit CI audio permission issue
@pytest.mark.skip_browser("webkit")
def test_audio_input_action_buttons_styling(app: Page):
    """Test that the audio input action buttons are styled correctly."""
    # Enabled audio input
    audio_input_element = app.get_by_test_id("stAudioInput").first

    # Check record button default & hover styling
    record_button = audio_input_element.get_by_role("button", name="Record")
    expect(record_button).to_have_css("color", "rgba(49, 51, 63, 0.6)")
    record_button.hover()
    expect(record_button).to_have_css("color", "rgb(49, 51, 63)")

    # Click the record button to get to the play button
    record_button.click()
    app.wait_for_timeout(1000)
    stop_recording(audio_input_element, app)

    # Check play button default & hover styling consistent with record button
    play_button = audio_input_element.get_by_role("button", name="Play")
    expect(play_button).to_have_css("color", "rgba(49, 51, 63, 0.6)")
    play_button.hover()
    expect(play_button).to_have_css("color", "rgb(49, 51, 63)")

    # Disabled audio input
    disabled_audio_input_element = app.get_by_test_id("stAudioInput").nth(3)
    record_button = disabled_audio_input_element.get_by_role("button", name="Record")
    expect(record_button).to_have_css("color", "rgba(49, 51, 63, 0.2)")


@pytest.mark.only_browser("webkit")
def test_no_permission_audio_input_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Take a snapshot of the audio input element when no permission is granted."""
    no_permission_audio_input = themed_app.get_by_test_id("stAudioInput").nth(0)
    record_button = no_permission_audio_input.get_by_role("button", name="Record")

    expect(
        themed_app.get_by_text("This app would like to use your microphone.")
    ).not_to_be_visible()

    expect(record_button).to_be_visible()
    expect(record_button).not_to_be_disabled()

    expect(record_button).not_to_be_disabled()
    record_button.click()

    # Verify the permission message is visible
    expect(
        themed_app.get_by_text("This app would like to use your microphone.")
    ).to_be_visible()

    # Capture the snapshot
    assert_snapshot(no_permission_audio_input, name="st_audio_input-no_permission")


def test_audio_input_label_visibility_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Take a snapshot to check visibility of the audio input label when hidden."""
    audio_input_no_label_visibility = themed_app.get_by_test_id("stAudioInput").nth(4)

    # Verify the label is hidden
    expect(themed_app.get_by_text("Hidden Label Audio Input")).not_to_be_visible()

    # Capture the snapshot
    assert_snapshot(
        audio_input_no_label_visibility, name="st_audio_input-label_visibility_disabled"
    )


def _test_download_audio_file(app: Page, locator: FrameLocator | Locator):
    audio_input = locator.get_by_test_id("stAudioInput").nth(1)
    audio_input.get_by_role("button", name="Record").click()
    app.wait_for_timeout(1500)

    stop_recording(audio_input, app)

    with app.expect_download() as download_info:
        download_button = audio_input.get_by_role("button", name="Download as WAV")
        download_button.click()

    download = download_info.value
    file_name = download.suggested_filename

    assert file_name == "recording.wav"


@pytest.mark.only_browser("chromium")
def test_audio_input_file_download(app: Page):
    """Test that the audio input file can be downloaded."""
    app.context.grant_permissions(["microphone"])

    _test_download_audio_file(app, app.locator("body"))


@pytest.mark.only_browser("chromium")
def test_audio_input_file_download_in_iframe(iframed_app: IframedPage):
    """Test that the audio input file can be downloaded within an iframe."""

    page: Page = iframed_app.page
    frame_locator: FrameLocator = iframed_app.open_app(None)

    _test_download_audio_file(page, frame_locator)


@pytest.mark.only_browser("chromium")
def test_audio_input_callback(app: Page):
    """Test that the callback is triggered when audio input changes."""
    # Initial state before any interaction
    expect(app.get_by_text("Audio Input Changed: False")).to_be_visible()

    # Simulate recording interaction
    audio_input = app.get_by_test_id("stAudioInput").nth(5)
    audio_input.get_by_role("button", name="Record").click()
    app.wait_for_timeout(1500)

    stop_recording(audio_input, app)

    ensure_waveform_rendered(audio_input)

    # Verify the callback updated the UI
    expect(app.get_by_text("Audio Input Changed: True")).to_be_visible()


@pytest.mark.only_browser("chromium")
def test_audio_input_remount_keep_value(app: Page):
    """Test that the audio input component remounts without resetting its value."""
    expect(app.get_by_text("audio_input-after-sleep: False")).to_be_visible()

    # Simulate recording interaction
    audio_input = app.get_by_test_id("stAudioInput").nth(6)
    audio_input.scroll_into_view_if_needed()
    audio_input.get_by_role("button", name="Record").click()
    app.wait_for_timeout(1500)

    stop_recording(audio_input, app)

    wait_for_app_run(app)

    # Ensure the value is retained after remount
    expect(app.get_by_text("audio_input-after-sleep: True")).to_be_visible()

    # Unmount the component and verify the value is still retained
    click_button(app, "Create some elements to unmount component")
    expect(app.get_by_text("audio_input-after-sleep: True")).to_be_visible()

    ensure_waveform_rendered(audio_input)


@pytest.mark.only_browser("chromium")
def test_audio_input_works_in_forms(app: Page):
    """Test the functionality of the audio input component within a form."""
    app.context.grant_permissions(["microphone"])

    # Initial form state
    expect(app.get_by_text("Audio Input in Form: None")).to_be_visible()

    # Simulate recording in the form
    form_audio_input = app.get_by_test_id("stAudioInput").nth(1)
    form_audio_input.get_by_role("button", name="Record").click()
    app.wait_for_timeout(1500)

    stop_recording(form_audio_input, app)

    submit_button = app.get_by_role("button", name="Submit")
    submit_button.scroll_into_view_if_needed()
    expect(submit_button).to_be_enabled()

    # Verify the form state has not changed yet
    expect(app.get_by_text("Audio Input in Form: None")).to_be_visible()

    app.wait_for_timeout(1500)

    # Submit the form and verify the state update
    click_form_button(app, "Submit")
    wait_for_app_run(app)

    ensure_waveform_is_not_rendered(form_audio_input)

    app.get_by_text("Audio Input in Form:").scroll_into_view_if_needed()
    expect(app.get_by_text("Audio Input in Form: None")).not_to_be_visible()


@pytest.mark.only_browser("chromium")
def test_audio_input_works_with_fragments(app: Page):
    """Test that the audio input component works correctly inside fragments."""
    app.context.grant_permissions(["microphone"])

    # Initial state for fragments
    expect(app.get_by_text("Runs: 1")).to_be_visible()
    expect(app.get_by_text("Audio Input in Fragment: None")).to_be_visible()

    # Simulate recording interaction in a fragment
    fragment_audio_input = app.get_by_test_id("stAudioInput").nth(2)
    fragment_audio_input.scroll_into_view_if_needed()
    fragment_audio_input.get_by_role("button", name="Record").click()
    app.wait_for_timeout(1500)

    stop_recording(fragment_audio_input, app)

    wait_for_app_run(app)

    # Verify the state is updated without additional reruns
    app.get_by_text("Audio Input in Fragment:").scroll_into_view_if_needed()
    expect(app.get_by_text("Audio Input in Fragment: None")).not_to_be_visible()
    expect(app.get_by_text("Runs: 1")).to_be_visible()

    # Clear recording and verify the state remains consistent
    fragment_audio_input.get_by_role("button", name="Clear recording").click()
    wait_for_app_run(app)
    expect(app.get_by_text("Runs: 1")).to_be_visible()


@pytest.mark.only_browser("chromium")
def test_audio_input_basic_flow(app: Page):
    """Test the basic flow of recording, playing, and clearing audio input."""
    app.context.grant_permissions(["microphone"])

    # Verify initial state
    expect(app.get_by_text("Audio Input 1: False")).to_be_visible()
    audio_input = app.get_by_test_id("stAudioInput").first

    # Check for help tooltip and ensure permissions message is hidden
    expect_help_tooltip(app, audio_input, "This is the help text")
    expect(
        app.get_by_text("This app would like to use your microphone.").first
    ).not_to_be_visible()

    # Start recording and verify time code
    record_button = app.get_by_role("button", name="Record").first
    clock = audio_input.get_by_test_id("stAudioInputWaveformTimeCode")
    expect(clock).to_have_text("00:00")
    record_button.click()

    app.wait_for_timeout(1500)

    stop_recording(audio_input, app)

    wait_for_app_run(app)
    expect(app.get_by_text("Audio Input 1: True")).to_be_visible()

    ensure_waveform_rendered(audio_input)

    expect(app.get_by_text("Channels:")).to_be_visible()
    expect(app.get_by_text("Sample Width:")).to_be_visible()
    expect(app.get_by_text("Frame Rate (Sample Rate):")).to_be_visible()
    expect(app.get_by_text("Duration:")).to_be_visible()

    # Ensure no error is displayed
    expect(app.get_by_text("Error loading WAV file")).not_to_be_visible()

    # Play and pause the recording, then verify the controls
    play_button = audio_input.get_by_role("button", name="Play").first
    expect(clock).not_to_have_text("00:00")
    play_button.click()

    pause_button = audio_input.get_by_role("button", name="Pause").first
    expect(pause_button).to_be_visible()
    pause_button.click()
    expect(play_button).to_be_visible()

    # Clear the recording and verify reset to initial state
    audio_input.hover()
    clear_button = audio_input.get_by_role("button", name="Clear recording").first
    expect(clear_button).to_be_visible()
    clear_button.click()

    wait_for_app_run(app)
    expect(app.get_by_text("Audio Input 1: False")).to_be_visible()
    expect(audio_input.get_by_role("button", name="Record").first).to_be_visible()
    expect(clock).to_have_text("00:00")


@pytest.mark.only_browser("chromium")
def test_audio_input_error_state(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test the error state of audio input."""
    themed_app.context.grant_permissions(["microphone"])

    def handle(route: Route):
        route.abort("failed")

    themed_app.route("**/_stcore/upload_file/**", handle)

    audio_input = themed_app.get_by_test_id("stAudioInput").first

    audio_input.get_by_role("button", name="Record").click()
    themed_app.wait_for_timeout(1500)
    stop_recording(audio_input, themed_app)

    expect(
        audio_input.get_by_text("An error has occurred, please try again.")
    ).to_be_visible()

    assert_snapshot(audio_input, name="st_audio_input-error_state")

    audio_input.get_by_role("button", name="Reset").click()
    expect(
        audio_input.get_by_text("An error has occurred, please try again.")
    ).not_to_be_visible()


def test_audio_input_widths(app: Page, assert_snapshot: ImageCompareFunction):
    """Test audio_input with different width configurations."""
    stretch_width_input = app.get_by_test_id("stAudioInput").nth(10)
    pixel_width_input = app.get_by_test_id("stAudioInput").nth(11)

    expect(stretch_width_input).to_be_visible()
    expect(pixel_width_input).to_be_visible()

    assert_snapshot(stretch_width_input, name="st_audio_input-width_stretch")
    assert_snapshot(pixel_width_input, name="st_audio_input-width_300px")


@pytest.mark.only_browser("chromium")
def test_audio_input_sample_rates_recording(app: Page):
    """Test that audio_input records at different sample rates correctly."""
    app.context.grant_permissions(["microphone"])

    # Test 48 kHz recording
    high_quality_input = (
        app.get_by_test_id("stAudioInput")
        .filter(has=app.get_by_text("High Quality (48 kHz)"))
        .first
    )
    expect(high_quality_input).to_be_visible()

    # Record audio at 48 kHz
    high_quality_input.get_by_role("button", name="Record").click()
    app.wait_for_timeout(2000)  # Record for 2 seconds
    stop_recording(high_quality_input, app)
    wait_for_app_run(app)

    # Verify recording was created
    expect(app.get_by_text("48 kHz recorded")).to_be_visible()

    # Download and verify the sample rate
    with app.expect_download() as download_info:
        high_quality_input.get_by_role("button", name="Download as WAV").click()

    download = download_info.value
    temp_path = tempfile.mktemp(suffix=".wav")
    download.save_as(temp_path)

    try:
        with wave.open(temp_path, "rb") as wav_file:
            sample_rate = wav_file.getframerate()
            # Verify it's 48 kHz
            assert sample_rate == 48000, f"Expected 48000Hz, got {sample_rate}Hz"
    finally:
        os.unlink(temp_path)

    # Test browser default (should be 44.1 or 48 kHz)
    browser_default_input = (
        app.get_by_test_id("stAudioInput")
        .filter(has=app.get_by_text("Browser Default"))
        .first
    )

    browser_default_input.get_by_role("button", name="Record").click()
    app.wait_for_timeout(2000)
    stop_recording(browser_default_input, app)
    wait_for_app_run(app)

    expect(app.get_by_text("Browser default recorded")).to_be_visible()

    with app.expect_download() as download_info:
        browser_default_input.get_by_role("button", name="Download as WAV").click()

    download = download_info.value
    temp_path = tempfile.mktemp(suffix=".wav")
    download.save_as(temp_path)

    try:
        with wave.open(temp_path, "rb") as wav_file:
            sample_rate = wav_file.getframerate()
            # Browser default is typically 44100 or 48000
            assert sample_rate in [44100, 48000], (
                f"Expected browser default (44100 or 48000Hz), got {sample_rate}Hz"
            )
    finally:
        os.unlink(temp_path)


def test_audio_input_sample_rates_display(app: Page):
    """Test that audio_input widgets with different sample rates display correctly."""
    # Navigate to sample rate section
    sample_rate_header = app.get_by_role("heading", name="Sample Rate Tests")
    expect(sample_rate_header).to_be_visible()

    # Test default sample rate widget
    default_input = (
        app.get_by_test_id("stAudioInput")
        .filter(has=app.get_by_text("Default Sample Rate (16 kHz)"))
        .first
    )
    expect(default_input).to_be_visible()

    # Test 48 kHz widget
    high_quality_input = (
        app.get_by_test_id("stAudioInput")
        .filter(has=app.get_by_text("High Quality (48 kHz)"))
        .first
    )
    expect(high_quality_input).to_be_visible()

    # Test browser default widget
    browser_default_input = (
        app.get_by_test_id("stAudioInput")
        .filter(has=app.get_by_text("Browser Default"))
        .first
    )
    expect(browser_default_input).to_be_visible()

    # Verify all three widgets are independent
    expect(app.get_by_test_id("stAudioInput")).to_have_count(
        12
    )  # Updated count including new widgets


@pytest.mark.skip_browser("webkit")  # Webkit has CI audio permission issues
def test_audio_input_re_recording(app: Page):
    """Test that clicking record with an existing recording clears it and starts new recording."""
    audio_input = app.get_by_test_id("stAudioInput").first

    # Get the record button by aria-label since it's an icon button
    record_button = audio_input.locator("[aria-label='Record']")

    # Start first recording
    record_button.click()

    # Wait for recording to start - button changes to stop
    stop_button = audio_input.get_by_role("button", name="Stop recording")
    expect(stop_button).to_be_visible(timeout=2000)

    # Record for 1 second
    app.wait_for_timeout(1000)

    # Stop recording
    stop_button.click()

    # Wait for recording to process
    app.wait_for_timeout(3000)

    # After stopping, should have both play and record buttons
    play_button = audio_input.get_by_role("button", name="Play")
    expect(play_button).to_be_visible()

    record_button = audio_input.locator("[aria-label='Record']")
    expect(record_button).to_be_visible()

    # Now test re-recording: click record again with existing recording
    # This should clear the old recording and start a new one immediately
    record_button.click()

    # The button should change to "Stop recording" indicating recording started
    # This is the critical test - it should work with just one click
    stop_button = audio_input.get_by_role("button", name="Stop recording")
    expect(stop_button).to_be_visible(timeout=3000)

    # Record for another second
    app.wait_for_timeout(1000)

    # Stop the second recording
    stop_button.click()

    # Wait for processing
    app.wait_for_timeout(3000)

    # Should have play button again
    expect(play_button).to_be_visible()
