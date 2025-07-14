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

TOTAL_SCATTER_CHARTS = 14


def test_scatter_chart_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.scatter_chart renders correctly via snapshot testing."""
    scatter_chart_elements = app.get_by_test_id("stVegaLiteChart")
    expect(scatter_chart_elements).to_have_count(TOTAL_SCATTER_CHARTS)

    # Also make sure that all canvas objects are rendered:
    expect(scatter_chart_elements.locator("canvas")).to_have_count(TOTAL_SCATTER_CHARTS)

    # Take individual snapshots for each chart with meaningful names
    assert_snapshot(scatter_chart_elements.nth(0), name="st_scatter_chart-empty_chart")
    assert_snapshot(scatter_chart_elements.nth(1), name="st_scatter_chart-basic_df")
    assert_snapshot(
        scatter_chart_elements.nth(2), name="st_scatter_chart-single_x_axis"
    )
    assert_snapshot(
        scatter_chart_elements.nth(3), name="st_scatter_chart-single_y_axis"
    )
    assert_snapshot(
        scatter_chart_elements.nth(4), name="st_scatter_chart-multiple_y_axis"
    )
    assert_snapshot(
        scatter_chart_elements.nth(5), name="st_scatter_chart-fixed_dimensions"
    )
    assert_snapshot(
        scatter_chart_elements.nth(6),
        name="st_scatter_chart-single_x_axis_single_y_axis",
    )
    assert_snapshot(
        scatter_chart_elements.nth(7),
        name="st_scatter_chart-single_x_axis_multiple_y_axis",
    )
    assert_snapshot(scatter_chart_elements.nth(8), name="st_scatter_chart-utc_df")
    assert_snapshot(
        scatter_chart_elements.nth(9), name="st_scatter_chart-custom_color_labels"
    )
    assert_snapshot(
        scatter_chart_elements.nth(10),
        name="st_scatter_chart-custom_color_labels_size_word_labels_with_size",
    )
    assert_snapshot(
        scatter_chart_elements.nth(11), name="st_scatter_chart-number_labels_with_size"
    )
    assert_snapshot(
        scatter_chart_elements.nth(12), name="st_scatter_chart-custom_axis_labels"
    )
    # The add_rows chart (index 13) is tested separately in test_add_rows_preserves_styling


def test_themed_scatter_chart_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.scatter_chart renders with different theming."""
    scatter_chart_elements = themed_app.get_by_test_id("stVegaLiteChart")
    expect(scatter_chart_elements).to_have_count(TOTAL_SCATTER_CHARTS)

    # Also make sure that all canvas objects are rendered:
    expect(scatter_chart_elements.locator("canvas")).to_have_count(TOTAL_SCATTER_CHARTS)

    # Only test a single chart per built-in chart type:
    assert_snapshot(scatter_chart_elements.nth(1), name="st_scatter_chart_themed")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stVegaLiteChart")


# Issue #11312 - add_rows should preserve styling params
def test_add_rows_preserves_styling(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that add_rows preserves the original styling params (color, width, height,
    use_container_width).
    """
    add_rows_chart = app.get_by_test_id("stVegaLiteChart").nth(13)
    expect(add_rows_chart).to_be_visible()

    # Click the button to add data to the chart
    app.get_by_text("Add data to Scatter Chart").click()
    wait_for_app_run(app)

    # Wait for the chart to update
    chart_canvas = add_rows_chart.locator("canvas")
    expect(chart_canvas).to_be_visible()

    # Check that the chart has the correct styling params
    expect(chart_canvas).to_have_attribute("width", "600")
    expect(chart_canvas).to_have_attribute("height", "300")

    assert_snapshot(add_rows_chart, name="st_scatter_chart-add_rows_preserves_styling")
