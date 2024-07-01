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

VEGA_LITE_CHART_COUNT = 14


def test_vega_lite_chart(app: Page):
    """Tests that it displays charts on the DOM"""
    vega_lite_charts = app.get_by_test_id("stArrowVegaLiteChart")
    expect(vega_lite_charts).to_have_count(VEGA_LITE_CHART_COUNT)

    for idx in range(VEGA_LITE_CHART_COUNT):
        chart = vega_lite_charts.nth(idx)
        canvas = chart.locator("canvas").nth(0)
        expect(canvas).to_be_visible()
        expect(canvas).to_have_class("marks")


def test_vega_lite_chart_sets_chart_width(themed_app: Page):
    """Tests that it sets the correct chart width"""
    vega_lite_charts = themed_app.get_by_test_id("stArrowVegaLiteChart")

    expect(vega_lite_charts.nth(0).locator("canvas").nth(0)).to_have_css(
        "width", "704px"
    )
    expect(vega_lite_charts.nth(1).locator("canvas").nth(0)).to_have_css(
        "width", "704px"
    )
    expect(vega_lite_charts.nth(2).locator("canvas").nth(0)).to_have_css(
        "width", "400px"
    )
    expect(vega_lite_charts.nth(3).locator("canvas").nth(0)).to_have_css(
        "width", "500px"
    )


def test_vega_lite_chart_displays_interactive_charts(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests that it displays interactive charts on the DOM"""
    vega_lite_charts = themed_app.get_by_test_id("stArrowVegaLiteChart")
    # expect statement here so that snapshots are taken properly
    expect(vega_lite_charts).to_have_count(VEGA_LITE_CHART_COUNT)

    assert_snapshot(
        vega_lite_charts.nth(4),
        name="st_vega_lite_chart-interactive",
    )


def test_vega_lite_chart_same_plot_different_ways(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests that it displays the same plot in different ways"""
    vega_lite_charts = themed_app.get_by_test_id("stArrowVegaLiteChart")
    # expect statement here so that snapshots are taken properly
    expect(vega_lite_charts).to_have_count(VEGA_LITE_CHART_COUNT)

    for idx in range(5, 9):
        assert_snapshot(vega_lite_charts.nth(idx), name=f"st_vega_lite_chart-{idx}")


def test_vega_lite_chart_streamlit_theme(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests that st.vega_lite_chart supports the Streamlit theme"""
    vega_lite_charts = themed_app.get_by_test_id("stArrowVegaLiteChart")
    # expect statement here so that snapshots are taken properly
    expect(vega_lite_charts).to_have_count(VEGA_LITE_CHART_COUNT)

    for idx in range(9, 11):
        assert_snapshot(
            vega_lite_charts.nth(idx), name=f"st_vega_lite_chart-theming_{idx}"
        )


def test_vega_lite_chart_default_theme(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests that st.vega_lite_chart supports the default theme"""
    vega_lite_charts = themed_app.get_by_test_id("stArrowVegaLiteChart")
    # expect statement here so that snapshots are taken properly
    expect(vega_lite_charts).to_have_count(VEGA_LITE_CHART_COUNT)

    assert_snapshot(vega_lite_charts.nth(11), name="st_vega_lite_chart-default_theming")


def test_vega_lite_chart_user_supplied_colors(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests that st.vega_lite_chart respects user configuration"""
    vega_lite_charts = themed_app.get_by_test_id("stArrowVegaLiteChart")
    # expect statement here so that snapshots are taken properly
    expect(vega_lite_charts).to_have_count(VEGA_LITE_CHART_COUNT)

    assert_snapshot(
        vega_lite_charts.nth(12),
        name="st_vega_lite_chart-user_supplied_colors",
    )


def test_empty_vega_lite_chart(app: Page, assert_snapshot: ImageCompareFunction):
    vega_lite_charts = app.get_by_test_id("stArrowVegaLiteChart")
    # expect statement here so that snapshots are taken properly
    expect(vega_lite_charts).to_have_count(VEGA_LITE_CHART_COUNT)

    assert_snapshot(
        vega_lite_charts.nth(13),
        name="st_vega_lite_chart-empty",
    )
