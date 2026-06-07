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

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_toggle,
    get_element_by_key,
    get_expander,
    reset_hovering,
)


def test_tabs_render_correctly(themed_app: Page, assert_snapshot: ImageCompareFunction):
    st_tabs = themed_app.get_by_test_id("stTabs")
    expect(st_tabs).to_have_count(14)

    assert_snapshot(st_tabs.nth(0), name="st_tabs-sidebar")
    assert_snapshot(st_tabs.nth(1), name="st_tabs-text_input")
    assert_snapshot(st_tabs.nth(2), name="st_tabs-many")
    assert_snapshot(st_tabs.nth(3), name="st_tabs-markdown_labels")
    assert_snapshot(st_tabs.nth(5), name="st_tabs-fixed_width")


def test_displays_correctly_in_sidebar(app: Page):
    expect(app.get_by_test_id("stSidebar").get_by_test_id("stTab")).to_have_count(2)
    expect(app.get_by_text("I am in the sidebar")).to_have_count(1)
    expect(app.get_by_text("I am in the sidebarI'm also in the sidebar")).to_have_count(
        1
    )


def test_contains_all_tabs_when_overflowing(app: Page):
    expect(get_expander(app, "Expander").get_by_test_id("stTab")).to_have_count(25)


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stTabs")


def test_tabs_with_html(app: Page):
    tabs = app.get_by_test_id("stTabs").nth(4)

    expect(app.get_by_text("This is HTML tab 1")).to_be_visible()
    tabs.get_by_role("tab", name="HTML Tab 2").click()
    expect(app.get_by_text("This is HTML tab 2")).to_be_visible()
    tabs.get_by_role("tab", name="HTML Tab 3").click()
    expect(app.get_by_text("This is HTML tab 3")).to_be_visible()
    tabs.get_by_role("tab", name="HTML Tab 1").click()
    expect(app.get_by_text("This is HTML tab 1")).to_be_visible()


