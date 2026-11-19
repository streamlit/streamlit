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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class, get_element_by_key

# Subpixel rounding can make the two gaps differ by a few pixels.
_EQUAL_SPACE_TOLERANCE_PX = 3

_SPACING_CASES = (
    (
        "divider_spacing_standalone",
        "Above standalone divider",
        "Below standalone divider",
    ),
    (
        "divider_spacing_write",
        "Above write divider",
        "Below write divider",
    ),
    (
        "divider_spacing_markdown",
        "Above markdown divider",
        "Below markdown divider",
    ),
)


def _vertical_gap(above: Locator, below: Locator) -> float:
    above_box = above.bounding_box()
    below_box = below.bounding_box()
    assert above_box is not None
    assert below_box is not None
    return below_box["y"] - (above_box["y"] + above_box["height"])


def test_divider_renders(themed_app: Page, assert_snapshot: ImageCompareFunction):
    markdown_elements = themed_app.get_by_test_id("stMarkdown")
    expect(themed_app.get_by_test_id("stMarkdown").first).to_be_visible()
    assert_snapshot(markdown_elements.nth(0), name="st_divider")
    assert_snapshot(markdown_elements.nth(1), name="st_divider_width_600")
    assert_snapshot(markdown_elements.nth(2), name="st_divider_width_stretch")

    # Neighboring text plus the rule, so spacing regressions are visible.
    container = get_element_by_key(themed_app, "divider_spacing_standalone")
    expect(container.locator("hr")).to_be_visible()
    assert_snapshot(container, name="st_divider-equal_space_standalone")


def test_divider_has_equal_space_above_and_below(app: Page):
    """Rules sit equally between neighboring text, both standalone and inside a markdown block."""
    for key, above_text, below_text in _SPACING_CASES:
        block = get_element_by_key(app, key)
        rule = block.locator("hr")
        expect(rule).to_be_visible()

        space_above = _vertical_gap(block.get_by_text(above_text, exact=True), rule)
        space_below = _vertical_gap(rule, block.get_by_text(below_text, exact=True))
        assert abs(space_above - space_below) <= _EQUAL_SPACE_TOLERANCE_PX, (
            f"Expected equal space around {key}, got {space_above:.1f}px above "
            f"and {space_below:.1f}px below"
        )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stMarkdown")
