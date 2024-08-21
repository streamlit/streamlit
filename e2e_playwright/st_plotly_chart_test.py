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
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


# Only do chromium as this can create a lot of screenshots
# there should be no differences between chrome and safari and firefox
@pytest.mark.only_browser("chromium")
def test_plotly_has_consistent_visuals(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    snapshot_names = [
        "st_plotly_chart-none_theme",
        "st_plotly_chart-streamlit_theme_use_container_width",
        "st_plotly_chart-candlestick_streamlit_theme",
        "st_plotly_chart-sunburst_custom_color",
        "st_plotly_chart-contour_heatmap_together",
        "st_plotly_chart-waterfall_chart_custom_height_and_width",
        "st_plotly_chart-ternary_chart",
        "st_plotly_chart-table_plot",
        "st_plotly_chart-electric_colorscale",
        "st_plotly_chart-discrete_sequence",
        "st_plotly_chart-layout_customization",
        "st_plotly_chart-template_customization",
        "st_plotly_chart-histogram_chart",
    ]
    expect(themed_app.get_by_test_id("stPlotlyChart")).to_have_count(16)
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            themed_app.get_by_test_id("stPlotlyChart").nth(i),
            name=name,
        )


def test_plotly_has_correct_visuals(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    snapshot_names = [
        "st_plotly_chart-line_chart_specific_height_width",
        "st_plotly_chart-use_container_width_false_and_specified_height",
        "st_plotly_chart-none_theme_and_use_container_width",
    ]
    plotly_indices = [13, 14, 15]
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            themed_app.get_by_test_id("stPlotlyChart").nth(plotly_indices[i]),
            name=name,
        )


def test_plotly_use_container_width_false_fullscreen(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    index = 14
    themed_app.get_by_test_id("stPlotlyChart").nth(index).hover()
    fullscreen_button = themed_app.locator('[data-title="Fullscreen"]').nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-container_width_false_fullscreen",
    )

    fullscreen_button = themed_app.locator('[data-title="Close fullscreen"]').nth(0)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-container_width_false_exited_fullscreen",
    )


def test_plotly_use_container_width_true_fullscreen(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    index = 15
    themed_app.get_by_test_id("stPlotlyChart").nth(index).hover()
    fullscreen_button = themed_app.locator('[data-title="Fullscreen"]').nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-container_width_true_fullscreen",
    )

    fullscreen_button = themed_app.locator('[data-title="Close fullscreen"]').nth(0)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-container_width_true_exited_fullscreen",
    )


def test_allows_custom_toolbar_modifications(
    app: Page, assert_snapshot: ImageCompareFunction
):
    chart_element = app.get_by_test_id("stPlotlyChart").nth(1)
    chart_element.hover()
    assert_snapshot(
        chart_element,
        name="st_plotly_chart-toolbar_customization",
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    expect(app.get_by_test_id("stPlotlyChart").first).to_have_class("stPlotlyChart")
