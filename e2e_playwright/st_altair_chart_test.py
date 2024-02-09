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


def test_that_altair_charts_display_correct(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    ST_ALTAIR_CHART = "st_altair_chart"
    snapshot_names = [
        f"{ST_ALTAIR_CHART}-scatter-chart-default-theme",
        f"{ST_ALTAIR_CHART}-scatter-chart-streamlit-theme",
        f"{ST_ALTAIR_CHART}-scatter-chart-overwritten-theme",
        f"{ST_ALTAIR_CHART}-bar-chart-overwritten-theme",
        f"{ST_ALTAIR_CHART}-pie-chart-large-legend-items",
        f"{ST_ALTAIR_CHART}-grouped-bar-chart-default-theme",
        f"{ST_ALTAIR_CHART}-grouped-bar-chart-streamlit-theme",
    ]
    expect(themed_app.get_by_test_id("stArrowVegaLiteChart")).to_have_count(16)
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            themed_app.get_by_test_id("stArrowVegaLiteChart").nth(i),
            name=name,
        )
