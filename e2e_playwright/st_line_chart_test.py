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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_for_app_loaded,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import get_element_by_key
from e2e_playwright.shared.theme_utils import apply_theme_via_window
from e2e_playwright.shared.vega_utils import (
    assert_vega_chart_height,
    assert_vega_chart_width,
)

TOTAL_LINE_CHARTS = 16


def test_line_chart_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.line_chart renders correctly via snapshot testing."""
    line_chart_elements = app.get_by_test_id("stVegaLiteChart")
    expect(line_chart_elements).to_have_count(TOTAL_LINE_CHARTS)

    # Also make sure that all Vega display objects are rendered:
    expect(line_chart_elements.locator("[role='graphics-document']")).to_have_count(
        TOTAL_LINE_CHARTS
    )

    assert_snapshot(line_chart_elements.nth(0), name="st_line_chart-empty_chart")
    assert_snapshot(line_chart_elements.nth(1), name="st_line_chart-basic_df")
    assert_snapshot(line_chart_elements.nth(2), name="st_line_chart-single_x_axis")
    assert_snapshot(line_chart_elements.nth(3), name="st_line_chart-single_y_axis")
    assert_snapshot(line_chart_elements.nth(4), name="st_line_chart-multiple_y_axis")
    assert_snapshot(line_chart_elements.nth(5), name="st_line_chart-fixed_dimensions")
    assert_snapshot(
        line_chart_elements.nth(6), name="st_line_chart-single_x_axis_single_y_axis"
    )
    assert_snapshot(
        line_chart_elements.nth(7), name="st_line_chart-single_x_axis_multiple_y_axis"
    )
    assert_snapshot(line_chart_elements.nth(8), name="st_line_chart-utc_df")
    assert_snapshot(
        line_chart_elements.nth(9), name="st_line_chart-custom_color_labels"
    )
    assert_snapshot(
        line_chart_elements.nth(10), name="st_line_chart-custom_axis_labels"
    )
    # Charts tested separately:
    # - index 11: column_order chart in test_column_order_with_colors
    # - index 12: width=content chart in test_line_chart_width_height
    # - index 13: height=stretch chart in test_line_chart_width_height
    # - index 14: fixed width in horizontal container in test_fixed_width_in_horizontal_container
    # - index 15: add_rows chart in test_add_rows_preserves_styling


def test_line_chart_width_height(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.line_chart renders correctly with different width and height."""
    content_width_chart = app.get_by_test_id("stVegaLiteChart").nth(12)

    expect(content_width_chart.locator("[role='graphics-document']")).to_have_count(1)
    assert_snapshot(
        content_width_chart,
        name="st_line_chart-width_content",
    )

    stretch_height_chart_container = get_element_by_key(app, "test_height_stretch")
    expect(
        stretch_height_chart_container.locator("[role='graphics-document']")
    ).to_have_count(1)
    assert_snapshot(
        stretch_height_chart_container,
        name="st_line_chart-height_stretch",
    )


