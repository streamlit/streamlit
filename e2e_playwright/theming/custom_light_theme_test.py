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


import os

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_for_app_loaded,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import expect_no_skeletons


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_custom_light_theme():
    """Configure custom light theme."""
    # [theme] configs
    os.environ["STREAMLIT_THEME_PRIMARY_COLOR"] = "#1a6ce7"
    os.environ["STREAMLIT_THEME_BACKGROUND_COLOR"] = "#ffffff"
    os.environ["STREAMLIT_THEME_SECONDARY_BACKGROUND_COLOR"] = "#f7f7f7"
    os.environ["STREAMLIT_THEME_TEXT_COLOR"] = "#1e252f"
    os.environ["STREAMLIT_THEME_BORDER_COLOR"] = "#d5dae4"
    os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"] = "14"
    os.environ["STREAMLIT_THEME_FONT"] = (
        "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, "
        "sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
    )
    os.environ["STREAMLIT_THEME_HEADING_FONT"] = (
        "bold Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
        "Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
    )
    os.environ["STREAMLIT_THEME_CODE_FONT"] = (
        '"Monaspace Argon", Menlo, Monaco, Consolas, "Courier New", monospace'
    )

    # [theme.light] configs
    os.environ["STREAMLIT_THEME_LIGHT_BORDER_COLOR"] = (
        "#ff6700"  # hazard orange - should override [theme] config above
    )
    os.environ["STREAMLIT_THEME_LIGHT_CODE_FONT_SIZE"] = "13px"
    os.environ["STREAMLIT_THEME_LIGHT_CODE_TEXT_COLOR"] = "#FF69B4"  # hot pink
    os.environ["STREAMLIT_THEME_LIGHT_LINK_COLOR"] = "#89CFF0"  # baby blue
    # [ theme.dark] config to test theme persistence on reload
    os.environ["STREAMLIT_THEME_DARK_PRIMARY_COLOR"] = "#228B22"
    os.environ["STREAMLIT_THEME_DARK_BORDER_COLOR"] = "#ff6700"  # hazard orange
    os.environ["STREAMLIT_THEME_DARK_CODE_FONT_SIZE"] = "13px"
    os.environ["STREAMLIT_THEME_DARK_CODE_TEXT_COLOR"] = "#FF69B4"  # hot pink
    os.environ["STREAMLIT_THEME_DARK_LINK_COLOR"] = "#89CFF0"  # baby blue
    yield
    del os.environ["STREAMLIT_THEME_PRIMARY_COLOR"]
    del os.environ["STREAMLIT_THEME_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SECONDARY_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"]
    del os.environ["STREAMLIT_THEME_FONT"]
    del os.environ["STREAMLIT_THEME_HEADING_FONT"]
    del os.environ["STREAMLIT_THEME_CODE_FONT"]
    del os.environ["STREAMLIT_THEME_LIGHT_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_LIGHT_CODE_FONT_SIZE"]
    del os.environ["STREAMLIT_THEME_LIGHT_CODE_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_LIGHT_LINK_COLOR"]
    del os.environ["STREAMLIT_THEME_DARK_PRIMARY_COLOR"]
    del os.environ["STREAMLIT_THEME_DARK_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_DARK_CODE_FONT_SIZE"]
    del os.environ["STREAMLIT_THEME_DARK_CODE_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_DARK_LINK_COLOR"]


@pytest.mark.usefixtures("configure_custom_light_theme")
def test_auto_theme_with_light_preference(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the auto theme is the Custom Theme Light when the system preference is light."""
    # Browser preference should be light by default
    is_light_mode = app.evaluate("matchMedia('(prefers-color-scheme: light)').matches")
    assert is_light_mode is True

    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    assert_snapshot(app, name="custom_theme_auto_light", image_threshold=0.0003)


@pytest.mark.usefixtures("configure_custom_light_theme")
def test_custom_light_theme(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the custom light theme is rendered correctly."""
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    # Change the theme to explicitly be Custom Light Theme via the main menu:
    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")
    menu.get_by_role("menuitemradio", name="Light").click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()
    wait_for_app_run(app)

    assert_snapshot(app, name="custom_light_themed_app", image_threshold=0.0003)


@pytest.mark.usefixtures("configure_custom_light_theme")
def test_custom_dark_theme_with_dark_configs(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the custom dark theme is rendered correctly with expected dark configs."""
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    # Switch to Custom Dark Theme via the main menu:
    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")
    menu.get_by_role("menuitemradio", name="Dark").click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()
    wait_for_app_run(app)

    assert_snapshot(
        app, name="custom_dark_theme_with_dark_configs", image_threshold=0.0003
    )


@pytest.mark.usefixtures("configure_custom_light_theme")
def test_theme_preference_persists_on_reload(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that custom theme selection persists across full page reload (issue #13280)."""
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    # Select "Dark" theme explicitly via the main menu:
    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")
    # Verify "System" is currently selected (auto theme)
    system_radio = menu.get_by_role("menuitemradio", name="System")
    expect(system_radio).to_have_attribute("aria-checked", "true")
    menu.get_by_role("menuitemradio", name="Dark").click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()
    wait_for_app_run(app)

    assert_snapshot(app, name="persisted_on_reload_before", image_threshold=0.0003)

    # Force a full page reload
    app.reload()

    # Wait for the app to fully load again after reload
    wait_for_app_loaded(app)

    # Open the main menu to verify theme selection persisted
    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")

    # Verify "Dark" is still selected after reload
    dark_radio = menu.get_by_role("menuitemradio", name="Dark")
    expect(dark_radio).to_have_attribute("aria-checked", "true")

    # Close the menu
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()

    assert_snapshot(app, name="persisted_on_reload_after", image_threshold=0.0003)
