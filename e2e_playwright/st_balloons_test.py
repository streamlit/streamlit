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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import check_top_level_class


def test_balloons_are_present_on_page(app: Page):
    expect(app.get_by_test_id("stBalloons")).to_have_count(1)
    check_top_level_class(app, "stBalloons")


def test_balloons_animate_on_each_button_click(app: Page):
    """Test that balloons animate on each button click, not cached.

    Verifies that st.balloons() triggers animation on every button click,
    not skipped due to hash matching.
    """
    balloons = app.get_by_test_id("stBalloons")

    # Click button to show balloons (in addition to initial auto-balloons)
    app.get_by_role("button", name="Show more balloons", exact=True).click()

    # Wait for balloons to appear and counter to show
    expect(balloons).to_have_count(1)
    expect(app.get_by_text("Balloons shown: 1")).to_be_visible()

    wait_for_app_run(app)

    # Click button again - should trigger new animation
    app.get_by_role("button", name="Show more balloons", exact=True).click()

    # The counter should increment to 2
    expect(app.get_by_text("Balloons shown: 2")).to_be_visible()
    expect(balloons).to_have_count(1)

    wait_for_app_run(app)
