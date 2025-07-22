# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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


def test_st_map_has_no_stale_elements(
    themed_app: Page,
):
    maps = themed_app.get_by_test_id("stDeckGlJsonChart")
    expect(maps).to_have_count(3)

    selectbox = themed_app.get_by_test_id("stSelectbox").first
    selectbox.locator("input").first.click()
    selection_dropdown = themed_app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").nth(1).click()

    expect(maps).to_have_count(3)

    selectbox.locator("input").first.click()
    selection_dropdown = themed_app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").nth(0).click()

    expect(maps).to_have_count(3)
