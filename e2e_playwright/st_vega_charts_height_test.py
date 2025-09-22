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
from e2e_playwright.shared.app_utils import check_top_level_class, get_element_by_key
from e2e_playwright.shared.vega_utils import assert_vega_chart_height

VEGA_CHART_COUNT = 7


def test_vega_chart_height_behavior(app: Page):
    """Tests that charts have correct height behavior for both default and explicit heights."""
    vega_lite_charts = app.get_by_test_id("stVegaLiteChart")
    expect(vega_lite_charts).to_have_count(VEGA_CHART_COUNT)

    expected_heights = [
        350,  # 0: Chart with height='content'
        468,  # 1: Chart with height='stretch' (in 500px container, minus padding)
        150,  # 2: Chart with height=150
        200,  # 3: Chart with height in spec (200) and height='content' parameter
        368,  # 4: Chart with height in spec (200) and height='stretch' parameter (in 400px container)
        100,  # 5: Chart with height in spec (200) and height=100 parameter
        852,  # 6: Vertical concatenation chart with default height (content)
    ]

    descriptions = [
        "Chart with height='content'",
        "Chart with height='stretch' (in 500px container)",
        "Chart with height=150",
        "Chart with height in spec (200) and height='content' parameter",
        "Chart with height in spec (200) and height='stretch' parameter (in 400px container)",
        "Chart with height in spec (200) and height=100 parameter",
        "Vertical concatenation chart with default height (content)",
    ]

    for i, expected_height in enumerate(expected_heights):
        chart = vega_lite_charts.nth(i)
        expect(chart).to_be_visible()

        chart_description = f"Chart {i}: {descriptions[i]}"
        # Note: tolerance is included below to account for some small pixel differences that can occur
        # due to sizing by the charting library and stretch height rounding.
        assert_vega_chart_height(chart, expected_height, chart_description, tolerance=3)


def test_vega_chart_height_content_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests height='content' parameter visual appearance."""
    vega_lite_charts = app.get_by_test_id("stVegaLiteChart")
    expect(vega_lite_charts).to_have_count(VEGA_CHART_COUNT)

    expect(vega_lite_charts.nth(0)).to_be_visible()
    assert_snapshot(
        vega_lite_charts.nth(0),
        name="st_vega_charts_height-height_content",
    )


def test_vega_chart_height_stretch_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests height='stretch' parameter visual appearance."""
    vega_lite_charts = app.get_by_test_id("stVegaLiteChart")
    expect(vega_lite_charts).to_have_count(VEGA_CHART_COUNT)

    expect(get_element_by_key(app, "test_height_stretch")).to_be_visible()
    assert_snapshot(
        vega_lite_charts.nth(1),
        name="st_vega_charts_height-height_stretch",
    )


def test_vega_chart_height_150px_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests height=150 parameter visual appearance."""
    vega_lite_charts = app.get_by_test_id("stVegaLiteChart")
    expect(vega_lite_charts).to_have_count(VEGA_CHART_COUNT)

    expect(vega_lite_charts.nth(2)).to_be_visible()
    assert_snapshot(
        vega_lite_charts.nth(2),
        name="st_vega_charts_height-height_150px",
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stVegaLiteChart")
