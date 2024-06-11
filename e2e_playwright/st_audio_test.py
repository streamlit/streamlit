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
import re

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run, wait_until


def test_audio_has_correct_properties(app: Page):
    """Test that `st.audio` renders correct properties."""
    audio_elements = app.get_by_test_id("stAudio")
    expect(audio_elements).to_have_count(4)

    expect(audio_elements.nth(0)).to_be_visible()
    expect(audio_elements.nth(0)).to_have_attribute("controls", "")
    expect(audio_elements.nth(0)).to_have_attribute("src", re.compile(r".*media.*wav"))


@pytest.mark.skip_browser("webkit")
def test_audio_end_time(app: Page):
    """Test that `st.audio` end_time property works correctly."""
    audio_elements = app.get_by_test_id("stAudio")
    expect(audio_elements).to_have_count(4)

    expect(audio_elements.nth(1)).to_be_visible()

    audio_element = audio_elements.nth(1)
    audio_element.evaluate("el => el.play()")
    app.wait_for_timeout(5000)
    expect(audio_element).to_have_js_property("paused", True)
    wait_until(app, lambda: int(audio_element.evaluate("el => el.currentTime")) == 13)


@pytest.mark.skip_browser("webkit")
def test_audio_end_time_loop(app: Page):
    """Test that `st.audio` end_time and loop properties work correctly."""
    audio_elements = app.get_by_test_id("stAudio")
    expect(audio_elements).to_have_count(4)

    expect(audio_elements.nth(2)).to_be_visible()

    audio_element = audio_elements.nth(2)
    audio_element.evaluate("el => el.play()")
    # The corresponding element definition looks like this:
    # st.audio(url2, start_time=15, end_time=19, loop=True)
    # We wait for 6 seconds, which mean the current time should be
    # approximately 17 (4 seconds until end_time and 2 seconds starting from start time)
    app.wait_for_timeout(6000)
    expect(audio_element).to_have_js_property("paused", False)
    wait_until(app, lambda: 16 < audio_element.evaluate("el => el.currentTime") < 18)


def test_audio_autoplay(app: Page):
    """Test that `st.audio` autoplay property works correctly."""
    audio_elements = app.get_by_test_id("stAudio")
    expect(audio_elements).to_have_count(4)

    expect(audio_elements.nth(3)).to_be_visible()

    audio_element = audio_elements.nth(3)
    expect(audio_element).to_have_js_property("paused", True)
    expect(audio_element).to_have_js_property("autoplay", False)

    checkbox_element = app.get_by_test_id("stCheckbox")
    autoplay_checkbox = checkbox_element.nth(0)
    autoplay_checkbox.click()
    # To prevent flakiness, we wait for the audio to load and start playing
    wait_until(app, lambda: audio_element.evaluate("el => el.readyState") == 4)
    expect(audio_element).to_have_js_property("autoplay", True)
    expect(audio_element).to_have_js_property("paused", False)


def test_audio_remount_no_autoplay(app: Page):
    """Test that `st.audio` remounts correctly without autoplay."""
    audio_elements = app.get_by_test_id("stAudio")
    expect(audio_elements).to_have_count(4)

    expect(audio_elements.nth(3)).to_be_visible()

    audio_element = audio_elements.nth(3)
    expect(audio_element).to_have_js_property("paused", True)
    expect(audio_element).to_have_js_property("autoplay", False)

    checkbox_element = app.get_by_test_id("stCheckbox")
    autoplay_checkbox = checkbox_element.nth(0)
    autoplay_checkbox.click()
    # To prevent flakiness, we wait for the audio to load and start playing
    wait_until(app, lambda: audio_element.evaluate("el => el.readyState") == 4)
    expect(audio_element).to_have_js_property("autoplay", True)
    expect(audio_element).to_have_js_property("paused", False)

    autoplay_checkbox.click()

    button_element = app.get_by_test_id("stButton").locator("button").first
    expect(app.get_by_test_id("stMarkdownContainer").nth(1)).to_have_text(
        "Create some elements to unmount component"
    )
    button_element.click()
    wait_for_app_run(app)

    expect(audio_element).to_have_js_property("autoplay", False)
    expect(audio_element).to_have_js_property("paused", True)
