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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_loaded, wait_until


def setup_viewport(page: Page, viewport_type: str) -> None:
    """Set up viewport for testing."""
    if viewport_type == "mobile":
        page.set_viewport_size({"width": 640, "height": 800})
    else:
        page.set_viewport_size({"width": 1280, "height": 720})


def get_expected_sidebar_state(initial_state: str, viewport: str) -> str:
    """Calculate expected sidebar state based on config and viewport."""
    if initial_state == "collapsed":
        return "collapsed"
    if initial_state == "expanded":
        return "expanded"

    return "collapsed" if viewport == "mobile" else "expanded"


def verify_sidebar_state(page: Page, expected_state: str) -> None:
    """Verify sidebar exists and has expected expanded state."""
    sidebar = page.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()

    expected_expanded = "true" if expected_state == "expanded" else "false"
    expect(sidebar).to_have_attribute("aria-expanded", expected_expanded)


def create_sidebar_monitor_script() -> str:
    """Create JavaScript to monitor sidebar state changes during page load."""
    return """
    window.__sidebarStates = [];
    window.__monitorStarted = Date.now();

    // Override setAttribute to catch aria-expanded changes
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
        if (this.dataset && this.dataset.testid === 'stSidebar' && name === 'aria-expanded') {
            window.__sidebarStates.push({
                timestamp: Date.now() - window.__monitorStarted,
                ariaExpanded: value,
                method: 'setAttribute'
            });
        }
        return originalSetAttribute.call(this, name, value);
    };

    // Monitor DOM mutations
    const observer = new MutationObserver(() => {
        const sidebar = document.querySelector('[data-testid="stSidebar"]');
        if (sidebar) {
            const ariaExpanded = sidebar.getAttribute('aria-expanded');
            const lastState = window.__sidebarStates[window.__sidebarStates.length - 1];

            if (!lastState || lastState.ariaExpanded !== ariaExpanded) {
                window.__sidebarStates.push({
                    timestamp: Date.now() - window.__monitorStarted,
                    ariaExpanded: ariaExpanded,
                    method: 'mutation'
                });
            }
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-expanded']
    });
    """


def check_for_sidebar_flicker(page: Page, initial_state: str) -> None:
    """Check captured sidebar states for any flickering behavior."""
    states = page.evaluate("window.__sidebarStates || []")

    if not states:
        return  # No state changes captured

    # Check for flicker in collapsed state (most common issue)
    if initial_state == "collapsed":
        for state in states:
            if state["ariaExpanded"] == "true":
                # Found flicker - sidebar was expanded when it should stay collapsed
                states_str = "\n".join(
                    [
                        f"  {s['timestamp']}ms: aria-expanded={s['ariaExpanded']} (via {s['method']})"
                        for s in states
                    ]
                )
                # Use pytest.fail for custom error message
                pytest.fail(
                    f"Sidebar flickered! Started expanded then collapsed.\nState changes:\n{states_str}"
                )

    # Check for flicker in expanded state
    elif initial_state == "expanded":
        for state in states:
            if state["ariaExpanded"] == "false":
                # Found flicker - sidebar was collapsed when it should stay expanded
                states_str = "\n".join(
                    [
                        f"  {s['timestamp']}ms: aria-expanded={s['ariaExpanded']} (via {s['method']})"
                        for s in states
                    ]
                )
                pytest.fail(
                    f"Sidebar flickered! Started collapsed then expanded.\nState changes:\n{states_str}"
                )


def verify_no_sidebar_flicker(
    page: Page, initial_state: str, expected_final_state: str
) -> None:
    """Verify that sidebar doesn't flicker during page load.

    This checks both that the final state is correct AND that no
    intermediate flickering occurred during the loading process.
    """
    # Wait for sidebar to be stable in expected state
    wait_for_sidebar_stable(page, expected_final_state)

    # Verify final state is correct
    verify_sidebar_state(page, expected_final_state)

    # Check for any flicker that occurred during loading
    check_for_sidebar_flicker(page, initial_state)


def wait_for_sidebar_stable(
    page: Page, expected_state: str, timeout: int = 3000
) -> None:
    """Wait for sidebar to reach stable state without flickering."""
    sidebar = page.get_by_test_id("stSidebar")
    expected_expanded = "true" if expected_state == "expanded" else "false"

    def check_stable_state() -> bool:
        current_state = sidebar.get_attribute("aria-expanded")
        return current_state == expected_expanded

    wait_until(page, check_stable_state, timeout=timeout)


@pytest.mark.parametrize("viewport", ["desktop", "mobile"])
@pytest.mark.parametrize("initial_sidebar_state", ["collapsed", "expanded", "auto"])
def test_sidebar_no_flicker_on_initial_load(
    page: Page, app_port: int, viewport: str, initial_sidebar_state: str
):
    """Test that sidebar doesn't flicker during initial page load.

    Verifies that when initial_sidebar_state is configured, the sidebar
    maintains the correct state throughout the page load process without
    flickering between expanded and collapsed states.
    """
    # Set up viewport
    setup_viewport(page, viewport)

    # Determine expected final state
    expected_final_state = get_expected_sidebar_state(initial_sidebar_state, viewport)

    # Inject monitoring script before page loads
    page.add_init_script(create_sidebar_monitor_script())

    # Navigate to the page
    page.goto(f"http://localhost:{app_port}/?test_mode={initial_sidebar_state}")

    # Wait for app to load
    wait_for_app_loaded(page)

    # Verify sidebar state without flicker
    verify_no_sidebar_flicker(page, initial_sidebar_state, expected_final_state)


