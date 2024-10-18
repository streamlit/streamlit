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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class

TOTAL_AREA_CHARTS = 15


def test_area_chart_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.area_chart renders correctly via snapshot testing."""
    area_chart_elements = app.get_by_test_id("stVegaLiteChart")
    expect(area_chart_elements).to_have_count(TOTAL_AREA_CHARTS)

    # Also make sure that all canvas objects are rendered:
    expect(area_chart_elements.locator("canvas")).to_have_count(TOTAL_AREA_CHARTS)

    for i, element in enumerate(area_chart_elements.all()):
        assert_snapshot(element, name=f"st_area_chart-{i}")


def test_themed_area_chart_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.area_chart renders with different theming."""
    area_chart_elements = themed_app.get_by_test_id("stVegaLiteChart")
    expect(area_chart_elements).to_have_count(TOTAL_AREA_CHARTS)

    # Also make sure that all canvas objects are rendered:
    expect(area_chart_elements.locator("canvas")).to_have_count(TOTAL_AREA_CHARTS)

    # Only test a single chart per built-in chart type:
    assert_snapshot(area_chart_elements.nth(1), name="st_area_chart_themed")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stVegaLiteChart")


def test_multi_line_hover(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that hovering on a st.area_chart shows chart markers on all lines and
    a tooltip."""

    multi_line_chart = app.get_by_test_id("stVegaLiteChart").nth(1)
    expect(multi_line_chart).to_be_visible()

    multi_line_chart.scroll_into_view_if_needed()
    multi_line_chart.locator("canvas").hover(position={"x": 100, "y": 100})

    expect(app.locator("#vg-tooltip-element")).to_be_visible()

    assert_snapshot(multi_line_chart, name="st_area_chart-multi_line_hover")


def test_single_line_hover(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that hovering on a st.area_chart shows chart markers and a tooltip."""

    single_line_chart = app.get_by_test_id("stVegaLiteChart").nth(3)
    expect(single_line_chart).to_be_visible()

    single_line_chart.scroll_into_view_if_needed()
    single_line_chart.locator("canvas").hover(position={"x": 100, "y": 100})

    expect(app.locator("#vg-tooltip-element")).to_be_visible()
    assert_snapshot(single_line_chart, name="st_area_chart-single_line_hover")
