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

TOTAL_LINE_CHARTS = 11


def test_line_chart_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.line_chart renders correctly via snapshot testing."""
    line_chart_elements = app.get_by_test_id("stArrowVegaLiteChart")
    expect(line_chart_elements).to_have_count(TOTAL_LINE_CHARTS)

    # Also make sure that all canvas objects are rendered:
    expect(line_chart_elements.locator("canvas")).to_have_count(TOTAL_LINE_CHARTS)

    for i, element in enumerate(line_chart_elements.all()):
        assert_snapshot(element, name=f"st_line_chart-{i}")


def test_themed_line_chart_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.line_chart renders with different theming."""
    line_chart_elements = themed_app.get_by_test_id("stArrowVegaLiteChart")
    expect(line_chart_elements).to_have_count(TOTAL_LINE_CHARTS)

    # Also make sure that all canvas objects are rendered:
    expect(line_chart_elements.locator("canvas")).to_have_count(TOTAL_LINE_CHARTS)

    # Only test a single chart per built-in chart type:
    assert_snapshot(line_chart_elements.nth(1), name="st_line_chart_themed")
