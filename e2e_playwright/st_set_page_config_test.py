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


def test_sets_page_favicon(app: Page):
    favicon = app.locator("link[rel='shortcut icon']")
    expect(favicon).to_have_attribute(
        "href",
        "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f988.png",
    )


def test_sets_page_title(app: Page):
    expect(app).to_have_title("Heya, world?")


def test_collapses_sidebar(app: Page):
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "false")


def test_sets_page_in_wide_mode(app: Page):
    app_view_container = app.get_by_test_id("stAppViewContainer")
    expect(app_view_container).to_have_attribute("data-layout", "wide")


def test_displays_in_wide_mode(app: Page, assert_snapshot: ImageCompareFunction):
    app_view_container = app.get_by_test_id("stAppViewContainer")
    assert_snapshot(app_view_container, name="wide-mode")


def test_double_setting_set_page_config(app: Page):
    # Rerun the script to ensure a fresh slate
    app.keyboard.press("r")
    wait_for_app_run(app)

    # Test: should not display an error when st.set_page_config is used after an st.* command in a callback
    app.get_by_test_id("stButton").nth(1).click()
    expect(app.get_by_test_id("stException")).not_to_be_visible()
    expect(app).to_have_title("Heya, world?")

    # Test: should display an error when st.set_page_config is called multiple times in a callback
    app.get_by_test_id("stButton").nth(2).click()
    expect(app.get_by_test_id("stException")).to_contain_text(
        "set_page_config() can only be called once per app page"
    )
    expect(app).to_have_title("Change 1")

    # Test: should display an error when st.set_page_config is called after being called in a callback
    app.get_by_test_id("stButton").nth(3).click()
    expect(app.get_by_test_id("stException")).to_contain_text(
        "set_page_config() can only be called once per app page"
    )
    expect(app).to_have_title("Change 3")
