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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import rerun_app, wait_for_app_run
from e2e_playwright.shared.app_utils import click_button, click_checkbox, get_image


def test_that_caching_shows_cached_widget_warning(app: Page):
    click_button(app, "Run cached function with widget warning")
    wait_for_app_run(app)
    expect(app.get_by_test_id("stException")).to_have_count(1)

    exception_element = app.get_by_test_id("stException").nth(0)
    expect(exception_element).to_contain_text("CachedWidgetWarning: Your script uses")


def test_that_nested_cached_function_shows_cached_widget_warning(app: Page):
    click_button(app, "Run nested cached function with widget warning")
    expect(app.get_by_test_id("stException")).to_have_count(2)

    expect(app.get_by_test_id("stException").nth(0)).to_contain_text(
        "CachedWidgetWarning: Your script uses"
    )
    expect(app.get_by_test_id("stException").nth(1)).to_contain_text(
        "CachedWidgetWarning: Your script uses"
    )


def test_that_replay_element_works_as_expected(app: Page):
    click_button(app, "Cached function with element replay")
    expect(app.get_by_test_id("stException")).to_have_count(0)
    expect(app.get_by_text("Cache executions: 1")).to_be_visible()
    expect(app.get_by_text("Cache return 1")).to_be_visible()

    # Execute again, the values should be the same:
    click_button(app, "Cached function with element replay")
    expect(app.get_by_test_id("stException")).to_have_count(0)
    expect(app.get_by_text("Cache executions: 1")).to_be_visible()
    expect(app.get_by_text("Cache return 1")).to_be_visible()


# have 1 test so we don't have to reload the video
def test_st_audio_player_and_video_player(app: Page):
    audio = app.get_by_test_id("stAudio")

    expect(audio).to_be_visible()
    expect(audio).to_have_attribute("controls", "")
    expect(audio).to_have_attribute("src", re.compile(r"^.*\.wav$", re.IGNORECASE))
    audio_src = audio.get_attribute("src")

    video_player = app.get_by_test_id("stVideo")
    expect(video_player).to_be_visible()
    expect(video_player).to_have_attribute(
        "src", re.compile(r"^.*\.mp4$", re.IGNORECASE)
    )
    video_src = video_player.get_attribute("src")

    rerun_app(app)

    expect(audio).to_have_attribute("src", audio_src or "")
    expect(video_player).to_have_attribute("src", video_src or "")


def test_cached_image_replay(app: Page):
    """Test that the image is cached and replayed correctly."""
    image_element = get_image(app, "A black square").locator("img")
    # Image should be visible
    expect(image_element).to_be_visible()

    expect(image_element).to_have_css("height", "200px")
    expect(image_element).to_have_css("width", "200px")
    image_src = image_element.get_attribute("src")

    click_checkbox(app, "Show image")
    # Image should disappear
    expect(image_element).not_to_be_attached()

    click_checkbox(app, "Show image")
    # Image should be visible again
    expect(image_element).to_be_visible()
    expect(image_element).to_have_css("height", "200px")
    expect(image_element).to_have_css("width", "200px")
    expect(image_element).to_have_attribute("src", image_src or "")
