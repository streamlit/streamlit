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
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_form_button,
    expect_help_tooltip,
    get_element_by_key,
)


def ensure_waveform_rendered(audio_input: Locator):
    # Check for the waveform and time code
    expect(audio_input.get_by_test_id("stAudioInputWaveSurfer")).to_be_visible()
    time_code = audio_input.get_by_test_id("stAudioInputWaveformTimeCode")
    expect(time_code).to_be_visible()
    expect(time_code).not_to_have_text("00:00")

    audio_input.hover()
    expect(audio_input.get_by_role("button", name="Clear recording")).to_be_visible()


def test_audio_input_renders(app: Page):
    """Test that the audio input component is rendered the correct number of times."""
    audio_input_elements = app.get_by_test_id("stAudioInput")
    count = 7  # Expected number of audio input elements

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


@pytest.mark.only_browser("chromium")
def test_audio_input_callback(app: Page):
    """Test that the callback is triggered when audio input changes."""
    # Initial state before any interaction
    expect(app.get_by_text("Audio Input Changed: False")).to_be_visible()

    # Simulate recording interaction
    audio_input = app.get_by_test_id("stAudioInput").nth(5)
    audio_input.get_by_role("button", name="Record").click()
    app.wait_for_timeout(1500)
    audio_input.get_by_role("button", name="Stop recording").click()

    ensure_waveform_rendered(audio_input)

    # Verify the callback updated the UI
    expect(app.get_by_text("Audio Input Changed: True")).to_be_visible()


@pytest.mark.only_browser("chromium")
def test_audio_input_remount_keep_value(app: Page):
    """Test that the audio input component remounts without resetting its value."""
    expect(app.get_by_text("audio_input-after-sleep: False")).to_be_visible()

    # Simulate recording interaction
    audio_input = app.get_by_test_id("stAudioInput").nth(6)
    audio_input.get_by_role("button", name="Record").click()
    app.wait_for_timeout(1500)
    audio_input.get_by_role("button", name="Stop recording").click()

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
    form_audio_input.get_by_role("button", name="Stop recording").click()

    # Verify the form state has not changed yet
    expect(app.get_by_text("Audio Input in Form: None")).to_be_visible()

    # Submit the form and verify the state update
    click_form_button(app, "Submit")
    wait_for_app_run(app)
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
    fragment_audio_input.get_by_role("button", name="Record").click()
    app.wait_for_timeout(1500)
    fragment_audio_input.get_by_role("button", name="Stop recording").click()

    wait_for_app_run(app)

    # Verify the state is updated without additional reruns
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

    # Stop recording after a second and verify state change
    stop_button = audio_input.get_by_role("button", name="Stop recording").first
    expect(stop_button).to_be_visible()
    app.wait_for_timeout(1500)
    stop_button.click()

    wait_for_app_run(app)
    expect(app.get_by_text("Audio Input 1: True")).to_be_visible()

    ensure_waveform_rendered(audio_input)

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
