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

from e2e_playwright.conftest import ImageCompareFunction


# Only do chromium as this can create a lot of screenshots
# there should be no differences between chrome and safari and firefox
@pytest.mark.only_browser("chromium")
def test_plotly_has_consistent_visuals(
    app: Page, assert_snapshot: ImageCompareFunction
):
    expect(app.locator(".element-container")).to_have_count(16)
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(0),
        name="st_plotly_chart-none-theme",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(1),
        name="st_plotly_chart-streamlit-theme-use-container-width",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(2),
        name="st_plotly_chart-candlestick-streamlit-theme",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(3),
        name="st_plotly_chart-sunburst-custom-color",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(4),
        name="st_plotly_chart-contour-heatmap-together",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(5),
        name="st_plotly_chart-waterfall-chart-custom-height-and-width",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(6),
        name="st_plotly_chart-ternary-chart",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(7),
        name="st_plotly_chart-table-plot",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(8),
        name="st_plotly_chart-electric-colorscale",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(9),
        name="st_plotly_chart-discrete-sequence",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(10),
        name="st_plotly_chart-layout-customization",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(11),
        name="st_plotly_chart-template-customization",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(12),
        name="st_plotly_chart-histogram-chart",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(13),
        name="st_plotly_chart-line-chart-specific-height-width",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(14),
        name="st_plotly_chart-use-container-width-false-and-specified-height",
    )
    assert_snapshot(
        app.locator(".element-container .stPlotlyChart").nth(15),
        name="st_plotly_chart-none-theme-and-use-container-width",
    )
