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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_toggle,
    expect_no_skeletons,
    get_button,
    get_button_group,
    get_element_by_key,
    get_segment_button,
    get_text_input,
    open_popover,
)


def test_page_wide_runtime_mapping(app: Page, assert_snapshot: ImageCompareFunction):
    """Selecting a page overlay replaces the runtime theme until it is cleared."""
    expect_no_skeletons(app)

    overlay = get_button_group(app, "page_overlay")
    get_segment_button(overlay, "Purple").click()
    wait_for_app_run(app)

    page_button = get_button(app, "Page primary")
    expect(page_button).to_have_css("background-color", "rgb(124, 58, 237)")
    assert_snapshot(
        get_element_by_key(app, "page_primary"),
        name="st_theme_overrides-page_purple",
    )

    get_segment_button(overlay, "Clear").click()
    wait_for_app_run(app)
    expect(page_button).to_have_css("background-color", "rgb(255, 75, 75)")


def test_keep_preserves_runtime_overlay(app: Page):
    """theme=None (Keep) leaves the current page overlay in place."""
    expect_no_skeletons(app)

    overlay = get_button_group(app, "page_overlay")
    get_segment_button(overlay, "Purple").click()
    wait_for_app_run(app)
    expect(get_button(app, "Page primary")).to_have_css(
        "background-color", "rgb(124, 58, 237)"
    )

    get_segment_button(overlay, "Keep").click()
    wait_for_app_run(app)
    expect(get_button(app, "Page primary")).to_have_css(
        "background-color", "rgb(124, 58, 237)"
    )


def test_sidebar_uses_runtime_overlay_primary(app: Page):
    """The sidebar picks up overlay primary while fonts stay on the selected theme."""
    expect_no_skeletons(app)

    overlay = get_button_group(app, "page_overlay")
    get_segment_button(overlay, "Purple").click()
    wait_for_app_run(app)
    expect(get_button(app, "Sidebar primary")).to_have_css(
        "background-color", "rgb(124, 58, 237)"
    )


def test_inherited_base_follows_theme_menu(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Light/dark sections follow the theme selected in the menu."""
    expect_no_skeletons(themed_app)
    inherited = get_element_by_key(themed_app, "inherited_base")
    expect(inherited).to_be_visible()
    assert_snapshot(inherited, name="st_theme_overrides-inherited_base")


def test_inherited_base_updates_from_theme_menu(app: Page):
    """Switching Light/Dark in the menu restyles inherit scopes without a mapping change."""
    expect_no_skeletons(app)
    inherited_btn = get_button(app, "Inherited primary")
    expect(inherited_btn).to_have_css("background-color", "rgb(9, 105, 218)")

    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")
    menu.get_by_role("menuitemradio", name="Dark").click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()
    expect(inherited_btn).to_have_css("background-color", "rgb(88, 166, 255)")


def test_scoped_primary_does_not_paint_sibling(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Green and red scopes restyle their buttons; the sibling keeps the app primary."""
    expect_no_skeletons(app)

    green = get_button(app, "Green")
    red = get_button(app, "Red")
    sibling = get_button(app, "Sibling")

    expect(green).to_have_css("background-color", "rgb(0, 128, 0)")
    expect(red).to_have_css("background-color", "rgb(255, 0, 0)")
    expect(sibling).to_have_css("background-color", "rgb(255, 75, 75)")

    assert_snapshot(
        get_element_by_key(app, "scoped_row"),
        name="st_theme_overrides-scoped_primary_row",
    )


def test_themed_popover_and_chart(app: Page, assert_snapshot: ImageCompareFunction):
    """Portaled popover widgets and charts pick up the scoped palette."""
    expect_no_skeletons(app)

    scope = get_element_by_key(app, "popover_chart_scope")
    expect(scope.get_by_test_id("stVegaLiteChart")).to_be_visible()
    assert_snapshot(scope, name="st_theme_overrides-popover_chart_closed")

    body = open_popover(app, "Themed popover")
    expect(body.get_by_test_id("stSelectbox")).to_be_visible()
    assert_snapshot(
        body,
        name="st_theme_overrides-themed_popover_open",
    )


def test_multipage_theme_replace_and_clear(app: Page):
    """Themed pages replace the overlay; theme={} restores the selected app theme."""
    expect_no_skeletons(app)

    nav = app.get_by_test_id("stSidebarNav")
    nav.get_by_text("Green", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("Green page", exact=True)).to_be_visible()
    expect(get_button(app, "Green page primary")).to_have_css(
        "background-color", "rgb(0, 128, 0)"
    )

    nav.get_by_text("Red", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("Red page", exact=True)).to_be_visible()
    expect(get_button(app, "Red page primary")).to_have_css(
        "background-color", "rgb(255, 0, 0)"
    )

    nav.get_by_text("Clear", exact=True).click()
    wait_for_app_run(app)
    expect(app.get_by_text("Cleared page", exact=True)).to_be_visible()
    expect(get_button(app, "Cleared page primary")).to_have_css(
        "background-color", "rgb(255, 75, 75)"
    )


def test_explicit_base_does_not_inherit_outer_text_color(app: Page):
    """Explicit base paints a light/dark island so ancestor colors cannot leak."""
    expect_no_skeletons(app)

    expect(get_button(app, "Inner dark-base")).to_have_css(
        "background-color", "rgb(255, 75, 75)"
    )
    inner = get_element_by_key(app, "explicit_base_inner")
    inner_copy = inner.get_by_text("Inner copy", exact=True)
    expect(inner_copy).to_have_css("color", "rgb(250, 250, 250)")
    expect(inner).to_have_css("background-color", "rgb(14, 17, 23)")
    expect(
        get_element_by_key(app, "explicit_base_outer").get_by_text("Outer copy")
    ).to_have_css("color", "rgb(128, 0, 128)")


def test_keyed_widget_state_survives_scoped_theme_change(app: Page):
    """Changing a container theme mapping must not reset keyed widget state."""
    expect_no_skeletons(app)

    field = get_text_input(app, "Retained name").locator("input").first
    field.fill("keeps-value")
    field.press("Enter")
    wait_for_app_run(app)
    expect(get_element_by_key(app, "keyed_state_value")).to_contain_text(
        "retained: keeps-value"
    )

    click_toggle(app, "Green scoped theme")
    expect(get_text_input(app, "Retained name").locator("input").first).to_have_value(
        "keeps-value"
    )
    expect(get_element_by_key(app, "keyed_state_value")).to_contain_text(
        "retained: keeps-value"
    )
