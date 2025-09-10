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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class
from e2e_playwright.shared.react18_utils import wait_for_react_stability

NUM_CHARTS = 8


def test_altair_chart_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    charts = themed_app.get_by_test_id("stVegaLiteChart")
    expect(charts).to_have_count(NUM_CHARTS)

    # Also make sure that all Vega display objects are rendered:
    expect(charts.locator("[role='graphics-document']")).to_have_count(NUM_CHARTS)

    # Ensure all charts are visible before taking snapshots
    for idx in range(NUM_CHARTS):
        chart = charts.nth(idx)
        vega_display = chart.locator("[role='graphics-document']").nth(0)
        expect(vega_display).to_be_visible()

    assert_snapshot(charts.nth(0), name="st_altair_chart-pie_chart_large_legend_items")
    assert_snapshot(charts.nth(1), name="st_altair_chart-scatter_chart_default_theme")
    assert_snapshot(charts.nth(2), name="st_altair_chart-scatter_chart_streamlit_theme")
    assert_snapshot(
        charts.nth(3), name="st_altair_chart-scatter_chart_overwritten_theme"
    )
    assert_snapshot(charts.nth(4), name="st_altair_chart-bar_chart_overwritten_theme")
    # TODO(lukasmasuch): Temporarily disabled because of flickering in webkit & chromium.
    # assert_snapshot(charts.nth(5), name="st_altair_chart-grouped_bar_chart_default_theme")  # noqa: ERA001
    # assert_snapshot(charts.nth(5), name="st_altair_chart-grouped_bar_chart_streamlit_theme")  # noqa: ERA001
    # assert_snapshot(charts.nth(5), name="st_altair_chart-grouped_use_container_width_default_theme")  # noqa: ERA001
    assert_snapshot(
        charts.nth(5), name="st_altair_chart-grouped_layered_line_chart_streamlit_theme"
    )
    assert_snapshot(charts.nth(6), name="st_altair_chart-vconcat_width")
    assert_snapshot(
        charts.nth(7), name="st_altair_chart-altair_chart_cut_off_legend_title_none"
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stVegaLiteChart")


# Webkit is quite flaky, potentially pointing to a bug
# see the other comments in the test script
@pytest.mark.flaky(reruns=3)
@pytest.mark.skip_browser("webkit")
def test_chart_tooltip_styling(app: Page, assert_snapshot: ImageCompareFunction):
    """Check that the chart tooltip styling is correct."""

    charts = app.get_by_test_id("stVegaLiteChart")
    expect(charts).to_have_count(NUM_CHARTS)

    pie_chart = charts.nth(0)
    expect(pie_chart).to_be_visible()
    wait_for_react_stability(app)
    pie_chart.scroll_into_view_if_needed()
    wait_for_react_stability(app)
    pie_chart.locator("[role='graphics-document']").hover(
        position={"x": 60, "y": 60}, force=True
    )
    tooltip = app.locator("#vg-tooltip-element")
    expect(tooltip).to_be_visible()

    assert_snapshot(tooltip, name="st_altair_chart-tooltip_styling")


def test_chart_menu_styling(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Check that the chart menu styling is correct."""
    chart = themed_app.get_by_test_id("stVegaLiteChart").first
    expect(chart).to_be_visible()
    chart.locator("summary").click()
    chart_menu = chart.locator(".vega-actions")
    expect(chart_menu).to_be_visible()
    assert_snapshot(chart_menu, name="st_altair_chart-menu_styling")


def test_show_chart_data_button(app: Page, assert_snapshot: ImageCompareFunction):
    """Check that the show chart data feature works correctly."""
    # The first fullscreen frame of a chart:
    chart = app.get_by_test_id("stFullScreenFrame").first
    expect(chart).to_be_visible()
    chart.hover(force=True)

    toolbar = chart.get_by_test_id("stElementToolbar")
    expect(toolbar).to_be_visible()
    toolbar_buttons = toolbar.get_by_test_id("stElementToolbarButton")
    expect(toolbar_buttons).to_have_count(2)

    expect(toolbar_buttons.get_by_label("Show Data")).to_be_visible()
    toolbar_buttons.get_by_label("Show Data").click()

    dataframe = app.get_by_test_id("stDataFrame")

    expect(dataframe).to_be_visible()

    assert_snapshot(dataframe, name="st_altair_chart-show_chart_data")

    # Check that switching back to the chart works:
    dataframe.hover(force=True)

    toolbar = dataframe.get_by_test_id("stElementToolbar")
    expect(toolbar).to_be_visible()
    toolbar_buttons = toolbar.get_by_test_id("stElementToolbarButton")
    expect(toolbar_buttons.get_by_label("Show Chart")).to_be_visible()
    toolbar_buttons.get_by_label("Show Chart").click()

    expect(dataframe).not_to_be_attached()
