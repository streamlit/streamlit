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

    themed_app.get_by_text("Record a screencast").click()
    dialog = themed_app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    assert_snapshot(dialog.get_by_role("dialog"), name="record_screencast_dialog")


# Webkit (safari) and firefox doesn't support screencast on linux machines
@pytest.mark.only_browser("chromium")
def test_renders_screencast_recorded_dialog_properly(themed_app: Page):
    themed_app.get_by_test_id("stMainMenu").click()

    themed_app.get_by_text("Record a screencast").click()
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
