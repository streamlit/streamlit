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

import math
from typing import Callable, cast

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import check_top_level_class


def create_sidebar_collapsed_checker(sidebar: Locator) -> Callable[[], bool]:
    """Helper to create a function that checks if sidebar is collapsed."""

    def check_sidebar_collapsed() -> bool:
        return sidebar.get_attribute("aria-expanded") == "false"

    return check_sidebar_collapsed


def create_sidebar_expanded_checker(sidebar: Locator) -> Callable[[], bool]:
    """Helper to create a function that checks if sidebar is expanded."""

    def check_sidebar_expanded() -> bool:
        return sidebar.get_attribute("aria-expanded") == "true"

    return check_sidebar_expanded


def create_sidebar_exists_checker(sidebar: Locator) -> Callable[[], bool]:
    """Helper to create a function that checks if sidebar element exists."""

    def check_sidebar_exists() -> bool:
        return sidebar.count() > 0

    return check_sidebar_exists


def get_sidebar_width(sidebar: Locator) -> int:
    """Helper to get the current width of the sidebar."""
    return cast("int", sidebar.evaluate("el => el.getBoundingClientRect().width"))


def test_sidebar_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    sidebar = themed_app.get_by_test_id("stSidebar")
    # Add an except before snapshot assert to ensure that there is time for painting
    # to complete.
    expect(sidebar.get_by_test_id("stVegaLiteChart")).to_be_visible()
    assert_snapshot(sidebar, name="st_sidebar-display")


