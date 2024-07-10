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
from e2e_playwright.shared.app_utils import get_expander


def test_tabs_render_correctly(themed_app: Page, assert_snapshot: ImageCompareFunction):
    st_tabs = themed_app.get_by_test_id("stTabs")
    expect(st_tabs).to_have_count(3)

    st_tabs.nth(2).filter(has_text="Tab 2").click()
    st_tabs.nth(2).filter(has_text="Tab 0").click()

    assert_snapshot(st_tabs.nth(0), name="st_tabs-sidebar")
    assert_snapshot(st_tabs.nth(1), name="st_tabs-text_input")
    assert_snapshot(st_tabs.nth(2), name="st_tabs-many")


def test_displays_correctly_in_sidebar(app: Page):
    expect(app.get_by_test_id("stSidebar").get_by_test_id("stTab")).to_have_count(2)
    expect(app.get_by_text("I am in the sidebar")).to_have_count(1)
    expect(app.get_by_text("I am in the sidebarI'm also in the sidebar")).to_have_count(
        1
    )


def test_contains_all_tabs_when_overflowing(app: Page):
    expect(get_expander(app, "Expander").get_by_test_id("stTab")).to_have_count(25)
