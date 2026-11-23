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

"""E2E tests for help on st.Page: nav tooltips and st.page_link inheritance."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from playwright.sync_api import FloatRect, Locator, Page, expect

from e2e_playwright.conftest import wait_until
from e2e_playwright.shared.app_utils import (
    expect_help_tooltip,
    reset_hovering,
    select_radio_option,
)

if TYPE_CHECKING:
    from e2e_playwright.conftest import ImageCompareFunction

_REVENUE_HELP = "Net revenue by region. Excludes refunds."
_COSTS_HELP = (
    "Operating costs by team, in EUR, including shared infrastructure, "
    "licenses, and contractors. Allocations follow the monthly cost model. "
    "See the glossary."
)


def _page_link(app: Page, label: str) -> Locator:
    return app.get_by_test_id("stPageLink").filter(
        has=app.get_by_text(label, exact=True)
    )


def _bounding_box(locator: Locator) -> FloatRect:
    box = locator.bounding_box()
    assert box is not None
    return box


def _is_topmost_at_center(locator: Locator) -> bool:
    """Whether nothing is painted over the center of ``locator``."""
    return bool(
        locator.evaluate(
            """el => {
                const rect = el.getBoundingClientRect()
                const hit = document.elementFromPoint(
                    rect.left + rect.width / 2, rect.top + rect.height / 2
                )
                return el.contains(hit)
            }"""
        )
    )


def test_sidebar_nav_help_and_page_link_inheritance(
    app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    """Sidebar items show page help as a delayed tooltip and always expose it as
    their accessible description; st.page_link inherits it unless overridden.
    """
    nav_links = app.get_by_test_id("stSidebarNavLink")
    # The hidden Archive page has no nav item.
    expect(nav_links).to_have_count(4)
    revenue_link = app.get_by_role("link", name="Revenue", exact=True).and_(nav_links)
    home_link = app.get_by_role("link", name="Home", exact=True).and_(nav_links)

    # The description is rendered Markdown, present while no tooltip is open.
    expect(revenue_link).to_have_accessible_description(_REVENUE_HELP)
    expect(home_link).to_have_accessible_description("")
    expect(
        app.get_by_role("link", name="Docs").and_(nav_links)
    ).to_have_accessible_description("Opens the Streamlit docs.")

    tooltip = app.get_by_test_id("stTooltipContent")
    expect(tooltip).not_to_be_attached()

    reset_hovering(app)
    revenue_link.hover()
    # Not open yet right after hover; unit tests pin the 1000ms delay.
    expect(tooltip).not_to_be_attached()
    expect(tooltip).to_be_visible()
    expect(tooltip).to_have_text(_REVENUE_HELP)
    expect(tooltip.locator("strong")).to_have_text("region")
    expect(tooltip.locator("code")).to_have_text("refunds")
    # The popup is hidden from assistive tech; the link's description is the
    # hidden copy, so focus announces it once.
    expect(app.get_by_role("tooltip")).to_have_count(0)
    # The popup opens to the right of the item.
    link_box = _bounding_box(revenue_link)
    assert _bounding_box(tooltip)["x"] >= link_box["x"] + link_box["width"]
    assert_snapshot(tooltip, name="st_navigation_help-sidebar_tooltip")

    reset_hovering(app)
    expect(tooltip).not_to_be_attached()

    # Keyboard focus opens the tooltip without the hover delay.
    home_link.focus()
    app.keyboard.press("Tab")
    expect(revenue_link).to_be_focused()
    # Below the 1000ms hover delay, so this proves focus opens it immediately.
    expect(tooltip).to_have_text(_REVENUE_HELP, timeout=900)
    app.keyboard.press("Escape")
    expect(tooltip).not_to_be_attached()

    # st.page_link inherits the page's help unless it passes its own.
    expect_help_tooltip(app, _page_link(app, "Revenue"), _REVENUE_HELP)
    expect_help_tooltip(
        app, _page_link(app, "Revenue with local help"), "Opens revenue."
    )
    # A hidden page has no nav item, but its page links still inherit help.
    expect_help_tooltip(app, _page_link(app, "Archive"), "Closed periods.")
    expect(
        _page_link(app, "Revenue without tooltip").get_by_test_id(
            "stTooltipHoverTarget"
        )
    ).not_to_be_attached()

    # Long help wraps inside a narrow window instead of running off screen.
    app.set_viewport_size({"width": 800, "height": 720})
    reset_hovering(app)
    app.get_by_role("link", name="Costs", exact=True).and_(nav_links).hover()
    expect(tooltip).to_have_text(_COSTS_HELP)
    box = _bounding_box(tooltip)
    assert box["x"] + box["width"] <= 800


def test_top_nav_help_tooltips(app: Page) -> None:
    """Top-bar items and dropdown menu items show page help, and the tooltip
    is painted above the dropdown menu.
    """
    select_radio_option(app, option="top", label="Position")
    expect(app.get_by_test_id("stTopNav")).to_be_visible()

    top_links = app.get_by_test_id("stTopNavLink")
    revenue_link = top_links.filter(has_text="Revenue")
    expect(revenue_link).to_have_accessible_description(_REVENUE_HELP)

    tooltip = app.get_by_test_id("stTooltipContent")
    reset_hovering(app)
    revenue_link.hover()
    expect(tooltip).to_have_text(_REVENUE_HELP)
    # The popup opens below a top-bar item.
    link_box = _bounding_box(revenue_link)
    assert _bounding_box(tooltip)["y"] >= link_box["y"] + link_box["height"]
    reset_hovering(app)
    expect(tooltip).not_to_be_attached()

    # On the menu's first open, it moves into place a frame after it mounts. A
    # tooltip that focus opened before that move would close right away, so
    # measuring it after the text check proves it stayed open beside the item.
    more_trigger = app.get_by_test_id("stTopNavSection").filter(has_text="More")
    costs_item = app.get_by_role("menuitem", name="Costs")
    more_trigger.focus()
    app.keyboard.press("ArrowDown")
    expect(costs_item).to_be_focused()
    expect(tooltip).to_have_text(_COSTS_HELP)
    item_box = _bounding_box(costs_item)
    tooltip_box = _bounding_box(tooltip)
    item_center_y = item_box["y"] + item_box["height"] / 2
    assert tooltip_box["y"] <= item_center_y <= tooltip_box["y"] + tooltip_box["height"]
    app.keyboard.press("Escape")
    expect(costs_item).not_to_be_attached()

    more_trigger.click()
    docs_item = app.get_by_role("menuitem", name="Docs")
    expect(costs_item).to_have_accessible_description(_COSTS_HELP)
    expect(docs_item).to_have_accessible_description("Opens the Streamlit docs.")
    # Help does not change how an external item opens.
    expect(docs_item).to_have_attribute("target", "_blank")

    costs_item.hover()
    expect(tooltip).to_have_text(_COSTS_HELP)
    # The menu stays open, and does not cover the tooltip.
    menu = app.get_by_test_id("stTopNavPopover")
    expect(menu).to_be_visible()
    wait_until(app, lambda: _is_topmost_at_center(tooltip))

    # A link in an item's help works inside the menu. Costs is also the item
    # the menu focused when it opened.
    expect(costs_item).to_be_focused()
    help_link = tooltip.locator("a", has_text="the glossary")
    help_link.hover()
    help_link.click()
    expect(app).to_have_url(re.compile(r"#glossary$"))
    expect(menu).to_be_visible()
    expect(tooltip).to_have_text(_COSTS_HELP)
