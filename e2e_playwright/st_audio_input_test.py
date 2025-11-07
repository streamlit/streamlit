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

from e2e_playwright.conftest import (
    IframedPage,
    ImageCompareFunction,
    wait_for_app_run,
    wait_until,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_form_button,
    click_toggle,
    expect_help_tooltip,
    expect_prefixed_markdown,
    get_element_by_key,
)

NUM_AUDIO_INPUTS = 13


def grant_microphone_permissions(page: Page) -> None:
    """Grant microphone permissions where supported."""
    try:
        page.context.grant_permissions(["microphone"])
    except Exception:
        pass


def get_audio_input_by_label(app: Page, label: str) -> Locator:
    """Get audio input by its label text.

    Args:
        app: Page or Frame object
        label: The label text of the audio input

    Returns
    -------
        Locator for the audio input widget
    """
    # Use filter with has_text to match by label
    return app.get_by_test_id("stAudioInput").filter(has_text=label)


def record_and_stop(app: Page, label: str, duration_ms: int = 1500) -> None:
    """Record audio for duration and stop.

    Args:
        app: Page or Frame object
        label: The label text of the audio input
        duration_ms: Duration to record in milliseconds
    """
    audio_input = get_audio_input_by_label(app, label)
    # Use exact matching to avoid ambiguity with other buttons
    audio_input.get_by_role("button", name="Record", exact=True).click()
    app.wait_for_timeout(duration_ms)
    audio_input.get_by_role("button", name="Stop recording", exact=True).click()


def verify_recording_exists(app: Page, label: str) -> None:
    """Verify audio input has a recording and is in correct state.

    Args:
        app: Page or Frame object
        label: The label text of the audio input
    """
    audio_input = get_audio_input_by_label(app, label)

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
    # WaveSurfer may have multiple canvases (waveform and progress)
    canvas = waveform.locator("canvas")
    expect(canvas).to_have_count(2)  # Expect 2 canvases in WaveSurfer


def verify_no_recording(app: Page, label: str) -> None:
    """Verify audio input has no recording and is in initial state.

    Args:
        app: Page or Frame object
        label: The label text of the audio input
    """
    audio_input = get_audio_input_by_label(app, label)

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
    app: Page, label: str, has_previous_recording: bool = False
) -> None:
    """Verify audio input is actively recording.

    Args:
        app: Page object
        label: The label text of the audio input
        has_previous_recording: If True, old waveform may still be visible during recording
    """
    audio_input = get_audio_input_by_label(app, label)

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
    expect(themed_app.get_by_test_id("stAudioInput")).to_have_count(NUM_AUDIO_INPUTS)

    assert_snapshot(
        get_audio_input_by_label(themed_app, "Audio Input 1"),
        name="st_audio_input-default",
    )
    assert_snapshot(
        get_audio_input_by_label(themed_app, "Disabled Audio Input"),
        name="st_audio_input-disabled",
    )
    assert_snapshot(
        get_audio_input_by_label(themed_app, "Hidden Label Audio Input"),
        name="st_audio_input-hidden_label",
    )
    assert_snapshot(
        get_audio_input_by_label(themed_app, "Width Stretch"),
        name="st_audio_input-width_stretch",
    )
    assert_snapshot(
        get_audio_input_by_label(themed_app, "Width 300px"),
        name="st_audio_input-width_300px",
    )


def test_check_top_level_class(app: Page):
    """Check that custom CSS class is applied via key."""
    audio_input = get_element_by_key(app, "the_audio_input")
    expect(audio_input).to_be_visible()
    check_top_level_class(app, "stAudioInput")


