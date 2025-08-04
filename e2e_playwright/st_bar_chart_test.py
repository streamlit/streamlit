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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import check_top_level_class
from e2e_playwright.shared.vega_utils import (
    assert_vega_chart_height,
    assert_vega_chart_width,
)

TOTAL_BAR_CHARTS = 19


def test_bar_chart_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.bar_chart renders correctly via snapshot testing."""
    bar_chart_elements = app.get_by_test_id("stVegaLiteChart")
    expect(bar_chart_elements).to_have_count(TOTAL_BAR_CHARTS)

    # Also make sure that all Vega display objects are rendered:
    expect(bar_chart_elements.locator("[role='graphics-document']")).to_have_count(
        TOTAL_BAR_CHARTS
    )

    # Take individual snapshots for each chart with meaningful names
    assert_snapshot(bar_chart_elements.nth(0), name="st_bar_chart-empty_chart")
    assert_snapshot(bar_chart_elements.nth(1), name="st_bar_chart-basic_df")
    assert_snapshot(bar_chart_elements.nth(2), name="st_bar_chart-single_x_axis")
    assert_snapshot(bar_chart_elements.nth(3), name="st_bar_chart-single_y_axis")
    assert_snapshot(bar_chart_elements.nth(4), name="st_bar_chart-multiple_y_axis")
    assert_snapshot(bar_chart_elements.nth(5), name="st_bar_chart-fixed_dimensions")
    assert_snapshot(
        bar_chart_elements.nth(6), name="st_bar_chart-single_x_axis_single_y_axis"
    )
    assert_snapshot(
        bar_chart_elements.nth(7), name="st_bar_chart-single_x_axis_multiple_y_axis"
    )
    assert_snapshot(bar_chart_elements.nth(8), name="st_bar_chart-utc_df")
    assert_snapshot(bar_chart_elements.nth(9), name="st_bar_chart-custom_color_labels")
    assert_snapshot(bar_chart_elements.nth(10), name="st_bar_chart-custom_axis_labels")
    assert_snapshot(bar_chart_elements.nth(11), name="st_bar_chart-horizontal")
    assert_snapshot(
        bar_chart_elements.nth(12), name="st_bar_chart-horizontal_custom_axis_labels"
    )
    assert_snapshot(bar_chart_elements.nth(13), name="st_bar_chart-stacked_true")
    assert_snapshot(bar_chart_elements.nth(14), name="st_bar_chart-stacked_false")
    assert_snapshot(bar_chart_elements.nth(15), name="st_bar_chart-stacked_normalize")
    assert_snapshot(bar_chart_elements.nth(16), name="st_bar_chart-stacked_center")
    assert_snapshot(bar_chart_elements.nth(17), name="st_bar_chart-stacked_layered")
    # The add_rows chart (index 18) is tested separately in test_add_rows_preserves_styling


def test_themed_bar_chart_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.bar_chart renders with different theming."""
    bar_chart_elements = themed_app.get_by_test_id("stVegaLiteChart")
    expect(bar_chart_elements).to_have_count(TOTAL_BAR_CHARTS)

    # Also make sure that all Vega display objects are rendered:
    expect(bar_chart_elements.locator("[role='graphics-document']")).to_have_count(
        TOTAL_BAR_CHARTS
    )

    # Only test a single chart per built-in chart type:
    assert_snapshot(bar_chart_elements.nth(1), name="st_bar_chart_themed")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stVegaLiteChart")


# Issue #11312 - add_rows should preserve styling params
def test_add_rows_preserves_styling(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that add_rows preserves the original styling params (color, width, height,
    use_container_width, horizontal, stack).
    """
    add_rows_chart = app.get_by_test_id("stVegaLiteChart").nth(18)
    expect(add_rows_chart).to_be_visible()

    # Click the button to add data to the chart
    app.get_by_text("Add data to Bar Chart").click()
    wait_for_app_run(app)

    # Wait for the chart to update
    vega_display = add_rows_chart.locator("[role='graphics-document']")
    expect(vega_display).to_be_visible()

    # Check that the chart has the correct styling params
    assert_vega_chart_width(add_rows_chart, 600)
    assert_vega_chart_height(add_rows_chart, 300)

    assert_snapshot(add_rows_chart, name="st_bar_chart-add_rows_preserves_styling")
