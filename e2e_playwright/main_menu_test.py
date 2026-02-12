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

    element = themed_app.get_by_test_id("stMainMenuPopover")
    assert_snapshot(element, name="main_menu")


def test_main_menu_closes_on_escape(app: Page):
    """Test that pressing Escape closes the main menu."""
    app.get_by_test_id("stMainMenu").click()

    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    app.keyboard.press("Escape")

    expect(popover).not_to_be_visible()


def test_renders_settings_dialog_properly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    themed_app.get_by_test_id("stMainMenu").click()

    themed_app.get_by_text("Settings").click()
    dialog = themed_app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text("Made with Streamlit")

    # Replace version with placeholder so snapshots don't change across versions.
    themed_app.get_by_test_id("stVersionText").evaluate(
        "el => (el.textContent = 'Made with Streamlit vX.XX.X')"
    )

    assert_snapshot(
        dialog.get_by_role("dialog"),
        name="settings_dialog",
    )

    # Hover to reveal the copy button and snapshot the version row only.
    version_row = dialog.get_by_test_id("stVersionRow")
    version_row.hover()
    assert_snapshot(version_row, name="settings_dialog_version_hover")


@pytest.mark.only_browser("chromium")
def test_settings_dialog_copies_version(app: Page):
    # Clipboard verification is chromium-only; see also st_data_editor_config_test.py.
    expect(app.get_by_test_id("stMainMenu")).to_be_visible()
    app.get_by_test_id("stMainMenu").click()
    app.get_by_text("Settings").click()

    version_row = app.get_by_test_id("stVersionRow")
    copy_button = app.get_by_test_id("stVersionCopyButton")

    expect(copy_button).to_be_visible()
    expect(copy_button).to_have_attribute("title", "Copy version to clipboard")

    # Before hover, the button should not be interactable or marked as copied.
    assert copy_button.evaluate("el => getComputedStyle(el).pointerEvents") == "none"
    assert copy_button.get_attribute("data-copy-state") == "idle"

    version_row.hover()
    # After hover, the button should be interactable.
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
    # Expect a semantic-version-like value (major.minor.patch + optional suffix).
    assert re.match(r"^\d+(?:\.\d+){2}.*$", copied_text)

    # Confirm the copy icon changed to check via state attribute.
    wait_until(
        app,
        lambda: copy_button.get_attribute("data-copy-state") == "copied",
    )


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
    first_item = app.get_by_test_id("stMainMenuItem-System")
    expect(first_item).to_be_focused()

    # Arrow down moves focus to Light radio
    app.keyboard.press("ArrowDown")
    light_item = app.get_by_test_id("stMainMenuItem-Light")
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

    # Navigate past theme radios (System, Light, Dark) then past Rerun to Settings
    for _ in range(4):
        app.keyboard.press("ArrowDown")
    expect(app.get_by_test_id("stMainMenuItem-Settings")).to_be_focused()
    app.keyboard.press("Enter")

    # Settings dialog should open, menu should close
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
    """Test that pressing Tab inside the menu closes it without returning focus to trigger.

    Per WAI-ARIA menu-button pattern, Tab/Shift+Tab should close the menu and
    allow focus to advance rather than snapping back to the trigger button.
    """
    menu_button = app.get_by_test_id("stMainMenuButton")
    menu_button.focus()
    app.keyboard.press("Enter")

    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    app.keyboard.press("Tab")
    expect(popover).not_to_be_visible()

    # Focus should NOT return to the menu button (Tab lets focus advance)
    expect(menu_button).not_to_be_focused()


def test_cached_preference_persists_on_reload(app: Page):
    """Test that the cached preference persists across full page reload."""
    # Set the browser preference to light to ensure user preference overrides system preference
    app.emulate_media(color_scheme="light")

    # Explicitly set dark theme preference
    app.get_by_test_id("stMainMenu").click()
    app.get_by_text("Settings").click()
    app.get_by_test_id("stSelectbox").get_by_text("Use system setting").click()
    app.get_by_test_id("stSelectboxVirtualDropdown").get_by_text("Dark").click()
    app.get_by_role("button", name="Close").click()

    # Hard reload the app
    app.goto(app.url)

    # Check that the dark theme preference persists
    app.get_by_test_id("stMainMenu").click()
    app.get_by_text("Settings").click()
    expect(app.get_by_text("Dark")).to_be_visible()


def test_auto_theme_recalibrates_on_system_change(app: Page):
    """Test that the auto theme recalibrates on underlying system preference change."""
    # The browser preference starts in light mode
    app.emulate_media(color_scheme="light")
    app.get_by_test_id("stMainMenu").click()
    app.get_by_text("Settings").click()

    # The auto theme should be selected
    expect(app.get_by_text("Use system setting")).to_be_visible()
    app.get_by_role("button", name="Close").click()

    # Check that auto translates to light theme
    app_background = app.get_by_test_id("stApp")
    light_background = app_background.evaluate(
        "el => getComputedStyle(el).backgroundColor"
    )
    wait_until(
        app,
        lambda: (
            app_background.evaluate("el => getComputedStyle(el).backgroundColor")
            == light_background
        ),
    )

    # Switch to explicit light theme
    app.get_by_test_id("stMainMenu").click()
    app.get_by_text("Settings").click()
    app.get_by_test_id("stSelectbox").get_by_text("Use system setting").click()
    app.get_by_test_id("stSelectboxVirtualDropdown").get_by_text("Light").click()
    app.get_by_role("button", name="Close").click()

    # The browser preference changes to dark mode
    app.emulate_media(color_scheme="dark")
    app.reload()

    # Select the auto theme again
    app.get_by_test_id("stMainMenu").click()
    app.get_by_text("Settings").click()
    app.get_by_test_id("stSelectbox").get_by_text("Light").click()
    app.get_by_test_id("stSelectboxVirtualDropdown").get_by_text(
        "Use system setting"
    ).click()
    app.get_by_role("button", name="Close").click()

    # Check that auto translates to dark theme
    wait_until(
        app,
        lambda: (
            app_background.evaluate("el => getComputedStyle(el).backgroundColor")
            != light_background
        ),
    )


