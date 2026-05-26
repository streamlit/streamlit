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

import re

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until


def test_main_menu_images(themed_app: Page, assert_snapshot: ImageCompareFunction):
    themed_app.get_by_test_id("stMainMenu").click()

    # Replace version with placeholder so snapshots don't change across versions.
    # The version footer lives outside role="menu" (inside the popover wrapper).
    popover = themed_app.get_by_test_id("stMainMenuPopover")
    popover.get_by_text(re.compile(r"^Made with Streamlit v")).evaluate(
        "el => (el.textContent = 'Made with Streamlit vX.XX.X')"
    )

    assert_snapshot(popover, name="main_menu")


def test_main_menu_closes_on_escape(app: Page):
    """Test that pressing Escape closes the main menu."""
    app.get_by_test_id("stMainMenu").click()

    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    app.keyboard.press("Escape")

    expect(popover).not_to_be_visible()


# Webkit (safari) and firefox doesn't support screencast on linux machines
@pytest.mark.only_browser("chromium")
def test_renders_screencast_dialog_properly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    themed_app.get_by_test_id("stMainMenu").click()

    themed_app.get_by_text("Record screen").click()
    dialog = themed_app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    assert_snapshot(dialog.get_by_role("dialog"), name="record_screencast_dialog")


# Webkit (safari) and firefox doesn't support screencast on linux machines
@pytest.mark.only_browser("chromium")
def test_renders_screencast_recorded_dialog_properly(themed_app: Page):
    themed_app.get_by_test_id("stMainMenu").click()

    themed_app.get_by_text("Record screen").click()
    themed_app.get_by_text("Start recording!").click()

    # Wait 5 seconds because there is a 3! 2! 1! on the screen until recording occurs and there may be buffer
    themed_app.wait_for_timeout(5000)

    # stop recording
    themed_app.keyboard.press("Escape")
    dialog = themed_app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()

    # don't use screenshot as the recording may differ so just check for specific text
    expect(
        themed_app.get_by_role("dialog").get_by_text("Preview your video below:")
    ).to_be_visible()


def test_renders_about_dialog_properly(themed_app: Page):
    themed_app.get_by_test_id("stMainMenu").click()

    themed_app.get_by_text("About").click()
    dialog = themed_app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text("This can be markdown!")


def test_renders_clear_cache_dialog_properly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    themed_app.get_by_test_id("stMainMenu").click()

    themed_app.get_by_text("Clear cache").click()
    dialog = themed_app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text(
        "Are you sure you want to clear the app's function caches?"
    )
    assert_snapshot(dialog.get_by_role("dialog"), name="clear_cache_dialog")


def test_keyboard_opens_menu_and_navigates(app: Page):
    """Test full keyboard flow: open with Enter, navigate with arrows, close with Escape."""
    menu_button = app.get_by_test_id("stMainMenuButton")
    menu_button.focus()

    # Open menu with Enter
    app.keyboard.press("Enter")
    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    # First item should be the System theme radio
    first_item = app.get_by_test_id("stMainMenuItem-theme-System")
    expect(first_item).to_be_focused()

    # Arrow down moves focus to Light radio
    app.keyboard.press("ArrowDown")
    light_item = app.get_by_test_id("stMainMenuItem-theme-Light")
    expect(light_item).to_be_focused()

    # Arrow up moves focus back to System
    app.keyboard.press("ArrowUp")
    expect(first_item).to_be_focused()

    # Escape closes the menu
    app.keyboard.press("Escape")
    expect(popover).not_to_be_visible()


def test_keyboard_activates_menu_item(app: Page):
    """Test that Enter activates a focused menu item."""
    app.get_by_test_id("stMainMenuButton").focus()
    app.keyboard.press("Enter")

    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    # Navigate past 3 theme radios + Rerun + Auto-rerun to Clear cache = 5 ArrowDowns
    for _ in range(5):
        app.keyboard.press("ArrowDown")
    expect(app.get_by_test_id("stMainMenuItem-clearCache")).to_be_focused()
    app.keyboard.press("Enter")

    # Clear cache dialog should open, menu should close
    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(popover).not_to_be_visible()


