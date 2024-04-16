# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def _evaluate_match_media_print(app: Page):
    app.evaluate("matchMedia('print').matches")


def test_app(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the app renders correctly using snapshot testing. Helps to compare with the printing version."""
    assert_snapshot(app, name="print_app-screen_media")


def test_app_print_mode_with_sidebar_open_light_theme(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the app looks correctly in print-mode with sidebar open and light-theme."""
    app.emulate_media(media="print", forced_colors="active", color_scheme="light")
    _evaluate_match_media_print(app)

    # ensure that the sidebar is visible
    expect(app.get_by_test_id("stSidebarContent")).to_be_visible()

    assert_snapshot(app, name="print_app-print_media-sidebar_open-light_theme")


def test_app_print_mode_with_sidebar_open_dark_theme(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the app looks correctly in print-mode with sidebar open and dark-theme."""
    app.emulate_media(media="print", forced_colors="active", color_scheme="dark")
    _evaluate_match_media_print(app)

    # ensure that the sidebar is visible
    expect(app.get_by_test_id("stSidebarContent")).to_be_visible()

    assert_snapshot(app, name="print_app-print_media-sidebar_open-dark_theme")


def test_app_print_mode_with_sidebar_closed(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the app looks correctly in print-mode with sidebar closed."""

    # close sidebar. Must be done before print-mode, because we hide the close button when printing
    sidebar_element = app.get_by_test_id("stSidebarContent")
    sidebar_element.get_by_test_id("baseButton-header").click()
    expect(sidebar_element).not_to_be_visible()

    app.emulate_media(media="print", forced_colors="active", color_scheme="light")
    _evaluate_match_media_print(app)

    assert_snapshot(app, name="print_app-print_media-sidebar_closed-light_theme")
