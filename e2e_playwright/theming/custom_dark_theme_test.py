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


import os
from typing import Any

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import expect_no_skeletons


@pytest.fixture(scope="module")
def browser_context_args(browser_context_args: dict[str, Any]) -> dict[str, Any]:
    """Override browser context to start with dark mode color scheme.

    Playwright defaults to light mode color scheme, and the `browser_context_args`
    is applied on the file level.
    """
    return {
        **browser_context_args,
        "color_scheme": "dark",
    }


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_custom_dark_theme():
    """Configure custom dark theme."""
    # [theme] configs
    os.environ["STREAMLIT_THEME_BASE"] = "dark"
    os.environ["STREAMLIT_THEME_PRIMARY_COLOR"] = "#004cbe"
    os.environ["STREAMLIT_THEME_BACKGROUND_COLOR"] = "#191e24"
    os.environ["STREAMLIT_THEME_SECONDARY_BACKGROUND_COLOR"] = "#0f161e"
    os.environ["STREAMLIT_THEME_TEXT_COLOR"] = "#bdc4d5"
    os.environ["STREAMLIT_THEME_BORDER_COLOR"] = "#293246"
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

    # [theme.dark] configs
    os.environ["STREAMLIT_THEME_DARK_BORDER_COLOR"] = (
        "#ff6700"  # hazard orange - should override [theme] config above
    )
    os.environ["STREAMLIT_THEME_DARK_CODE_FONT_SIZE"] = "13px"
    os.environ["STREAMLIT_THEME_DARK_CODE_TEXT_COLOR"] = "#d4c6f5"  # lavender
    os.environ["STREAMLIT_THEME_DARK_LINK_COLOR"] = "#CD1C18"  # chili red
    yield
    del os.environ["STREAMLIT_THEME_BASE"]
    del os.environ["STREAMLIT_THEME_PRIMARY_COLOR"]
    del os.environ["STREAMLIT_THEME_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SECONDARY_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"]
    del os.environ["STREAMLIT_THEME_FONT"]
    del os.environ["STREAMLIT_THEME_HEADING_FONT"]
    del os.environ["STREAMLIT_THEME_CODE_FONT"]
    del os.environ["STREAMLIT_THEME_DARK_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_DARK_CODE_FONT_SIZE"]
    del os.environ["STREAMLIT_THEME_DARK_CODE_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_DARK_LINK_COLOR"]


@pytest.mark.usefixtures("configure_custom_dark_theme")
def test_auto_theme_with_dark_preference(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the auto theme is the Custom Theme Dark when the system preference is dark."""
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    assert_snapshot(app, name="custom_theme_auto_dark", image_threshold=0.0003)


@pytest.mark.usefixtures("configure_custom_dark_theme")
def test_custom_dark_theme(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the custom dark theme is rendered correctly."""
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    # Change the theme to explicitly be Custom Dark Theme:
    app.get_by_test_id("stMainMenu").click()
    main_menu_list = app.get_by_test_id("stMainMenuList")
    main_menu_list.get_by_text("Settings").click()

    settings_dialog = app.get_by_test_id("stDialog")
    settings_dialog.get_by_role("combobox").click()

    # Select Custom Theme Dark
    dark_theme_option = app.get_by_test_id("stSelectboxVirtualDropdown").get_by_text(
        "Dark"
    )
    dark_theme_option.click()

    # Close settings dialog
    settings_dialog.get_by_role("button", name="Close").click()

    assert_snapshot(app, name="custom_dark_themed_app", image_threshold=0.0003)


@pytest.mark.usefixtures("configure_custom_dark_theme")
def test_custom_light_theme_with_no_light_configs(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the custom light theme is rendered correctly with no light configs."""
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    # Open the main menu
    app.get_by_test_id("stMainMenu").click()

    # Open the settings dialog
    main_menu_list = app.get_by_test_id("stMainMenuList")
    main_menu_list.get_by_text("Settings").click()

    # Open the theme selector dropdown
    settings_dialog = app.get_by_test_id("stDialog")
    settings_dialog.get_by_role("combobox").click()

    # Select Custom Theme Light
    light_theme_option = app.get_by_test_id("stSelectboxVirtualDropdown").get_by_text(
        "Light"
    )
    light_theme_option.click()

    # Close settings dialog
    settings_dialog.get_by_role("button", name="Close").click()

    assert_snapshot(
        app, name="custom_light_theme_no_light_configs", image_threshold=0.0003
    )


@pytest.mark.usefixtures("configure_custom_dark_theme")
def test_custom_dark_theme_settings_dialog(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the settings dialog shows correct options with dark theme configs."""
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    # Open the settings dialog
    app.get_by_test_id("stMainMenu").click()
    main_menu_list = app.get_by_test_id("stMainMenuList")
    main_menu_list.get_by_text("Settings").click()

    # Check that the auto theme is selected
    settings_dialog = app.get_by_test_id("stDialog")
    expect(settings_dialog).to_be_visible()
    expect(settings_dialog).to_contain_text("Use system setting")

    assert_snapshot(
        settings_dialog.get_by_role("dialog"),
        name="custom_dark_theme_settings_dialog",
        image_threshold=0.0003,
        # Hide version info so that snapshots don't change across versions.
        style="[data-testid='stVersionInfo'] { display: none !important; }",
    )

    # Open the theme selector dropdown
    theme_selector = settings_dialog.get_by_role("combobox")
    theme_selector.click()

    # Check that 3 options (auto, light, dark) are shown
    options_list = app.get_by_test_id("stSelectboxVirtualDropdown").get_by_role(
        "option"
    )
    expect(options_list).to_have_count(3)
    expect(options_list.get_by_text("Light")).to_be_visible()
    expect(options_list.get_by_text("Dark")).to_be_visible()
    expect(options_list.get_by_text("Use system setting")).to_be_visible()
