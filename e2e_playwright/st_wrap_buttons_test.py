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
from e2e_playwright.shared.app_utils import get_element_by_key

LONG = "Regenerate the complete quarterly report now"


def _height(page: Page, key: str) -> float:
    box = get_element_by_key(page, key).locator("button").bounding_box()
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


def test_wrap_false_sets_native_title(app: Page):
    """A wrap=False button exposes the full label via a native title so a
    hidden/ellipsized label stays recoverable on hover.
    """
    expect(
        get_element_by_key(app, "wf_middle").get_by_title(LONG, exact=True)
    ).to_be_visible()


def test_wrap_true_does_not_set_title(app: Page):
    """The default (wrap=True) button does not set a native title."""
    expect(
        get_element_by_key(app, "wt_middle").get_by_title(LONG, exact=True)
    ).to_have_count(0)


def test_help_takes_precedence_over_title(app: Page):
    """When help is set, no native title is added and the help tooltip shows."""
    container = get_element_by_key(app, "wf_help")
    # No native title competes with the help tooltip.
    expect(container.get_by_title(LONG, exact=True)).to_have_count(0)

    tooltip_content = app.get_by_test_id("stTooltipContent")
    container.get_by_test_id("stTooltipHoverTarget").first.hover()
    expect(tooltip_content).to_be_visible()
    expect(tooltip_content).to_have_text("Custom help text")


def test_wrap_false_keeps_icon_and_shortcut_visible(app: Page):
    """Icons and keyboard shortcuts stay visible when the label ellipsizes."""
    container = get_element_by_key(app, "wf_icon_shortcut")
    expect(container.get_by_test_id("stIconMaterial")).to_be_visible()
    # Keyboard shortcut hint (a <kbd>) remains rendered; its exact text is
    # platform-dependent, so only assert its presence.
    expect(container.locator("kbd")).to_be_visible()


def test_other_button_like_controls_set_title_with_wrap_false(app: Page):
    """download_button, link_button, popover, and menu_button all expose the
    full label via a native title when wrap=False, and popover/menu keep their
    expansion chevron visible.
    """
    for key in ("wf_download", "wf_link", "wf_popover", "wf_menu"):
        expect(
            get_element_by_key(app, key).get_by_title(LONG, exact=True)
        ).to_be_visible()

    # The expansion chevron stays visible next to the ellipsized label.
    expect(
        get_element_by_key(app, "wf_popover").get_by_test_id("stPopoverButton")
    ).to_contain_text("expand_more")
    expect(
        get_element_by_key(app, "wf_menu").get_by_test_id("stMenuButtonButton")
    ).to_contain_text("expand_more")


def test_form_submit_button_sets_title_with_wrap_false(app: Page):
    """A wrap=False form_submit_button exposes its full label via a native title."""
    submit = (
        app.get_by_test_id("stFormSubmitButton")
        .filter(has_text=LONG)
        .get_by_title(LONG, exact=True)
    )
    expect(submit).to_be_visible()


def test_wrap_false_row_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """The no-wrap toolbar renders as a single aligned row of buttons."""
    assert_snapshot(
        get_element_by_key(app, "wrap_false_row"),
        name="st_wrap_buttons-no_wrap_row",
    )
