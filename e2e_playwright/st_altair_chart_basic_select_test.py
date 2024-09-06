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


"""To determine the Canvas click points, you can run the Streamlit app, attach an event listener to the canvas and read the position from there."""

import re
from dataclasses import dataclass

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import (
    click_form_button,
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
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
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
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
    chart.click(position={"x": click_position.x, "y": click_position.y})
    wait_for_app_run(app)


def _get_selection_point_scatter_chart(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(0)


def _get_selection_interval_scatter_chart(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(1)


def _get_selection_point_bar_chart(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(2)


def _get_selection_interval_bar_chart(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(3)


def _get_selection_point_area_chart(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(4)


def _get_selection_interval_area_chart(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(5)


def _get_selection_point_histogram(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(6)


def _get_selection_interval_histogram(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(7)


def _get_in_form_chart(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(8)


def _get_callback_chart(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(9)


def _get_in_fragment_chart(app: Page) -> Locator:
    return app.get_by_test_id("stVegaLiteChart").locator("canvas").nth(10)


def test_point_bar_chart_displays_selection_text(app: Page):
    chart = _get_selection_point_bar_chart(app)

    # click on E-bar
    _click(app, chart, _MousePosition(150, 180))

    expected_prefix = "Bar chart with selection_point:"
    expected_selection = re.compile(
        "\\{'selection': \\{'param_1': \\[\\{'a': 'B', 'b': 55\\}]\\}\\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)


def test_interval_bar_chart_displays_selection_text(app: Page):
    chart = _get_selection_interval_bar_chart(app)
    expect(chart).to_be_visible()

    # change also height, because otherwise the selection is not triggered
    _create_selection_rectangle(
        app, chart, _MousePosition(90, 150), _MousePosition(175, 155)
    )

    expected_prefix = "Bar chart with selection_interval:"
    expected_selection = re.compile(
        "\\{'selection': \\{'param_1': \\{'a': \\['A', 'B'\\], 'b': \\[.+, .+\\]\\}\\}\\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)


def test_point_area_chart_displays_selection_text(app: Page):
    chart = _get_selection_point_area_chart(app)

    _click(app, chart, _MousePosition(150, 150))

    expected_prefix = "Area chart with selection_point:"
    expected_selection = re.compile(
        "\\{'param_1': \\[\\{'source': 'Fossil Fuels', 'year': .+, 'net_generation': .+\\}\\]\\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)


def test_interval_area_chart_displays_selection_text(app: Page):
    chart = _get_selection_interval_area_chart(app)

    _create_selection_rectangle(
        app, chart, _MousePosition(120, 110), _MousePosition(225, 195)
    )

    expected_prefix = "Area chart with selection_interval:"
    expected_selection = re.compile(
        "\\{'param_1': \\{'year': \\[.+, .+\\], 'net_generation': \\[.+, .+\\]\\}\\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)


def test_point_histogram_chart_displays_selection_text(app: Page):
    chart = _get_selection_point_histogram(app)

    _click(app, chart, _MousePosition(255, 238))

    expected_prefix = "Histogram chart with selection_point:"
    expected_selection = re.compile(
        "{'selection': {'param_1': \\[{'IMDB_Rating': 4.6}\\]}}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)


def test_interval_histogram_chart_displays_selection_text(app: Page):
    chart = _get_selection_interval_histogram(app)

    _create_selection_rectangle(
        app, chart, _MousePosition(160, 210), _MousePosition(205, 200)
    )

    expected_prefix = "Histogram chart with selection_interval:"
    expected_selection = re.compile(
        "\\{'selection': \\{'param_1': \\{'IMDB_Rating': \\[.+, .+\\]\\}\\}\\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)


def test_double_click_interval_shows_no_selection_text(app: Page):
    chart = _get_selection_interval_scatter_chart(app)

    _create_selection_rectangle(
        app, chart, _MousePosition(130, 100), _MousePosition(215, 160)
    )

    expected_prefix = "Scatter chart with selection_interval:"
    expected_selection = re.compile(
        "\\{'selection': \\{'param_1': \\{'Horsepower': \\[.+, .+\\], 'Miles_per_Gallon': \\[.+, .+\\]\\}\\}\\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)

    chart.dblclick(position={"x": 130, "y": 100})
    wait_for_app_run(app)
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(
        has_text=expected_selection
    )
    expect(selection_text).to_have_count(0)


def test_point_selection_scatter_chart_displays_selection_text(app: Page):
    chart = _get_selection_point_scatter_chart(app)

    _click(app, chart, _MousePosition(264, 162))

    expected_prefix = "Scatter chart with selection_point:"
    expected_selection = re.compile(
        "\\{'selection': \\{'param_1': \\[\\{'Origin': 'USA', 'Horsepower': .+, 'Miles_per_Gallon': .+\\}\\]\\}\\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)


def test_interval_selection_scatter_chart_displays_selection_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    chart = _get_selection_interval_scatter_chart(app)

    _create_selection_rectangle(
        app, chart, _MousePosition(260, 110), _MousePosition(433, 220)
    )

    expected_prefix = "Scatter chart with selection_interval:"
    expected_selection = re.compile(
        "\\{'selection': \\{'param_1': \\{'Horsepower': \\[.+, .+\\], 'Miles_per_Gallon': \\[.+, .+\\]\\}\\}\\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)

    assert_snapshot(chart, name="st_altair_chart-scatter_interval_selection")


def _test_shift_click_point_selection_scatter_chart_displays_selection(
    app: Page,
) -> Locator:
    chart = _get_selection_point_scatter_chart(app)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()
    chart.click(position={"x": 264, "y": 162})
    chart.click(position={"x": 310, "y": 175}, modifiers=["Shift"])
    chart.click(position={"x": 402, "y": 194}, modifiers=["Shift"])
    chart.click(position={"x": 181, "y": 94}, modifiers=["Shift"])
    wait_for_app_run(app)

    # move the mouse away so that we do not have any hover-menu effects on the chart when taking the screenshot.
    # we re-use the screenshot for the unmounting test.
    app.mouse.move(0, 0)
    app.wait_for_timeout(250)

    expected_prefix = "Scatter chart with selection_point:"
    expected_selection = re.compile(
        "\\{'selection': \\{'param_1': \\[\\{'Origin': 'USA', 'Horsepower': .+, 'Miles_per_Gallon': .+\\}, \\{'Origin': 'USA', 'Horsepower': .+, 'Miles_per_Gallon': .+\\}, \\{'Origin': 'USA', 'Horsepower': .+, 'Miles_per_Gallon': .+\\}, \\{'Origin': 'Japan', 'Horsepower': .+, 'Miles_per_Gallon': .+\\}\\]\\}\\}"
    )
    expect_prefixed_markdown(app, expected_prefix, expected_selection)

    return chart


def test_in_form_selection_and_session_state(app: Page):
    chart = _get_in_form_chart(app)
    expect(chart).to_be_visible()

    _click(app, chart, _MousePosition(255, 238))

    markdown_prefix = "Histogram-in-form selection:"
    markdown_prefix_session_state = "Histogram-in-form selection in session state:"
    empty_selection = re.compile("\\{'selection': \\{'param_1': \\{\\}\\}\\}")
    # nothing should be shown yet because we did not submit the form
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        empty_selection,
    )
    expect_prefixed_markdown(
        app,
        markdown_prefix_session_state,
        empty_selection,
    )

    # submit the form. The selection uses a debounce of 200ms; if we click too early, the state is not updated correctly and we submit the old, unselected values
    # app.wait_for_timeout(210)
    click_form_button(app, "Submit")

    expected_selection = re.compile(
        "{'selection': {'param_1': \\[{'IMDB_Rating': 4.6}\\]}}"
    )
    expect_prefixed_markdown(app, markdown_prefix, expected_selection)
    expect_prefixed_markdown(app, markdown_prefix_session_state, expected_selection)


def test_selection_with_callback(app: Page):
    chart = _get_callback_chart(app)
    expect(chart).to_be_visible()

    _click(app, chart, _MousePosition(255, 238))

    markdown_prefix = "Histogram selection callback:"
    expected_selection = re.compile(
        "{'selection': {'param_1': \\[{'IMDB_Rating': 4.6}\\]}}"
    )
    expect_prefixed_markdown(app, markdown_prefix, expected_selection)


def test_selection_in_fragment(app: Page):
    chart = _get_in_fragment_chart(app)
    expect(chart).to_be_visible()

    markdown_prefix = "Histogram-in-fragment selection:"
    empty_selection = re.compile("\\{'selection': \\{'param_1': \\{\\}\\}\\}")
    expect_prefixed_markdown(app, markdown_prefix, empty_selection)

    _click(app, chart, _MousePosition(255, 238))

    expected_selection = re.compile(
        "{'selection': {'param_1': \\[{'IMDB_Rating': 4.6}\\]}}"
    )
    expect_prefixed_markdown(app, markdown_prefix, expected_selection)

    # Check that the main script has run once (the initial run), but not after the selection:
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_shift_click_point_selection_scatter_chart_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    chart = _test_shift_click_point_selection_scatter_chart_displays_selection(app)
    chart.scroll_into_view_if_needed()
    assert_snapshot(chart, name="st_altair_chart-scatter_shift_selection")


# Skip firefox since it takes a snapshot with a slightly different size
# compared to the one in the test_multi_row_and_multi_column_select_snapshot test
@pytest.mark.skip_browser("firefox")
def test_selection_state_remains_after_unmounting_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    chart = _test_shift_click_point_selection_scatter_chart_displays_selection(app)

    # click on button to trigger unmounting / mounting
    app.get_by_test_id("stButton").filter(
        has_text="Create some elements to unmount component"
    ).locator("button").click()
    wait_for_app_run(app, wait_delay=4000)
    chart.scroll_into_view_if_needed()
    # Use the same snapshot name as the previous test to ensure visual consistency
    # Increase the image_threshold slightly because the second image is a little bit moved for some reason
    assert_snapshot(
        chart,
        name="st_altair_chart-scatter_shift_selection",
        image_threshold=0.041,
    )


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "scatter_point")).to_be_visible()
