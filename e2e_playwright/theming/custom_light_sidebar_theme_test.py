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

import pytest
from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import expect_no_skeletons


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_custom_light_sidebar_theme():
    """Configure custom light theme."""
    # [theme] configs
    os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"] = "14"
    os.environ["STREAMLIT_THEME_PRIMARY_COLOR"] = "#1a6ce7"
    os.environ["STREAMLIT_THEME_TEXT_COLOR"] = "#1e252f"

    # [theme.light] configs
    os.environ["STREAMLIT_THEME_LIGHT_BACKGROUND_COLOR"] = "#ffffff"
    os.environ["STREAMLIT_THEME_LIGHT_SECONDARY_BACKGROUND_COLOR"] = "#f7f7f7"
    os.environ["STREAMLIT_THEME_LIGHT_BORDER_COLOR"] = "#d5dae4"
    os.environ["STREAMLIT_THEME_LIGHT_FONT"] = (
        "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, "
        "sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
    )
    os.environ["STREAMLIT_THEME_LIGHT_HEADING_FONT"] = (
        "bold Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
        "Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
    )
    os.environ["STREAMLIT_THEME_LIGHT_CODE_FONT"] = (
        '"Monaspace Argon", Menlo, Monaco, Consolas, "Courier New", monospace'
    )

    # [theme.sidebar] configs
    os.environ["STREAMLIT_THEME_SIDEBAR_BACKGROUND_COLOR"] = (
        "#bfbbbb"  # Should override [theme.light] config - light gray
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_BORDER_COLOR"] = (
        "#000000"  # Should apply - black
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_DATAFRAME_BORDER_COLOR"] = (
        "#FF69B4"  # Should apply - hot pink
    )

    # [theme.light.sidebar] configs
    os.environ["STREAMLIT_THEME_LIGHT_SIDEBAR_BORDER_COLOR"] = (
        "#ff6700"  # hazard orange - should override [theme.light] & [theme.sidebar] configs
    )
    os.environ["STREAMLIT_THEME_LIGHT_SIDEBAR_LINK_COLOR"] = "#7851A9"  # royal purple
    yield
    del os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"]
    del os.environ["STREAMLIT_THEME_PRIMARY_COLOR"]
    del os.environ["STREAMLIT_THEME_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_LIGHT_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_LIGHT_SECONDARY_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_LIGHT_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_LIGHT_FONT"]
    del os.environ["STREAMLIT_THEME_LIGHT_HEADING_FONT"]
    del os.environ["STREAMLIT_THEME_LIGHT_CODE_FONT"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_DATAFRAME_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_LIGHT_SIDEBAR_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_LIGHT_SIDEBAR_LINK_COLOR"]


@pytest.mark.usefixtures("configure_custom_light_sidebar_theme")
def test_auto_sidebar_theme_with_light_preference(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the auto sidebar theme is the Custom Theme Light when the system preference is light."""
    # Browser preference should be light by default
    is_light_mode = app.evaluate("matchMedia('(prefers-color-scheme: light)').matches")
    assert is_light_mode is True

    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    assert_snapshot(app, name="custom_light_sidebar_theme_auto", image_threshold=0.0003)


@pytest.mark.usefixtures("configure_custom_light_sidebar_theme")
def test_custom_light_sidebar_theme(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the custom light sidebar theme is rendered correctly."""
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    # Change the theme to explicitly be Custom Light Theme:
    app.get_by_test_id("stMainMenu").click()
    main_menu_list = app.get_by_test_id("stMainMenuList")
    main_menu_list.get_by_text("Settings").click()

    settings_dialog = app.get_by_test_id("stDialog")
    settings_dialog.get_by_role("combobox").click()

    light_theme_option = app.get_by_test_id("stSelectboxVirtualDropdown").get_by_text(
        "Light"
    )
    light_theme_option.click()

    # Close settings dialog
    settings_dialog.get_by_role("button", name="Close").click()

    assert_snapshot(app, name="custom_light_sidebar_theme", image_threshold=0.0003)


@pytest.mark.usefixtures("configure_custom_light_sidebar_theme")
def test_custom_dark_sidebar_theme_with_no_dark_configs(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the custom dark sidebar theme is rendered correctly with no dark configs."""
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

    # Select Custom Theme Dark
    dark_theme_option = app.get_by_test_id("stSelectboxVirtualDropdown").get_by_text(
        "Dark"
    )
    dark_theme_option.click()

    # Close settings dialog
    settings_dialog.get_by_role("button", name="Close").click()

    assert_snapshot(
        app, name="custom_dark_sidebar_theme_no_dark_configs", image_threshold=0.0003
    )
