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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import click_button

EXPANDER_HEADER_IDENTIFIER = ".streamlit-expanderHeader"


def test_default_selection_first_tab(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.tabs has first tab selected as default."""
    assert_snapshot(app.get_by_test_id("stTabs"), name="st_tabs-default")


def test_maintains_selection_when_other_tab_added(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test st.tabs maintains selected tab if additional tab added."""
    tab_buttons = app.get_by_test_id("stTabs").locator("button[role=tab]")
    # Select Tab 2
    tab_buttons.nth(1).click()

    click_button(app, "Add Tab 3")

    # Wait for tabs to properly load
    wait_for_app_run(app, wait_delay=500)
    assert_snapshot(app.get_by_test_id("stTabs"), name="st_tabs-selection_add_tab")


def test_maintains_selection_when_other_tab_removed(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test st.tabs maintains selected tab if non-selected tab removed."""
    click_button(app, "Reset Tabs")
    click_button(app, "Add Tab 3")

    # Select Tab 3
    tab_buttons = app.get_by_test_id("stTabs").locator("button[role=tab]")
    tab_buttons.nth(2).click()

    click_button(app, "Remove Tab 1")

    # Wait for tabs to properly load
    wait_for_app_run(app, wait_delay=500)
    assert_snapshot(app.get_by_test_id("stTabs"), name="st_tabs-selection_remove_tab")


def test_resets_selection_when_selected_tab_removed(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test st.tabs resets selected tab to 1 if previously selected tab removed."""
    # Reset Tabs
    click_button(app, "Reset Tabs")

    wait_for_app_run(app)
    # Select Tab 2
    tab_buttons = app.get_by_test_id("stTabs").locator("button[role=tab]")
    tab_buttons.nth(1).click()

    click_button(app, "Remove Tab 2")

    # Wait for tabs to properly load
    wait_for_app_run(app, wait_delay=500)
    assert_snapshot(app.get_by_test_id("stTabs"), name="st_tabs-remove_selected")


def test_maintains_selection_when_same_name_exists(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test when tabs names change, keep selected tab if matching label still exists."""

    click_button(app, "Reset Tabs")
    click_button(app, "Add Tab 3")

    tab_buttons = app.get_by_test_id("stTabs").locator("button[role=tab]")
    tab_buttons.nth(1).click()

    # Ensure that the click worked and the highlight animation finished
    # to avoid issues with the snapshot later. The 'tab-highlight' element
    # is always visible for the selected tab and its always the same element
    # that simply changes the position using CSS transform.
    expect(tab_buttons.nth(1)).to_have_attribute("aria-selected", "true")
    tab_highlight_element = app.locator("[data-baseweb='tab-highlight']")
    expect(tab_highlight_element).to_be_visible()
    tab_highlight_element.evaluate(
        """
        element => Promise.all(
                element.getAnimations().map((animation) => animation.finished)
            )
        """
    )

    # Change Tab 1 & 3 Names
    click_button(app, "Change Tab 1 & 3")
    # Wait for tabs to properly load
    wait_for_app_run(app, wait_delay=500)
    assert_snapshot(app.get_by_test_id("stTabs"), name="st_tabs-change_some_names")


def test_resets_selection_when_tab_names_change(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test when tabs names change, reset selected tab if no matching label exists."""
    # Reset Tabs
    click_button(app, "Reset Tabs")

    wait_for_app_run(app)
    # Select Tab 2
    tab_buttons = app.get_by_test_id("stTabs").locator("button[role=tab]")
    tab_buttons.nth(1).click()

    click_button(app, "Change All Tabs")

    # Wait for tabs to properly load
    wait_for_app_run(app, wait_delay=500)
    assert_snapshot(app.get_by_test_id("stTabs"), name="st_tabs-change_all_names")
