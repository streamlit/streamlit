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

TOTAL_CHARTS = 46


def test_built_in_chart_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.<>_chart renders correctly via snapshot testing."""
    chart_elements = app.get_by_test_id("stArrowVegaLiteChart")
    expect(chart_elements).to_have_count(TOTAL_CHARTS)

    # Also make sure that all canvas objects are rendered:
    expect(chart_elements.locator("canvas")).to_have_count(TOTAL_CHARTS)

    for i, element in enumerate(chart_elements.all()):
        assert_snapshot(element, name=f"st_builtin_chart-{i}")


def test_themed_chart_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.<>_chart renders with different theming."""
    chart_elements = themed_app.get_by_test_id("stArrowVegaLiteChart")
    expect(chart_elements).to_have_count(TOTAL_CHARTS)

    # Also make sure that all canvas objects are rendered:
    expect(chart_elements.locator("canvas")).to_have_count(TOTAL_CHARTS)

    # Only test a single selected chart per built-in chart type:
    assert_snapshot(chart_elements.nth(1), name="st_builtin_chart-area_chart_themed")
    assert_snapshot(chart_elements.nth(12), name="st_builtin_chart-bar_chart_themed")
    assert_snapshot(chart_elements.nth(23), name="st_builtin_chart-line_chart_themed")
    assert_snapshot(
        chart_elements.nth(34), name="st_builtin_chart-scatter_chart_themed"
    )
