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

    assert_snapshot(
        dialog.get_by_role("dialog"),
        name="settings_dialog",
        # Hide version info so that snapshots don't change across versions.
        style="[data-testid='stVersionInfo'] { display: none !important; }",
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
        lambda: app_background.evaluate("el => getComputedStyle(el).backgroundColor")
        == light_background,
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
        lambda: app_background.evaluate("el => getComputedStyle(el).backgroundColor")
        != light_background,
    )
