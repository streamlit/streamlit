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

from __future__ import annotations

import re

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import check_top_level_class, get_element_by_key

# Fixed layout values replicated from the engine (getDetailLayout in
# scatterplotMatrixEngine.ts). Only valid while the scene renders at
# identity zoom (i.e. the content fits the canvas without scaling).
_MATRIX_X = 64
_MATRIX_Y = 74
_CELL_GAP = 8
_QUERY_PANEL_ROW_HEIGHT = 26


def _get_canvas(app: Page, index: int) -> Locator:
    return app.get_by_test_id("stScatterplotMatrixChartCanvas").nth(index)


def _get_matrix_width(canvas_width: float, num_atts: int) -> float:
    """Replicates the engine's layout to compute the small-plot matrix width."""
    available = max(300.0, min(430.0, canvas_width * 0.42))
    cell_size = min(
        max(int((available - _CELL_GAP * (num_atts - 1)) // num_atts), 24), 56
    )
    return cell_size * num_atts + _CELL_GAP * (num_atts - 1)


def _get_large_plot_rect(
    canvas_width: float, canvas_height: float, num_atts: int
) -> tuple[float, float, float]:
    """Replicates the engine's layout to locate the large plot.

    Returns (x, y, size) of the large detail plot in canvas coordinates.
    """
    large_x = _MATRIX_X + _get_matrix_width(canvas_width, num_atts) + 54
    large_size = min(
        max(min(canvas_width - large_x - 36, canvas_height - 150), 260), 430
    )
    return large_x, _MATRIX_Y, large_size


def _get_clear_button_pos(
    canvas_width: float, num_atts: int, num_layers: int
) -> tuple[float, float]:
    """Replicates the engine's layout to locate the "Clear All Queries" button.

    Returns (x, y) of a point inside the button in canvas coordinates.
    """
    panel_y = _MATRIX_Y + _get_matrix_width(canvas_width, num_atts) + 24
    panel_height = 32 + num_layers * _QUERY_PANEL_ROW_HEIGHT + 30
    return _MATRIX_X + 20, panel_y + panel_height - 24


def test_scatterplot_matrix_charts_render(app: Page):
    """Both scatterplot matrix charts render a visible canvas."""
    charts = app.get_by_test_id("stScatterplotMatrixChart")
    expect(charts).to_have_count(2)
    expect(_get_canvas(app, 0)).to_be_visible()
    expect(_get_canvas(app, 1)).to_be_visible()


def test_check_top_level_class(app: Page):
    """The custom top level class is correctly set."""
    check_top_level_class(app, "stScatterplotMatrixChart")


def test_lasso_selection_triggers_rerun(app: Page):
    """Lasso-selecting points in the large plot reruns the app with the
    selected row indices, and clearing the queries resets the selection.
    """
    expect(app.get_by_text("Selected points: 0")).to_be_visible()

    canvas = get_element_by_key(app, "selectable_splom").get_by_test_id(
        "stScatterplotMatrixChartCanvas"
    )
    canvas.scroll_into_view_if_needed()
    bounding_box = canvas.bounding_box()
    assert bounding_box is not None

    large_x, large_y, large_size = _get_large_plot_rect(
        bounding_box["width"], bounding_box["height"], num_atts=3
    )

    def to_page(x: float, y: float) -> tuple[float, float]:
        return bounding_box["x"] + x, bounding_box["y"] + y

    # Lasso a rectangle covering most of the large plot (the first query
    # layer is selected by default):
    inset = 5
    corners = [
        (large_x + inset, large_y + inset),
        (large_x + large_size - inset, large_y + inset),
        (large_x + large_size - inset, large_y + large_size - inset),
        (large_x + inset, large_y + large_size - inset),
    ]
    app.mouse.move(*to_page(*corners[0]))
    app.mouse.down()
    for corner_x, corner_y in corners[1:]:
        # Move in small steps so the lasso path has enough points:
        app.mouse.move(*to_page(corner_x, corner_y), steps=10)
    app.mouse.up()
    wait_for_app_run(app)

    selection_text = app.get_by_text(re.compile(r"^Selected points: \d+$"))
    expect(selection_text).to_be_visible()
    expect(app.get_by_text("Selected points: 0")).not_to_be_visible()

    # Click "Clear All Queries" at the bottom of the query panel:
    clear_x, clear_y = to_page(
        *_get_clear_button_pos(bounding_box["width"], num_atts=3, num_layers=2)
    )
    app.mouse.click(clear_x, clear_y)
    wait_for_app_run(app)

    expect(app.get_by_text("Selected points: 0")).to_be_visible()
