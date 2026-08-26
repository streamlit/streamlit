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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_target import AppTarget
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expect_help_tooltip,
    get_element_by_key,
    get_expander,
    get_text,
)


def test_st_text_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    assert_snapshot(
        get_expander(app, "Various text elements"), name="st_text-rendering"
    )


def test_st_text_shows_correct_text(app: Page):
    expect(app.get_by_test_id("stText").nth(0)).to_have_text("This text is awesome!")


def test_st_text_doesnt_apply_formatting(
    app: Page, assert_snapshot: ImageCompareFunction
):
    assert_snapshot(
        app.get_by_test_id("stText").nth(1), name="st_text-no_formatting_applied"
    )


def test_help_tooltip_works(app_target: AppTarget):
    """Test that the help tooltip is displayed on hover."""
    text_with_help = app_target.get_by_test_id("stText").nth(2)
    expect_help_tooltip(app_target, text_with_help, "This is a help tooltip!")


def test_multiline_text(app: Page):
    """Test that multi-line text is displayed correctly."""
    multiline_text = app.get_by_test_id("stText").nth(3)
    expect(multiline_text).not_to_contain_text("\\n")

    # check that the text is displayed as multiline with its span's height > width
    bounding_box = multiline_text.locator("span").first.bounding_box()
    assert bounding_box is not None
    assert bounding_box["height"] > bounding_box["width"]


def test_singleline_text_with_escape_char(app: Page):
    """Test that single-line text with escape char is displayed correctly."""
    singleline_text = app.get_by_test_id("stText").nth(4)
    expect(singleline_text).to_contain_text("\\n")


def test_preserves_whitespace_sequences(app: Page):
    """st.text keeps extra spaces and tabs instead of collapsing them like HTML."""
    text_element = app.get_by_test_id("stText").nth(5)
    expect(text_element.locator("span").first).to_have_css(
        "white-space-collapse", "preserve"
    )


def test_no_scrollbar_for_long_text(app: Page):
    """Test that no scrollbar is shown for long text."""
    text_element = app.get_by_test_id("stText").nth(5)
    expect(text_element).not_to_have_class("scrollbar")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stText")


def test_width_settings(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that different width settings are applied correctly."""
    # Get the last three text elements (the ones with width settings)
    text_elements = app.get_by_test_id("stText")
    content_text = text_elements.nth(7)
    stretch_text = text_elements.nth(8)
    fixed_text = text_elements.nth(9)

    expect(content_text).to_contain_text("This is a text with content width.")

    assert_snapshot(stretch_text, name="st_text-stretch-width")
    assert_snapshot(fixed_text, name="st_text-fixed-width")
    assert_snapshot(content_text, name="st_text-content-width")


@pytest.mark.parametrize(
    "alignment_value",
    ["left", "center", "right", "justify"],
)
def test_text_text_alignment(
    app: Page,
    assert_snapshot: ImageCompareFunction,
    alignment_value: str,
):
    """Test st.text with text alignment."""
    text_map = {
        "left": r"Left aligned text \(default\)",
        "center": "Center aligned text",
        "right": "Right aligned text",
        "justify": "Justified text. This is a longer text to demonstrate justification.",
    }

    text_element = get_text(app, text_map[alignment_value])

    expect(text_element).to_be_visible()
    text_element.scroll_into_view_if_needed()

    assert_snapshot(text_element, name=f"st_text-text_alignment_{alignment_value}")


WRAP_TEXT = "Quarterly revenue versus plan for the complete fiscal year dashboard"
WRAPPED_HEIGHT_MARGIN = 4


def test_wrap_false_ellipsizes_text_and_sets_title(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """wrap=False keeps plain text on one line, ellipsizes overflow, and exposes
    the full text via a native title. wrap=True wraps and has no title.
    """
    no_wrap_container = get_element_by_key(app, "wrap_false_text")
    wrap_container = get_element_by_key(app, "wrap_true_text")
    no_wrap = no_wrap_container.get_by_test_id("stText")
    wraps = wrap_container.get_by_test_id("stText")

    expect(no_wrap_container.get_by_title(WRAP_TEXT, exact=True)).to_be_visible()
    expect(wrap_container.get_by_title(WRAP_TEXT, exact=True)).to_have_count(0)
    wait_until(
        app,
        lambda: no_wrap.evaluate(
            "el => Array.from(el.querySelectorAll('span')).some("
            "t => t.scrollWidth > t.clientWidth)"
        ),
    )

    false_box = no_wrap.bounding_box()
    true_box = wraps.bounding_box()
    assert false_box is not None
    assert true_box is not None
    assert true_box["height"] > false_box["height"] + WRAPPED_HEIGHT_MARGIN
    assert_snapshot(no_wrap_container, name="st_text-wrap_false")


WRAP_NEWLINE_TEXT = "Line one Line two Line three extra"


def test_wrap_false_collapses_text_newlines(app: Page):
    """wrap=False keeps st.text on one line even when the body contains newlines."""
    no_wrap_container = get_element_by_key(app, "wrap_false_text_newlines")
    wrap_container = get_element_by_key(app, "wrap_true_text_newlines")
    no_wrap = no_wrap_container.get_by_test_id("stText")
    wraps = wrap_container.get_by_test_id("stText")
    single_line = get_element_by_key(app, "wrap_false_text").get_by_test_id("stText")

    expect(
        no_wrap_container.get_by_title(WRAP_NEWLINE_TEXT, exact=True)
    ).to_be_visible()
    expect(wrap_container.get_by_title(WRAP_NEWLINE_TEXT, exact=True)).to_have_count(0)

    false_box = no_wrap.bounding_box()
    true_box = wraps.bounding_box()
    single_box = single_line.bounding_box()
    assert false_box is not None
    assert true_box is not None
    assert single_box is not None
    assert true_box["height"] > false_box["height"] + WRAPPED_HEIGHT_MARGIN
    assert abs(false_box["height"] - single_box["height"]) < WRAPPED_HEIGHT_MARGIN
