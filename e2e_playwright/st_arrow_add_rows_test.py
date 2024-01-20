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


def test_that_no_new_elements_are_created(app: Page):
    expect(app.get_by_test_id("stTable")).to_be_visible()
    expect(app.get_by_test_id("stDataFrame")).to_be_visible()
    expect(app.get_by_test_id("stArrowVegaLiteChart")).to_have_count(6)


def test_correctly_adds_rows_to_table(app: Page):
    expect(
        app.locator(".element-container [data-testid='stTable'] tbody tr")
    ).to_have_count(4)


def test_correctly_adds_rows_to_charts(
    app: Page, assert_snapshot: ImageCompareFunction
):
    charts = app.get_by_test_id("stArrowVegaLiteChart")
    for index in charts.count():
        assert_snapshot(charts.nth(index), name=f"arrowstArrowVegaLiteChart-{index}")


def test_correctly_adds_rows_to_dataframe(
    app: Page, assert_snapshot: ImageCompareFunction
):
    dataframes = app.locator(".element-container .stDataFrame")
    for index in dataframes.count():
        assert_snapshot(dataframes.nth(index), name=f"dataFrame-{index}")


def test_raises_an_exception_when_shapes_dont_match(app: Page):
    expect(app.get_by_test_id("stAlert")).to_be_visible()
