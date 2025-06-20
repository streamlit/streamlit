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

from e2e_playwright.shared.app_utils import click_checkbox


def _expect_numeric_tabs(app: Page):
    tabs = app.get_by_test_id("stTabs")
    expect(tabs).to_have_count(1)
    tab_buttons = tabs.locator("button")
    expect(tab_buttons).to_have_count(2)
    expect(tab_buttons.nth(0)).to_have_text("Tab 1")
    expect(tab_buttons.nth(1)).to_have_text("Tab 2")


def _expect_letter_tabs(app: Page):
    tabs = app.get_by_test_id("stTabs")
    expect(tabs).to_have_count(1)
    tab_buttons = tabs.locator("button")
    expect(tab_buttons).to_have_count(3)
    expect(tab_buttons.nth(0)).to_have_text("Tab A")
    expect(tab_buttons.nth(1)).to_have_text("Tab B")
    expect(tab_buttons.nth(2)).to_have_text("Tab C")


def test_correct_tabs_are_shown_and_no_ghost_tabs(app: Page):
    """When we render a different amount of tabs, we want the
    correct tabs to show and no tabs from the previous fragment
    run (see issue https://github.com/streamlit/streamlit/issues/9158).
    """
    _expect_numeric_tabs(app)

    # Ensure that this works for multiple runs
    for _ in range(10):
        click_checkbox(app, "Yes or No")
        _expect_letter_tabs(app)

        click_checkbox(app, "Yes or No")
        _expect_numeric_tabs(app)
