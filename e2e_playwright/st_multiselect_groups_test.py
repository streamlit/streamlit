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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import get_multiselect


def _open_dropdown(app: Page, label: str) -> Locator:
    """Open a multiselect dropdown and return the input element."""
    ms = get_multiselect(app, label)
    input_el = ms.locator("input")
    input_el.click()
    return input_el


def test_group_fuzzy_shows_group_headers(app: Page):
    """Group-fuzzy shows group headers when browsing the dropdown."""
    input_el = _open_dropdown(app, "group-fuzzy search")

    options = app.locator("li")
    option_texts = options.all_inner_texts()
    assert "Select all" in option_texts
    assert "Select all Fruits" in option_texts
    assert "Select all Vegetables" in option_texts
    assert "Apple" in option_texts
    assert "Broccoli" in option_texts

    input_el.press("Escape")


def test_group_fuzzy_preserves_groups_during_search(app: Page):
    """Group-fuzzy keeps group structure during search."""
    input_el = _open_dropdown(app, "group-fuzzy search")

    input_el.fill("a")
    options = app.locator("li")
    option_texts = options.all_inner_texts()
    # "a" fuzzy-matches options in both groups; group headers should still appear
    has_group_header = any("Fruits" in t for t in option_texts)
    assert has_group_header, f"Expected a Fruits group header, got: {option_texts}"

    input_el.press("Escape")


def test_group_fuzzy_select_all_group(app: Page):
    """Clicking 'Select all {group}' selects only that group's items."""
    input_el = _open_dropdown(app, "group-fuzzy search")

    app.get_by_role("option", name="Select all Fruits").click()
    wait_for_app_run(app)
    expect(app.get_by_text("value 1: ['Apple', 'Banana', 'Cherry']")).to_be_visible()

    input_el.press("Escape")


def test_group_exact_filters_within_groups(app: Page):
    """Group-exact only matches exact labels, preserving group structure."""
    input_el = _open_dropdown(app, "group-exact search")

    # Partial match should yield no results
    input_el.fill("app")
    expect(app.get_by_text("No results")).to_be_visible()

    # Exact match
    input_el.fill("Apple")
    options = app.locator("li")
    expect(options).to_have_count(1)
    expect(options.first).to_contain_text("Apple")

    app.get_by_role("option", name="Apple", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("value 2: ['Apple']")).to_be_visible()

    input_el.press("Escape")


def test_group_contains_filters_within_groups(app: Page):
    """Group-contains matches substrings while preserving group structure."""
    input_el = _open_dropdown(app, "group-contains search")

    # "ar" as substring matches Carrot (contains "ar") — and possibly others
    input_el.fill("ar")
    options = app.locator("li")
    option_texts = options.all_inner_texts()
    assert "Carrot" in option_texts

    app.get_by_role("option", name="Carrot", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("value 3: ['Carrot']")).to_be_visible()

    input_el.press("Escape")


def test_group_startswith_filters_within_groups(app: Page):
    """Group-startswith matches prefix while preserving group structure."""
    input_el = _open_dropdown(app, "group-startswith search")

    # "B" matches Banana (Fruits) and Broccoli (Vegetables)
    input_el.fill("B")
    options = app.locator("li")
    option_texts = options.all_inner_texts()
    assert "Banana" in option_texts
    assert "Broccoli" in option_texts
    # Apple does not start with "B"
    assert "Apple" not in option_texts

    app.get_by_role("option", name="Banana", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("value 4: ['Banana']")).to_be_visible()

    input_el.press("Escape")


def test_flat_search_shows_groups_when_browsing(app: Page):
    """Non-group search type still shows groups when dropdown is open (no search)."""
    input_el = _open_dropdown(app, "flat-fuzzy search")

    options = app.locator("li")
    option_texts = options.all_inner_texts()
    assert "Select all Fruits" in option_texts
    assert "Select all Vegetables" in option_texts
    assert "Apple" in option_texts
    assert "Broccoli" in option_texts

    input_el.press("Escape")


def test_flat_search_flattens_during_search(app: Page):
    """Non-group search type flattens results when user types a search query."""
    input_el = _open_dropdown(app, "flat-fuzzy search")

    input_el.fill("a")
    options = app.locator("li")
    option_texts = options.all_inner_texts()
    # During search, no group headers should appear
    assert not any(
        "Select all Fruits" in t or "Select all Vegetables" in t for t in option_texts
    ), f"Expected no group headers during flat search, got: {option_texts}"
    # Results should still include matches from both groups (intermingled)
    assert "Apple" in option_texts

    input_el.press("Escape")


def test_flat_search_select_works(app: Page):
    """Non-group search type can still select options normally."""
    input_el = _open_dropdown(app, "flat-fuzzy search")

    input_el.fill("Cherry")
    app.get_by_role("option", name="Cherry", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("value 5: ['Cherry']")).to_be_visible()

    input_el.press("Escape")


def test_group_fuzzy_max_selections(app: Page):
    """Group select-all respects max_selections limit."""
    input_el = _open_dropdown(app, "group-fuzzy max3")

    # Select all Fruits (3 items) — should hit the max_selections=3 limit
    app.get_by_role("option", name="Select all Fruits").click()
    wait_for_app_run(app)
    expect(app.get_by_text("value 6: ['Apple', 'Banana', 'Cherry']")).to_be_visible()

    # Now at max; dropdown should show the max-reached message
    input_el.click()
    expect(app.get_by_text("You can only select up to 3 options")).to_be_visible()

    input_el.press("Escape")
