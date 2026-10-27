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
    wait_until,
)
from e2e_playwright.shared.app_utils import expect_font, expect_no_skeletons
from e2e_playwright.shared.dataframe_utils import expect_canvas_to_be_stable


def _dataframe_canvas_has_painted_content(app: Page) -> bool:
    """Return True when the first dataframe canvas has non-blank pixels."""
    return bool(
        app.evaluate(
            """() => {
                const canvas = document.querySelector(
                    '[data-testid="stDataFrame"] canvas'
                );
                if (!canvas || canvas.width === 0 || canvas.height === 0) {
                    return false;
                }
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (!ctx) {
                    return false;
                }
                const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < data.length; i += 4) {
                    // Non-transparent and not nearly white → cells/grid are painted.
                    if (
                        data[i + 3] > 0 &&
                        (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250)
                    ) {
                        return true;
                    }
                }
                return false;
            }"""
        )
    )


def _wait_for_theme_app_ready(app: Page) -> None:
    """Stabilize fonts and dataframe paint before full-page theme snapshots.

    Webkit can screenshot after layout but before Glide paints cell content,
    producing an empty bordered dataframe frame (~0.12% pixel diff).
    """
    expect_no_skeletons(app, timeout=25000)
    expect_font(app, "Material Symbols Rounded")
    expect_font(app, "Inter")
    dataframe = app.get_by_test_id("stDataFrame").first
    expect(dataframe).to_be_visible()
    expect_canvas_to_be_stable(dataframe)
    wait_until(app, lambda: _dataframe_canvas_has_painted_content(app), timeout=10000)


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

    _wait_for_theme_app_ready(app)
    assert_snapshot(app, name="custom_theme_auto_light", image_threshold=0.0003)


@pytest.mark.usefixtures("configure_custom_light_theme")
def test_custom_light_theme(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the custom light theme is rendered correctly."""
    _wait_for_theme_app_ready(app)

    # Change the theme to explicitly be Custom Light Theme via the main menu:
    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")
    menu.get_by_role("menuitemradio", name="Light").click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()
    wait_for_app_run(app)

    _wait_for_theme_app_ready(app)
    assert_snapshot(app, name="custom_light_themed_app", image_threshold=0.0003)


@pytest.mark.usefixtures("configure_custom_light_theme")
def test_custom_dark_theme_with_dark_configs(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the custom dark theme is rendered correctly with expected dark configs."""
    _wait_for_theme_app_ready(app)

    # Switch to Custom Dark Theme via the main menu:
    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")
    menu.get_by_role("menuitemradio", name="Dark").click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()
    wait_for_app_run(app)

    _wait_for_theme_app_ready(app)
    assert_snapshot(
        app, name="custom_dark_theme_with_dark_configs", image_threshold=0.0003
    )


@pytest.mark.usefixtures("configure_custom_light_theme")
def test_theme_preference_persists_on_reload(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that custom theme selection persists across full page reload (issue #13280)."""
    _wait_for_theme_app_ready(app)

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

    _wait_for_theme_app_ready(app)
    assert_snapshot(app, name="persisted_on_reload_before", image_threshold=0.0003)

    # Force a full page reload
    app.reload()

    wait_for_app_loaded(app)
    _wait_for_theme_app_ready(app)

    # Snapshot before opening the menu so focus/hover from the menu cannot
    # affect the full-page screenshot. Slightly looser threshold than the
    # pre-reload snapshot: after reload, webkit/firefox occasionally shift
    # help-icon anti-aliasing by ~1px (~290 pixels / 0.03%), which is just
    # over the 0.0003 budget used elsewhere in this file.
    assert_snapshot(app, name="persisted_on_reload_after", image_threshold=0.0005)

    # Verify the stored theme preference itself persisted in the menu.
    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")
    dark_radio = menu.get_by_role("menuitemradio", name="Dark")
    expect(dark_radio).to_have_attribute("aria-checked", "true")
