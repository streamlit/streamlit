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


import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded
from e2e_playwright.shared.app_utils import check_top_level_class
from e2e_playwright.shared.theme_utils import apply_theme_via_window


# Only do chromium as this can create a lot of screenshots
# there should be no differences between chrome and safari and firefox
@pytest.mark.only_browser("chromium")
def test_plotly_has_consistent_visuals(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    snapshot_names = [
        "st_plotly_chart-none_theme",
        "st_plotly_chart-streamlit_theme",
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
        "st_plotly_chart-line_chart_specific_height_width",
    ]
    expect(themed_app.get_by_test_id("stPlotlyChart")).to_have_count(18)
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            themed_app.get_by_test_id("stPlotlyChart").nth(i),
            name=name,
        )


def test_plotly_content_width_fullscreen(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    index = 14
    themed_app.get_by_test_id("stPlotlyChart").nth(index).hover()
    fullscreen_button = themed_app.locator('[data-title="Fullscreen"]').nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-content_width_fullscreen",
    )

    fullscreen_button = themed_app.locator('[data-title="Close fullscreen"]').nth(0)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-content_width_exited_fullscreen",
    )


def test_plotly_stretch_width_fullscreen(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    index = 15
    themed_app.get_by_test_id("stPlotlyChart").nth(index).hover()
    fullscreen_button = themed_app.locator('[data-title="Fullscreen"]').nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-stretch_width_fullscreen",
    )

    fullscreen_button = themed_app.locator('[data-title="Close fullscreen"]').nth(0)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.get_by_test_id("stPlotlyChart").nth(index),
        name="st_plotly_chart-stretch_width_exited_fullscreen",
    )


def test_plotly_fullscreen_reset_axis(app: Page, assert_snapshot: ImageCompareFunction):
    index = 13
    chart = app.get_by_test_id("stPlotlyChart").nth(index)

    chart.hover()
    fullscreen_button = app.locator('[data-title="Fullscreen"]').nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()

    chart_bbox = chart.bounding_box()

    # Type narrowing: after the null check, mypy knows chart_bbox is not None
    assert chart_bbox is not None
    start_x = chart_bbox["x"] + chart_bbox["width"] * 0.3
    start_y = chart_bbox["y"] + chart_bbox["height"] * 0.4
    end_x = chart_bbox["x"] + chart_bbox["width"] * 0.7
    end_y = chart_bbox["y"] + chart_bbox["height"] * 0.6
    app.mouse.move(start_x, start_y)
    app.mouse.down()
    app.mouse.move(end_x, end_y)
    app.mouse.up()

    # Assert snapshot after zoom selection to verify the zoom was applied
    assert_snapshot(
        chart,
        name="st_plotly_chart-fullscreen_zoomed_selection",
    )

    exit_fullscreen_button = app.locator('[data-title="Close fullscreen"]').nth(0)
    exit_fullscreen_button.hover()
    exit_fullscreen_button.click()

    # Find and click the reset axes button (usually appears as "Reset axes" or similar)
    reset_button = app.locator('[data-title="Reset axes"]').nth(0)
    reset_button.hover()
    reset_button.click()

    assert_snapshot(
        chart,
        name="st_plotly_chart-fullscreen_reset_axis",
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
    check_top_level_class(app, "stPlotlyChart")


def test_plotly_with_custom_theme(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that plotly chart adjusts for custom theme."""
    # Apply custom theme using window injection
    apply_theme_via_window(
        app,
        base="light",
        chartCategoricalColors=[
            "#ff7f0e",  # orange
            "#2ca02c",  # green
            "#1f77b4",  # blue
            "#d62728",
            "#9467bd",
            "#8c564b",
            "#e377c2",
            "#7f7f7f",
            "#bcbd22",
            "#17becf",
        ],
    )

    # Reload to apply the theme
    app.reload()
    wait_for_app_loaded(app)

    plotly_elements = app.get_by_test_id("stPlotlyChart")
    expect(plotly_elements).to_have_count(18)

    # Take a snapshot of the single mark chart, shows it applies the first color
    # from chartCategoricalColors (orange):
    assert_snapshot(plotly_elements.nth(6), name="st_plotly_chart-custom-theme")


def test_plotly_dimensions(app: Page, assert_snapshot: ImageCompareFunction):
    """Tests that width and height parameters work correctly."""
    plotly_elements = app.get_by_test_id("stPlotlyChart")
    expect(plotly_elements).to_have_count(18)

    assert_snapshot(plotly_elements.nth(14), name="st_plotly_chart-width_content")
    assert_snapshot(plotly_elements.nth(15), name="st_plotly_chart-width_stretch")
    assert_snapshot(plotly_elements.nth(16), name="st_plotly_chart-width_400px")
    assert_snapshot(
        plotly_elements.nth(17), name="st_plotly_chart-width_1000px_content"
    )
