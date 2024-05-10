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


def _click(app: Page, chart: Locator, click_position: _MousePosition) -> None:
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
    chart.click(position={"x": click_position.x, "y": click_position.y})
    wait_for_app_run(app)


def _expect_written_text(app: Page, expected_prefix: str, expected_selection: str):
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(
        has_text=expected_prefix
    )
    expected_selection = expected_prefix + " " + expected_selection
    expect(selection_text).to_have_text(expected_selection)


def test_point_facet_chart_displays_selection(app: Page):
    chart = app.get_by_test_id("stArrowVegaLiteChart").nth(2)

    _click(app, chart, _MousePosition(215, 174))

    _expect_written_text(
        app,
        "Facet chart selection:",
        "{'select': {'param_1': [{'petalLength': 1.4, 'petalWidth': 0.3}]}}",
    )


def test_point_selection_repeat_scatter_chart_displays_selection_and_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(0)

    # Click on top-right chart
    _click(themed_app, chart, _MousePosition(469, 65))

    _expect_written_text(
        themed_app,
        "Repeat Scatter Chart selection:",
        "{'select': {'param_1': [{'sepalWidth': 3, 'petalLength': 4.8}]}}",
    )

    assert_snapshot(chart, name="st_altair_chart-repeat_scatter_single_selection")


def test_interval_selection_repeat_scatter_chart_displays_selection_and_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(0)

    _create_selection_rectangle(
        themed_app, chart, _MousePosition(160, 330), _MousePosition(211, 377)
    )

    _expect_written_text(
        themed_app,
        "Repeat Scatter Chart selection:",
        "{'select': {'param_2': {'sepalLength': [3.96, 6], 'petalWidth': [1.3297578125, 1.9407578125]}}}",
    )

    assert_snapshot(chart, name="st_altair_chart-repeat_scatter_interval_selection")


def test_point_layered_chart_displays_selection_and_can_reset_snapshots(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(1)

    _click(themed_app, chart, _MousePosition(168, 116))

    _expect_written_text(
        themed_app,
        "Layered Chart selection:",
        "{'select': {'param_1': [{'date': 1164927600000, 'price': '460.48'}]}}",
    )

    assert_snapshot(chart, name="st_altair_chart-layered_chart_point_selection_greyed")

    # Click on empty space on graph
    _click(themed_app, chart, _MousePosition(100, 50))
    expected = "Layered Chart selection: {'select': {'param_1': [{'date': 1164927600000, 'price': '460.48'}]}}"
    selection_text = themed_app.get_by_test_id("stMarkdownContainer").filter(
        has_text=expected
    )
    expect(selection_text).to_have_count(0)
    assert_snapshot(chart, name="st_altair_chart-layered_chart_original")


def test_interval_vconcat_chart_displays_selection_and_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(3)

    _create_selection_rectangle(
        themed_app, chart, _MousePosition(311, 279), _MousePosition(411, 337)
    )

    _expect_written_text(
        themed_app,
        "Vconcat Chart selection:",
        "{'select': {'param_1': {'date': [1073898864000, 1127351664000]}}}",
    )

    assert_snapshot(chart, name="st_altair_chart-vconcat_chart_interval")


def test_interval_hconcat_chart_displays_selection_and_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(4)

    _create_selection_rectangle(
        themed_app, chart, _MousePosition(62, 173), _MousePosition(161, 272)
    )

    _expect_written_text(
        themed_app,
        "Hconcat Chart selection:",
        "{'select': {'param_1': {'petalLength': [0.023333333333333334, 2.333333333333333], 'petalWidth': [0.24733854166666658, 1.1053385416666668]}}}",
    )

    expect(themed_app.get_by_text("Hconcat callback called!")).to_be_visible()
    assert_snapshot(chart, name="st_altair_chart-hconcat_chart_interval")
