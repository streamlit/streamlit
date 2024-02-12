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


def test_altair_chart_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    expect(
        themed_app.get_by_test_id("stArrowVegaLiteChart").locator("canvas")
    ).to_have_count(10)
    charts = themed_app.get_by_test_id("stArrowVegaLiteChart")
    expect(charts).to_have_count(10)
    snapshot_names = [
        "st_altair_chart-scatter-chart-default-theme",
        "st_altair_chart-scatter-chart-streamlit-theme",
        "st_altair_chart-scatter-chart-overwritten-theme",
        "st_altair_chart-bar-chart-overwritten-theme",
        "st_altair_chart-pie-chart-large-legend-items",
        "st_altair_chart-grouped-bar-chart-default-theme",
        "st_altair_chart-grouped-bar-chart-streamlit-theme",
        "st_altair_chart-grouped-use_container_width_default_theme"
        "st_altair_chart-grouped-layered_line_chart_streamlit_theme",
    ]
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            charts.nth(i),
            name=name,
        )
