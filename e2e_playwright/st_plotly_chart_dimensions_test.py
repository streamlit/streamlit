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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class, get_element_by_key


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stPlotlyChart")


# Only run on chromium to reduce test time since visual differences between browsers
# should be minimal for dimension tests
@pytest.mark.only_browser("chromium")
def test_plotly_dimensions(app: Page, assert_snapshot: ImageCompareFunction):
    """Tests that width and height parameters work correctly."""
    plotly_elements = app.get_by_test_id("stPlotlyChart")
    expect(plotly_elements).to_have_count(8)

    # Width parameter tests
    assert_snapshot(plotly_elements.nth(0), name="st_plotly_chart-width_content")
    assert_snapshot(plotly_elements.nth(1), name="st_plotly_chart-width_stretch")
    assert_snapshot(plotly_elements.nth(2), name="st_plotly_chart-width_400px")
    assert_snapshot(plotly_elements.nth(3), name="st_plotly_chart-width_1000px_content")

    # Height parameter tests
    assert_snapshot(plotly_elements.nth(4), name="st_plotly_chart-height_content")

    # For height="stretch", snapshot the entire container to verify stretching behavior
    stretch_container = get_element_by_key(app, "test_height_stretch")
    assert_snapshot(stretch_container, name="st_plotly_chart-height_stretch")

    assert_snapshot(plotly_elements.nth(6), name="st_plotly_chart-height_300px")
    assert_snapshot(plotly_elements.nth(7), name="st_plotly_chart-height_600px_content")


def test_plotly_content_width_fullscreen(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test fullscreen behavior with width='content'."""
    index = 0  # First chart with width='content'
    themed_app.get_by_test_id("stPlotlyChart").nth(index).hover()
    fullscreen_button = themed_app.locator('[data-title="Fullscreen"]').nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()

    # Wait for fullscreen mode to activate
    expect(themed_app.get_by_test_id("stFullScreenFrame").nth(index)).to_have_css(
        "position", "fixed"
    )

    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-content_width_fullscreen",
    )

    fullscreen_button = themed_app.locator('[data-title="Close fullscreen"]').nth(0)
    fullscreen_button.hover()
    fullscreen_button.click()

    # Wait for fullscreen mode to deactivate
    expect(themed_app.get_by_test_id("stFullScreenFrame").nth(index)).not_to_have_css(
        "position", "fixed"
    )

    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-content_width_exited_fullscreen",
    )


def test_plotly_stretch_width_fullscreen(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test fullscreen behavior with width='stretch'."""
    index = 1  # Second chart with width='stretch'
    themed_app.get_by_test_id("stPlotlyChart").nth(index).hover()
    fullscreen_button = themed_app.locator('[data-title="Fullscreen"]').nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()

    # Wait for fullscreen mode to activate
    expect(themed_app.get_by_test_id("stFullScreenFrame").nth(index)).to_have_css(
        "position", "fixed"
    )

    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-stretch_width_fullscreen",
    )

    fullscreen_button = themed_app.locator('[data-title="Close fullscreen"]').nth(0)
    fullscreen_button.hover()
    fullscreen_button.click()

    # Wait for fullscreen mode to deactivate
    expect(themed_app.get_by_test_id("stFullScreenFrame").nth(index)).not_to_have_css(
        "position", "fixed"
    )

    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-stretch_width_exited_fullscreen",
    )