# WebKit (Safari) does not allow programmatic .focus() on buttons outside a
# user-activation context. Our focus-return fires from react-focus-lock's
# returnFocus callback (after BaseWeb's close animation timer), which
# Chromium/Firefox accept but WebKit silently ignores.
@pytest.mark.skip_browser("webkit")
def test_focus_returns_to_menu_button_after_close(app: Page):
    """Test that focus returns to the menu button after the popover closes."""
    menu_button = app.get_by_test_id("stMainMenuButton")
    menu_button.focus()

    # Open and close via Escape
    app.keyboard.press("Enter")
    expect(app.get_by_test_id("stMainMenuPopover")).to_be_visible()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()

    # Focus should return to the menu button
    expect(menu_button).to_be_focused()


def test_tab_closes_menu(app: Page):
    """Test that pressing Tab from the menu eventually closes the popover.

    The first Tab moves focus from the menu items to the version CopyButton
    (which lives outside role="menu" but inside the popover's focus-lock).
    The second Tab closes the popover and advances focus.
    """
    menu_button = app.get_by_test_id("stMainMenuButton")
    menu_button.focus()
    app.keyboard.press("Enter")

    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    # First Tab: focus moves from the menu to the CopyButton in the footer.
    app.keyboard.press("Tab")
    expect(popover).to_be_visible()

    # Second Tab: closes the popover (forward Tab from the CopyButton).
    app.keyboard.press("Tab")
    expect(popover).not_to_be_visible()

    # Focus should NOT return to the menu button (Tab lets focus advance)
    expect(menu_button).not_to_be_focused()


def _select_theme(app: Page, label: str) -> None:
    """Open the main menu, click a theme radio, and close the menu."""
    app.get_by_test_id("stMainMenu").click()
    expect(app.get_by_test_id("stMainMenuPopover")).to_be_visible()
    app.get_by_test_id(f"stMainMenuItem-theme-{label}").click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()


def test_auto_theme_recalibrates_on_system_change(app: Page):
    """Test that the System (auto) theme follows OS preference changes."""
    # Start with light OS preference — System theme should produce a light bg
    app.emulate_media(color_scheme="light")

    app_background = app.get_by_test_id("stApp")
    light_bg = app_background.evaluate("el => getComputedStyle(el).backgroundColor")

    # Switch to explicit Light so System is no longer active
    _select_theme(app, "Light")

    # Change OS preference to dark and reload
    app.emulate_media(color_scheme="dark")
    app.reload()

    # Switch back to System — it should now follow the dark OS preference
    _select_theme(app, "System")

    # Verify the background changed from the original light color
    wait_until(
        app,
        lambda: (
            app_background.evaluate("el => getComputedStyle(el).backgroundColor")
            != light_bg
        ),
    )


def test_theme_switcher_changes_to_dark(app: Page):
    """Test that clicking the Dark radio changes the app background color."""
    app.emulate_media(color_scheme="light")

    app_background = app.get_by_test_id("stApp")
    initial_bg = app_background.evaluate("el => getComputedStyle(el).backgroundColor")

    # Open menu and click Dark
    app.get_by_test_id("stMainMenu").click()
    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    app.get_by_test_id("stMainMenuItem-theme-Dark").click()

    # Menu should remain open after clicking a theme radio
    expect(popover).to_be_visible()

    # Dark radio should now be checked
    expect(app.get_by_test_id("stMainMenuItem-theme-Dark")).to_have_attribute(
        "aria-checked", "true"
    )

    # Background color should change from the initial (light) color
    wait_until(
        app,
        lambda: (
            app_background.evaluate("el => getComputedStyle(el).backgroundColor")
            != initial_bg
        ),
    )


def test_theme_switcher_persists_cached_preference_on_reload(app: Page):
    """Test that theme selection via radio persists in localStorage across page reload."""
    app.emulate_media(color_scheme="light")

    # Select Dark theme via the radio
    app.get_by_test_id("stMainMenu").click()
    app.get_by_test_id("stMainMenuItem-theme-Dark").click()

    # Verify Dark is checked
    expect(app.get_by_test_id("stMainMenuItem-theme-Dark")).to_have_attribute(
        "aria-checked", "true"
    )

    # Close the menu and reload
    app.keyboard.press("Escape")
    app.goto(app.url)

    # Re-open menu and verify Dark is still checked
    app.get_by_test_id("stMainMenu").click()
    expect(app.get_by_test_id("stMainMenuItem-theme-Dark")).to_have_attribute(
        "aria-checked", "true"
    )


