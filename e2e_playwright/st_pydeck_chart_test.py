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


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.only_browser("chromium")
def test_pydeck_chart_has_consistent_visuals(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    pydeck_charts = themed_app.get_by_test_id("stDeckGlJsonChart")
    expect(pydeck_charts).to_have_count(3)

    assert_snapshot(pydeck_charts.nth(0), name="st_pydeck_chart-empty")

    wait_for_app_run(themed_app, 20000)
    assert_snapshot(
        pydeck_charts.nth(1).locator("canvas").nth(0),
        name="st_pydeck_chart-san_francisco",
    )

    wait_for_app_run(themed_app, 20000)
    assert_snapshot(
        pydeck_charts.nth(2).locator("canvas").nth(1), name="st_pydeck_chart-continents"
    )
