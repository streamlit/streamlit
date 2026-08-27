# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import expect_text, get_multiselect


def _close_dropdown(app: Page) -> None:
    app.keyboard.press("Escape")
    expect(app.get_by_role("option")).to_have_count(0)


def test_select_all_parameter(app: Page):
    """select_all controls bulk-action visibility and thresholds."""
    # False: no bulk action; the first row is the first match.
    ms_false = get_multiselect(app, "select_all False")
    ms_false.scroll_into_view_if_needed()
    input_false = ms_false.locator("input")
    input_false.click()

    options = app.get_by_role("option")
    expect(options).to_have_count(3)
    expect(options.nth(0)).to_have_text("apple")
    expect(app.get_by_role("option", name="Select all")).not_to_be_visible()

    input_false.press_sequentially("ap")
    expect(app.get_by_role("option", name="Select 2 matches")).not_to_be_visible()
    expect(app.get_by_role("option")).to_have_count(2)
    expect(app.get_by_role("option").nth(0)).to_have_text("apple")

    app.get_by_role("option", name="apple", exact=True).click()
    wait_for_app_run(app)

    expect_text(app, "select_all False: ['apple']")
    expect(ms_false.locator('span[title="apricot"]')).not_to_be_visible()
    _close_dropdown(app)

    # True: Select all is shown.
    ms_true = get_multiselect(app, "select_all True")
    ms_true.scroll_into_view_if_needed()
    ms_true.locator("input").click()
    expect(app.get_by_role("option", name="Select all")).to_be_visible()
    _close_dropdown(app)

    # Integer threshold uses the filtered selectable count.
    ms_threshold = get_multiselect(app, "select_all threshold")
    ms_threshold.scroll_into_view_if_needed()
    input_threshold = ms_threshold.locator("input")
    input_threshold.click()

    expect(app.get_by_role("option", name="Select all")).not_to_be_visible()
    expect(app.get_by_role("option", name="alpha", exact=True)).to_be_visible()

    input_threshold.press_sequentially("al")
    select_matches = app.get_by_role("option", name="Select 3 matches")
    expect(select_matches).to_be_visible()
    expect(app.get_by_role("option", name="Select all")).not_to_be_visible()

    select_matches.click()
    wait_for_app_run(app)

    expect_text(app, "select_all threshold: ['alpha', 'alpine', 'alta']")
    _close_dropdown(app)

    # max_selections hides Select all once the cap is reached.
    ms_max = get_multiselect(app, "select_all with max_selections")
    ms_max.scroll_into_view_if_needed()
    input_max = ms_max.locator("input")
    input_max.click()

    expect(app.get_by_role("option", name="Select all")).to_be_visible()
    app.get_by_role("option", name="Select all").click()
    wait_for_app_run(app)

    expect_text(app, "select_all with max_selections: ['red', 'green']")
    _close_dropdown(app)

    input_max.click()
    expect(app.get_by_role("option", name="Select all")).not_to_be_visible()
    expect(app.get_by_test_id("stMultiSelectDropdown")).to_have_text(
        "You can only select up to 2 options. Remove an option first.",
        use_inner_text=True,
    )
    _close_dropdown(app)

    # Custom chips do not count toward the threshold.
    ms_chips = get_multiselect(app, "select_all custom chips")
    ms_chips.scroll_into_view_if_needed()
    input_chips = ms_chips.locator("input")
    input_chips.click()

    expect(app.get_by_role("option", name="Select all")).not_to_be_visible()
    input_chips.press_sequentially("custom")
    input_chips.press("Enter")
    wait_for_app_run(app)
    expect_text(app, "select_all custom chips: ['custom']")
    _close_dropdown(app)

    input_chips.click()
    expect(app.get_by_role("option", name="Select all")).not_to_be_visible()
    expect(app.get_by_role("option", name="one", exact=True)).to_be_visible()
