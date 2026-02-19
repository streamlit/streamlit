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

"""E2E tests for mermaid charts in st.markdown."""

from playwright.sync_api import Page, expect


def test_mermaid_charts_render(app: Page):
    """Test that mermaid charts are rendered correctly."""
    # Check that mermaid charts are rendered
    mermaid_charts = app.locator('[data-testid="stMermaidChart"]')
    expect(mermaid_charts).to_have_count(5)


def test_mermaid_charts_contain_svg(app: Page):
    """Test that rendered mermaid charts contain SVG content."""
    # Get the first few mermaid charts (valid diagrams)
    mermaid_charts = app.locator('[data-testid="stMermaidChart"]')

    # Check that they contain SVG elements
    for i in range(4):  # First 4 are valid diagrams
        svg = mermaid_charts.nth(i).locator("svg")
        expect(svg).to_be_visible()


def test_mermaid_invalid_syntax_shows_error(app: Page):
    """Test that invalid mermaid syntax shows an error message."""
    # The 5th mermaid block has invalid syntax
    error = app.locator('[data-testid="stMermaidError"]')
    expect(error).to_be_visible()
    expect(error).to_contain_text("Mermaid diagram error")


def test_regular_code_block_not_mermaid(app: Page):
    """Test that regular code blocks are not rendered as mermaid charts."""
    # Check that there's a syntax highlighter for Python code
    code_block = app.locator('[data-testid="stCode"]')
    expect(code_block).to_be_visible()
    expect(code_block).to_contain_text("def hello")
