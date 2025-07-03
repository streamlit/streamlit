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

from e2e_playwright.conftest import wait_for_app_loaded


@pytest.mark.parametrize("viewport", ["desktop", "mobile"])
@pytest.mark.parametrize("initial_sidebar_state", ["collapsed", "expanded", "auto"])
def test_sidebar_no_flicker_on_initial_load(
    page: Page, app_port: int, viewport: str, initial_sidebar_state: str
):
    """Test that sidebar doesn't flicker when initial_sidebar_state is set.

    This test should fail when the bug is present and pass when fixed.
    """

    # Set viewport size
    if viewport == "mobile":
        page.set_viewport_size({"width": 640, "height": 800})
    else:
        page.set_viewport_size({"width": 1280, "height": 720})

    # Determine expected final state
    if initial_sidebar_state == "collapsed":
        expected_final_state = "collapsed"
    elif initial_sidebar_state == "expanded":
        expected_final_state = "expanded"
    else:  # auto
        expected_final_state = "collapsed" if viewport == "mobile" else "expanded"

        # Use add_init_script to capture sidebar state changes during page load (works across all browsers)
    monitor_script = """
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
    const observer = new MutationObserver((mutations) => {
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

    # Inject the script before page loads (works across all browsers)
    page.add_init_script(monitor_script)

    # Navigate to the page
    page.goto(f"http://localhost:{app_port}/?test_mode={initial_sidebar_state}")

    # Wait for app to load
    wait_for_app_loaded(page)

    # Get all captured states
    states = page.evaluate("window.__sidebarStates || []")

    # Check final state is correct
    sidebar = page.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute(
        "aria-expanded", "true" if expected_final_state == "expanded" else "false"
    )

    # Analyze states for flicker
    if initial_sidebar_state == "collapsed" and len(states) > 0:
        # For collapsed state, check if it ever was expanded
        for _, state in enumerate(states):
            if state["ariaExpanded"] == "true":
                # Found a flicker - sidebar was expanded before becoming collapsed
                states_str = "\n".join(
                    [
                        f"  {s['timestamp']}ms: aria-expanded={s['ariaExpanded']} (via {s['method']})"
                        for s in states
                    ]
                )
                pytest.fail(
                    f"Sidebar flickered! Started expanded then collapsed.\n"
                    f"State changes:\n{states_str}"
                )

    # For debugging - print states if test passes but we want to see what happened
    if states:
        print(f"\nSidebar states for {initial_sidebar_state} on {viewport}:")
        for state in states:
            print(f"  {state['timestamp']}ms: aria-expanded={state['ariaExpanded']}")


def test_sidebar_no_flicker_without_page_config(page: Page, app_port: int):
    """Test sidebar behavior when set_page_config is not called.

    Should default to auto behavior (expanded on desktop).
    """
    # Track sidebar states (works across all browsers)
    monitor_script = """
    window.__sidebarStates = [];
    window.__monitorStarted = Date.now();

    const observer = new MutationObserver(() => {
        const sidebar = document.querySelector('[data-testid="stSidebar"]');
        if (sidebar) {
            const ariaExpanded = sidebar.getAttribute('aria-expanded');
            const lastState = window.__sidebarStates[window.__sidebarStates.length - 1];

            if (!lastState || lastState.ariaExpanded !== ariaExpanded) {
                window.__sidebarStates.push({
                    timestamp: Date.now() - window.__monitorStarted,
                    ariaExpanded: ariaExpanded
                });
            }
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true
    });
    """

    page.add_init_script(monitor_script)

    page.goto(f"http://localhost:{app_port}/?test_mode=no_config")
    wait_for_app_loaded(page)

    # Verify final state
    sidebar = page.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Get states
    states = page.evaluate("window.__sidebarStates || []")

    # Check for unexpected state changes
    if len(states) > 1:
        states_str = "\n".join(
            [f"  {s['timestamp']}ms: aria-expanded={s['ariaExpanded']}" for s in states]
        )
        print(f"\nMultiple state changes detected:\n{states_str}")
