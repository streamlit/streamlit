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
import re

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_checkbox,
)

AUDIO_ELEMENTS_WITH_PATH = 3
AUDIO_ELEMENTS_WITH_URL = 3


def check_audio_source_error_count(messages: list[str], expected_count: int):
    """Check that the expected number of audio source error messages are logged."""
    assert (
        len(
            [
                message
                for message in messages
                if "Client Error: Audio source error" in message
            ]
        )
        # when test run on webkit, it will sometimes log extra instances of the error
        # for the same source - so we use >= expected_count to avoid flakiness
        >= expected_count
    )


def test_audio_has_correct_properties(app: Page):
    """Test that `st.audio` renders correct properties."""
    audio_elements = app.get_by_test_id("stAudio")
    expect(audio_elements).to_have_count(8)
    expect(audio_elements.nth(0)).to_be_visible()
    expect(audio_elements.nth(0)).to_have_attribute("controls", "")
    expect(audio_elements.nth(0)).to_have_attribute("src", re.compile(r".*media.*wav"))


@pytest.mark.skip_browser("webkit")
def test_audio_end_time(app: Page):
    """Test that `st.audio` end_time property works correctly."""
    audio_element = app.get_by_test_id("stAudio").nth(1)
    expect(audio_element).to_be_visible()
    audio_element.evaluate("el => el.play()")
    app.wait_for_timeout(5000)
    expect(audio_element).to_have_js_property("paused", True)
    wait_until(app, lambda: int(audio_element.evaluate("el => el.currentTime")) == 13)


@pytest.mark.skip_browser("webkit")
def test_audio_end_time_loop(app: Page):
    """Test that `st.audio` end_time and loop properties work correctly."""
    audio_element = app.get_by_test_id("stAudio").nth(2)
    audio_element.evaluate("el => el.play()")
    # The corresponding element definition looks like this:
    # > st.audio(url2, start_time=15, end_time=19, loop=True)
    # We wait for 6 seconds, which mean the current time should be
    # approximately 17 (4 seconds until end_time and 2 seconds starting from start time)
    app.wait_for_timeout(6000)
    expect(audio_element).to_have_js_property("paused", False)
    wait_until(app, lambda: 16 < audio_element.evaluate("el => el.currentTime") < 18)


def test_audio_autoplay(app: Page):
    """Test that `st.audio` autoplay property works correctly."""
    audio_element = app.get_by_test_id("stAudio").nth(5)
    expect(audio_element).to_have_js_property("paused", True)
    expect(audio_element).to_have_js_property("autoplay", False)

    # To prevent flakiness, we wait for the audio to load and start playing
    wait_until(
        app, lambda: audio_element.evaluate("el => el.readyState") == 4, timeout=15000
    )

    click_checkbox(app, "Autoplay")

    expect(audio_element).to_have_js_property("autoplay", True)
    expect(audio_element).to_have_js_property("paused", False)


@pytest.mark.skip_browser("firefox")
def test_audio_width_configurations(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that `st.audio` width configurations are applied correctly."""
    audio_pixel_width = app.get_by_test_id("stAudio").nth(6)
    wait_until(
        app,
        lambda: audio_pixel_width.evaluate("el => el.readyState") == 4,
        timeout=15000,
    )
    # Hide the timeline to prevent flakiness in screenshots
    hide_timeline_style = """
    audio::-webkit-media-controls-timeline { display: none; }
    """
    assert_snapshot(
        audio_pixel_width, name="st_audio-width_300px", style=hide_timeline_style
    )

    audio_stretch_width = app.get_by_test_id("stAudio").nth(7)
    wait_until(
        app,
        lambda: audio_stretch_width.evaluate("el => el.readyState") == 4,
        timeout=15000,
    )

    assert_snapshot(
        audio_stretch_width, name="st_audio-width_stretch", style=hide_timeline_style
    )


def test_audio_remount_no_autoplay(app: Page):
    """Test that `st.audio` remounts correctly without autoplay."""
    audio_element = app.get_by_test_id("stAudio").nth(5)
    expect(audio_element).to_have_js_property("paused", True)
    expect(audio_element).to_have_js_property("autoplay", False)

    # To prevent flakiness, we wait for the audio to load and start playing
    wait_until(
        app, lambda: audio_element.evaluate("el => el.readyState") == 4, timeout=15000
    )

    click_checkbox(app, "Autoplay")

    expect(audio_element).to_have_js_property("autoplay", True)
    expect(audio_element).to_have_js_property("paused", False)

    click_checkbox(app, "Autoplay")
    click_button(app, "Create some elements to unmount component")

    expect(audio_element).to_have_js_property("autoplay", False)
    expect(audio_element).to_have_js_property("paused", True)


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stAudio")


def test_audio_uses_unified_height(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Check that the audio component uses our default element height."""
    audio_element = themed_app.get_by_test_id("stAudio").first

    # To prevent flakiness, we wait for the audio to finish loading:
    wait_until(
        themed_app,
        lambda: audio_element.evaluate("el => el.readyState") == 4,
        timeout=15000,
    )

    expect(audio_element).to_have_css("height", "40px")
    # Additional wait to ensure that the audio element is fully loaded
    # and that its not causing flakiness in screenshots.
    # This might not be 100% necessary.
    themed_app.wait_for_timeout(1000)

    assert_snapshot(audio_element, name="st_audio-unified_height")


# TODO(mgbarnes): Figure out why this test is flaky on firefox & webkit.
@pytest.mark.only_browser("chromium")
def test_audio_source_error_with_url(app: Page, app_port: int):
    """Test `st.audio` source error when data is a url."""
    # Ensure audio source request return a 404 status
    app.route(
        "https://mdn.github.io/learning-area/html/multimedia-and-embedding/video-and-audio-content/viper.mp3",
        lambda route: route.fulfill(
            status=404, headers={"Content-Type": "text/plain"}, body="Not Found"
        ),
    )

    # Capture console messages
    messages = []
    app.on("console", lambda msg: messages.append(msg.text))

    # Navigate to the app
    app.goto(f"http://localhost:{app_port}")

    # Wait until the expected error is logged, indicating CLIENT_ERROR was sent
    # Should be 3 instances of the error, one for each audio element with url
    wait_until(
        app, lambda: check_audio_source_error_count(messages, AUDIO_ELEMENTS_WITH_URL)
    )


# TODO(mgbarnes): Figure out why this test is flaky on firefox & webkit.
@pytest.mark.only_browser("chromium")
def test_audio_source_error_with_path(app: Page, app_port: int):
    """Test `st.audio` source error when data is path (media endpoint)."""
    # Ensure audio source request return a 404 status
    app.route(
        f"http://localhost:{app_port}/media/**",
        lambda route: route.fulfill(
            status=404, headers={"Content-Type": "text/plain"}, body="Not Found"
        ),
    )

    # Capture console messages
    messages = []
    app.on("console", lambda msg: messages.append(msg.text))

    # Navigate to the app
    app.goto(f"http://localhost:{app_port}")

    # Wait until the expected errors are logged, indicating CLIENT_ERROR was sent
    # Should be 3 instances of the error, one for each audio element with path
    wait_until(
        app, lambda: check_audio_source_error_count(messages, AUDIO_ELEMENTS_WITH_PATH)
    )
