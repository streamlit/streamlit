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

from playwright.sync_api import FloatRect, Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import expect_help_tooltip, get_element_by_key

LONG_LABEL = "A very long card label that does not fit on one line of a narrow card"
LONG_CAPTION = (
    "A long caption that runs over more than two lines of the card, so "
    "that it ends in an ellipsis and shows its full text in a tooltip "
    "when the pointer rests on it."
)
SURFACES = [
    "outlined",
    "filled_with_outline",
    "filled_without_outline",
    "frameless",
]
# Header variants are drawn on the main page and in the sidebar.
HEADER_PREFIXES = ["header", "sidebar"]


def _card(app: Page, key: str) -> Locator:
    return get_element_by_key(app, key).get_by_test_id("stCard").first


def _box(locator: Locator) -> FloatRect:
    box = locator.bounding_box()
    assert box is not None
    return box


def _css_px(locator: Locator, prop: str) -> float:
    return float(locator.evaluate(f"el => parseFloat(getComputedStyle(el)['{prop}'])"))


def _label_offset(card: Locator) -> float:
    """Distance from the top of the card to the top of its label."""
    return _box(card.get_by_test_id("stCardLabel"))["y"] - _box(card)["y"]


def test_header_variants_in_main_and_sidebar(app: Page):
    for prefix in HEADER_PREFIXES:
        full = _card(app, f"{prefix}_full_header")
        truncated = _card(app, f"{prefix}_truncated_header")
        label_only = _card(app, f"{prefix}_label_only")

        # A card is a group named by its label and described by its caption.
        # It is neither a heading nor focusable.
        expect(full).to_have_attribute("role", "group")
        expect(full).to_have_accessible_name("Revenue")
        expect(full).to_have_accessible_description("Monthly recurring revenue")
        expect(full.get_by_test_id("stCardLabel")).to_have_text("Revenue")
        expect(full.get_by_role("heading")).to_have_count(0)
        expect(label_only).to_have_accessible_name("Label only")
        expect(label_only.get_by_test_id("stCardCaption")).to_have_count(0)
        expect_help_tooltip(
            app, full.get_by_test_id("stCardHeader"), "Revenue per month"
        )

        # A clipped label and caption show their full text as a native title.
        expect(truncated.get_by_test_id("stCardLabel")).to_have_attribute(
            "title", LONG_LABEL
        )
        expect(truncated.get_by_test_id("stCardCaption")).to_have_attribute(
            "title", LONG_CAPTION
        )
        # Text that fits has no title.
        expect(full.get_by_test_id("stCardLabel")).not_to_have_attribute(
            "title", "Revenue"
        )

        # The label stays at the same place whether or not there is a caption.
        offsets = [_label_offset(c) for c in (full, truncated, label_only)]
        assert max(offsets) - min(offsets) < 1, (prefix, offsets)

    # Label: 24px with a 1.2 line height. Caption: 14px with a 1.2 line height.
    full = _card(app, "header_full_header")
    label = full.get_by_test_id("stCardLabel")
    caption = full.get_by_test_id("stCardCaption").locator("p").first
    expect(label).to_have_css("font-size", "24px")
    expect(caption).to_have_css("font-size", "14px")
    assert abs(_css_px(label, "lineHeight") - 28.8) < 0.1
    assert abs(_css_px(caption, "lineHeight") - 16.8) < 0.1


def test_surfaces_and_nested_background(app: Page):
    for surface in SURFACES:
        expect(_card(app, f"surface_{surface}")).to_be_visible()
        expect(_card(app, f"sidebar_{surface}")).to_be_visible()

    # Only the filled cards differ from the sidebar background.
    colors = {
        surface: _card(app, f"sidebar_{surface}").evaluate(
            "el => getComputedStyle(el).backgroundColor"
        )
        for surface in SURFACES
    }
    assert colors["outlined"] == colors["frameless"]
    assert colors["filled_with_outline"] == colors["filled_without_outline"]
    assert colors["outlined"] != colors["filled_with_outline"]

    # Only the frameless card has no frame, so it is the shortest.
    heights = {s: _box(_card(app, f"sidebar_{s}"))["height"] for s in SURFACES}
    assert heights["frameless"] < heights["outlined"]

    # A filled card inside another card swaps the background again.
    outer = _card(app, "nested_outer")
    inner = _card(app, "nested_inner")
    expect(inner).to_be_visible()
    outer_background = outer.evaluate("el => getComputedStyle(el).backgroundColor")
    inner_background = inner.evaluate("el => getComputedStyle(el).backgroundColor")
    assert outer_background != inner_background


def test_card_sizing(app: Page):
    # Cards in a row stretch to the tallest one.
    equal = [_card(app, k) for k in ("equal_short", "equal_tall", "equal_chart")]
    expect(equal[2].get_by_test_id("stVegaLiteChart")).to_be_visible()
    heights = [_box(c)["height"] for c in equal]
    assert max(heights) - min(heights) < 1, heights

    # Cards fill a grid row with an integer row height.
    trend = _card(app, "grid_trend")
    data = _card(app, "grid_data")
    expect(trend.get_by_test_id("stVegaLiteChart")).to_be_visible()
    expect(data.get_by_test_id("stDataFrame")).to_be_visible()
    assert abs(_box(trend)["height"] - 320) < 2
    assert abs(_box(data)["height"] - 320) < 2

    # A card without body content is only its header plus padding.
    empty = _card(app, "empty_body")
    expect(empty.get_by_test_id("stCardLabel")).to_have_text("Empty body")
    expect(empty.get_by_test_id("stLayoutWrapper")).to_have_count(0)
    assert _box(empty)["height"] < 90

    # A content-width card hugs its content.
    content_width = _card(app, "content_width")
    expect(content_width.get_by_text("Fits the content")).to_be_visible()
    main_width = _box(app.get_by_test_id("stMain"))["width"]
    assert _box(content_width)["width"] < main_width / 2

    # An integer height pins the header and scrolls only the body.
    fixed = _card(app, "fixed_height")
    fixed.scroll_into_view_if_needed()
    assert abs(_box(fixed)["height"] - 180) < 2
    expect(fixed.get_by_text("Row 0", exact=True)).to_be_visible()
    expect(fixed.get_by_text("Row 11", exact=True)).not_to_be_in_viewport()
    fixed.get_by_test_id("stCardScrollBody").evaluate(
        "el => { el.scrollTop = el.scrollHeight }"
    )
    expect(fixed.get_by_text("Row 11", exact=True)).to_be_in_viewport()
    expect(fixed.get_by_test_id("stCardLabel")).to_be_in_viewport()


def test_card_snapshots(themed_app: Page, assert_snapshot: ImageCompareFunction):
    for surface in SURFACES:
        expect(_card(themed_app, f"surface_{surface}")).to_be_visible()
        expect(_card(themed_app, f"sidebar_{surface}")).to_be_visible()
    expect(
        _card(themed_app, "header_full_header").get_by_test_id("stVegaLiteChart")
    ).to_be_visible()

    for key, name in (
        ("surface_outlined", "surfaces"),
        ("header_full_header", "header_variants"),
    ):
        row = get_element_by_key(themed_app, key).locator(
            "xpath=ancestor::*[@data-testid='stHorizontalBlock'][1]"
        )
        assert_snapshot(row, name=f"st_card-{name}")
    assert_snapshot(
        get_element_by_key(themed_app, "sidebar_surfaces"), name="st_card-sidebar"
    )
