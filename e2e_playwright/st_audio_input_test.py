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

import time

from playwright.sync_api import Page, expect


def test_audio_input_renders(app: Page):
    audio_input_elements = app.get_by_test_id("stAudioInput")
    expect(audio_input_elements).to_have_count(1)

    expect(audio_input_elements.nth(0)).to_be_visible()


def test_audio_input_basic_flow(app: Page):
    # Check browser type and grant microphone permission only if supported
    if app.context.browser_name == "chromium" or app.context.browser_name == "firefox":
        app.context.grant_permissions(["microphone"])

    app.wait_for_timeout(2000)

    record_button = app.get_by_test_id("stAudioInputRecordButton").first
    clock = app.get_by_test_id("StyledWaveformTimeCode").first

    expect(clock).to_have_text("00:00")

    record_button.click()

    stop_button = app.get_by_test_id("stAudioInputStopRecordingButton").first
    expect(stop_button).to_be_visible()

    time.sleep(2)

    stop_button.click()

    play_button = app.get_by_test_id("stAudioInputPlayButton").first

    expect(clock).not_to_have_text("00:00")

    play_button.click()

    pause_button = app.get_by_test_id("stAudioInputPauseButton").first
    expect(pause_button).to_be_visible()

    pause_button.click()

    expect(play_button).to_be_visible()

    app.get_by_test_id("stAudioInput").first.hover()

    clear_button = app.get_by_test_id("stAudioInputClearRecordingButton").first
    expect(clear_button).to_be_visible()

    clear_button.click()

    expect(app.get_by_test_id("stAudioInputRecordButton").first).to_be_visible()
    expect(clock).to_have_text("00:00")