def test_fixed_width_in_horizontal_container(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.line_chart renders correctly with fixed width in horizontal container."""
    fixed_width_chart_container = get_element_by_key(
        app, "test_fixed_width_in_horizontal_container"
    )

    expect(
        fixed_width_chart_container.locator("[role='graphics-document']")
    ).to_have_count(1)
    assert_snapshot(
        fixed_width_chart_container,
        name="st_line_chart-fixed_width_in_horizontal_container",
    )


def test_content_width_chart_show_data(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that content width line chart shows data correctly when toggled to dataframe view."""
    all_charts = app.get_by_test_id("stVegaLiteChart")
    expect(all_charts).to_have_count(16)

    content_width_chart = all_charts.nth(12)
    expect(content_width_chart).to_be_visible()
    expect(content_width_chart.locator("[role='graphics-document']")).to_be_visible()

    # Get toolbar from parent container (standard DOM structure for Vega-Lite charts)
    toolbar = content_width_chart.locator("..").get_by_test_id("stElementToolbar")
    expect(toolbar).to_be_attached()

    content_width_chart.hover(force=True)
    toolbar_buttons = toolbar.get_by_test_id("stElementToolbarButton")

    expect(toolbar_buttons.get_by_label("Show Data")).to_be_visible()
    toolbar_buttons.get_by_label("Show Data").click()

    dataframe = app.get_by_test_id("stDataFrame")
    expect(dataframe).to_be_visible()

    assert_snapshot(dataframe, name="st_line_chart-content_width_show_data")


def test_themed_line_chart_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.line_chart renders with different theming."""
    line_chart_elements = themed_app.get_by_test_id("stVegaLiteChart")
    expect(line_chart_elements).to_have_count(TOTAL_LINE_CHARTS)

    # Also make sure that all Vega display objects are rendered:
    expect(line_chart_elements.locator("[role='graphics-document']")).to_have_count(
        TOTAL_LINE_CHARTS
    )

    # Only test a single chart per built-in chart type:
    assert_snapshot(line_chart_elements.nth(1), name="st_line_chart_themed")


def test_multi_line_hover(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that hovering on a st.line_chart shows chart markers on all lines and
    a tooltip.
    """

    multi_line_chart = app.get_by_test_id("stVegaLiteChart").nth(1)
    expect(multi_line_chart).to_be_visible()

    multi_line_chart.scroll_into_view_if_needed()
    multi_line_chart.locator("[role='graphics-document']").hover(
        position={"x": 100, "y": 100}, force=True
    )

    expect(app.locator("#vg-tooltip-element")).to_be_visible()

    assert_snapshot(multi_line_chart, name="st_line_chart-multi_line_hover")


def test_single_line_hover(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that hovering on a st.line_chart shows chart markers and a tooltip."""

    single_line_chart = app.get_by_test_id("stVegaLiteChart").nth(3)
    expect(single_line_chart).to_be_visible()

    single_line_chart.scroll_into_view_if_needed()
    single_line_chart.locator("[role='graphics-document']").hover(
        position={"x": 100, "y": 100}, force=True
    )

    expect(app.locator("#vg-tooltip-element")).to_be_visible()
    assert_snapshot(single_line_chart, name="st_line_chart-single_line_hover")


# Issue #11312 - add_rows should preserve styling params
def test_add_rows_preserves_styling(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that add_rows preserves the original styling params (color, width, height,
    use_container_width) and that dimensions are maintained after fullscreen mode.
    """
    add_rows_chart = app.get_by_test_id("stVegaLiteChart").nth(15)
    expect(add_rows_chart).to_be_visible()

    # Click the button to add data to the chart
    app.get_by_text("Add data to Line Chart").click()
    wait_for_app_run(app)

    # Wait for the chart to update
    vega_display = add_rows_chart.locator("[role='graphics-document']")
    expect(vega_display).to_be_visible()

    # Check that the chart has the correct styling params
    assert_vega_chart_width(add_rows_chart, 600)
    assert_vega_chart_height(add_rows_chart, 300)

    assert_snapshot(add_rows_chart, name="st_line_chart-add_rows_preserves_styling")

    # Test fullscreen mode - this tests if the width/height is correctly set on
    # the stElementContainer after adding rows to an empty chart.
    widget_toolbar = add_rows_chart.locator("..").get_by_test_id("stElementToolbar")
    fullscreen_button = widget_toolbar.get_by_test_id("stElementToolbarButton").last

    add_rows_chart.hover()
    expect(widget_toolbar).to_have_css("opacity", "1")

    fullscreen_button.click()
    expect(
        widget_toolbar.get_by_role("button", name="Close fullscreen")
    ).to_be_visible()

    fullscreen_button.click()
    expect(widget_toolbar.get_by_role("button", name="Fullscreen")).to_be_visible()

    # Wait a moment for dimensions to stabilize
    app.wait_for_timeout(100)

    # Verify dimensions are restored after exiting fullscreen
    assert_vega_chart_width(add_rows_chart, 600)
    assert_vega_chart_height(add_rows_chart, 300)

    assert_snapshot(add_rows_chart, name="st_line_chart-add_rows_after_fullscreen")


def test_column_order_with_colors(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that column order is preserved when using y and color parameters.

    This is a regression test for issue #12071 where columns were being
    reordered alphabetically instead of preserving the order specified in y parameter.
    """
    column_order_chart = app.get_by_test_id("stVegaLiteChart").nth(11)
    expect(column_order_chart).to_be_visible()

    # The chart should have 3 lines in the specified order
    vega_display = column_order_chart.locator("[role='graphics-document']")
    expect(vega_display).to_be_visible()

    # Hover to show tooltip and verify the order
    vega_display.hover(position={"x": 50, "y": 100}, force=True)

    # Snapshot the chart to verify colors are applied in correct order
    assert_snapshot(column_order_chart, name="st_line_chart-column_order_preserved")


def test_line_chart_with_custom_theme(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that line chart adjusts for custom theme."""
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

    line_chart_elements = app.get_by_test_id("stVegaLiteChart")
    expect(line_chart_elements).to_have_count(TOTAL_LINE_CHARTS)

    # Take a snapshot of the single line chart, shows it applies the first color
    # from chartCategoricalColors (orange):
    assert_snapshot(line_chart_elements.nth(3), name="st_line_chart-custom-theme")
