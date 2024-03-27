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


def test_point_selection_repeat_scatter_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(0)
    expect(chart).to_be_visible()
    # Pick Non First chart
    themed_app.mouse.move(750, 250)
    themed_app.mouse.down()
    themed_app.mouse.up()

    expect(themed_app.get_by_test_id("stDataFrame")).to_have_count(1)
    assert_snapshot(chart, name="st_altair_chart-repeat_scatter_single_selection")


def test_interval_selection_repeat_scatter_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(0)
    expect(chart).to_be_visible()
    themed_app.mouse.move(450, 500)
    themed_app.mouse.down()
    themed_app.mouse.move(500, 550)
    themed_app.mouse.up()

    expect(themed_app.get_by_test_id("stDataFrame")).to_have_count(1)
    assert_snapshot(chart, name="st_altair_chart-repeat_scatter_interval_selection")


def test_point_layered_chart_displays_dataframe_and_can_reset(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(1)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()
    themed_app.mouse.move(455, 295)
    themed_app.mouse.down()
    themed_app.mouse.up()

    assert_snapshot(chart, name="st_altair_chart-layered_chart_point_selection_greyed")
    expect(themed_app.get_by_test_id("stDataFrame")).to_have_count(1)

    # Click on empty space on graph
    themed_app.mouse.move(400, 230)
    themed_app.mouse.down()
    themed_app.mouse.up()

    assert_snapshot(chart, name="st_altair_chart-layered_chart_original")
    expect(themed_app.get_by_test_id("stDataFrame")).to_have_count(0)


def test_point_facet_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(2)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()
    themed_app.mouse.move(825, 300)
    themed_app.mouse.down()
    themed_app.mouse.up()

    expect(themed_app.get_by_test_id("stDataFrame")).to_have_count(1)


def test_interval_vconcat_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(3)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()
    themed_app.mouse.move(600, 450)
    themed_app.mouse.down()
    themed_app.mouse.move(700, 450)
    themed_app.mouse.up()

    expect(themed_app.get_by_test_id("stDataFrame")).to_have_count(1)
    assert_snapshot(chart, name="st_altair_chart-vconcat_chart_interval")


def test_interval_hconcat_chart_displays_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    chart = themed_app.get_by_test_id("stArrowVegaLiteChart").nth(4)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()
    themed_app.mouse.move(450, 450)
    themed_app.mouse.down()
    themed_app.mouse.move(350, 350)
    themed_app.mouse.up()

    expect(themed_app.get_by_test_id("stDataFrame")).to_have_count(1)
    expect(themed_app.get_by_text("Hello world")).to_be_visible()
    assert_snapshot(chart, name="st_altair_chart-hconcat_chart_interval")
