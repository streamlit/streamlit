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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    get_element_by_key,
    get_popover,
    open_popover,
)


def test_popover_button_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the popover buttons are correctly rendered via screenshot matching."""
    popover_elements = themed_app.get_by_test_id("stPopover")
    expect(popover_elements).to_have_count(21)

    assert_snapshot(
        get_popover(themed_app, "popover 5 (in sidebar)"), name="st_popover-sidebar"
    )
    assert_snapshot(
        get_popover(themed_app, "popover 1 (empty)"),
        name="st_popover-empty",
    )
    assert_snapshot(
        get_popover(themed_app, "popover 2 (use_container_width)"),
        name="st_popover-use_container_width",
    )
    assert_snapshot(
        get_popover(themed_app, "popover 3 (with widgets)"),
        name="st_popover-normal",
    )
    # Popover button 4 is almost the same as 3, so we don't need to test it
    assert_snapshot(
        get_popover(themed_app, "popover 6 (disabled)"),
        name="st_popover-disabled",
    )
    assert_snapshot(
        get_popover(themed_app, "popover 7 (emoji)"),
        name="st_popover-emoji_icon",
    )
    assert_snapshot(
        get_popover(themed_app, "popover 8 (material icon)"),
        name="st_popover-material_icon",
    )
    assert_snapshot(
        get_popover(themed_app, "popover 9 (use_container_width) with help"),
        name="st_popover-use_container_width_with_help",
    )


def test_popover_width_content(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover button with width=content."""
    content_width_container = get_element_by_key(app, "test_width=content")
    content_width_popover = open_popover(app, "popover 10 (width=content)")
    expect(content_width_popover.get_by_test_id("stMarkdown")).to_have_text(
        "Content width"
    )
    assert_snapshot(
        content_width_container,
        name="st_popover-width_content",
    )