def test_sidebar_date_input_popover(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Handles z-index of date input popover correctly."""
    date_inputs = themed_app.get_by_test_id("stSidebar").get_by_test_id("stDateInput")
    expect(date_inputs).to_have_count(2)
    expect(date_inputs.first).to_be_visible()
    date_inputs.first.click()
    calendar_popover = themed_app.locator("[data-baseweb='calendar']")
    expect(calendar_popover).to_be_visible()
    assert_snapshot(calendar_popover, name="st_sidebar-date_popover")


def test_sidebar_overwriting_elements(app: Page):
    sidebar_text = app.get_by_test_id("stSidebar").get_by_test_id("stText")
    expect(sidebar_text).to_contain_text("overwritten")


def test_sidebar_collapse_on_mobile_resize(app: Page):
    app.set_viewport_size({"width": 800, "height": 400})
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    app.set_viewport_size({"width": 400, "height": 800})
    expect(sidebar).to_have_attribute("aria-expanded", "false")


def test_sidebar_no_collapse_on_text_input_mobile(app: Page):
    app.set_viewport_size({"width": 400, "height": 800})

    # Expand the sidebar on mobile
    app.get_by_test_id("stExpandSidebarButton").click()

    app.get_by_test_id("stSidebar").get_by_test_id("stTextInput").locator(
        "input"
    ).click()

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")


def test_sidebar_chart_and_toolbar(app: Page):
    sidebar = app.get_by_test_id("stSidebar")
    # Check for the chart & tooltip
    chart = sidebar.get_by_test_id("stVegaLiteChart")
    chart.hover(position={"x": 60, "y": 220})
    tooltip = app.locator("#vg-tooltip-element")
    expect(tooltip).to_be_visible()


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stSidebar")


def test_sidebar_resize_functionality(app: Page):
    """Test that sidebar can be resized by dragging and not by clicking."""

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()

    initial_width = get_sidebar_width(sidebar)

    resize_handle = app.locator("div[style*='cursor: col-resize']")
    expect(resize_handle).to_be_visible()

    handle_box = resize_handle.bounding_box()

    assert handle_box is not None

    handle_x = handle_box["x"] + handle_box["width"] / 2
    handle_y = handle_box["y"] + handle_box["height"] / 2

    # Drag the handle to the right by 20 pixels
    drag_distance = 20
    app.mouse.move(handle_x, handle_y)
    app.mouse.down()
    app.mouse.move(handle_x + drag_distance, handle_y)
    app.mouse.up()

    def check_width_changed() -> bool:
        return get_sidebar_width(sidebar) > initial_width

    wait_until(app, check_width_changed)

    after_drag_width = get_sidebar_width(sidebar)

    def check_approximate_width_change() -> bool:
        current_width = get_sidebar_width(sidebar)
        width_change = current_width - initial_width
        return math.isclose(width_change, drag_distance, abs_tol=3)

    wait_until(app, check_approximate_width_change)

    # Now just click the resize handle without dragging
    resize_handle.click()

    # Track width changes after clicking to detect stabilization
    last_seen_width = after_drag_width
    stable_count = 0

    def check_width_stabilized() -> bool:
        nonlocal last_seen_width, stable_count
        current_width = get_sidebar_width(sidebar)

        if current_width == last_seen_width:
            stable_count += 1
        else:
            # Width changed, reset counter
            last_seen_width = current_width
            stable_count = 0

        # Consider width stable if it hasn't changed for 3 consecutive checks
        return stable_count >= 3

    wait_until(app, check_width_stabilized)

    # Now get the stable width after clicking
    click_width = get_sidebar_width(sidebar)

    # Finally, test double-click to reset width
    resize_handle.dblclick()

    # Wait for the reset to take effect
    def check_width_reset() -> bool:
        reset_width = get_sidebar_width(sidebar)
        return reset_width != click_width

    wait_until(app, check_width_reset)

    # Measure the width after double-clicking
    after_dblclick_width = get_sidebar_width(sidebar)

    # Verify the width changed (reset to default)
    assert after_dblclick_width != click_width, (
        f"Width didn't reset after double-clicking: {after_dblclick_width} == {click_width}"
    )


def test_sidebar_width_localstorage_persistence(app: Page):
    """Test that sidebar width is saved to localStorage and restored on page reload."""

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()

    default_width = get_sidebar_width(sidebar)

    resize_handle = app.locator("div[style*='cursor: col-resize']")
    expect(resize_handle).to_be_visible()

    handle_box = resize_handle.bounding_box()
    assert handle_box is not None

    handle_x = handle_box["x"] + handle_box["width"] / 2
    handle_y = handle_box["y"] + handle_box["height"] / 2

    # Drag by 50px to make a significant width change
    drag_distance = 50
    app.mouse.move(handle_x, handle_y)
    app.mouse.down()
    app.mouse.move(handle_x + drag_distance, handle_y)
    app.mouse.up()

    def check_width_changed() -> bool:
        current_width = get_sidebar_width(sidebar)
        return abs(current_width - default_width) >= (drag_distance - 5)

    wait_until(app, check_width_changed)

    new_width = get_sidebar_width(sidebar)

    saved_width = app.evaluate("() => window.localStorage.getItem('sidebarWidth')")
    assert saved_width == str(new_width), (
        f"Width not saved to localStorage: expected {new_width}, got {saved_width}"
    )

    app.reload()

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()

    def check_width_restored() -> bool:
        restored_width = get_sidebar_width(sidebar)
        return (
            abs(restored_width - new_width) <= 3
        )  # Allow small tolerance for rendering

    wait_until(app, check_width_restored)

    restored_width = get_sidebar_width(sidebar)
    assert abs(restored_width - new_width) <= 3, (
        f"Width not restored from localStorage: expected ~{new_width}, got {restored_width}"
    )


def test_sidebar_width_double_click_updates_localstorage(app: Page):
    """Test that double-clicking to reset width also updates localStorage."""

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()

    default_width = get_sidebar_width(sidebar)

    resize_handle = app.locator("div[style*='cursor: col-resize']")
    expect(resize_handle).to_be_visible()

    handle_box = resize_handle.bounding_box()
    assert handle_box is not None

    handle_x = handle_box["x"] + handle_box["width"] / 2
    handle_y = handle_box["y"] + handle_box["height"] / 2

    # Drag to make the sidebar wider
    app.mouse.move(handle_x, handle_y)
    app.mouse.down()
    app.mouse.move(handle_x + 40, handle_y)
    app.mouse.up()

    def check_width_increased() -> bool:
        current_width = get_sidebar_width(sidebar)
        return current_width > default_width + 30

    wait_until(app, check_width_increased)

    custom_width_saved = app.evaluate(
        "() => window.localStorage.getItem('sidebarWidth')"
    )
    assert custom_width_saved is not None
    assert int(custom_width_saved) > default_width

    resize_handle.dblclick()

    def check_width_reset() -> bool:
        current_width = get_sidebar_width(sidebar)
        return abs(current_width - default_width) <= 3

    wait_until(app, check_width_reset)

    reset_width_saved = app.evaluate(
        "() => window.localStorage.getItem('sidebarWidth')"
    )
    assert reset_width_saved == str(default_width), (
        f"localStorage not updated after double-click reset: expected {default_width}, got {reset_width_saved}"
    )


def test_sidebar_width_initial_load_from_localstorage(app: Page):
    """Test that sidebar respects width from localStorage on initial load."""

    custom_width = 350
    app.evaluate(f"() => window.localStorage.setItem('sidebarWidth', '{custom_width}')")

    app.reload()

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()

    def check_initial_width() -> bool:
        current_width = get_sidebar_width(sidebar)
        return abs(current_width - custom_width) <= 3

    wait_until(app, check_initial_width)

    actual_width = get_sidebar_width(sidebar)
    assert abs(actual_width - custom_width) <= 3, (
        f"Sidebar didn't use localStorage width on initial load: expected ~{custom_width}, got {actual_width}"
    )


def test_sidebar_toggle_state_localstorage_persistence(app: Page):
    """Test that sidebar toggle state is saved to localStorage and restored on page reload."""

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()

    expect(sidebar).to_have_attribute("aria-expanded", "true")

    sidebar_header = app.get_by_test_id("stSidebarHeader")
    expect(sidebar_header).to_be_visible()
    sidebar_header.hover()

    collapse_button = app.get_by_test_id("stSidebarCollapseButton")
    expect(collapse_button).to_be_visible()
    collapse_button.click()

    wait_until(app, create_sidebar_collapsed_checker(sidebar))

    saved_state = app.evaluate(
        "() => window.localStorage.getItem('stSidebarCollapsed-')"
    )
    assert saved_state == "true", (
        f"Collapsed state not saved to localStorage: expected 'true', got {saved_state}"
    )

    app.reload()

    sidebar = app.get_by_test_id("stSidebar")

    wait_until(app, create_sidebar_exists_checker(sidebar))

    wait_until(app, create_sidebar_collapsed_checker(sidebar))

    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expect(expand_button).to_be_visible()
    expand_button.click()

    wait_until(app, create_sidebar_expanded_checker(sidebar))

    expect(sidebar).to_be_visible()

    saved_state_expanded = app.evaluate(
        "() => window.localStorage.getItem('stSidebarCollapsed-')"
    )
    assert saved_state_expanded == "false", (
        f"Expanded state not saved to localStorage: expected 'false', got {saved_state_expanded}"
    )


def test_sidebar_toggle_state_initial_load_from_localstorage(app: Page):
    """Test that sidebar respects toggle state from localStorage on initial load."""

    app.evaluate("() => window.localStorage.setItem('stSidebarCollapsed-', 'true')")

    app.reload()

    sidebar = app.get_by_test_id("stSidebar")
    wait_until(app, create_sidebar_exists_checker(sidebar))

    wait_until(app, create_sidebar_collapsed_checker(sidebar))

    app.evaluate("() => window.localStorage.setItem('stSidebarCollapsed-', 'false')")
    app.reload()

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()

    wait_until(app, create_sidebar_expanded_checker(sidebar))


def test_sidebar_toggle_state_invalid_localstorage_fallback(app: Page):
    """Test that sidebar falls back gracefully when localStorage has invalid values."""

    app.evaluate("() => window.localStorage.setItem('stSidebarCollapsed-', 'invalid')")

    app.reload()

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()

    wait_until(app, create_sidebar_expanded_checker(sidebar))


def test_sidebar_toggle_state_overrides_initial_config(app: Page):
    """Test that localStorage toggle state overrides initial sidebar configuration.
    This test verifies that if a user has manually set a preference,
    it takes precedence over any st.set_page_config(initial_sidebar_state=...).
    """

    app.evaluate("() => window.localStorage.setItem('stSidebarCollapsed-', 'true')")

    app.reload()

    sidebar = app.get_by_test_id("stSidebar")
    wait_until(app, create_sidebar_exists_checker(sidebar))

    wait_until(app, create_sidebar_collapsed_checker(sidebar))

    app.evaluate("() => window.localStorage.removeItem('stSidebarCollapsed-')")
    app.reload()

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()

    wait_until(app, create_sidebar_expanded_checker(sidebar))
