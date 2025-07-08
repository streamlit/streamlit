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

from e2e_playwright.conftest import wait_until
from e2e_playwright.shared.app_utils import get_checkbox
from e2e_playwright.shared.react18_utils import wait_for_react_stability


def test_tooltip_does_not_overflow_on_the_left_side(app: Page):
    sidebar_button = (
        app.get_by_test_id("stButton")
        .filter(has_text="Sidebar-button with help")
        .locator("button")
        .first
    )
    sidebar_button.hover()
    tooltip = app.get_by_test_id("stTooltipContent")
    expect(tooltip).to_be_visible()

    # Wait until the tooltip is positioned correctly
    wait_until(
        app, lambda: (bbox := tooltip.bounding_box()) is not None and bbox["x"] >= 0
    )


def test_tooltip_does_not_overflow_on_the_right_side(app: Page):
    # Resize the viewport to make sure there is not a lot of space on the right side
    viewport_width = 750
    app.set_viewport_size({"width": viewport_width, "height": 800})
    app.wait_for_function(f"() => window.innerWidth === {viewport_width}")

    # Wait for React to stabilize after viewport change
    wait_for_react_stability(app)

    popover_button = (
        app.get_by_test_id("stPopover")
        .filter(has_text="Popover with toggle")
        .locator("button")
    )

    # Ensure popover button is visible and stable before clicking
    expect(popover_button).to_be_visible()

    # Click the button to open it:
    popover_button.click()

    # Wait for React to stabilize after opening popover
    wait_for_react_stability(app)

    toggle = get_checkbox(app, "Right-toggle with help")
    expect(toggle).to_be_visible()

    # Get the tooltip hover target and ensure it's visible before hovering
    hover_target = toggle.get_by_test_id("stTooltipHoverTarget")
    expect(hover_target).to_be_visible()

    # Ensure UI is stable before hovering
    wait_for_react_stability(app)

    # Hover over the tooltip target
    hover_target.hover()

    # Wait for tooltip to appear and stabilize
    app.wait_for_timeout(200)

    tooltip = app.get_by_test_id("stTooltipContent")
    expect(tooltip).to_be_visible()

    # Wait for tooltip positioning to complete
    wait_for_react_stability(app)

    # Wait until the tooltip is positioned correctly
    wait_until(
        app,
        lambda: (bbox := tooltip.bounding_box()) is not None
        and bbox["x"] + bbox["width"] <= viewport_width,
    )


def test_tooltip_with_code(app: Page):
    """Test that a help tooltip with code displays correctly."""
    # Get the number input widget
    number_input = app.get_by_test_id("stNumberInput")
    # Hover over the tooltip target (?) to display the tooltip
    hover_target = number_input.get_by_test_id("stTooltipHoverTarget")
    hover_target.hover()

    # Wait for tooltip to appear and stabilize
    app.wait_for_timeout(200)

    # Get the tooltip content
    tooltip = app.get_by_test_id("stTooltipContent")
    expect(tooltip).to_be_visible()
    expect(tooltip).to_contain_text("Tooltip with some code in it")

    # General tooltip text should have a size of 14px
    expect(tooltip.get_by_text("Tooltip")).to_have_css("font-size", "14px")

    # Inline code text should be set to 0.75em (which with tooltip font size
    # of 14px translates to 10.5px)
    expect(tooltip.get_by_role("code")).to_have_css("font-size", "10.5px")
