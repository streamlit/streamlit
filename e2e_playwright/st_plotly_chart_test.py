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
    ST_PLOTLY_CHART = f"{ST_PLOTLY_CHART}-"
    snapshot_names = [
        f"{ST_PLOTLY_CHART}-none-theme",
        f"{ST_PLOTLY_CHART}-streamlit-theme-use-container-width",
        f"{ST_PLOTLY_CHART}-candlestick-streamlit-theme",
        f"{ST_PLOTLY_CHART}-sunburst-custom-color",
        f"{ST_PLOTLY_CHART}-contour-heatmap-together",
        f"{ST_PLOTLY_CHART}-waterfall-chart-custom-height-and-width",
        f"{ST_PLOTLY_CHART}-ternary-chart",
        f"{ST_PLOTLY_CHART}-table-plot",
        f"{ST_PLOTLY_CHART}-electric-colorscale",
        f"{ST_PLOTLY_CHART}-discrete-sequence",
        f"{ST_PLOTLY_CHART}-layout-customization",
        f"{ST_PLOTLY_CHART}-template-customization",
        f"{ST_PLOTLY_CHART}-histogram-chart",
        f"{ST_PLOTLY_CHART}-line-chart-specific-height-width",
        f"{ST_PLOTLY_CHART}-use-container-width-false-and-specified-height",
        f"{ST_PLOTLY_CHART}-none-theme-and-use-container-width",
    ]
    expect(themed_app.locator(".element-container")).to_have_count(16)
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            themed_app.locator(".element-container .stPlotlyChart").nth(i),
            name=name,
        )