def test_popover_width_stretch(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover button with width=stretch."""
    stretch_width_container = get_element_by_key(app, "test_width=stretch")
    stretch_width_popover = open_popover(app, "popover 11 (width=stretch)")
    expect(stretch_width_popover.get_by_test_id("stMarkdown")).to_have_text(
        "Stretch width"
    )
    assert_snapshot(
        stretch_width_container,
        name="st_popover-width_stretch",
    )


def test_popover_width_fixed(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover button with width=500px."""
    fixed_width_container = get_element_by_key(app, "test_width=500px")
    fixed_width_popover = open_popover(app, "popover 12 (width=500px)")
    expect(fixed_width_popover.get_by_test_id("stMarkdown")).to_have_text("500px width")
    assert_snapshot(
        fixed_width_container,
        name="st_popover-width_500px",
    )


def test_popover_width_content_help(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover button with width=content + help tooltip."""
    content_width_help_container = get_element_by_key(app, "test_width=content_help")
    content_width_help_popover = open_popover(app, "popover 13 (width=content + help)")
    expect(content_width_help_popover.get_by_test_id("stMarkdown")).to_have_text(
        "Content width with help tooltip"
    )
    assert_snapshot(
        content_width_help_container,
        name="st_popover-width_content_help",
    )


def test_popover_width_stretch_help(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover button with width=stretch + help tooltip."""
    stretch_width_help_container = get_element_by_key(app, "test_width=stretch_help")
    stretch_width_help_popover = open_popover(app, "popover 14 (width=stretch + help)")
    expect(stretch_width_help_popover.get_by_test_id("stMarkdown")).to_have_text(
        "Stretch width with help tooltip"
    )
    assert_snapshot(
        stretch_width_help_container,
        name="st_popover-width_stretch_help",
    )


def test_popover_width_fixed_help(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover button with width=500px + help tooltip."""
    fixed_width_help_container = get_element_by_key(app, "test_width=180px_help")
    fixed_width_help_popover = open_popover(app, "popover 15 (width=500px + help)")
    expect(fixed_width_help_popover.get_by_test_id("stMarkdown")).to_have_text(
        "500px width with help tooltip"
    )
    assert_snapshot(
        fixed_width_help_container,
        name="st_popover-width_500px_help",
    )


def test_popover_columns(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover buttons in columns."""
    columns_container = get_element_by_key(app, "test_columns")
    columns_popover_1 = open_popover(app, "popover 16 (in column 1)")
    expect(columns_popover_1.get_by_test_id("stMarkdown")).to_have_text(
        "Popover in column 1"
    )
    assert_snapshot(
        columns_container,
        name="st_popover-columns",
    )


def test_popover_deprecated_use_container_width(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test deprecated use_container_width parameter with warning display."""
    container_width_true = get_element_by_key(
        app, "test_deprecated_use_container_width=True"
    )
    assert_snapshot(
        container_width_true,
        name="st_popover-deprecated_use_container_width_true",
    )

    container_width_false = get_element_by_key(
        app, "test_deprecated_use_container_width=False"
    )
    assert_snapshot(
        container_width_false,
        name="st_popover-deprecated_use_container_width_false",
    )


def test_popover_container_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the popover container is correctly rendered via screenshot matching."""
    popover_container = open_popover(themed_app, "popover 3 (with widgets)")

    # Check that it is open:
    expect(popover_container.get_by_test_id("stMarkdown")).to_have_text(
        "Hello World 👋"
    )

    # Click somewhere outside the close popover container:
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    expect(popover_container).not_to_be_visible()

    # Click the button to open it:
    popover_container = open_popover(themed_app, "popover 3 (with widgets)")

    expect(popover_container.get_by_test_id("stMarkdown")).to_have_text(
        "Hello World 👋"
    )
    expect(popover_container.get_by_test_id("stTextInput")).to_have_count(4)

    assert_snapshot(popover_container, name="st_popover-container")


def test_applying_changes_from_popover_container(app: Page):
    """Test that changes made in the popover container are applied correctly."""
    # Get the widgets popover container:
    popover_container = open_popover(app, "popover 3 (with widgets)")
    expect(popover_container.get_by_test_id("stMarkdown")).to_have_text(
        "Hello World 👋"
    )

    # Fill in the text:
    text_input_element = popover_container.get_by_test_id("stTextInput").nth(0)
    text_input_element.locator("input").first.fill("Input text in popover")
    wait_for_app_run(app)

    # Click somewhere outside the close popover container:
    app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    expect(popover_container).not_to_be_visible()

    # Click the button to open it:
    popover_container = open_popover(app, "popover 3 (with widgets)")

    # Write a text into a text input
    text_input_element = popover_container.get_by_test_id("stTextInput").nth(0)
    text_input_element.locator("input").first.fill("Input text in popover")
    wait_for_app_run(app)

    # Check that it is still open after rerun:
    expect(popover_container).to_be_visible()
    expect(popover_container.get_by_test_id("stMarkdown")).to_have_text(
        "Hello World 👋"
    )

    # Click somewhere outside the close popover container
    app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    expect(popover_container).not_to_be_visible()

    # The main app should render this text:
    expect(app.get_by_test_id("stExpander").get_by_test_id("stMarkdown")).to_have_text(
        "Input text in popover"
    )


def test_fullscreen_mode_is_disabled_in_popover(app: Page):
    """Test that the fullscreen mode is disabled within a popover container."""
    # Get the fullscreen elements popover container:
    popover_container = open_popover(app, "popover 4 (with dataframe)")

    # Check dataframe toolbar:
    dataframe_element = popover_container.get_by_test_id("stDataFrame").nth(0)
    expect(dataframe_element).to_be_visible()
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")
    # Hover over dataframe
    dataframe_element.hover()
    # Should only have  two buttons, search + download CSV
    expect(dataframe_toolbar.get_by_test_id("stElementToolbarButton")).to_have_count(2)


def test_show_tooltip_on_hover(app: Page):
    """Test that the tooltip is shown when hovering over a popover button."""
    popover_button = (
        get_popover(app, "popover 4 (with dataframe)")
        .get_by_test_id("stPopoverButton")
        .first
    )
    # Click the button to open it:
    popover_button.hover()

    expect(app.get_by_test_id("stTooltipContent")).to_have_text("help text")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stPopover")
