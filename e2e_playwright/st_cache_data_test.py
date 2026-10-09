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


import re
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    rerun_app,
    wait_for_app_run,
    wait_until,
)
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    get_button,
    get_image,
)

_BACKGROUND_REFRESH_STALE_WAIT_MS = 9000


@pytest.fixture(scope="module")
def app_server_extra_env(
    tmp_path_factory: pytest.TempPathFactory,
) -> dict[str, str]:
    release_file = tmp_path_factory.mktemp("st_cache_data") / "async-cache-release"
    return {"STREAMLIT_ASYNC_CACHE_DATA_RELEASE_FILE": str(release_file)}


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


@pytest.mark.only_browser("chromium")
def test_async_cache_data_miss_hit_spinner_and_replay(
    app: Page, app_server_extra_env: dict[str, str]
):
    release_file = Path(app_server_extra_env["STREAMLIT_ASYNC_CACHE_DATA_RELEASE_FILE"])
    release_file.unlink(missing_ok=True)

    get_button(app, "Run async cache_data E2E scenario").click()

    spinner = app.get_by_test_id("stSpinner").filter(
        has_text="Computing async cache_data value..."
    )
    expect(spinner).to_be_visible()
    release_file.touch()
    wait_for_app_run(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(app.get_by_text("Inside async cache_data: 1", exact=True)).to_be_visible()
    expect(app.get_by_text("Async cache_data result: 1", exact=True)).to_be_visible()

    rerun_app(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(app.get_by_text("Inside async cache_data: 1", exact=True)).to_be_visible()
    expect(app.get_by_text("Async cache_data result: 1", exact=True)).to_be_visible()
    expect(app.get_by_text("Inside async cache_data: 2", exact=True)).to_have_count(0)


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


def test_cached_code_replay(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the code is cached and replayed correctly with width and height."""
    code_element = app.get_by_test_id("stCode").first
    expect(code_element).to_be_visible()

    # Test dimensions with snapshots since the width/height is set on the element container.
    assert_snapshot(code_element, name="st_cache_data-st_code_before_caching")

    click_checkbox(app, "Show code")
    expect(code_element).not_to_be_attached()

    click_checkbox(app, "Show code")
    expect(code_element).to_be_visible()
    assert_snapshot(code_element, name="st_cache_data-st_code_after_caching")


def test_background_refresh_stale_while_revalidate(app: Page):
    click_button(app, "Run cache_data background refresh test")
    wait_for_app_run(app)

    # Initial miss computes the value, renders display output live, and warns that
    # display commands aren't replayed from a background-mode cache.
    expect(app.get_by_text("Background refresh value: 1")).to_be_visible()
    expect(app.get_by_text("Inside background cache_data function")).to_be_visible()
    expect(app.get_by_test_id("stException")).to_contain_text(
        "CachedStFunctionInBackgroundModeWarning"
    )

    # A fresh hit keeps the value and doesn't replay display output or the warning.
    rerun_app(app)
    expect(app.get_by_text("Background refresh value: 1")).to_be_visible()
    expect(app.get_by_text("Inside background cache_data function")).to_have_count(0)
    expect(app.get_by_test_id("stException")).to_have_count(0)

    # Enter the stale grace window ([ttl, 2 * ttl)), then verify that the stale value
    # is served without a spinner while the refresh runs in the background.
    app.wait_for_timeout(_BACKGROUND_REFRESH_STALE_WAIT_MS)
    rerun_app(app)
    expect(app.get_by_text("Background refresh value: 1")).to_be_visible()
    expect(app.get_by_test_id("stSpinner")).to_have_count(0)

    def value_refreshed() -> bool:
        rerun_app(app)
        return app.get_by_text("Background refresh value: 2").count() > 0

    wait_until(app, value_refreshed)
    expect(app.get_by_text("Background refresh value: 2")).to_be_visible()
    expect(app.get_by_text("Inside background cache_data function")).to_have_count(0)
