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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def test_displays_maps_properly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    map_charts = themed_app.get_by_test_id("stDeckGlJsonChart")
    expect(map_charts).to_have_count(7)
    expect(themed_app.locator(".zoomButton")).to_have_count(7)

    data_warning_caps = themed_app.get_by_test_id("stCaptionContainer")
    expect(data_warning_caps).to_have_count(2)
    expect(data_warning_caps.nth(0)).to_have_text(
        "⚠️ Showing only 10k rows. Call collect() on the dataframe to show more."
    )
    expect(data_warning_caps.nth(1)).to_have_text(
        "⚠️ Showing only 10k rows. Call collect() on the dataframe to show more."
    )

    assert_snapshot(map_charts.nth(5), name="st_map-basic")
    wait_for_app_run(themed_app, 10000)
    assert_snapshot(map_charts.nth(6), name="st_map-complex")
