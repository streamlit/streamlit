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
from e2e_playwright.shared.app_utils import check_top_level_class


def test_html_in_line_styles(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that html renders correctly using snapshot testing."""
    html_elements = themed_app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(6)
    first_html = html_elements.nth(0)

    expect(first_html).to_have_text("This is a div with some inline styles.")

    styled_div = first_html.locator("div")
    expect(styled_div).to_have_css("color", "rgb(255, 165, 0)")
    assert_snapshot(first_html, name="st_html-inline_styles")


def test_html_sanitization(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that html sanitizes script tags correctly."""
    html_elements = themed_app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(6)
    second_html = html_elements.nth(1)

    expect(second_html).to_contain_text("This is a i tag")
    expect(second_html).to_contain_text("This is a strong tag")
    expect(second_html.locator("script")).to_have_count(0)
    assert_snapshot(second_html, name="st_html-script_tags")


def test_html_style_tags(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that html style tags are applied correctly."""
    html_elements = themed_app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(6)
    third_html = html_elements.nth(2)

    expect(third_html).to_have_text("This text should be blue")
    expect(third_html.locator("div")).to_have_css("color", "rgb(0, 0, 255)")
    assert_snapshot(third_html, name="st_html-style_tags")


def test_html_style_tag_spacing(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that non-rendered html doesn't cause unnecessary spacing."""
    html_elements = themed_app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(6)

    assert_snapshot(
        themed_app.get_by_test_id("stVerticalBlock"), name="st_html-style_tag_spacing"
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stHtml")


def test_html_from_file_str(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that we can load HTML files from str paths."""
    html_elements = app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(6)
    assert_snapshot(html_elements.nth(4), name="st_html-file_str")


def test_html_from_file_path(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that we can load HTML files from Path objects."""
    html_elements = app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(6)
    assert_snapshot(html_elements.nth(5), name="st_html-file_path")
