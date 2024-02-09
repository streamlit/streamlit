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
    expect(themed_app.locator(".element-container")).to_have_count(16)
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            themed_app.locator(".element-container .stPlotlyChart").nth(i),
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
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            themed_app.locator(".element-container .stPlotlyChart").nth(i),
            name=name,
        )
