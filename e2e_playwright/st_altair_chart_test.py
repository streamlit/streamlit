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


def test_altair_chart_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    expect(
        themed_app.get_by_test_id("stVegaLiteChart").locator("canvas")
    ).to_have_count(10)
    charts = themed_app.get_by_test_id("stVegaLiteChart")
    expect(charts).to_have_count(10)
    snapshot_names = [
        "st_altair_chart-scatter_chart_default_theme",
        "st_altair_chart-scatter_chart_streamlit_theme",
        "st_altair_chart-scatter_chart_overwritten_theme",
        "st_altair_chart-bar_chart_overwritten_theme",
        "st_altair_chart-pie_chart_large_legend_items",
        "st_altair_chart-grouped_bar_chart_default_theme",
        "st_altair_chart-grouped_bar_chart_streamlit_theme",
        "st_altair_chart-grouped_use_container_width_default_theme",
        "st_altair_chart-grouped_layered_line_chart_streamlit_theme",
        "st_altair_chart-vconcat_width",
    ]
    for i, name in enumerate(snapshot_names):
        # We use a higher threshold here to prevent some flakiness
        # We should probably remove this once we have refactored the
        # altair frontend component.
        assert_snapshot(charts.nth(i), name=name, image_threshold=0.6)


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stVegaLiteChart")


def test_chart_tooltip_styling(app: Page, assert_snapshot: ImageCompareFunction):
    """Check that the chart tooltip styling is correct."""
    pie_chart = app.get_by_test_id("stVegaLiteChart").nth(4)
    pie_chart.scroll_into_view_if_needed()
    pie_chart.locator("canvas").hover(position={"x": 60, "y": 60}, force=True)
    tooltip = app.locator("#vg-tooltip-element")
    expect(tooltip).to_be_visible()

    assert_snapshot(tooltip, name="st_altair_chart-tooltip_styling")


def test_chart_menu_styling(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Check that the chart menu styling is correct."""
    chart = themed_app.get_by_test_id("stVegaLiteChart").first
    chart.locator("summary").click()
    chart_menu = chart.locator(".vega-actions")
    expect(chart_menu).to_be_visible()
    assert_snapshot(chart_menu, name="st_altair_chart-menu_styling")
