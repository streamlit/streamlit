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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


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

    assert_snapshot(dialog.get_by_role("dialog"), name="settings_dialog")


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
    expect(dialog).to_contain_text("Made with Streamlit v")


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


def test_renders_active_theme_dialog_properly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    themed_app.get_by_test_id("stMainMenu").click()
    themed_app.get_by_text("Settings").click()
    themed_app.get_by_text("Edit active theme").click()

    dialog = themed_app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    assert_snapshot(dialog.get_by_role("dialog"), name="edit_active_theme_dialog")
