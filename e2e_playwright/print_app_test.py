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

"""Emulate printing by setting the 'print' media type and the viewport size similar to DIN A4 dimensions.

The 'forced_colors="active"' argument is supposed to force showing background images
similar to the '-webkit-print-color-adjust' CSS property. It looks like
for the test that Chromium does not respect this property, so screenshots might look
funny from a color-perspective there.

"""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def _evaluate_match_media_print(app: Page):
    app.evaluate("matchMedia('print').matches")


# DIN A4 paper is 21cm x 29.7cm which is 595px x 842px in 72dpi;
# Use higher pixels to avoid mobile media queries to trigger but keep the ratio
portrait_width_px = 1240
portrait_height_px = 1754


def _set_portrait_dimensions(app: Page):
    app.set_viewport_size({"width": portrait_width_px, "height": portrait_height_px})


def _set_landscape_dimensions(app: Page):
    app.set_viewport_size({"width": portrait_height_px, "height": portrait_width_px})


def test_app(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the app renders correctly using snapshot testing. Helps to compare with the printing version."""
    assert_snapshot(app, name="print_app-screen_media")


def test_app_print_mode_portrait_with_sidebar_open(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the app looks correctly in print-mode with sidebar open."""
    app = themed_app
    app.emulate_media(media="print", forced_colors="active")
    _set_portrait_dimensions(app)
    _evaluate_match_media_print(app)

    # ensure that the sidebar is visible
    expect(app.get_by_test_id("stSidebarContent")).to_be_visible()

    assert_snapshot(app, name="print_app-print_media-portrait-sidebar_open")


def test_app_print_mode_portrait_with_sidebar_closed(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the app looks correctly in print-mode with sidebar closed."""
    app = themed_app
    # close sidebar. Must be done before print-mode, because we hide the close button when printing
    sidebar_element = app.get_by_test_id("stSidebarContent")
    sidebar_element.get_by_test_id("baseButton-header").click()
    expect(sidebar_element).not_to_be_visible()

    app.emulate_media(media="print", forced_colors="active")
    _set_portrait_dimensions(app)
    _evaluate_match_media_print(app)

    assert_snapshot(app, name="print_app-print_media-portrait-sidebar_closed")


def test_app_print_mode_landscape_with_sidebar_open(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the app looks correctly in print-mode (orientation: landscape) with sidebar open."""
    app = themed_app
    app.emulate_media(media="print", forced_colors="active")
    _set_landscape_dimensions(app)
    _evaluate_match_media_print(app)

    # ensure that the sidebar is visible
    expect(app.get_by_test_id("stSidebarContent")).to_be_visible()

    assert_snapshot(app, name="print_app-print_media-landscape-sidebar_open")


def test_app_print_mode_landscape_with_sidebar_closed(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the app looks correctly in print-mode (orientation: landscape) with sidebar closed."""
    app = themed_app
    # close sidebar. Must be done before print-mode, because we hide the close button when printing
    sidebar_element = app.get_by_test_id("stSidebarContent")
    sidebar_element.get_by_test_id("baseButton-header").click()
    expect(sidebar_element).not_to_be_visible()

    app.emulate_media(media="print", forced_colors="active")
    _set_landscape_dimensions(app)
    _evaluate_match_media_print(app)

    assert_snapshot(app, name="print_app-print_media-landscape-sidebar_closed")