def test_sidebar_collapsed_state_no_flicker(page: Page, app_port: int):
    """Test that sidebar stays collapsed when configured as collapsed.

    This focused test ensures that a sidebar configured as collapsed
    never shows an expanded state during page load.
    """
    setup_viewport(page, "desktop")

    # Inject monitoring script before page loads
    page.add_init_script(create_sidebar_monitor_script())

    page.goto(f"http://localhost:{app_port}/?test_mode=collapsed")
    wait_for_app_loaded(page)

    verify_no_sidebar_flicker(page, "collapsed", "collapsed")


def test_sidebar_expanded_state_no_flicker(page: Page, app_port: int):
    """Test that sidebar stays expanded when configured as expanded.

    This focused test ensures that a sidebar configured as expanded
    maintains its expanded state during page load.
    """
    setup_viewport(page, "desktop")

    # Inject monitoring script before page loads
    page.add_init_script(create_sidebar_monitor_script())

    page.goto(f"http://localhost:{app_port}/?test_mode=expanded")
    wait_for_app_loaded(page)

    verify_no_sidebar_flicker(page, "expanded", "expanded")


def test_sidebar_auto_state_desktop(page: Page, app_port: int):
    """Test that sidebar auto state works correctly on desktop.

    On desktop, auto state should result in an expanded sidebar.
    """
    setup_viewport(page, "desktop")

    # Inject monitoring script before page loads
    page.add_init_script(create_sidebar_monitor_script())

    page.goto(f"http://localhost:{app_port}/?test_mode=auto")
    wait_for_app_loaded(page)

    verify_no_sidebar_flicker(page, "auto", "expanded")


def test_sidebar_auto_state_mobile(page: Page, app_port: int):
    """Test that sidebar auto state works correctly on mobile.

    On mobile, auto state should result in a collapsed sidebar.
    """
    setup_viewport(page, "mobile")

    # Inject monitoring script before page loads
    page.add_init_script(create_sidebar_monitor_script())

    page.goto(f"http://localhost:{app_port}/?test_mode=auto")
    wait_for_app_loaded(page)

    verify_no_sidebar_flicker(page, "auto", "collapsed")


def test_sidebar_no_flicker_without_page_config(page: Page, app_port: int):
    """Test sidebar behavior when set_page_config is not called.

    Should default to auto behavior (expanded on desktop).
    """
    setup_viewport(page, "desktop")

    # Inject monitoring script before page loads
    page.add_init_script(create_sidebar_monitor_script())

    page.goto(f"http://localhost:{app_port}/?test_mode=no_config")
    wait_for_app_loaded(page)

    # Without page config, should behave like auto (expanded on desktop)
    verify_sidebar_state(page, "expanded")

    # Also check that no flicker occurred during load
    states = page.evaluate("window.__sidebarStates || []")
    if states:
        # Check for any unexpected state changes
        for state in states:
            if state["ariaExpanded"] == "false":
                states_str = "\n".join(
                    [
                        f"  {s['timestamp']}ms: aria-expanded={s['ariaExpanded']} (via {s['method']})"
                        for s in states
                    ]
                )
                pytest.fail(
                    f"Sidebar unexpectedly collapsed during load.\nState changes:\n{states_str}"
                )


def test_sidebar_stability_after_initial_load(page: Page, app_port: int):
    """Test that sidebar state remains stable after initial load.

    Verifies that the sidebar doesn't change state unexpectedly
    after the page has finished loading.
    """
    setup_viewport(page, "desktop")

    # Inject monitoring script before page loads
    page.add_init_script(create_sidebar_monitor_script())

    page.goto(f"http://localhost:{app_port}/?test_mode=collapsed")
    wait_for_app_loaded(page)

    # Verify initial state
    verify_sidebar_state(page, "collapsed")

    # Clear previous state tracking and monitor for additional changes
    page.evaluate("window.__sidebarStates = []; window.__monitorStarted = Date.now();")

    # Wait a bit more and verify state hasn't changed
    page.wait_for_timeout(1000)
    verify_sidebar_state(page, "collapsed")

    # Check that no state changes occurred during the wait
    states = page.evaluate("window.__sidebarStates || []")
    if states:
        states_str = "\n".join(
            [
                f"  {s['timestamp']}ms: aria-expanded={s['ariaExpanded']} (via {s['method']})"
                for s in states
            ]
        )
        pytest.fail(
            f"Sidebar state changed after initial load.\nState changes:\n{states_str}"
        )

    # Verify sidebar is still attached and stable
    sidebar = page.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()
    expect(sidebar).to_have_attribute("aria-expanded", "false")
