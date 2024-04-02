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


def test_altair_chart_displays_date_axes_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    charts = themed_app.get_by_test_id("stArrowVegaLiteChart")
    expect(charts).to_have_count(3)
    snapshot_names = [
        "st_altair_chart-utc_area_chart",
        "st_altair_chart-utc_bar_chart",
        "st_altair_chart-utc_line_chart",
    ]
    for i, name in enumerate(snapshot_names):
        assert_snapshot(
            charts.nth(i),
            name=name,
        )
