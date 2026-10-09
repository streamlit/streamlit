# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import check_top_level_class, get_element_by_key


def test_grid_renders(app: Page):
    """Test that all grids render correctly."""
    grids = app.get_by_test_id("stGrid")
    expect(grids).to_have_count(5)
    check_top_level_class(app, "stGrid")


def test_auto_sizing_grid(app: Page):
    """Test that the auto-sizing grid contains metrics."""
    first_grid = get_element_by_key(app, "auto_sizing")
    metrics = first_grid.get_by_test_id("stMetric")
    expect(metrics).to_have_count(4)
    expect(first_grid).to_have_attribute("data-test-wrap", "true")


def test_grid_with_border(app: Page):
    """Test that the bordered grid has visible borders."""
    bordered_grid = get_element_by_key(app, "bordered")
    expect(bordered_grid).to_be_visible()
    expect(bordered_grid.get_by_test_id("stGridCell")).to_have_count(6)


def test_grid_with_span(app: Page):
    """Test that grid with spanning cells renders correctly."""
    span_grid = get_element_by_key(app, "spanning")
    expect(span_grid).to_be_visible()
    expect(span_grid.get_by_text("Spans 2 columns")).to_be_visible()
    expect(span_grid.get_by_text("Spans all columns")).to_be_visible()

    span_all_cell = span_grid.get_by_test_id("stGridCell").first
    expect(span_all_cell).to_have_css("grid-column-start", "1")
    expect(span_all_cell).to_have_css("grid-column-end", "-1")


def test_grid_wrap_false_keeps_declared_columns(app: Page):
    """wrap=False keeps the declared count and scrolls locally."""
    no_wrap_grid = get_element_by_key(app, "no_wrap")
    expect(no_wrap_grid).to_have_attribute("data-test-wrap", "false")
    expect(no_wrap_grid).to_have_attribute("data-test-column-count", "3")
    expect(no_wrap_grid).to_have_css("overflow-x", "auto")


def test_stretch_chart_fills_fixed_row_cell(app: Page):
    """height=stretch inside grid.cell() fills a pixel row.

    Covers both ``with grid.cell()`` and the chained ``grid.cell().bar_chart``
    form. A content-sized cell block collapses these charts to 0px.
    """
    grid = get_element_by_key(app, "stretch_cell")
    charts = grid.get_by_test_id("stVegaLiteChart")
    expect(charts).to_have_count(2)
    for index in range(2):
        chart = charts.nth(index)
        cell = chart.locator("xpath=ancestor::*[@data-testid='stGridCell'][1]")

        def chart_is_stretched(chart: Locator = chart, cell: Locator = cell) -> bool:
            # The default chart height is 21.875rem (~350px). A stretch chart
            # in a 240px row stays below that and fills most of its cell.
            chart_box = chart.bounding_box()
            cell_box = cell.bounding_box()
            if chart_box is None or cell_box is None or cell_box["height"] <= 0:
                return False
            height = chart_box["height"]
            return height < 300 and height / cell_box["height"] > 0.45

        wait_until(app, chart_is_stretched)


def test_grid_visual_snapshot(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test grid visual appearance with snapshot."""
    first_grid = get_element_by_key(themed_app, "auto_sizing")
    assert_snapshot(first_grid, name="st_grid-auto_sizing")


def test_grid_with_border_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test bordered grid visual appearance."""
    bordered_grid = get_element_by_key(themed_app, "bordered")
    assert_snapshot(bordered_grid, name="st_grid-bordered")


def test_grid_with_span_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test grid with span visual appearance."""
    span_grid = get_element_by_key(themed_app, "spanning")
    assert_snapshot(span_grid, name="st_grid-span")
