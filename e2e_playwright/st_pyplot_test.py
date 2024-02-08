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


from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def test_displays_a_pyplot_figures(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that all pyplot figures are displayed correctly via screenshot matching."""
    pyplot_elements = app.get_by_test_id("stImage")
    assert_snapshot(pyplot_elements.nth(0), name="st_pyplot-figures")


def test_clears_the_figure_on_rerun(app: Page, assert_snapshot):
    """Test that the pyplot figure is cleared on rerun."""
    app.locator("[data-testid='stAppRerunButton']").click()

    # Waiting for the 'data-stale' attribute to become 'false'
    app.wait_for_selector(".element-container[data-stale='false']")

    first_image = app.locator("[data-testid='stImage'] > img").first()
    assert_snapshot(first_image, name="pyplot-check-if-cleared")


def test_that_hiding_deprecation_warning_works(app: Page):
    """Test that the deprecation warning & config works correctly."""
    deprecation_message = app.get_by_text("PyplotGlobalUseWarning")
    expect(deprecation_message).to_have_count(1)


def test_use_container_width_false_displays_smaller_image(app: Page):
    """Test if 'use_container_width=False' renders a smaller image than 'use_container_width=True'."""
    large_image = app.get_by_test_id("stImage").nth(2).locator("img")
    expect(large_image).to_have_css("width", "1200px")

    small_image = app.get_by_test_id("stImage").nth(3).locator("img")
    expect(small_image).to_have_css("width", "342px")
