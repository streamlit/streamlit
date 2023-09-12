# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

EXPANDER_HEADER_IDENTIFIER = ".streamlit-expanderHeader"


def test_default_selection_first_tab(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.tabs has first tab selected as default."""
    assert_snapshot(app.locator(".stTabs"), name="tabs-default")


def test_maintains_selection_when_other_tab_added(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test st.tabs maintains selected tab if additional tab added."""
    control_buttons = app.locator(".stButton")
    tab_buttons = app.locator(".stTabs button[role=tab]")
    # Select Tab 2
    tab_buttons.nth(1).click()
    # Select Add Tab 3 button
    control_buttons.nth(0).click()
    # Wait for tabs to properly load
    wait_for_app_run(app)
    # Tab add/remove/switch can still be in process despite app run finishing.
    app.wait_for_timeout(1000)
    assert_snapshot(app.locator(".stTabs"), name="tabs-selection-add-tab")


def test_maintains_selection_when_other_tab_removed(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test st.tabs maintains selected tab if non-selected tab removed."""
    control_buttons = app.locator(".stButton")
    # Reset Tabs
    control_buttons.nth(5).click()
    wait_for_app_run(app)
    # Add Tab 3
    control_buttons.nth(0).click()
    # Select Tab 3
    tab_buttons = app.locator(".stTabs button[role=tab]")
    tab_buttons.nth(2).click()
    # Select Remove Tab 1 button
    control_buttons.nth(1).click()
    # Wait for tabs to properly load
    wait_for_app_run(app)
    app.wait_for_timeout(1000)
    assert_snapshot(app.locator(".stTabs"), name="tabs-selection-remove-tab")


def test_resets_selection_when_selected_tab_removed(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test st.tabs resets selected tab to 1 if previously selected tab removed."""
    control_buttons = app.locator(".stButton")
    # Reset Tabs
    control_buttons.nth(5).click()
    wait_for_app_run(app)
    # Select Tab 2
    tab_buttons = app.locator(".stTabs button[role=tab]")
    tab_buttons.nth(1).click()
    # Select Remove Tab 2 button
    control_buttons.nth(2).click()
    # Wait for tabs to properly load
    wait_for_app_run(app)
    app.wait_for_timeout(1000)
    assert_snapshot(app.locator(".stTabs"), name="tabs-remove-selected")


def test_maintains_selection_when_same_name_exists(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test when tabs names change, keeps selected tab if matching label still exists."""
    control_buttons = app.locator(".stButton")
    # Reset Tabs
    control_buttons.nth(5).click()
    wait_for_app_run(app)
    # Add Tab 3
    control_buttons.nth(0).click()
    # Select Tab 2
    tab_buttons = app.locator(".stTabs button[role=tab]")
    tab_buttons.nth(1).click()
    # Change Tab 1 & 3 Names
    control_buttons.nth(3).click()
    # Wait for tabs to properly load
    wait_for_app_run(app)
    app.wait_for_timeout(1000)
    assert_snapshot(app.locator(".stTabs"), name="tabs-change-some-names")


def test_resets_selection_when_tab_names_change(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test when tabs names change, reset selected tab if no matching label exists."""
    control_buttons = app.locator(".stButton")
    # Reset Tabs
    control_buttons.nth(5).click()
    wait_for_app_run(app)
    # Select Tab 2
    tab_buttons = app.locator(".stTabs button[role=tab]")
    tab_buttons.nth(1).click()
    # Change All Tab Names
    control_buttons.nth(4).click()
    # Wait for tabs to properly load
    wait_for_app_run(app)
    app.wait_for_timeout(1000)
    assert_snapshot(app.locator(".stTabs"), name="tabs-change-all-names")
