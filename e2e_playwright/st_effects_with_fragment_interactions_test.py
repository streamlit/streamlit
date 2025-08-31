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

from functools import partial

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_until
from e2e_playwright.shared.animation_utils import (
    assert_animation_is_hidden,
    check_if_onscreen,
    wait_for_animation_to_be_hidden,
)


def test_balloons_visibility_with_fragment_interactions(app: Page):
    """Tests the visibility behavior of st.balloons when interacting with
    components in an @st.fragment.

    Specifically, it tests that:
    1. Balloons appear when triggered.
    2. Balloons disappear after a short time.
    3. Balloons remain hidden after a fragment rerun.
    4. Balloons appear after a full page rerun.

    See: https://github.com/streamlit/streamlit/issues/10961
    """
    expect(app.get_by_test_id("stBalloons")).to_have_count(0)

    # Trigger the balloons
    app.click("button:has-text('Balloons')")
    expect(app.get_by_test_id("stBalloons")).to_have_count(1)

    # Expect the balloons set to be visible on screen
    animation_images = app.get_by_test_id("stBalloons").nth(0).locator("img")
    wait_until(
        app,
        partial(check_if_onscreen, app, animation_images.first),
        timeout=5000,
    )

    # Assert that all balloon images are not visible after some time
    wait_for_animation_to_be_hidden(app, animation_images)

    # Trigger the fragment re-run by changing the select box value
    selectbox = app.get_by_test_id("stSelectbox").nth(0).locator("input")
    selectbox.click()
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").nth(1).click()

    # Wait briefly to be sure that the animations aren't running
    app.wait_for_timeout(500)

    # Assert that all balloon images are not visible
    assert_animation_is_hidden(app, animation_images)

    # Trigger a full page re-run, which should trigger the fragment again
    app.click("button:has-text('Balloons')")

    # Expect the first balloon image to be visible
    animation_images = app.get_by_test_id("stBalloons").nth(0).locator("img")
    wait_until(
        app,
        partial(check_if_onscreen, app, animation_images.first),
        timeout=5000,
    )


def test_snow_visibility_with_fragment_interactions(app: Page):
    """Tests the visibility behavior of st.snow when interacting with
    components in an @st.fragment.

    Specifically, it tests that:
    1. Snow appears when triggered.
    2. Snow disappears after a short time.
    3. Snow remains hidden after a fragment rerun.
    4. Snow appears after a full page rerun.

    See: https://github.com/streamlit/streamlit/issues/10961
    """
    expect(app.get_by_test_id("stSnow")).to_have_count(0)

    # Trigger the snow
    app.click("button:has-text('Snow')")
    expect(app.get_by_test_id("stSnow")).to_have_count(1)

    # Expect the snow to be visible on screen
    animation_images = app.get_by_test_id("stSnow").nth(0).locator("img")
    wait_until(
        app,
        partial(check_if_onscreen, app, animation_images.first),
        timeout=5000,
    )

    # Assert that all snow images are not visible after some time
    wait_for_animation_to_be_hidden(app, animation_images)

    # Trigger the fragment re-run by changing the select box value
    selectbox = app.get_by_test_id("stSelectbox").nth(0).locator("input")
    selectbox.click()
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").nth(1).click()

    # Wait briefly to be sure that the animations aren't running
    app.wait_for_timeout(500)

    # Assert that all snow images are not visible
    assert_animation_is_hidden(app, animation_images)

    # Trigger a full page re-run, which should trigger the fragment again
    app.click("button:has-text('Snow')")

    # Expect the first snow image to be visible
    animation_images = app.get_by_test_id("stSnow").nth(0).locator("img")
    wait_until(
        app,
        partial(check_if_onscreen, app, animation_images.first),
        timeout=5000,
    )
