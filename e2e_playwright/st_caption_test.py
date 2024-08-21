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
from e2e_playwright.shared.app_utils import expand_sidebar, expect_help_tooltip


def test_correct_number_of_elements(app: Page):
    caption_containers = app.get_by_test_id("stCaptionContainer")
    expect(caption_containers).to_have_count(5)


def test_correct_content_in_caption(app: Page):
    """Check that the captions have the correct content and also use the correct
    markdown formatting."""
    caption_containers = app.get_by_test_id("stCaptionContainer")
    expect(caption_containers.nth(1)).to_have_text("This is a caption!")
    expect(caption_containers.nth(2)).to_have_text(
        "This is a caption that contains html inside it!"
    )
    expect(caption_containers.nth(3)).to_have_text(
        "This is a caption with a help tooltip"
    )


def test_help_tooltip_works(app: Page):
    """Test that the help tooltip is displayed on hover."""
    # The stMarkdown div is the outermost container that holds the caption and the
    # help tooltip:
    caption_with_help = app.get_by_test_id("stMarkdown").nth(3)
    expect_help_tooltip(app, caption_with_help, "This is some help tooltip!")


def test_match_snapshot_for_caption_with_html_and_unsafe_html_true(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the unsafe_html caption matches the snapshot."""
    # fetching the element-container so that when we capture a snapshot, it contains
    # the tooltip
    caption_container = (
        app.get_by_test_id("element-container")
        .filter(has=app.get_by_test_id("stCaptionContainer"))
        .nth(2)
    )
    assert_snapshot(caption_container, name="st_caption-with_html_and_unsafe_html_true")


def test_match_snapshot_for_caption_with_tooltip(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the caption with matches the snapshot. Also test dark-theme to make
    sure icon is visible."""
    caption_container = (
        themed_app.get_by_test_id("element-container")
        .filter(has=themed_app.get_by_test_id("stCaptionContainer"))
        .nth(3)
    )
    assert_snapshot(caption_container, name="st_caption-with_tooltip")


def test_match_snapshot_for_mixed_markdown_content(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the big markdown caption with the mixed content matches the snapshot."""
    caption_container = (
        app.get_by_test_id("element-container")
        .filter(has=app.get_by_test_id("stCaptionContainer"))
        .nth(4)
    )
    assert_snapshot(
        caption_container, name="st_caption-with_different_markdown_content"
    )


def test_match_snapshot_in_sidebar(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    sidebar = expand_sidebar(themed_app)
    caption_in_sidebar = sidebar.get_by_test_id("stCaptionContainer")
    assert_snapshot(caption_in_sidebar, name="st_caption-sidebar_caption")