def test_auto_rerun_toggle_visible_in_dev_mode(app: Page):
    """Test that the auto-rerun toggle is visible when running in dev mode (default).

    The complementary negative assertion (toggle absent in viewer mode)
    is covered by MainMenu.test.tsx unit tests, which can control
    developmentMode/allowRunOnSave props directly without requiring a
    separate server configuration.
    """
    app.get_by_test_id("stMainMenu").click()
    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    toggle = app.get_by_test_id("stMainMenuItem-autoRerun")
    expect(toggle).to_be_visible()
    expect(toggle).to_have_attribute("role", "menuitemcheckbox")
    expect(toggle).to_have_attribute("aria-checked", "false")


def test_auto_rerun_toggle_changes_state(app: Page):
    """Test that clicking the auto-rerun toggle changes its aria-checked state."""
    app.get_by_test_id("stMainMenu").click()
    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    toggle = app.get_by_test_id("stMainMenuItem-autoRerun")
    expect(toggle).to_have_attribute("aria-checked", "false")
    toggle.click()

    # Verify the toggle state changed
    expect(toggle).to_have_attribute("aria-checked", "true")

    # Menu should remain open after toggling
    expect(popover).to_be_visible()


def test_rerun_visible_in_dev_mode(app: Page):
    """Test that the Rerun menu item is visible in dev mode (default for local dev)."""
    app.get_by_test_id("stMainMenu").click()
    expect(app.get_by_test_id("stMainMenuItem-rerun")).to_be_visible()


def test_main_menu_version_footer_visible(app: Page):
    """Test that the Made with Streamlit version footer is visible in the popover."""
    app.get_by_test_id("stMainMenu").click()
    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    # The version footer lives outside role="menu" but inside the popover.
    version_text = popover.get_by_text(re.compile(r"^Made with Streamlit v"))
    expect(version_text).to_be_visible()

    copy_button = popover.get_by_role("button", name="Copy version to clipboard")
    expect(copy_button).to_have_css("pointer-events", "none")
    expect(copy_button).to_have_attribute("data-copy-state", "idle")


@pytest.mark.only_browser("chromium")
def test_main_menu_version_footer_copies_version(app: Page):
    """Test that the copy button in the menu footer copies the version string."""
    app.get_by_test_id("stMainMenu").click()
    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    # The version footer lives outside role="menu" but inside the popover.
    version_text = popover.get_by_text(re.compile(r"^Made with Streamlit v"))
    copy_button = popover.get_by_role("button", name="Copy version to clipboard")

    # The copy button starts hidden (opacity: 0, pointer-events: none) until hover.
    expect(copy_button).to_have_css("pointer-events", "none")

    # Hover the version row to reveal the copy button.
    version_text.hover()
    wait_until(
        app,
        lambda: (
            copy_button.evaluate("el => getComputedStyle(el).pointerEvents") == "auto"
        ),
    )

    copy_button.click()

    wait_until(
        app,
        lambda: bool(app.evaluate("navigator.clipboard.readText()")),
    )
    copied_text = app.evaluate("navigator.clipboard.readText()")
    assert copied_text
    assert re.match(r"^\d+(?:\.\d+){2}.*$", copied_text)


def test_clear_cache_dialog_dismisses(app: Page):
    """Test that the clear cache dialog can be dismissed via Escape key and close button."""
    # Dismiss via Escape key
    app.get_by_test_id("stMainMenu").click()
    app.get_by_text("Clear cache").click()
    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    app.keyboard.press("Escape")
    expect(dialog).not_to_be_visible()

    # Re-open and dismiss via close button
    app.get_by_test_id("stMainMenu").click()
    app.get_by_text("Clear cache").click()
    expect(dialog).to_be_visible()
    dialog.get_by_role("dialog").get_by_label("Close").click()
    expect(dialog).not_to_be_visible()
