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

from dataclasses import dataclass

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


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


def _expect_written_text(app: Page, expected_prefix: str, expected_selection: str):
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(
        has_text=expected_prefix
    )
    expected_selection = expected_prefix + " " + expected_selection
    expect(selection_text).to_have_text(expected_selection)


def _click(app: Page, chart: Locator, click_position: _MousePosition) -> None:
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
    chart.click(position={"x": click_position.x, "y": click_position.y})
    wait_for_app_run(app)


def _get_selection_point_scatter_chart(app: Page) -> Locator:
    return app.get_by_test_id("stArrowVegaLiteChart").nth(0)


def _get_selection_interval_scatter_chart(app: Page) -> Locator:
    return app.get_by_test_id("stArrowVegaLiteChart").nth(1)


def _get_selection_point_bar_chart(app: Page) -> Locator:
    return app.get_by_test_id("stArrowVegaLiteChart").nth(2)


def _get_selection_interval_bar_chart(app: Page) -> Locator:
    return app.get_by_test_id("stArrowVegaLiteChart").nth(3)


def _get_selection_point_area_chart(app: Page) -> Locator:
    return app.get_by_test_id("stArrowVegaLiteChart").nth(4)


def _get_selection_interval_area_chart(app: Page) -> Locator:
    return app.get_by_test_id("stArrowVegaLiteChart").nth(5)


def _get_selection_point_histogram(app: Page) -> Locator:
    return app.get_by_test_id("stArrowVegaLiteChart").nth(6)


def _get_selection_interval_histogram(app: Page) -> Locator:
    return app.get_by_test_id("stArrowVegaLiteChart").nth(7)


def test_point_bar_chart_displays_dataframe(app: Page):
    chart = _get_selection_point_bar_chart(app)

    # click on E-bar
    _click(app, chart, _MousePosition(150, 180))

    expected_prefix = "Bar chart with selection_point:"
    expected_selection = "{'select': {'param_1': [{'a': 'E', 'b': 81}]}}"
    _expect_written_text(app, expected_prefix, expected_selection)


def test_interval_bar_chart_displays_dataframe(app: Page):
    chart = _get_selection_interval_bar_chart(app)
    expect(chart).to_be_visible()

    # change also height, because otherwise the selection is not triggered
    _create_selection_rectangle(
        app, chart, _MousePosition(90, 150), _MousePosition(175, 155)
    )

    expected_prefix = "Bar chart with selection_interval:"
    expected_selection = "{'select': {'param_1': {'a': ['B', 'C', 'D', 'E', 'F'], 'b': [44.28889142335767, 46.113708941605836]}}}"
    _expect_written_text(app, expected_prefix, expected_selection)


def test_point_area_chart_displays_dataframe(app: Page):
    chart = _get_selection_point_area_chart(app)

    _click(app, chart, _MousePosition(150, 150))

    expected_prefix = "Area chart with selection_point:"
    expected_selection = "{'param_1': [{'year': 978307200000, 'net_generation': '35361', 'source': 'Fossil Fuels'}]}"
    _expect_written_text(app, expected_prefix, expected_selection)


def test_interval_area_chart_displays_dataframe(app: Page):
    chart = _get_selection_interval_area_chart(app)

    _create_selection_rectangle(
        app, chart, _MousePosition(120, 110), _MousePosition(225, 195)
    )

    expected_prefix = "Area chart with selection_interval:"
    expected_selection = "{'param_1': {'year': [1092053274725, 1383354197802], 'net_generation': [17319.534132841327, 36138.722324723254]}}"
    _expect_written_text(app, expected_prefix, expected_selection)


def test_point_histogram_chart_displays_dataframe(app: Page):
    chart = _get_selection_point_histogram(app)

    _click(app, chart, _MousePosition(255, 238))

    expected_prefix = "Histogram chart with selection_point:"
    expected_selection = "{'select': {'param_1': [{'IMDB_Rating': [8, 9]}]}}"
    _expect_written_text(app, expected_prefix, expected_selection)


def test_interval_histogram_chart_displays_dataframe(app: Page):
    chart = _get_selection_interval_histogram(app)

    _create_selection_rectangle(
        app, chart, _MousePosition(160, 210), _MousePosition(205, 200)
    )

    expected_prefix = "Histogram chart with selection_interval:"
    expected_selection = "{'select': {'param_1': {'IMDB_Rating': [4.575342465753424, 6.424657534246575]}}}"
    _expect_written_text(app, expected_prefix, expected_selection)


def test_double_click_interval_shows_no_dataframe(app: Page):
    chart = _get_selection_interval_scatter_chart(app)

    _create_selection_rectangle(
        app, chart, _MousePosition(130, 100), _MousePosition(215, 160)
    )

    expected_prefix = "Scatter chart with selection_interval:"
    expected_selection = "{'select': {'param_1': {'Horsepower': [69.39759036144578, 151.32530120481925], 'Miles_per_Gallon': [20.936635147601475, 32.00674584870848]}}}"
    _expect_written_text(app, expected_prefix, expected_selection)

    chart.dblclick(position={"x": 130, "y": 100})
    wait_for_app_run(app)
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(
        has_text=expected_prefix + " " + expected_selection
    )
    expect(selection_text).to_have_count(0)


def test_point_selection_scatter_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = _get_selection_point_scatter_chart(themed_app)

    _click(themed_app, chart, _MousePosition(162, 181))

    expected_prefix = "Scatter chart with selection_point:"
    expected_selection = "{'select': {'param_1': [{'Horsepower': 100, 'Miles_per_Gallon': 17, 'Origin': 'USA'}]}}"
    _expect_written_text(themed_app, expected_prefix, expected_selection)

    assert_snapshot(chart, name="st_altair_chart-scatter_single_selection_greyed")


def test_interval_selection_scatter_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = _get_selection_interval_scatter_chart(themed_app)

    _create_selection_rectangle(
        themed_app, chart, _MousePosition(165, 88), _MousePosition(265, 188)
    )

    expected_prefix = "Scatter chart with selection_interval:"
    expected_selection = "{'select': {'param_1': {'Horsepower': [103.13253012048193, 199.51807228915663], 'Miles_per_Gallon': [15.770583487084872, 34.22076798892989]}}}"
    _expect_written_text(themed_app, expected_prefix, expected_selection)

    assert_snapshot(chart, name="st_altair_chart-scatter_interval_selection_greyed")


def test_shift_click_point_selection_scatter_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = _get_selection_point_scatter_chart(themed_app)
    expect(chart).to_be_visible()
    chart.click(position={"x": 162, "y": 181})
    chart.click(position={"x": 157, "y": 146}, modifiers=["Shift"])
    wait_for_app_run(themed_app)

    expected_prefix = "Scatter chart with selection_point:"
    expected_selection = "{'select': {'param_1': [{'Horsepower': 100, 'Miles_per_Gallon': 17, 'Origin': 'USA'}, {'Horsepower': 97, 'Miles_per_Gallon': 23.9, 'Origin': 'Japan'}]}}"
    _expect_written_text(themed_app, expected_prefix, expected_selection)

    assert_snapshot(chart, name="st_altair_chart-scatter_double_selection_greyed")
