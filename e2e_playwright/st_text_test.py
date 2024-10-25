# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from e2e_playwright.shared.app_utils import check_top_level_class, expect_help_tooltip


def test_st_text_shows_correct_text(app: Page):
    expect(app.get_by_test_id("stText").nth(0)).to_have_text("This text is awesome!")


def test_st_text_doesnt_apply_formatting(
    app: Page, assert_snapshot: ImageCompareFunction
):
    assert_snapshot(
        app.get_by_test_id("stText").nth(1), name="st_text-no_formatting_applied"
    )


def test_help_tooltip_works(app: Page):
    """Test that the help tooltip is displayed on hover."""
    text_with_help = app.get_by_test_id("stText").nth(2)
    expect_help_tooltip(app, text_with_help, "This is a help tooltip!")


def test_multiline_text(app: Page):
    """Test that multi-line text is displayed correctly."""
    multiline_text = app.get_by_test_id("stText").nth(3)
    expect(multiline_text).not_to_contain_text("\\n")

    # check that the text is displayed as multiline with its div's height > width
    bounding_box = multiline_text.locator("div").bounding_box()
    assert bounding_box["height"] > bounding_box["width"]


def test_singleline_text_with_escape_char(app: Page):
    """Test that single-line text with escape char is displayed correctly."""
    singleline_text = app.get_by_test_id("stText").nth(4)
    expect(singleline_text).to_contain_text("\\n")


def test_no_scrollbar_for_long_text(app: Page):
    """Test that no scrollbar is shown for long text."""
    text_element = app.get_by_test_id("stText").nth(5)
    expect(text_element).not_to_have_class("scrollbar")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stText")