def test_help_tooltip(app: Page):
    """Test that help tooltip appears on hover."""
    audio_input = get_audio_input_by_label(app, "Audio Input 1")
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
    record_and_stop(app, "Audio Input 1")
    wait_for_app_run(app)
    verify_recording_exists(app, "Audio Input 1")
    expect(app.get_by_text("Audio Input 1: True")).to_be_visible()

    # Verify WAV analysis shows
    expect(app.get_by_text("Channels:")).to_be_visible()
    expect(app.get_by_text("Frame Rate (Sample Rate):")).to_be_visible()
    expect(app.get_by_text("Duration:")).to_be_visible()

    # Clear
    audio_input = get_audio_input_by_label(app, "Audio Input 1")
    audio_input.hover()
    audio_input.get_by_role("button", name="Clear recording").click()
    wait_for_app_run(app)
    verify_no_recording(app, "Audio Input 1")
    expect(app.get_by_text("Audio Input 1: False")).to_be_visible()

    # Re-record (should auto-clear)
    audio_input.get_by_role("button", name="Record", exact=True).click()
    verify_recording_in_progress(
        app, "Audio Input 1", has_previous_recording=True
    )  # Verify recording state
    expect(
        app.get_by_text("Audio Input 1: False")
    ).to_be_visible()  # Old recording cleared
    app.wait_for_timeout(1500)
    audio_input.get_by_role("button", name="Stop recording").click()
    wait_for_app_run(app)
    verify_recording_exists(app, "Audio Input 1")
    expect(app.get_by_text("Audio Input 1: True")).to_be_visible()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_form_clears_on_submit(app: Page):
    """Test audio input in form clears after submit."""
    grant_microphone_permissions(app)
    record_and_stop(app, "Audio Input in Form", 1000)
    wait_for_app_run(app)
    verify_recording_exists(app, "Audio Input in Form")

    click_form_button(app, "Submit")
    wait_for_app_run(app)
    verify_no_recording(app, "Audio Input in Form")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_fragment_isolation(app: Page):
    """Test fragment doesn't trigger full rerun."""
    grant_microphone_permissions(app)
    expect(app.get_by_text("Runs: 1")).to_be_visible()

    record_and_stop(app, "Audio Input in Fragment")
    wait_for_app_run(app)
    verify_recording_exists(app, "Audio Input in Fragment")

    # Should still be 1 run (fragment isolated)
    expect(app.get_by_text("Runs: 1")).to_be_visible()
    expect(app.get_by_text("Audio Input in Fragment:")).not_to_have_text("None")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_callback_triggered(app: Page):
    """Test on_change callback fires."""
    grant_microphone_permissions(app)
    expect(app.get_by_text("Audio Input Changed: False")).to_be_visible()
    record_and_stop(app, "Testing Callback")
    wait_for_app_run(app)
    expect(app.get_by_text("Audio Input Changed: True")).to_be_visible()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_high_quality_sample_rate(app: Page):
    """Test 48kHz recording configuration."""
    grant_microphone_permissions(app)
    audio_input = get_audio_input_by_label(app, "High Quality (48 kHz)")
    audio_input.scroll_into_view_if_needed()

    record_and_stop(app, "High Quality (48 kHz)", duration_ms=2000)
    wait_for_app_run(app)

    expect(app.get_by_text("48 kHz recorded")).to_be_visible()

    # Download and verify actual sample rate
    audio_input = get_audio_input_by_label(app, "High Quality (48 kHz)")
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
    audio_input = get_audio_input_by_label(app, "Disabled Audio Input")
    record_button = audio_input.get_by_role("button", name="Record", exact=True)
    expect(record_button).to_be_disabled()


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_remount_persistence(app: Page):
    """Test value persists across remount."""
    grant_microphone_permissions(app)
    audio_input = get_audio_input_by_label(app, "After sleep audio input")
    audio_input.scroll_into_view_if_needed()

    record_and_stop(app, "After sleep audio input")
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
    record_and_stop(app, "Audio Input in Form")  # Use the helper function
    wait_for_app_run(app)

    audio_input = get_audio_input_by_label(app, "Audio Input in Form")
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

    # Use label-based selector for frame
    audio_input = frame.get_by_test_id("stAudioInput").filter(
        has_text="Audio Input in Form"
    )
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
    audio_input = get_audio_input_by_label(app, "Audio Input 1")

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


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_permission_denied_state(
    app_with_microphone_permission_denied: Page, assert_snapshot: ImageCompareFunction
):
    """Test that permission denied state is displayed."""
    app_with_microphone_permission_denied.on(
        "console", lambda msg: print(f"CONSOLE[{msg.type}]: {msg.text}")
    )

    audio_input = get_audio_input_by_label(
        app_with_microphone_permission_denied, "Audio Input 1"
    )

    # Try to record - should trigger permission denied
    record_button = audio_input.get_by_role("button", name="Record", exact=True)
    record_button.click()
    app_with_microphone_permission_denied.wait_for_timeout(2000)

    # Verify permission denied message appears
    expect(
        audio_input.get_by_text("This app would like to use your microphone")
    ).to_be_visible()

    # Verify record button is disabled
    expect(record_button).to_be_disabled()

    # Take snapshot
    assert_snapshot(audio_input, name="st_audio_input-permission_denied")


