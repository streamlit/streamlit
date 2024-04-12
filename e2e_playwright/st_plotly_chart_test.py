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


import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


# Only do chromium as this can create a lot of screenshots
# there should be no differences between chrome and safari and firefox
@pytest.mark.only_browser("chromium")
def test_plotly_has_consistent_visuals(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    snapshot_names = [
        "st_plotly_chart-none-theme",
        "st_plotly_chart-streamlit-theme-use-container-width",
        "st_plotly_chart-candlestick-streamlit-theme",
        "st_plotly_chart-sunburst-custom-color",
        "st_plotly_chart-contour-heatmap-together",
        "st_plotly_chart-waterfall-chart-custom-height-and-width",
        "st_plotly_chart-ternary-chart",
        "st_plotly_chart-table-plot",
        "st_plotly_chart-electric-colorscale",
        "st_plotly_chart-discrete-sequence",
        "st_plotly_chart-layout-customization",
        "st_plotly_chart-template-customization",
        "st_plotly_chart-histogram-chart",
    ]
    expect(themed_app.locator(".stPlotlyChart")).to_have_count(16)
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            themed_app.locator(".stPlotlyChart").nth(i),
            name=name,
        )


def test_plotly_has_correct_visuals(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    snapshot_names = [
        "st_plotly_chart-line-chart-specific-height-width",
        "st_plotly_chart-use-container-width-false-and-specified-height",
        "st_plotly_chart-none-theme-and-use-container-width",
    ]
    plotly_indices = [13, 14, 15]
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            themed_app.locator(".stPlotlyChart").nth(plotly_indices[i]),
            name=name,
        )


def test_plotly_use_container_width_false_fullscreen(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    index = 14
    themed_app.locator(".stPlotlyChart").nth(index).hover()
    fullscreen_button = themed_app.get_by_test_id("StyledFullScreenButton").nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.locator(".stPlotlyChart").nth(index),
        name="st_plotly_chart-container_width_false_fullscreen",
    )

    fullscreen_button = themed_app.get_by_test_id("StyledFullScreenButton").nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.locator(".stPlotlyChart").nth(index),
        name="st_plotly_chart-container_width_false_exited_fullscreen",
    )


def test_plotly_use_container_width_true_fullscreen(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    index = 15
    themed_app.locator(".stPlotlyChart").nth(index).hover()
    fullscreen_button = themed_app.get_by_test_id("StyledFullScreenButton").nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.locator(".stPlotlyChart").nth(index),
        name="st_plotly_chart-container_width_true_fullscreen",
    )

    fullscreen_button = themed_app.get_by_test_id("StyledFullScreenButton").nth(index)
    fullscreen_button.hover()
    fullscreen_button.click()
    assert_snapshot(
        themed_app.locator(".stPlotlyChart").nth(index),
        name="st_plotly_chart-container_width_true_exited_fullscreen",
    )
