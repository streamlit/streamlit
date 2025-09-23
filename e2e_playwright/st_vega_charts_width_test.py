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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class
from e2e_playwright.shared.vega_utils import assert_vega_chart_width

VEGA_CHART_COUNT = 13


def test_vega_chart_width_behavior(themed_app: Page):
    """Tests that charts have correct width behavior for both default and explicit widths."""
    vega_lite_charts = themed_app.get_by_test_id("stVegaLiteChart")
    expect(vega_lite_charts).to_have_count(VEGA_CHART_COUNT)

    expected_widths = [
        704,  # 0: Regular chart (should default to stretch)
        135,  # 1: Facet chart (should default to content)
        158,  # 2: Chart with row encoding (should default to content)
        444,  # 3: Chart with column encoding (should default to content)
        308,  # 4: Horizontal concatenation chart (should default to content)
        704,  # 5: Vertical concatenation chart (should default to stretch)
        144,  # 6: Repeat chart (should default to content)
        144,  # 7: Chart with width='content'
        704,  # 8: Chart with width='stretch'
        400,  # 9: Chart with width=400
        500,  # 10: Chart with width in spec (500) and width='content' parameter
        704,  # 11: Chart with width in spec (500) and width='stretch' parameter
        200,  # 12: Chart with width in spec (500) and width=200 parameter
    ]

    descriptions = [
        "Regular chart (should default to stretch)",
        "Facet chart (should default to content)",
        "Chart with row encoding (should default to content)",
        "Chart with column encoding (should default to content)",
        "Horizontal concatenation chart (should default to content)",
        "Vertical concatenation chart (should default to stretch)",
        "Repeat chart (should default to content)",
        "Chart with width='content'",
        "Chart with width='stretch'",
        "Chart with width=400",
        "Chart with width in spec (500) and width='content' parameter",
        "Chart with width in spec (500) and width='stretch' parameter",
        "Chart with width in spec (500) and width=200 parameter",
    ]

    for i, expected_width in enumerate(expected_widths):
        chart = vega_lite_charts.nth(i)
        expect(chart).to_be_visible()

        chart_description = f"Chart {i}: {descriptions[i]}"
        # Note: tolerance is included below to account for some small pixel differences that can
        # occur when the width is calculated by the charting library when width="content".
        assert_vega_chart_width(chart, expected_width, chart_description, tolerance=3)


def test_vega_chart_width_content_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests width='content' parameter visual appearance."""
    vega_lite_charts = app.get_by_test_id("stVegaLiteChart")
    expect(vega_lite_charts).to_have_count(VEGA_CHART_COUNT)

    expect(vega_lite_charts.nth(7)).to_be_visible()
    assert_snapshot(
        vega_lite_charts.nth(7),
        name="st_vega_charts_width-width_content",
    )


def test_vega_chart_width_stretch_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests width='stretch' parameter visual appearance."""
    vega_lite_charts = app.get_by_test_id("stVegaLiteChart")
    expect(vega_lite_charts).to_have_count(VEGA_CHART_COUNT)

    expect(vega_lite_charts.nth(8)).to_be_visible()
    assert_snapshot(
        vega_lite_charts.nth(8),
        name="st_vega_charts_width-width_stretch",
    )


def test_vega_chart_width_400px_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests width=400 parameter visual appearance."""
    vega_lite_charts = app.get_by_test_id("stVegaLiteChart")
    expect(vega_lite_charts).to_have_count(VEGA_CHART_COUNT)

    expect(vega_lite_charts.nth(9)).to_be_visible()
    assert_snapshot(
        vega_lite_charts.nth(9),
        name="st_vega_charts_width-width_400px",
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stVegaLiteChart")
