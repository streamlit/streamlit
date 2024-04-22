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


def test_markdown_all_elements_displayed(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Displays correct number of markdown elements"""

    markdown_elements = themed_app.get_by_test_id("stMarkdown")

    expect(markdown_elements).to_have_count(18)

    for i in range(markdown_elements.count()):
        assert_snapshot(markdown_elements.nth(i), name=f"st_markdown-{i}")


def test_displays_markdown(app: Page):
    """Verifies the correct text content of markdown elements."""

    markdown_elements = app.get_by_test_id("stMarkdown")

    # Assert the text content of each markdown element
    expect(markdown_elements.nth(0)).to_have_text("This markdown is awesome! 😎")
    expect(markdown_elements.nth(1)).to_have_text("This <b>HTML tag</b> is escaped!")
    expect(markdown_elements.nth(2)).to_have_text("This HTML tag is not escaped!")
    expect(markdown_elements.nth(3)).to_have_text("[text]")
    expect(markdown_elements.nth(4)).to_have_text("link")
    expect(markdown_elements.nth(5)).to_have_text("[][]")
    expect(markdown_elements.nth(6)).to_have_text("Inline math with KaTeX\\KaTeXKATE​X")
    expect(markdown_elements.nth(7)).to_have_text(
        "ax2+bx+c=0ax^2 + bx + c = 0ax2+bx+c=0"
    )
    expect(markdown_elements.nth(8)).to_have_text("Some header 1")
    expect(markdown_elements.nth(9)).to_have_text("Some header 2")
    expect(markdown_elements.nth(10)).to_have_text("Some header 3")
    expect(markdown_elements.nth(11)).to_have_text("Col1Col2SomeData")

    # Additional checks for specific elements like links
    expect(markdown_elements.nth(3).locator("a")).to_have_count(0)
    expect(markdown_elements.nth(4).locator("a")).to_have_attribute("href", "href")


def test_markdown_displays_headers_anchors(app: Page):
    """Displays headers with anchors"""

    h1 = app.locator("h1#some-header-1")
    h2 = app.locator("h2#some-header-2")
    h3 = app.locator("h3#some-header-3")

    expect(h1).to_have_count(1)
    expect(h2).to_have_count(1)
    expect(h3).to_have_count(1)

    expect(h1).to_have_attribute("id", "some-header-1")
    expect(h2).to_have_attribute("id", "some-header-2")
    expect(h3).to_have_attribute("id", "some-header-3")


def test_markdown_displays_tables(app: Page, assert_snapshot: ImageCompareFunction):
    """Displays markdown tables correctly"""

    tables = app.locator(".element-container .stMarkdown table")
    expect(tables).to_have_count(1)
    assert_snapshot(tables.first, name="markdown-table-visuals")


def test_markdown_displays_long_headers_above_other_elements(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Displays long headers above other elements in the markdown block"""

    long_header = app.locator(
        "[data-testid='stVerticalBlock'] [data-testid='stVerticalBlock']"
    ).nth(0)
    assert_snapshot(long_header, name="long-markdown-header-above-table")


def test_markdown_displays_headings_and_markdown_together(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Checks how headings and markdown are displayed when called separately or together and take snapshots."""

    heading_and_markdown_block = app.locator(
        "[data-testid='stVerticalBlock'] [data-testid='stVerticalBlock']"
    ).nth(1)
    assert_snapshot(
        heading_and_markdown_block, name="heading-and-markdown-combinations"
    )