@pytest.mark.skip_browser("webkit")  # Webkit CI audio permission issue
def test_dynamic_audio_input_props(app: Page):
    """Test that the audio input can be updated dynamically while keeping the state."""
    # Initial dynamic input
    audio_input = get_element_by_key(app, "dynamic_audio_input_key")
    expect(audio_input).to_be_visible()
    expect(audio_input).to_contain_text("Initial dynamic audio input")
    expect_prefixed_markdown(app, "Initial audio input value:", "False")

    # Check that the help tooltip is correct:
    expect_help_tooltip(
        app, audio_input.get_by_test_id("stWidgetLabel"), "initial help"
    )

    # Record
    record_and_stop(app, "Initial dynamic audio input")
    wait_for_app_run(app)
    verify_recording_exists(app, "Initial dynamic audio input")

    expect_prefixed_markdown(app, "Initial audio input value:", "True")

    # Toggle to update props (changes sample_rate)
    click_toggle(app, "Update audio input props")

    # New widget rendered with same key container but different configuration
    expect(audio_input).to_contain_text("Updated dynamic audio input")

    # The recorded audio input snapshots are flaky, so we can only verify
    # metadata in this case.

    # Verify the updated audio input value
    expect_prefixed_markdown(app, "Updated audio input value:", "True")
    # Verify new width:
    expect(audio_input).to_have_css("width", "300px")

    # Check that the help tooltip is correct:
    expect_help_tooltip(
        app, audio_input.get_by_test_id("stWidgetLabel"), "updated help"
    )


@pytest.mark.only_browser("chromium")
def test_audio_input_rapid_re_recordings(app: Page):
    """Test that rapid re-recordings work correctly without race conditions."""
    grant_microphone_permissions(app)

    audio_input = get_audio_input_by_label(app, "Audio Input 1")

    # Do 3 rapid recordings - each new one should replace the previous
    for i in range(3):
        # Use the specific aria-label selector to avoid ambiguity
        record_button = audio_input.locator('[aria-label="Record"]')
        record_button.click()

        # Wait for stop button to appear (indicates recording started)
        expect(
            audio_input.get_by_role("button", name="Stop recording", exact=True)
        ).to_be_visible()

        # Let it record briefly
        app.wait_for_timeout(500)  # This is OK - we need actual recording time

        stop_button = audio_input.get_by_role("button", name="Stop recording")
        stop_button.click()

        if i < 2:  # Don't wait after last recording
            # Wait for record button to be available again before next recording
            expect(record_button).to_be_visible()

    # Wait for the final upload to complete
    wait_for_app_run(app)

    # Wait for the audio to be processed and displayed
    expect(app.get_by_text("Audio Input 1: True")).to_be_visible(timeout=10000)


