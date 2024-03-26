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


def test_point_selection_scatter_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(0)
    expect(chart).to_be_visible()
    themed_app.mouse.move(450, 410)
    themed_app.mouse.down()
    themed_app.mouse.up()

    expect(themed_app.get_by_test_id("stDataFrame")).to_have_count(1)
    assert_snapshot(chart, name="st_altair_chart-scatter_single_selection_greyed")


def test_interval_selection_scatter_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(1)
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
    chart.hover()
    themed_app.mouse.move(450, 450)
    themed_app.mouse.down()
    themed_app.mouse.move(550, 550)
    themed_app.mouse.up()

    expect(themed_app.get_by_test_id("stDataFrame")).to_have_count(1)
    assert_snapshot(chart, name="st_altair_chart-scatter_interval_selection_greyed")


def test_point_bar_chart_displays_dataframe(app: Page):
    chart = app.get_by_test_id("stArrowVegaLiteChart").nth(2)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()
    chart.hover()
    app.mouse.move(435, 410)
    app.mouse.down()
    app.mouse.up()

    expect(app.get_by_test_id("stDataFrame")).to_have_count(1)


def test_interval_bar_chart_displays_dataframe(app: Page):
    chart = app.get_by_test_id("stArrowVegaLiteChart").nth(3)
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
    chart.hover()
    app.mouse.move(350, 350)
    app.mouse.down()
    app.mouse.move(450, 450)
    app.mouse.up()

    expect(app.get_by_test_id("stDataFrame")).to_have_count(1)


def test_point_area_chart_displays_dataframe(app: Page):
    chart = app.get_by_test_id("stArrowVegaLiteChart").nth(4)
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
    app.mouse.move(435, 435)
    app.mouse.down()
    app.mouse.up()

    expect(app.get_by_test_id("stDataFrame")).to_have_count(1)


def test_interval_area_chart_displays_dataframe(app: Page):
    chart = app.get_by_test_id("stArrowVegaLiteChart").nth(5)
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
    chart.hover()
    app.mouse.move(400, 400)
    app.mouse.down()
    app.mouse.move(425, 425)
    app.mouse.up()

    expect(app.get_by_test_id("stDataFrame")).to_have_count(1)


def test_point_histogram_chart_displays_dataframe(app: Page):
    chart = app.get_by_test_id("stArrowVegaLiteChart").nth(6)
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
    app.mouse.move(450, 400)
    app.mouse.down()
    app.mouse.up()

    expect(app.get_by_test_id("stDataFrame")).to_have_count(1)


def test_interval_histogram_chart_displays_dataframe(app: Page):
    chart = app.get_by_test_id("stArrowVegaLiteChart").nth(7)
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
    chart.hover()
    app.mouse.move(400, 400)
    app.mouse.down()
    app.mouse.move(425, 425)
    app.mouse.up()

    expect(app.get_by_test_id("stDataFrame")).to_have_count(1)


def test_shift_click_point_selection_scatter_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(0)
    expect(chart).to_be_visible()
    themed_app.mouse.move(450, 410)
    themed_app.mouse.down()
    themed_app.mouse.up()

    themed_app.keyboard.down("Shift")
    themed_app.mouse.move(445, 375)
    themed_app.mouse.down()
    themed_app.mouse.up()

    expect(themed_app.get_by_test_id("stDataFrame")).to_have_count(1)
    assert_snapshot(chart, name="st_altair_chart-scatter_double_selection_greyed")
