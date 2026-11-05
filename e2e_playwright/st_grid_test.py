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
    expect(grids).to_have_count(8)
    check_top_level_class(app, "stGrid")


def test_auto_sizing_grid(app: Page):
    """Test that the auto-sizing grid fits three tracks at the default width."""
    first_grid = get_element_by_key(app, "auto_sizing")
    metrics = first_grid.get_by_test_id("stMetric")
    expect(metrics).to_have_count(4)
    expect(first_grid).to_have_attribute("data-test-wrap", "true")
    # The 704px centered content box fits three 200px tracks, not four.
    expect(first_grid).to_have_attribute("data-test-column-count", "3")


def test_grid_with_border(app: Page):
    """The bordered grid draws a border on each cell inside its track."""
    bordered_grid = get_element_by_key(app, "bordered")
    bordered_cells = bordered_grid.get_by_test_id("stGridCell")
    expect(bordered_cells).to_have_count(6)
    expect(bordered_grid).to_have_attribute("data-test-column-count", "3")
    bordered_cell = bordered_cells.first
    expect(bordered_cell).to_have_css("border-top-style", "solid")

    # The auto-sizing grid also has three tracks at this width, but no border.
    plain_cell = (
        get_element_by_key(app, "auto_sizing").get_by_test_id("stGridCell").first
    )
    expect(plain_cell).to_have_css("border-top-style", "none")

    def border_stays_inside_track() -> bool:
        bordered_box = bordered_cell.bounding_box()
        plain_box = plain_cell.bounding_box()
        if bordered_box is None or plain_box is None:
            return False
        return (
            bordered_box["width"] > 0
            and abs(bordered_box["width"] - plain_box["width"]) < 1
        )

    wait_until(app, border_stays_inside_track)


def test_grid_with_span(app: Page):
    """Test that grid with spanning cells renders correctly."""
    span_grid = get_element_by_key(app, "spanning")
    expect(span_grid).to_be_visible()
    expect(span_grid.get_by_text("Spans 2 columns")).to_be_visible()
    expect(span_grid.get_by_text("Spans all columns")).to_be_visible()

    cells = span_grid.get_by_test_id("stGridCell")
    span_all_cell = cells.first
    expect(span_all_cell).to_have_css("grid-column-start", "1")
    expect(span_all_cell).to_have_css("grid-column-end", "-1")

    # The row-span cell starts in the row of "Spans 2 columns" and ends with
    # the row of "Cell 3", so it covers both rows and the gap between them.
    # "Spans 2 columns" starts with "Cell 3" (track 1) and ends with "Cell 4"
    # (track 2), so it covers both tracks and the gap between them.
    row_span_cell = cells.filter(has_text="Spans 2 rows")
    column_span_cell = cells.filter(has_text="Spans 2 columns")
    first_track_cell = cells.filter(has_text="Cell 3")
    second_track_cell = cells.filter(has_text="Cell 4")

    def spans_cover_their_tracks() -> bool:
        row_span_box = row_span_cell.bounding_box()
        column_span_box = column_span_cell.bounding_box()
        first_box = first_track_cell.bounding_box()
        second_box = second_track_cell.bounding_box()
        if (
            row_span_box is None
            or column_span_box is None
            or first_box is None
            or second_box is None
        ):
            return False
        row_span_bottom = row_span_box["y"] + row_span_box["height"]
        first_bottom = first_box["y"] + first_box["height"]
        column_span_right = column_span_box["x"] + column_span_box["width"]
        second_right = second_box["x"] + second_box["width"]
        return (
            abs(row_span_box["y"] - column_span_box["y"]) < 1
            and abs(row_span_bottom - first_bottom) < 1
            and first_box["y"] > column_span_box["y"]
            and abs(column_span_box["x"] - first_box["x"]) < 1
            and abs(column_span_right - second_right) < 1
            and second_box["x"] > first_box["x"]
        )

    wait_until(app, spans_cover_their_tracks)


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
    # Three auto-width tracks fit here, so st.grid(2) shows its cap.
    expect(grid).to_have_attribute("data-test-column-count", "2")
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


def test_stretch_container_fills_content_row_cell(app: Page):
    """height=stretch inside grid.cell() fills a content row.

    A spanning grid.cell() container and a stretch chart match their taller
    neighbors, and vertical_alignment still moves a short grid.cell() in a
    content row.
    """
    wide = get_element_by_key(app, "wide")
    tall = get_element_by_key(app, "tall")
    short = get_element_by_key(app, "short")
    aligned_tall = get_element_by_key(app, "aligned_tall")
    expect(get_element_by_key(app, "content_stretch")).to_have_attribute(
        "data-test-column-count", "3"
    )

    def stretch_matches_neighbor() -> bool:
        wide_box = wide.bounding_box()
        tall_box = tall.bounding_box()
        if wide_box is None or tall_box is None:
            return False
        return (
            tall_box["height"] > 150
            and abs(wide_box["height"] - tall_box["height"]) < 1
            and abs(wide_box["y"] - tall_box["y"]) < 1
            # The spanning cell is wider than its one-column neighbor.
            and wide_box["width"] > tall_box["width"] * 1.5
        )

    wait_until(app, stretch_matches_neighbor)

    def short_cell_is_bottom_aligned() -> bool:
        short_box = short.bounding_box()
        tall_box = aligned_tall.bounding_box()
        if short_box is None or tall_box is None:
            return False
        short_bottom = short_box["y"] + short_box["height"]
        tall_bottom = tall_box["y"] + tall_box["height"]
        return (
            abs(short_bottom - tall_bottom) < 1
            # Content-height children do not stretch with the cell.
            and short_box["height"] < tall_box["height"] / 2
        )

    wait_until(app, short_cell_is_bottom_aligned)

    # A stretch chart has no definite height in a content row, so it starts
    # at its default height and then fills the taller row.
    chart = get_element_by_key(app, "content_chart").get_by_test_id("stVegaLiteChart")
    chart_neighbor = get_element_by_key(app, "chart_neighbor")

    def chart_fills_taller_row() -> bool:
        chart_box = chart.bounding_box()
        neighbor_box = chart_neighbor.bounding_box()
        if chart_box is None or neighbor_box is None:
            return False
        # The default chart height is 21.875rem (~350px).
        return (
            neighbor_box["height"] > 400
            and abs(chart_box["height"] - neighbor_box["height"]) < 1
        )

    wait_until(app, chart_fills_taller_row)


def test_grid_visual_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test grid visual appearance with snapshot."""
    first_grid = get_element_by_key(app, "auto_sizing")
    assert_snapshot(first_grid, name="st_grid-auto_sizing")


def test_grid_with_border_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test bordered grid visual appearance."""
    bordered_grid = get_element_by_key(app, "bordered")
    assert_snapshot(bordered_grid, name="st_grid-bordered")


def test_grid_with_span_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test grid with span visual appearance."""
    span_grid = get_element_by_key(app, "spanning")
    assert_snapshot(span_grid, name="st_grid-span")