def test_theme_switcher_visible_in_menu(app: Page):
    """Test that the theme switcher radio group is visible when the menu is open."""
    app.get_by_test_id("stMainMenu").click()
    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    # Verify the theme switcher group is present
    theme_switcher = popover.get_by_test_id("stThemeSwitcher")
    expect(theme_switcher).to_be_visible()

    # Verify all 3 radio items are visible
    radio_items = popover.get_by_role("menuitemradio")
    expect(radio_items).to_have_count(3)

    # Verify labels
    expect(popover.get_by_test_id("stMainMenuItem-System")).to_be_visible()
    expect(popover.get_by_test_id("stMainMenuItem-Light")).to_be_visible()
    expect(popover.get_by_test_id("stMainMenuItem-Dark")).to_be_visible()


def test_theme_switcher_changes_to_dark(app: Page):
    """Test that clicking the Dark radio changes the app background color."""
    app.emulate_media(color_scheme="light")

    app_background = app.get_by_test_id("stApp")
    initial_bg = app_background.evaluate("el => getComputedStyle(el).backgroundColor")

    # Open menu and click Dark
    app.get_by_test_id("stMainMenu").click()
    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    app.get_by_test_id("stMainMenuItem-Dark").click()

    # Menu should remain open after clicking a theme radio
    expect(popover).to_be_visible()

    # Dark radio should now be checked
    expect(app.get_by_test_id("stMainMenuItem-Dark")).to_have_attribute(
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


def test_theme_switcher_changes_to_light(app: Page):
    """Test that clicking the Light radio changes the app to light theme."""
    # Start with dark to have a visible change
    app.emulate_media(color_scheme="dark")

    # First set to Dark explicitly
    app.get_by_test_id("stMainMenu").click()
    app.get_by_test_id("stMainMenuItem-Dark").click()

    app_background = app.get_by_test_id("stApp")
    dark_bg = app_background.evaluate("el => getComputedStyle(el).backgroundColor")

    # Now switch to Light
    app.get_by_test_id("stMainMenuItem-Light").click()

    # Background should change
    wait_until(
        app,
        lambda: (
            app_background.evaluate("el => getComputedStyle(el).backgroundColor")
            != dark_bg
        ),
    )

    # Light radio should be checked
    expect(app.get_by_test_id("stMainMenuItem-Light")).to_have_attribute(
        "aria-checked", "true"
    )

    # Menu should still be open
    expect(app.get_by_test_id("stMainMenuPopover")).to_be_visible()


def test_theme_switcher_keyboard_navigation(app: Page):
    """Test seamless arrow-key navigation from theme radios into action items."""
    app.get_by_test_id("stMainMenuButton").focus()
    app.keyboard.press("Enter")

    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    # First item should be System radio
    system_radio = app.get_by_test_id("stMainMenuItem-System")
    expect(system_radio).to_be_focused()

    # Navigate through Light -> Dark -> Rerun (crosses radio/action boundary)
    app.keyboard.press("ArrowDown")
    expect(app.get_by_test_id("stMainMenuItem-Light")).to_be_focused()

    app.keyboard.press("ArrowDown")
    expect(app.get_by_test_id("stMainMenuItem-Dark")).to_be_focused()

    app.keyboard.press("ArrowDown")
    expect(app.get_by_test_id("stMainMenuItem-Rerun")).to_be_focused()

    # Navigate back up across the boundary
    app.keyboard.press("ArrowUp")
    expect(app.get_by_test_id("stMainMenuItem-Dark")).to_be_focused()


def test_theme_switcher_persists_on_reload(app: Page):
    """Test that theme selection via radio persists across page reload."""
    app.emulate_media(color_scheme="light")

    # Select Dark theme via the radio
    app.get_by_test_id("stMainMenu").click()
    app.get_by_test_id("stMainMenuItem-Dark").click()

    # Verify Dark is checked
    expect(app.get_by_test_id("stMainMenuItem-Dark")).to_have_attribute(
        "aria-checked", "true"
    )

    # Close the menu and reload
    app.keyboard.press("Escape")
    app.goto(app.url)

    # Re-open menu and verify Dark is still checked
    app.get_by_test_id("stMainMenu").click()
    expect(app.get_by_test_id("stMainMenuItem-Dark")).to_have_attribute(
        "aria-checked", "true"
    )


def test_settings_still_accessible_with_theme_switcher(app: Page):
    """Anti-regression: Settings menu item is still present and opens the dialog."""
    app.get_by_test_id("stMainMenu").click()
    popover = app.get_by_test_id("stMainMenuPopover")
    expect(popover).to_be_visible()

    # Verify Settings is present (as a menuitem, not a radio)
    settings_item = app.get_by_test_id("stMainMenuItem-Settings")
    expect(settings_item).to_be_visible()
    expect(settings_item).to_have_attribute("role", "menuitem")

    # Activate Settings
    settings_item.click()

    # Settings dialog should open
    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(popover).not_to_be_visible()
