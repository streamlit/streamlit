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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded
from e2e_playwright.shared.app_utils import click_button
from e2e_playwright.shared.theme_utils import apply_theme_via_window


def test_default_toast_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that toasts are correctly rendered."""
    themed_app.keyboard.press("r")
    wait_for_app_loaded(themed_app)
    themed_app.wait_for_timeout(250)

    toasts = themed_app.get_by_test_id("stToast")
    expect(toasts).to_have_count(3)
    toasts.nth(2).hover()

    expect(toasts.nth(2)).to_contain_text("🐶This is a default toast message")
    assert_snapshot(toasts.nth(2), name="toast-default")


def test_collapsed_toast_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test collapsed long toasts are correctly rendered."""
    themed_app.keyboard.press("r")
    wait_for_app_loaded(themed_app)
    themed_app.wait_for_timeout(250)

    toasts = themed_app.get_by_test_id("stToast")
    expect(toasts).to_have_count(3)
    toasts.nth(1).hover()

    expect(toasts.nth(1)).to_contain_text(
        "🦄Random toast message that is a really really really really really really "
        "really long message, going wayview moreClose"
    )
    assert_snapshot(toasts.nth(1), name="toast-collapsed")


def test_expanded_toast_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test expanded long toasts are correctly rendered."""
    themed_app.keyboard.press("r")
    wait_for_app_loaded(themed_app)
    themed_app.wait_for_timeout(250)

    toasts = themed_app.get_by_test_id("stToast")
    expect(toasts).to_have_count(3)
    toasts.nth(1).hover()

    expand = themed_app.get_by_text("view more")
    expect(expand).to_have_count(1)
    expand.click()

    expect(toasts.nth(1)).to_contain_text(
        "🦄Random toast message that is a really really really really really really "
        "really long message, going way past the 3 line limitview lessClose"
    )
    assert_snapshot(toasts.nth(1), name="toast-expanded")


def test_toast_with_material_icon_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that toasts with material icons are correctly rendered."""
    themed_app.keyboard.press("r")
    wait_for_app_loaded(themed_app)
    themed_app.wait_for_timeout(250)

    toasts = themed_app.get_by_test_id("stToast")
    expect(toasts).to_have_count(3)
    toasts.nth(0).hover()

    expect(toasts.nth(0)).to_contain_text("cabinYour edited image was saved!Close")
    assert_snapshot(toasts.nth(0), name="toast-material-icon")


def test_toast_above_dialog(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that toasts are correctly rendered above dialog."""
    # Set viewport size to better show dialog/toast interaction
    app.set_viewport_size({"width": 650, "height": 958})

    app.keyboard.press("r")
    wait_for_app_loaded(app)
    app.wait_for_timeout(250)

    # Trigger dialog
    app.get_by_text("Trigger dialog").click()
    # Ensure previous toasts have timed out
    app.wait_for_timeout(4500)

    # Trigger toast from dialog
    app.get_by_text("Toast from dialog").click()

    toasts = app.get_by_test_id("stToast")
    expect(toasts).to_have_count(1)
    expect(toasts.nth(0)).to_contain_text("🎉Toast above dialogClose")
    toaster = app.get_by_test_id("stToastContainer")
    assert_snapshot(toaster, name="toast-above-dialog")


def test_toast_duration(app: Page):
    """Test that toasts with different durations are correctly handled."""

    click_button(app, "Show duration toasts")

    short_duration_toast = app.get_by_text("I am a toast with a short duration")
    long_duration_toast = app.get_by_text("I am a toast with a long duration")
    persistent_toast = app.get_by_text("I am a persistent toast")

    # Check that the short duration toast is visible initially
    expect(short_duration_toast).to_be_visible()
    # and then disappears after 2 seconds
    app.wait_for_timeout(2500)
    expect(short_duration_toast).not_to_be_visible()

    # Check that the long duration toast is visible initially
    expect(long_duration_toast).to_be_visible()
    # Check that the persistent toast is still visible after the default 4s
    expect(persistent_toast).to_be_visible()


def test_toast_adjusts_for_custom_theme(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that toasts adjust for custom theme."""
    # Apply custom theme using window injection
    apply_theme_via_window(
        app, base="light", textColor="#301934", backgroundColor="#CBC3E3"
    )

    # Reload to apply the theme
    app.reload()
    wait_for_app_loaded(app)
    app.wait_for_timeout(250)

    toasts = app.get_by_test_id("stToast")
    expect(toasts).to_have_count(3)
    toast = toasts.filter(has_text="🐶This is a default toast message")
    expect(toast).to_be_visible()
    toast.hover()

    assert_snapshot(toast, name="toast-custom-theme")
