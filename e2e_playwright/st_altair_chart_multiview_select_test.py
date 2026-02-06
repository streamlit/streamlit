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

"""Tests for multi-view Altair chart selections.

This tests selection functionality for multi-view charts including:
- Layer charts (overlapping views)
- HConcat charts (horizontally concatenated views)
- VConcat charts (vertically concatenated views)
- Charts with multiple independent selections
"""

import re
from dataclasses import dataclass

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    expect_prefixed_markdown,
    get_element_by_key,
)


@dataclass
class _MousePosition:
    x: int
    y: int


def _create_selection_rectangle(
    app: Page,
    chart: Locator,
    canvas_start_pos: _MousePosition,
    canvas_end_pos: _MousePosition,
) -> None:
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()

    bounding_box = chart.bounding_box()
    assert bounding_box is not None
    canvas_start_x_px = bounding_box.get("x", 0)
    canvas_start_y_px = bounding_box.get("y", 0)
    app.mouse.move(
        canvas_start_x_px + canvas_start_pos.x, canvas_start_y_px + canvas_start_pos.y
    )
    app.mouse.down()
    app.mouse.move(
        canvas_start_x_px + canvas_end_pos.x, canvas_start_y_px + canvas_end_pos.y
    )
    app.mouse.up()
    wait_for_app_run(app)


def _click(app: Page, chart: Locator, click_position: _MousePosition) -> None:
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()
    chart.click(position={"x": click_position.x, "y": click_position.y})
    wait_for_app_run(app)


def _get_layer_chart(app: Page) -> Locator:
    return get_element_by_key(app, "layer_chart").locator("[role='graphics-document']")


def _get_hconcat_chart(app: Page) -> Locator:
    return get_element_by_key(app, "hconcat_chart").locator(
        "[role='graphics-document']"
    )


def _get_vconcat_chart(app: Page) -> Locator:
    return get_element_by_key(app, "vconcat_chart").locator(
        "[role='graphics-document']"
    )


def _get_hconcat_multi_chart(app: Page) -> Locator:
    return get_element_by_key(app, "hconcat_multi_chart").locator(
        "[role='graphics-document']"
    )


def test_layer_chart_point_selection(app: Page):
    """Test point selection on a layer chart (multi-view)."""
    chart = _get_layer_chart(app)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()

    # Verify no selection text is displayed before interaction
    selection_text = app.get_by_text("Layer chart selection:")
    expect(selection_text).not_to_be_visible()

    # Click on a point in the scatter layer
    _click(app, chart, _MousePosition(264, 120))

    # Verify selection text is displayed
    expected_prefix = "Layer chart selection:"
    expected_selection = re.compile(r"\{'layer_selection': \[\{.+\}\]\}")
    expect_prefixed_markdown(app, expected_prefix, expected_selection)


def test_hconcat_chart_interval_selection(app: Page):
    """Test interval selection on an hconcat chart (multi-view) with cross-view highlighting."""
    chart = _get_hconcat_chart(app)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()

    # Verify no selection text is displayed before interaction
    selection_text = app.get_by_text("HConcat chart selection:")
    expect(selection_text).not_to_be_visible()

    # Create interval selection on the left scatter plot
    _create_selection_rectangle(
        app, chart, _MousePosition(100, 80), _MousePosition(180, 150)
    )

    # Verify selection text is displayed with interval selection data
    expected_prefix = "HConcat chart selection:"
    expected_selection = re.compile(
        r"\{'hconcat_selection': \{'Horsepower': \[.+, .+\], 'Miles_per_Gallon': \[.+, .+\]\}\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)


def test_vconcat_chart_point_selection(app: Page):
    """Test point selection on a vconcat chart (multi-view) with field-based selection."""
    chart = _get_vconcat_chart(app)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()

    # Verify no selection text is displayed before interaction
    selection_text = app.get_by_text("VConcat chart selection:")
    expect(selection_text).not_to_be_visible()

    # Click on a point in the scatter plot (top view)
    _click(app, chart, _MousePosition(200, 80))

    # Verify selection text is displayed - field-based selection returns the Origin value
    expected_prefix = "VConcat chart selection:"
    expected_selection = re.compile(
        r"\{'vconcat_selection': \[\{'Origin': '(USA|Japan|Europe)'\}\]\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)


def test_hconcat_chart_multiple_selections(app: Page):
    """Test that a multi-view chart with multiple selection params works correctly.

    This test verifies that a point selection can be triggered on the left chart
    of an hconcat chart that has two separate selections (one per view).
    The key test is that having multiple selection params doesn't break selection handling.
    """
    chart = _get_hconcat_multi_chart(app)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()

    # Verify no selection text is displayed before interaction
    selection_text = app.get_by_text("HConcat multi selection:")
    expect(selection_text).not_to_be_visible()

    # Click on the LEFT chart to trigger point selection
    # The left chart uses Horsepower vs Miles_per_Gallon
    _click(app, chart, _MousePosition(150, 120))

    # Verify the point selection on the left chart is captured
    # The selection dict only includes triggered selections (non-empty)
    expected_prefix = "HConcat multi selection:"
    expected_left = re.compile(r"\{'left_point': \[\{.+\}\]\}")
    expect_prefixed_markdown(app, expected_prefix, expected_left)