@pytest.mark.only_browser("chromium")
def test_audio_input_cleans_up_blob_urls_on_abort(app: Page):
    """Test that blob URLs are properly revoked when uploads are aborted to prevent memory leaks."""
    grant_microphone_permissions(app)

    # Inject tracking code for blob URL creation and revocation
    app.evaluate("""
        window.blobTracking = {created: [], revoked: []};
        const origCreate = URL.createObjectURL;
        const origRevoke = URL.revokeObjectURL;

        URL.createObjectURL = function(blob) {
            const url = origCreate.call(this, blob);
            window.blobTracking.created.push(url);
            console.log('Created blob URL:', url);
            return url;
        };

        URL.revokeObjectURL = function(url) {
            window.blobTracking.revoked.push(url);
            console.log('Revoked blob URL:', url);
            return origRevoke.call(this, url);
        };
    """)

    audio_input = get_audio_input_by_label(app, "Audio Input 1")

    # Create 3 recordings rapidly - each should clean up the previous blob URL
    for i in range(3):
        record_button = audio_input.locator('[aria-label="Record"]')
        record_button.click()

        # Wait for stop button to appear
        expect(audio_input.get_by_role("button", name="Stop recording")).to_be_visible()

        # Let it record briefly
        app.wait_for_timeout(300)  # This is OK - we need actual recording time

        audio_input.get_by_role("button", name="Stop recording").click()

        if i < 2:
            # Wait for record button to be available again
            expect(record_button).to_be_visible()

    # Wait for processing to complete
    wait_for_app_run(app)

    # Check cleanup - wait for the tracking values to be available
    # Use wait_until pattern for async checks as per best practices
    def check_blob_urls() -> bool:
        tracking = app.evaluate("window.blobTracking")
        return len(tracking["created"]) >= 3 and len(tracking["revoked"]) >= 2

    wait_until(app, check_blob_urls, timeout=5)

    # Now verify the actual values
    tracking = app.evaluate("window.blobTracking")

    # These asserts are acceptable for non-DOM values
    # as confirmed by st_heading_test.py and other tests
    assert len(tracking["created"]) >= 3, (
        f"Expected at least 3 blob URLs created, got {len(tracking['created'])}"
    )

    assert len(tracking["revoked"]) >= 2, (
        f"Expected at least 2 blob URLs revoked, got {len(tracking['revoked'])}"
    )

    # Verify that earlier created URLs were revoked
    for i in range(min(2, len(tracking["created"]) - 1)):
        url = tracking["created"][i]
        assert url in tracking["revoked"], f"Blob URL {url} should have been revoked"


# Marking this as only Chromium because Playwright Firefox
# is having a strange issue that does not reproduce locally with Firefox,
# where clicking play seeks to the end and sets the time to 00:03.
@pytest.mark.only_browser("chromium")
def test_audio_input_timer_display(app: Page):
    """Test that the timer display shows correct values during recording and playback."""
    grant_microphone_permissions(app)
    audio_input = get_audio_input_by_label(app, "Audio Input 1")
    timer = audio_input.get_by_test_id("stAudioInputWaveformTimeCode")

    def timer_seconds() -> int:
        value = timer.inner_text().strip()
        if value == "--:--":
            return -1

        try:
            minutes, seconds = value.split(":", maxsplit=1)
        except ValueError:
            return -1

        return int(minutes) * 60 + int(seconds)

    def wait_for_timer_at_least(target_seconds: int, timeout_ms: int) -> str:
        """Wait until the timer reaches ``target_seconds`` and return the label seen."""

        target = target_seconds

        def reached_target() -> bool:
            return timer_seconds() >= target

        wait_until(app, reached_target, timeout=timeout_ms)
        return timer.inner_text().strip()

    # Record for roughly 3 seconds (add buffer for recording startup)
    audio_input.get_by_role("button", name="Record", exact=True).click()
    wait_for_timer_at_least(3, timeout_ms=6000)
    audio_input.get_by_role("button", name="Stop recording", exact=True).click()
    wait_for_app_run(app)

    # Verify timer shows a duration in the expected range and matches HH:MM formatting
    recorded_seconds = timer_seconds()
    assert 3 <= recorded_seconds <= 5
    expect(timer).to_have_text(re.compile(r"00:0[3-5]"))

    # Click play and wait for playback to start
    audio_input.get_by_role("button", name="Play", exact=True).click()
    # Wait for pause button to appear, confirming playback started
    expect(audio_input.get_by_role("button", name="Pause", exact=True)).to_be_visible()

    # Verify timer shows 00:00 at start of playback
    expect(timer).to_have_text("00:00")

    # Wait until timer advances to at least one second
    wait_for_timer_at_least(1, timeout_ms=4000)
    playback_seconds = timer_seconds()
    assert 1 <= playback_seconds <= 2
    expect(timer).to_have_text(re.compile(r"00:0[1-2]"))

    # Pause playback
    audio_input.get_by_role("button", name="Pause", exact=True).click()
    # Wait for play button to reappear
    expect(audio_input.get_by_role("button", name="Play", exact=True)).to_be_visible()

    # Re-record for roughly 4 seconds to validate timer updates again
    audio_input.get_by_role("button", name="Record", exact=True).click()
    wait_for_timer_at_least(4, timeout_ms=8000)
    audio_input.get_by_role("button", name="Stop recording", exact=True).click()
    wait_for_app_run(app)

    second_recorded_seconds = timer_seconds()
    assert 4 <= second_recorded_seconds <= 6
    expect(timer).to_have_text(re.compile(r"00:0[4-6]"))
