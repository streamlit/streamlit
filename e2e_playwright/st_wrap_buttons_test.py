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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key, reset_hovering

LONG = "Regenerate the complete quarterly report now"


def _height(page: Page, key: str) -> float:
    # A truncated button is rendered twice (desktop + mobile tooltip copies), so
    # measure the first (visible desktop) copy.
    box = get_element_by_key(page, key).locator("button").first.bounding_box()
    assert box is not None
    return box["height"]


def test_wrap_false_keeps_single_row_height(app: Page):
    """A wrap=False button stays the same height as its neighbors, while the
    default wrap=True button grows taller when its label is too long.
    """
    wf_middle = _height(app, "wf_middle")
    wf_left = _height(app, "wf_left")
    wt_middle = _height(app, "wt_middle")

    # wrap=False: the long middle button matches the short neighbor's height.
    assert abs(wf_middle - wf_left) <= 2
    # wrap=True (default): the long middle button wraps and is clearly taller.
    assert wt_middle > wf_middle + 4


def test_wrap_false_reveals_full_label_on_hover(app: Page):
    """Hovering a truncated wrap=False button reveals the full label in a
    Streamlit tooltip (not shown until hover).
    """
    container = get_element_by_key(app, "wf_middle")
    tooltip_content = app.get_by_test_id("stTooltipContent")

    # No tooltip until the button is hovered.
    expect(tooltip_content).not_to_be_attached()

    container.get_by_test_id("stTooltipHoverTarget").hover()
    expect(tooltip_content).to_be_visible()
    expect(tooltip_content).to_have_text(LONG)

    reset_hovering(app)
    expect(tooltip_content).not_to_be_attached()


def test_not_truncated_button_has_no_tooltip(app: Page):
    """A wrap=False button whose short label fits has no label tooltip."""
    container = get_element_by_key(app, "wf_left")
    expect(container.get_by_test_id("stTooltipHoverTarget")).to_have_count(0)


def test_help_takes_precedence_over_truncation_tooltip(app: Page):
    """When help is set, the help tooltip is shown instead of the label."""
    container = get_element_by_key(app, "wf_help")
    tooltip_content = app.get_by_test_id("stTooltipContent")

    container.get_by_test_id("stTooltipHoverTarget").first.hover()
    expect(tooltip_content).to_be_visible()
    expect(tooltip_content).to_have_text("Custom help text")

    reset_hovering(app)


def test_wrap_false_keeps_icon_and_shortcut_visible(app: Page):
    """Icons and keyboard shortcuts stay visible when the label ellipsizes."""
    container = get_element_by_key(app, "wf_icon_shortcut")
    # Material icon remains rendered (first = visible desktop tooltip copy).
    expect(container.get_by_test_id("stIconMaterial").first).to_be_visible()
    # Keyboard shortcut hint (a <kbd>) remains rendered; its exact text is
    # platform-dependent, so only assert its presence.
    expect(container.locator("kbd").first).to_be_visible()


def _expect_truncation_tooltip(app: Page, container_key: str) -> None:
    """Hover the truncated control and assert its tooltip reveals the full label."""
    reset_hovering(app)
    tooltip_content = app.get_by_test_id("stTooltipContent")
    get_element_by_key(app, container_key).get_by_test_id(
        "stTooltipHoverTarget"
    ).first.hover()
    expect(tooltip_content).to_be_visible()
    expect(tooltip_content).to_have_text(LONG)
    reset_hovering(app)


def test_other_button_like_controls_truncate_with_wrap_false(app: Page):
    """download_button, link_button, popover, and menu_button all ellipsize the
    label and reveal it on hover when wrap=False. Popover and menu keep their
    expansion chevron visible.
    """
    _expect_truncation_tooltip(app, "wf_download")
    _expect_truncation_tooltip(app, "wf_link")
    _expect_truncation_tooltip(app, "wf_popover")
    _expect_truncation_tooltip(app, "wf_menu")

    # The expansion chevron stays visible next to the ellipsized label.
    popover_button = (
        get_element_by_key(app, "wf_popover").get_by_test_id("stPopoverButton").first
    )
    expect(popover_button).to_contain_text("expand_more")
    menu_button = (
        get_element_by_key(app, "wf_menu").get_by_test_id("stMenuButtonButton").first
    )
    expect(menu_button).to_contain_text("expand_more")


def test_form_submit_button_truncates_with_wrap_false(app: Page):
    """A wrap=False form_submit_button ellipsizes and reveals its label on hover."""
    reset_hovering(app)
    tooltip_content = app.get_by_test_id("stTooltipContent")
    submit = (
        app.get_by_test_id("stFormSubmitButton")
        .filter(has_text=LONG)
        .get_by_test_id("stTooltipHoverTarget")
        .first
    )
    submit.hover()
    expect(tooltip_content).to_be_visible()
    expect(tooltip_content).to_have_text(LONG)
    reset_hovering(app)


def test_wrap_false_row_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """The no-wrap toolbar renders as a single aligned row of buttons."""
    assert_snapshot(
        get_element_by_key(app, "wrap_false_row"),
        name="st_wrap_buttons-no_wrap_row",
    )
