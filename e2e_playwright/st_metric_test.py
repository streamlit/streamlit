# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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


def test_first_metric_in_first_row(app: Page):
    expect(app.locator("[data-testid='stMetricLabel']").nth(0)).to_have_text(
        "User growth"
    )
    expect(app.locator("[data-testid='stMetricValue']").nth(0)).to_have_text(" 123 ")
    expect(app.locator("[data-testid='stMetricDelta']").nth(0)).to_have_text(" 123 ")


def test_second_metric_in_first_row(app: Page):
    expect(app.locator("[data-testid='stMetricLabel']").nth(2)).to_have_text("S&P 500")
    expect(app.locator("[data-testid='stMetricValue']").nth(2)).to_have_text(" -4.56 ")
    expect(app.locator("[data-testid='stMetricDelta']").nth(2)).to_have_text(" -50 ")


def test_third_metric_in_first_row(app: Page):
    expect(app.locator("[data-testid='stMetricLabel']").nth(4)).to_have_text(
        "Apples I've eaten"
    )
    expect(app.locator("[data-testid='stMetricValue']").nth(4)).to_have_text(" 23k ")
    expect(app.locator("[data-testid='stMetricDelta']").nth(4)).to_have_text(" -20 ")


def test_green_up_arrow_render(themed_app: Page, assert_snapshot: ImageCompareFunction):
    assert_snapshot(
        themed_app.locator('[data-testid="stMetric"]').nth(0),
        name="stMetric-green",
    )


def test_red_down_arrow_render(themed_app: Page, assert_snapshot: ImageCompareFunction):
    assert_snapshot(
        themed_app.locator('[data-testid="stMetric"]').nth(2),
        name="stMetric-red",
    )


def test_gray_down_arrow_render(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    assert_snapshot(
        themed_app.locator('[data-testid="stMetric"]').nth(4),
        name="stMetric-gray",
    )


def test_help_shows_up_without_columns(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    assert_snapshot(
        themed_app.locator('[data-testid="stMetric"]').nth(6),
        name="metric-with-help",
    )


def test_none_results_in_dash_in_value(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    assert_snapshot(
        themed_app.locator('[data-testid="stMetric"]').nth(7),
        name="metric-with-none-value",
    )


def test_label_visibility_set_to_hidden(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    expect(themed_app.locator("[data-testid='stMetricLabel']").nth(3)).to_have_text(
        "Test 4"
    )
    assert_snapshot(
        themed_app.locator('[data-testid="stMetric"]').nth(3),
        name="metric-label-hidden",
    )


def test_label_visibility_set_to_collapse(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    expect(themed_app.locator("[data-testid='stMetricLabel']").nth(5)).to_have_text(
        "Test 5"
    )
    assert_snapshot(
        themed_app.locator('[data-testid="stMetric"]').nth(5),
        name="metric-label-collapse",
    )


def test_ellipses_and_help_shows_up_properly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    assert_snapshot(
        themed_app.locator('[data-testid="stMetric"]').nth(8),
        name="metric-help-and-ellipses",
    )
