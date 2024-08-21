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


def test_sidebar_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    sidebar = themed_app.get_by_test_id("stSidebar")
    assert_snapshot(sidebar, name="st_sidebar-display")


def test_sidebar_date_input_popover(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Handles z-index of date input popover correctly."""
    date_inputs = themed_app.get_by_test_id("stSidebar").get_by_test_id("stDateInput")
    expect(date_inputs).to_have_count(2)

    date_inputs.first.click()
    assert_snapshot(
        themed_app.get_by_test_id("stSidebar"), name="st_sidebar-date_popover"
    )


def test_sidebar_overwriting_elements(app: Page):
    sidebar_text = app.get_by_test_id("stSidebar").get_by_test_id("stText")
    expect(sidebar_text).to_contain_text("overwritten")


def test_sidebar_collapse_on_mobile_resize(app: Page):
    app.set_viewport_size({"width": 800, "height": 400})
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    app.set_viewport_size({"width": 400, "height": 800})
    expect(sidebar).to_have_attribute("aria-expanded", "false")


def test_sidebar_no_collapse_on_text_input_mobile(app: Page):
    app.set_viewport_size({"width": 400, "height": 800})

    # Expand the sidebar on mobile
    app.get_by_test_id("stSidebarCollapsedControl").locator("button").click()

    app.get_by_test_id("stSidebar").get_by_test_id("stTextInput").locator(
        "input"
    ).click()

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    expect(app.get_by_test_id("stSidebar").first).to_have_class("stSidebar")