def test_tabs_with_code_layouts(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that tabs with code blocks and different height configurations render correctly."""
    tabs_with_code = app.get_by_test_id("stTabs").nth(6)

    # Test Tab 1 with container and stretched code
    tabs_with_code.scroll_into_view_if_needed()
    assert_snapshot(tabs_with_code, name="st_tabs-code_stretch_height_in_container")

    # Switch to Tab 2 and test fixed height and stretched code
    tabs_with_code.get_by_role("tab", name="Tab 2").click()
    assert_snapshot(tabs_with_code, name="st_tabs-fixed_height_stretch_height")


def test_overflow_scroll_arrows(app: Page):
    """Test that scroll arrows appear and work when tabs overflow."""
    # Use the many tabs inside the expander (25 tabs)
    expander = get_expander(app, "Expander")
    tabs_container = expander.get_by_test_id("stTabs")

    # Initially, right arrow should be visible (tabs overflow to the right)
    right_arrow = tabs_container.get_by_test_id("stTabsScrollRight")
    expect(right_arrow).to_be_visible()

    # Left arrow should not be visible initially (at the start)
    left_arrow = tabs_container.get_by_test_id("stTabsScrollLeft")
    expect(left_arrow).not_to_be_visible()

    # Click right arrow to scroll
    right_arrow.click()

    # After scrolling right, left arrow should appear
    expect(left_arrow).to_be_visible()

    # Click left arrow to scroll back
    left_arrow.click()

    # After scrolling back to start, left arrow should disappear
    expect(left_arrow).not_to_be_visible()


def test_overflow_scroll_arrows_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test scroll arrows appearance in light and dark themes."""
    expander = get_expander(themed_app, "Expander")
    tabs_container = expander.get_by_test_id("stTabs")

    # Snapshot with right arrow visible (initial state)
    assert_snapshot(tabs_container, name="st_tabs-overflow_right_arrow")

    # Scroll right to show both arrows
    right_arrow = tabs_container.get_by_test_id("stTabsScrollRight")
    right_arrow.click()

    # Wait for scroll state to update: both arrows should become visible
    left_arrow = tabs_container.get_by_test_id("stTabsScrollLeft")
    expect(left_arrow).to_be_visible()
    expect(right_arrow).to_be_visible()

    # Wait for smooth scroll animation to complete before taking snapshot.
    # The scroll uses behavior: "smooth" which animates over ~200-400ms.
    themed_app.wait_for_timeout(500)

    # Reset hovering state to avoid flaky snapshots with hover effects on arrows
    reset_hovering(themed_app)

    # Snapshot with both arrows visible
    assert_snapshot(tabs_container, name="st_tabs-overflow_both_arrows")


def test_dynamic_tabs_lazy_execution(app: Page):
    """Test that dynamic tabs only execute content for the active tab."""
    # Initially only Data tab should have executed
    expect(
        app.get_by_text("Tab executions - Data: 1, Charts: 0, Settings: 0")
    ).to_be_visible()

    # Switch to Charts tab
    dyn_tabs = (
        app.get_by_test_id("stTabs")
        .filter(has=app.get_by_role("tab", name="Charts"))
        .first
    )
    dyn_tabs.get_by_role("tab", name="Charts").click()
    wait_for_app_run(app)

    # Charts executes, Data does not re-execute since it's not open
    expect(app.get_by_text("Charts tab executed 1 times")).to_be_visible()
    expect(
        app.get_by_text("Tab executions - Data: 1, Charts: 1, Settings: 0")
    ).to_be_visible()

    # Switch to Settings
    dyn_tabs.get_by_role("tab", name="Settings").click()
    wait_for_app_run(app)

    expect(
        app.get_by_text("Tab executions - Data: 1, Charts: 1, Settings: 1")
    ).to_be_visible()

    # Switch back to Data
    dyn_tabs.get_by_role("tab", name="Data").click()
    wait_for_app_run(app)

    expect(
        app.get_by_text("Tab executions - Data: 2, Charts: 1, Settings: 1")
    ).to_be_visible()


def test_dynamic_tabs_programmatic_control(app: Page):
    """Test programmatic control of dynamic tabs via session state."""
    # Initially Alpha is active
    prog_tabs = (
        app.get_by_test_id("stTabs")
        .filter(has=app.get_by_role("tab", name="Alpha"))
        .first
    )
    expect(prog_tabs.get_by_text("Alpha tab content")).to_be_visible()

    # Click "Go to Beta" button
    click_button(app, "Go to Beta")

    # Beta should be active, Alpha not visible
    expect(prog_tabs.get_by_text("Beta tab content")).to_be_visible()
    expect(prog_tabs.get_by_text("Alpha tab content")).not_to_be_visible()

    # Click "Go to Gamma" button
    click_button(app, "Go to Gamma")

    expect(prog_tabs.get_by_text("Gamma tab content")).to_be_visible()
    expect(prog_tabs.get_by_text("Beta tab content")).not_to_be_visible()


def test_programmatic_nav_preserves_lazy_loading(app: Page):
    """Regression test for #15458: tab.open must stay True after programmatic
    nav followed by a widget interaction in the new tab.
    """
    prog_tabs = (
        app.get_by_test_id("stTabs")
        .filter(has=app.get_by_role("tab", name="Alpha"))
        .first
    )
    counts_text = app.get_by_text("Prog tab counts -", exact=False)

    # Step 1: interact with a widget while in Alpha (sets widgetMgr to "Alpha")
    click_button(app, "Increment Alpha")
    expect(counts_text).to_contain_text("Alpha: 1")

    # Step 2: programmatic nav to Beta via session_state
    click_button(app, "Go to Beta")
    expect(prog_tabs.get_by_text("Beta tab content")).to_be_visible()
    expect(prog_tabs.get_by_text("Alpha tab content")).not_to_be_visible()

    # Step 3: interact with widget inside Beta — before the fix this silently
    # failed because the stale widgetMgr value caused tab.open=False for Beta
    click_button(app, "Increment Beta")
    expect(counts_text).to_contain_text("Beta: 1")
    # Alpha must not have re-executed
    expect(counts_text).to_contain_text("Alpha: 1")


def test_tabs_key_only_does_not_trigger_rerun(app: Page):
    """Test that tabs with key but no on_change does not trigger reruns."""
    rerun_text = app.get_by_text("Tabs key-only rerun count:")
    expect(rerun_text).to_be_visible()
    initial_count = rerun_text.text_content()

    # Switch to KeyTab2
    key_only_tabs = (
        app.get_by_test_id("stTabs")
        .filter(has=app.get_by_role("tab", name="KeyTab2"))
        .first
    )
    key_only_tabs.get_by_role("tab", name="KeyTab2").click()

    # Rerun count should NOT have changed
    expect(rerun_text).to_have_text(initial_count or "")
    # Tab 2 content should be visible, tab 1 content should not
    expect(key_only_tabs.get_by_text("Key-only tab 2 content")).to_be_visible()
    expect(key_only_tabs.get_by_text("Key-only tab 1 content")).not_to_be_visible()

    # Switch back to KeyTab1
    key_only_tabs.get_by_role("tab", name="KeyTab1").click()

    # Still no rerun
    expect(rerun_text).to_have_text(initial_count or "")
    # Tab 1 content should be visible again, tab 2 should not
    expect(key_only_tabs.get_by_text("Key-only tab 1 content")).to_be_visible()
    expect(key_only_tabs.get_by_text("Key-only tab 2 content")).not_to_be_visible()


def test_dynamic_tabs_in_fragment(app: Page):
    """Test that dynamic tabs work correctly inside a fragment."""
    # Initially Left tab is active (default first tab)
    expect(app.get_by_text("Fragment tab execs - Left: 1, Right: 0")).to_be_visible()

    # Switch to Right tab
    frag_tabs = (
        app.get_by_test_id("stTabs")
        .filter(has=app.get_by_role("tab", name="Right"))
        .first
    )
    frag_tabs.get_by_role("tab", name="Right").click()
    wait_for_app_run(app)

    # Right should have executed once
    expect(app.get_by_text("Fragment tab execs - Left: 1, Right: 1")).to_be_visible()

    # Switch back to Left
    frag_tabs.get_by_role("tab", name="Left").click()
    wait_for_app_run(app)

    # Left should have executed twice, Right still once
    expect(app.get_by_text("Fragment tab execs - Left: 2, Right: 1")).to_be_visible()


def test_tabs_callback_fires_on_tab_switch(app: Page):
    """Test that the on_change callback fires when tabs are switched."""
    expect(app.get_by_text("Tabs callback log: []")).to_be_visible()

    # Locate the callback tabs container
    cb_tabs = (
        app.get_by_test_id("stTabs")
        .filter(has=app.get_by_role("tab", name="CbTab2"))
        .first
    )

    # Switch to CbTab2
    cb_tabs.get_by_role("tab", name="CbTab2").click()
    wait_for_app_run(app)
    expect(
        app.get_by_text("Tabs callback log: ['tabs_callback_called']")
    ).to_be_visible()

    # Switch back to CbTab1 — callback fires again
    cb_tabs.get_by_role("tab", name="CbTab1").click()
    wait_for_app_run(app)
    expect(
        app.get_by_text(
            "Tabs callback log: ['tabs_callback_called', 'tabs_callback_called']"
        )
    ).to_be_visible()


def test_tabs_callback_with_args_kwargs(app: Page):
    """Test that the on_change callback receives args and kwargs correctly."""
    expect(app.get_by_text("Tabs callback args result: Not called")).to_be_visible()

    # Locate the args callback tabs container
    args_tabs = (
        app.get_by_test_id("stTabs")
        .filter(has=app.get_by_role("tab", name="ArgsTab2"))
        .first
    )

    # Switch to ArgsTab2
    args_tabs.get_by_role("tab", name="ArgsTab2").click()
    wait_for_app_run(app)
    expect(
        app.get_by_text("Tabs callback args result: my_prefix-switched-my_suffix")
    ).to_be_visible()


def test_keyed_tabs_css_key_class(app: Page):
    """Keyed tabs should have the st-key-* CSS class on the outermost element."""
    keyed_tabs = get_element_by_key(app, "key_only_tabs")
    expect(keyed_tabs).to_have_class(re.compile(r"st-key-key_only_tabs"))


def test_keyed_tabs_persist_active_tab_across_remount(app: Page):
    """Toggling a conditional element above keyed tabs shifts the delta path,
    but the active tab should be preserved via elementStates.
    """
    keyed_tabs = get_element_by_key(app, "persist_tabs")

    # Click on "Details" (second tab)
    keyed_tabs.get_by_role("tab", name="Details").click()
    expect(keyed_tabs.get_by_role("tab", name="Details")).to_have_attribute(
        "aria-selected", "true"
    )

    # Toggle the conditional element above — causes a rerun and delta path shift
    click_toggle(app, "Show extra text")
    expect(app.get_by_text("Extra text inserted above tabs")).to_be_visible()

    # The keyed tabs should still show "Details" as active
    keyed_tabs = get_element_by_key(app, "persist_tabs")
    expect(keyed_tabs.get_by_role("tab", name="Details")).to_have_attribute(
        "aria-selected", "true"
    )

    # Toggle back — another rerun and delta path shift
    click_toggle(app, "Show extra text")
    expect(app.get_by_text("Extra text inserted above tabs")).not_to_be_visible()

    # Still persisted
    keyed_tabs = get_element_by_key(app, "persist_tabs")
    expect(keyed_tabs.get_by_role("tab", name="Details")).to_have_attribute(
        "aria-selected", "true"
    )
