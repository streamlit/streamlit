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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded
from e2e_playwright.shared.app_utils import click_button, expect_font, reset_hovering
from e2e_playwright.shared.theme_utils import apply_theme_via_window

# Startup script emits two default-duration emoji toasts used by rendering tests.
_STARTUP_TOAST_COUNT = 2


def _prepare_toast_snapshots(page: Page) -> None:
    """Wait for fonts used by toast icons/text before screenshot assertions."""
    expect_font(page, "Material Symbols Rounded")
    expect_font(page, "Source Sans")
    page.wait_for_timeout(250)


def _wait_for_stable_toast_size(toast: Locator, timeout_ms: int = 3000) -> None:
    """Wait until the toast bounding box height stops changing (font/layout settle)."""
    page = toast.page
    expect(toast).to_be_visible()
    last_height: float | None = None
    stable_iters = 0
    deadline = page.evaluate("Date.now()") + timeout_ms
    while page.evaluate("Date.now()") < deadline:
        box = toast.bounding_box()
        height = None if box is None else box["height"]
        if (
            height is not None
            and last_height is not None
            and abs(height - last_height) < 0.5
        ):
            stable_iters += 1
            if stable_iters >= 4:
                return
        else:
            stable_iters = 0
        last_height = height
        page.wait_for_timeout(50)


def test_default_toast_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that toasts are correctly rendered."""
    # Snapshot against the initial-load toasts. Do not press "r" first: with toast
    # lifetime decoupled from the element tree, a rerun keeps the original timer
    # running and can leave the toast mid-dismiss when we screenshot.
    _prepare_toast_snapshots(themed_app)
    toasts = themed_app.get_by_test_id("stToast")
    expect(toasts).to_have_count(_STARTUP_TOAST_COUNT)
    # Locate by content rather than index; with toast lifetime decoupled from
    # the element tree, stacking order is not a stable contract.
    default_toast = toasts.filter(has_text="This is a default toast message")
    default_toast.hover()
    _wait_for_stable_toast_size(default_toast)

    expect(default_toast).to_contain_text("🐶This is a default toast message")
    # Verify close button is accessible
    close_button = default_toast.get_by_role("button", name="Close")
    expect(close_button).to_be_visible()
    assert_snapshot(default_toast, name="toast-default")


def test_collapsed_toast_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test collapsed long toasts are correctly rendered."""
    _prepare_toast_snapshots(themed_app)
    toasts = themed_app.get_by_test_id("stToast")
    expect(toasts).to_have_count(_STARTUP_TOAST_COUNT)
    # Locate by content rather than index; with toast lifetime decoupled from
    # the element tree, stacking order is not a stable contract.
    long_toast = toasts.filter(has_text="Random toast message")
    long_toast.hover()
    _wait_for_stable_toast_size(long_toast)

    expect(long_toast).to_contain_text(
        "🦄Random toast message that is a really really really really really really "
        "really long message, going way past the 3 line limitview more"
    )
    assert_snapshot(long_toast, name="toast-collapsed")


def test_expanded_toast_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test expanded long toasts are correctly rendered."""
    _prepare_toast_snapshots(themed_app)
    toasts = themed_app.get_by_test_id("stToast")
    expect(toasts).to_have_count(_STARTUP_TOAST_COUNT)
    # Locate by content rather than index; with toast lifetime decoupled from
    # the element tree, stacking order is not a stable contract.
    long_toast = toasts.filter(has_text="Random toast message")
    long_toast.hover()

    expand = long_toast.get_by_text("view more")
    expect(expand).to_be_visible()
    expand.click()

    expect(long_toast).to_contain_text(
        "🦄Random toast message that is a really really really really really really "
        "really long message, going way past the 3 line limitview less"
    )
    reset_hovering(themed_app)
    _wait_for_stable_toast_size(long_toast)
    assert_snapshot(long_toast, name="toast-expanded")


def test_toast_with_material_icon_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that toasts with material icons are correctly rendered."""
    # Wait for the icon font, then emit the toast so layout uses the loaded face.
    _prepare_toast_snapshots(themed_app)
    click_button(themed_app, "Show material icon toast")

    material_icon_toast = themed_app.get_by_test_id("stToast").filter(
        has_text="Your edited image was saved!"
    )
    expect(material_icon_toast).to_be_visible()
    material_icon_toast.hover()
    _wait_for_stable_toast_size(material_icon_toast)

    expect(material_icon_toast).to_contain_text("cabinYour edited image was saved!")
    assert_snapshot(material_icon_toast, name="toast-material-icon")


def test_toast_above_dialog(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that toasts are correctly rendered above dialog."""
    # Set viewport size to better show dialog/toast interaction
    app.set_viewport_size({"width": 650, "height": 958})

    # Trigger dialog
    app.get_by_text("Trigger dialog").click()
    # Ensure previous (default-duration) toasts have timed out
    app.wait_for_timeout(4500)

    # Trigger toast from dialog
    app.get_by_text("Toast from dialog").click()

    toasts = app.get_by_test_id("stToast")
    expect(toasts).to_have_count(1)
    expect(toasts.nth(0)).to_contain_text("🎉Toast above dialog")
    dialog = app.get_by_role("dialog")
    assert_snapshot(dialog, name="toast-above-dialog")


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


def test_toast_persists_through_rerun(app: Page):
    """Test that a toast emitted right before st.rerun() still appears (#7740)."""
    click_button(app, "Toast and rerun")

    toast = app.get_by_test_id("stToast").filter(has_text="Toast survives rerun")
    # The toast survives the immediately-following st.rerun()...
    expect(toast).to_be_visible()
    # ...and is not duplicated by the rerun re-processing the delta.
    expect(toast).to_have_count(1)

    # It still auto-hides after its (default 4s) duration rather than lingering.
    # Extra slack beyond 4s covers post-rerun mount + exit animation.
    expect(toast).not_to_be_visible(timeout=7000)


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
    _prepare_toast_snapshots(app)

    toasts = app.get_by_test_id("stToast")
    expect(toasts).to_have_count(_STARTUP_TOAST_COUNT)
    toast = toasts.filter(has_text="🐶This is a default toast message")
    expect(toast).to_be_visible()
    toast.hover()
    _wait_for_stable_toast_size(toast)

    assert_snapshot(toast, name="toast-custom-theme")
