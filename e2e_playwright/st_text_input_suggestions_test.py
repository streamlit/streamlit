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

from typing import TYPE_CHECKING

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_form_button,
    expect_prefixed_markdown,
    get_text_input,
)

if TYPE_CHECKING:
    from e2e_playwright.conftest import ImageCompareFunction


def _field(locator: Page | Locator, label: str) -> Locator:
    return get_text_input(locator, label).locator("input").first


def _suggestions(app: Page) -> Locator:
    return app.get_by_test_id("stTextInputSuggestions")


def _expect_dropdown_anchored_to_field(field: Locator, dropdown: Locator) -> None:
    """The list must sit under the field, not at the viewport origin."""
    field_box = field.bounding_box()
    dropdown_box = dropdown.bounding_box()
    assert field_box is not None
    assert dropdown_box is not None
    assert dropdown_box["y"] >= field_box["y"]
    assert abs(dropdown_box["x"] - field_box["x"]) < 24
    assert dropdown_box["width"] > field_box["width"] * 0.8


def test_selects_suggestion_with_keyboard_and_mouse(app: Page):
    """Selecting a suggestion commits the value once, via keyboard or click."""
    field = _field(app, "Fruit search")
    field.click()
    field.type("ap")
    dropdown = _suggestions(app)
    expect(dropdown).to_be_visible()
    _expect_dropdown_anchored_to_field(field, dropdown)
    expect(dropdown.get_by_role("option")).to_have_count(2)

    field.press("ArrowDown")
    expect(dropdown.get_by_role("option").first).to_have_attribute(
        "data-focused", "true"
    )
    field.press("Enter")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "committed fruit:", "apple", exact_match=True)
    expect(dropdown).not_to_be_visible()

    field.click()
    field.fill("ap")
    expect(_suggestions(app)).to_be_visible()
    _suggestions(app).get_by_role("option").filter(has_text="apricot").click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "committed fruit:", "apricot", exact_match=True)


def test_enter_after_hover_commits_typed_text(app: Page):
    """Hover must not arm a row, so Enter still commits the typed text."""
    field = _field(app, "Fruit search")
    field.click()
    field.fill("ap")
    dropdown = _suggestions(app)
    expect(dropdown).to_be_visible()
    dropdown.get_by_role("option").first.hover()
    field.press("Enter")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "committed fruit:", "ap", exact_match=True)


def test_escape_closes_list_without_dismissing_dialog(app: Page):
    """Esc closes the suggestion list only and leaves st.dialog open."""
    click_button(app, "Open dialog")
    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()

    field = _field(dialog, "Dialog fruit")
    field.click()
    field.fill("ap")
    expect(_suggestions(app)).to_be_visible()
    field.press("Escape")
    expect(_suggestions(app)).not_to_be_visible()
    expect(dialog).to_be_visible()
    field.press("Escape")
    expect(dialog).not_to_be_visible()


def test_busy_state_and_failing_source(app: Page):
    """A failing source closes the list; the field still accepts free text."""
    field = _field(app, "Failing source")
    field.click()
    field.fill("ap")
    expect(_suggestions(app)).not_to_be_visible()
    expect(app.get_by_role("status").filter(has_text="No suggestions")).to_be_attached()
    field.fill("still works")
    field.press("Enter")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "failing value:", "still works", exact_match=True)


def test_form_fragment_live_max_chars_and_disabled(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Cover form staging, fragment isolation, live commit, max_chars, and disabled."""
    fruit_field = _field(app, "Fruit search")
    fruit_field.click()
    fruit_field.fill("a")
    dropdown = _suggestions(app)
    expect(dropdown).to_be_visible()
    assert_snapshot(dropdown, name="st_text_input_suggestions-open_dropdown")
    fruit_field.press("Escape")

    body_token = (
        app.get_by_test_id("stMarkdownContainer")
        .filter(has_text="body token:")
        .inner_text()
    )

    form_field = _field(app, "Form fruit")
    form_field.click()
    form_field.fill("ap")
    expect(_suggestions(app)).to_be_visible()
    _suggestions(app).get_by_role("option").filter(has_text="apple").click()
    expect(form_field).to_have_value("apple")
    expect_prefixed_markdown(app, "form fruit value:", "", exact_match=True)
    click_form_button(app, "Submit form")
    expect_prefixed_markdown(app, "form fruit value:", "apple", exact_match=True)
    expect_prefixed_markdown(app, "form submitted:", "True", exact_match=True)

    fragment_field = _field(app, "Fragment fruit")
    fragment_field.click()
    fragment_field.fill("ba")
    expect(_suggestions(app)).to_be_visible()
    _suggestions(app).get_by_role("option").filter(has_text="banana").click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "fragment fruit value:", "banana", exact_match=True)
    expect(
        app.get_by_test_id("stMarkdownContainer").filter(has_text="body token:")
    ).to_have_text(body_token)

    live_field = _field(app, "Live fruit")
    live_field.click()
    live_field.fill("ap")
    expect(_suggestions(app)).to_be_visible()
    _suggestions(app).get_by_role("option").filter(has_text="apple").click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "live fruit value:", "apple", exact_match=True)

    short_field = _field(app, "Short fruit")
    short_field.click()
    short_field.fill("a")
    short_dropdown = _suggestions(app)
    expect(short_dropdown).to_be_visible()
    expect(
        short_dropdown.get_by_role("option").filter(has_text="apricot")
    ).to_have_count(0)
    expect(
        short_dropdown.get_by_role("option").filter(has_text="apple")
    ).to_be_visible()
    short_field.press("Escape")
    expect(_suggestions(app)).not_to_be_visible()

    disabled_field = _field(app, "Disabled fruit")
    expect(disabled_field).to_be_disabled()
    expect(_suggestions(app)).not_to_be_visible()
