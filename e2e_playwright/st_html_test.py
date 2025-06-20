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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class, get_expander

# Each st.html call generates a stHtml frontend element.
# If the html content is only style tags, it will generate the stHtml element
# in the event container. If the html content is a mix of style tags and other tags,
# it will generate the stHtml element with both style/other tags in the main container.
ST_HTML_ELEMENTS = 10


def test_html_in_line_styles(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that html renders correctly using snapshot testing."""
    html_elements = themed_app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(ST_HTML_ELEMENTS)
    first_html = html_elements.nth(0)

    expect(first_html).to_have_text("This is a div with some inline styles.")

    styled_div = first_html.locator("div")
    expect(styled_div).to_have_css("color", "rgb(255, 165, 0)")
    assert_snapshot(first_html, name="st_html-inline_styles")


def test_html_sanitization(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that html sanitizes script tags correctly."""
    html_elements = themed_app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(ST_HTML_ELEMENTS)
    second_html = html_elements.nth(1)

    expect(second_html).to_contain_text("This is a i tag")
    expect(second_html).to_contain_text("This is a strong tag")
    expect(second_html.locator("script")).to_have_count(0)
    assert_snapshot(second_html, name="st_html-script_tags")


def test_html_style_tags(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that html style tags are applied correctly."""
    html_elements = themed_app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(ST_HTML_ELEMENTS)
    third_html = html_elements.nth(2)

    expect(third_html).to_have_text("This text should be blue")
    expect(third_html.locator("div")).to_have_css("color", "rgb(0, 0, 255)")
    assert_snapshot(third_html, name="st_html-style_tags")


def test_html_style_tag_spacing(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that non-rendered html doesn't cause unnecessary spacing."""
    expander = get_expander(themed_app, "HTML Elements for Spacing Test")
    assert_snapshot(
        expander,
        name="st_html-style_tag_spacing",
    )


def test_html_styles_only_in_event_container(app: Page):
    """Test that event container renders html with style tags only."""
    total_html_elements = app.get_by_test_id("stHtml")
    expect(total_html_elements).to_have_count(ST_HTML_ELEMENTS)

    # Check that the style tags are in the event container
    # and are not visible
    event_container = app.get_by_test_id("stEvent")
    style_only_html_elements = event_container.get_by_test_id("stHtml")
    # 4th & 7th elements style only ( <style> tag body in st.html & <style> tag body from css file)
    expect(style_only_html_elements).to_have_count(2)
    expect(style_only_html_elements.nth(0)).not_to_be_visible()
    expect(style_only_html_elements.nth(1)).not_to_be_visible()

    # The fourth st.html is only style tags, first in event container
    fourth_html = style_only_html_elements.nth(0).locator("style")
    expect(fourth_html).to_have_text(
        """
        #style-test {
            color: purple;
        }
    """,
        use_inner_text=True,
    )

    # Check that the styling is still applied correctly from style tag
    # even though it's in the event container
    styled_heading = app.get_by_text("Style test")
    expect(styled_heading).to_have_css("color", "rgb(128, 0, 128)")


def test_html_in_main_container(app: Page):
    """Test that main container renders html that is not only style tags."""
    total_html_elements = app.get_by_test_id("stHtml")
    expect(total_html_elements).to_have_count(ST_HTML_ELEMENTS)

    # Check that any html elements that are not only style tags are rendered
    # in the main container and are visible
    main_container = app.get_by_test_id("stMain")
    other_html_elements = main_container.get_by_test_id("stHtml")
    expect(other_html_elements).to_have_count(8)

    # Check that the remaining stHtml elements are in the main container
    # and are visible
    main_container = app.get_by_test_id("stMain")
    other_html_elements = main_container.get_by_test_id("stHtml")
    expect(other_html_elements).to_have_count(8)
    expect(other_html_elements.nth(0)).to_be_visible()
    expect(other_html_elements.nth(1)).to_be_visible()
    expect(other_html_elements.nth(2)).to_be_visible()
    expect(other_html_elements.nth(3)).to_be_visible()
    expect(other_html_elements.nth(4)).to_be_visible()


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stHtml")


def test_html_from_file_str(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that we can load HTML files from str paths."""
    html_elements = app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(ST_HTML_ELEMENTS)
    assert_snapshot(html_elements.nth(3), name="st_html-file_str")


def test_html_from_file_path(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that we can load HTML files from Path objects."""
    html_elements = app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(ST_HTML_ELEMENTS)
    assert_snapshot(html_elements.nth(4), name="st_html-file_path")


def test_html_with_css_file(app: Page):
    """Test that we can load CSS files and they are wrapped in style tags."""
    html_elements = app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(ST_HTML_ELEMENTS)

    # CSS file content goes to event container since it's style-only
    event_container = app.get_by_test_id("stEvent")
    style_only_html_elements = event_container.get_by_test_id("stHtml")
    # The CSS file is the 2nd style-only element (index 1) in the event container
    css_file_html = style_only_html_elements.nth(1)

    expect(css_file_html.locator("style")).to_have_text(
        """
        #hello-world {
            color: red;
        }
        .stMarkdown h2 {
            color: blue;
        }
        .stMarkdown h3 {
            color: green;
        }
    """,
        use_inner_text=True,
    )

    # Check that the styling is applied correctly from the CSS file
    heading_1 = app.get_by_text("Hello, World!")
    expect(heading_1).to_have_css("color", "rgb(255, 0, 0)")
    heading_2 = app.get_by_text("Random")
    expect(heading_2).to_have_css("color", "rgb(0, 0, 255)")
    heading_3 = app.get_by_text("Corgis")
    expect(heading_3).to_have_css("color", "rgb(0, 128, 0)")


def test_html_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that HTML elements with different width configurations are displayed correctly."""
    html_elements = app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(ST_HTML_ELEMENTS)

    # Width examples are in the main container since they contain actual content
    main_container = app.get_by_test_id("stMain")
    main_html_elements = main_container.get_by_test_id("stHtml")
    # The width examples are the last 3 elements in the main container (indices 5, 6, 7)

    assert_snapshot(main_html_elements.nth(5), name="st_html-width_content")
    assert_snapshot(main_html_elements.nth(6), name="st_html-width_stretch")
    assert_snapshot(main_html_elements.nth(7), name="st_html-width_300px")
