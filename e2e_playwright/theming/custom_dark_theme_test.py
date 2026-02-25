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
    build_app_url,
    wait_for_app_loaded,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import expect_no_skeletons


@pytest.fixture
def app(page: Page, app_base_url: str) -> Page:
    """Custom app fixture that sets dark mode color scheme before navigation.

    This uses page.emulate_media() instead of browser_context_args to avoid
    conflicts with browser context lifecycle in Firefox.
    """
    # Set dark mode color scheme before navigating to the app
    page.emulate_media(color_scheme="dark")

    response = page.goto(build_app_url(app_base_url, path="/"))
    if response is None or response.status != 200:
        raise RuntimeError("Unable to load page")

    wait_for_app_loaded(page)
    return page


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

    # Change the theme to explicitly be Custom Dark Theme via the main menu:
    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")
    menu.get_by_role("menuitemradio", name="Dark").click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()
    wait_for_app_run(app)

    assert_snapshot(app, name="custom_dark_themed_app", image_threshold=0.0003)


@pytest.mark.usefixtures("configure_custom_dark_theme")
def test_custom_light_theme_with_no_light_configs(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the custom light theme is rendered correctly with no light configs."""
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    # Switch to Custom Light Theme via the main menu:
    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")
    menu.get_by_role("menuitemradio", name="Light").click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()
    wait_for_app_run(app)

    assert_snapshot(
        app, name="custom_light_theme_no_light_configs", image_threshold=0.0003
    )
