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
from e2e_playwright.shared.app_utils import get_multiselect


def test_fuzzy_search_type(app: Page):
    """Fuzzy search matches non-contiguous characters and ranks by relevance."""
    ms = get_multiselect(app, "fuzzy search")
    input_el = ms.locator("input")
    input_el.click()

    # "ple" fuzzy-matches Apple, Pineapple (and possibly others via fzy scoring)
    input_el.fill("ple")
    options = app.locator("li")
    # At minimum Apple and Pineapple should appear (+ "Select X matches" header)
    expect(options.first).to_be_visible()
    option_texts = options.all_inner_texts()
    assert "Apple" in option_texts
    assert "Pineapple" in option_texts
    # Banana should not match "ple"
    assert "Banana" not in option_texts

    # Select Apple via the dropdown
    app.get_by_role("option", name="Apple", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("value 1: ['Apple']")).to_be_visible()

    # Clear search for next test
    input_el.press("Escape")


def test_exact_search_type(app: Page):
    """Exact search only matches when the full label equals the query."""
    ms = get_multiselect(app, "exact search")
    input_el = ms.locator("input")
    input_el.click()

    # Partial input "app" should yield no results
    input_el.fill("app")
    expect(app.get_by_text("No results")).to_be_visible()

    # Full exact match (case-insensitive) should show only Apple
    input_el.fill("apple")
    options = app.locator("li")
    expect(options).to_have_count(1)
    expect(options.first).to_contain_text("Apple")

    # "pineapple" is a different option; should not appear for "apple"
    expect(app.get_by_role("option", name="Pineapple")).not_to_be_visible()

    # Select Apple
    app.get_by_role("option", name="Apple", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("value 2: ['Apple']")).to_be_visible()

    input_el.press("Escape")


def test_contains_search_type(app: Page):
    """Contains search matches any option whose label includes the substring."""
    ms = get_multiselect(app, "contains search")
    input_el = ms.locator("input")
    input_el.click()

    # "apple" as substring matches Apple and Pineapple
    input_el.fill("apple")
    options = app.locator("li")
    option_texts = options.all_inner_texts()
    assert "Apple" in option_texts
    assert "Pineapple" in option_texts
    # Banana does not contain "apple"
    assert "Banana" not in option_texts

    # "berry" matches only Blueberry
    input_el.fill("berry")
    options = app.locator("li")
    expect(options).to_have_count(1)
    expect(options.first).to_contain_text("Blueberry")

    # Select Blueberry
    app.get_by_role("option", name="Blueberry", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("value 3: ['Blueberry']")).to_be_visible()

    input_el.press("Escape")


def test_startswith_search_type(app: Page):
    """Starts-with search only matches options whose label begins with the query."""
    ms = get_multiselect(app, "startswith search")
    input_el = ms.locator("input")
    input_el.click()

    # "ap" matches Apple and Apricot but NOT Pineapple (contains "apple" mid-string)
    input_el.fill("ap")
    options = app.locator("li")
    option_texts = options.all_inner_texts()
    assert "Apple" in option_texts
    assert "Apricot" in option_texts
    assert "Pineapple" not in option_texts

    # "b" matches Banana and Blueberry
    input_el.fill("b")
    options = app.locator("li")
    option_texts = options.all_inner_texts()
    assert "Banana" in option_texts
    assert "Blueberry" in option_texts
    assert "Apple" not in option_texts

    # Select Banana
    app.get_by_role("option", name="Banana", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("value 4: ['Banana']")).to_be_visible()

    input_el.press("Escape")
