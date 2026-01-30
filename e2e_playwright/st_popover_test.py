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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expect_markdown,
    get_element_by_key,
    get_popover,
    open_popover,
)


def test_popover_button_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the popover buttons are correctly rendered via screenshot matching."""
    popover_elements = themed_app.get_by_test_id("stPopover")
    expect(popover_elements).to_have_count(16)  # 14 original + 2 dynamic (20, 21)

    assert_snapshot(
        get_popover(themed_app, "popover 5 (in sidebar)"), name="st_popover-sidebar"
    )
    assert_snapshot(
        get_popover(themed_app, "popover 1 (empty)"),
        name="st_popover-empty",
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
        get_popover(themed_app, "popover 18 (primary)"),
        name="st_popover-primary",
    )
    assert_snapshot(
        get_popover(themed_app, "popover 19 (tertiary)"),
        name="st_popover-tertiary",
    )


def test_popover_width_content(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover button with width=content."""
    content_width_container = get_element_by_key(app, "test_width=content")
    content_width_popover = open_popover(app, "popover 10 (width=content)")
    expect_markdown(content_width_popover, "Content width")

    assert_snapshot(
        content_width_container,
        name="st_popover-width_content",
    )


def test_popover_width_stretch(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover button with width=stretch."""

    # We don't test this one opened because it is very unstable. It seems to be
    # due to the extra calculation involving the resizeObserver.
    stretch_width_popover = get_popover(app, "popover 11 (width=stretch)")

    assert_snapshot(
        stretch_width_popover,
        name="st_popover-width_stretch",
    )


def test_popover_width_fixed(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover button with width=500px."""
    fixed_width_container = get_element_by_key(app, "test_width=500px")
    fixed_width_popover = open_popover(app, "popover 12 (width=500px)")
    expect_markdown(fixed_width_popover, "500px width")

    assert_snapshot(
        fixed_width_container,
        name="st_popover-width_500px",
    )


def test_popover_columns(app: Page, assert_snapshot: ImageCompareFunction):
    """Test popover buttons in columns."""
    columns_container = get_element_by_key(app, "test_columns")
    columns_popover_1 = open_popover(app, "popover 16 (in column 1)")
    expect_markdown(columns_popover_1, "Popover in column 1")

    assert_snapshot(
        columns_container,
        name="st_popover-columns",
    )


def test_popover_container_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the popover container is correctly rendered via screenshot matching."""
    popover_container = open_popover(themed_app, "popover 3 (with widgets)")

    # Check that it is open:
    expect_markdown(popover_container, "Hello World 👋")

    # Click somewhere outside the close popover container:
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    expect(popover_container).not_to_be_visible()

    # Click the button to open it:
    popover_container = open_popover(themed_app, "popover 3 (with widgets)")

    expect_markdown(popover_container, "Hello World 👋")
    expect(popover_container.get_by_test_id("stTextInput")).to_have_count(4)

    assert_snapshot(popover_container, name="st_popover-container")


def test_applying_changes_from_popover_container(app: Page):
    """Test that changes made in the popover container are applied correctly."""
    # Get the widgets popover container:
    popover_container = open_popover(app, "popover 3 (with widgets)")
    expect_markdown(popover_container, "Hello World 👋")

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
    expect_markdown(popover_container, "Hello World 👋")

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


def test_dynamic_popover_lazy_execution(app: Page):
    """Test that dynamic popover only executes content when open."""
    # Initially closed, lazy content should not have executed
    expect(app.get_by_text("Lazy execution count: 0")).to_be_visible()

    # Open the popover
    lazy_popover_button = (
        get_popover(app, "popover 20 (dynamic lazy execution)")
        .get_by_test_id("stPopoverButton")
        .first
    )
    lazy_popover_button.click()
    wait_for_app_run(app)

    # Content should have executed once
    popover_body = app.get_by_test_id("stPopoverBody").first
    expect(popover_body.get_by_text("Lazy content executed 1 times")).to_be_visible()
    expect(app.get_by_text("Lazy execution count: 1")).to_be_visible()

    # Close the popover (click outside)
    app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(app)

    # Count should stay at 1 (content didn't execute while closed)
    expect(app.get_by_text("Lazy execution count: 1")).to_be_visible()


def test_dynamic_popover_programmatic_control(app: Page):
    """Test programmatic control of dynamic popover via session state."""
    # Open via button
    app.get_by_test_id("stButton").filter(has_text="Open Dynamic Popover").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Popover should be open
    popover_body = app.get_by_test_id("stPopoverBody").first
    expect(
        popover_body.get_by_text("Programmatically controlled popover content")
    ).to_be_visible()

    # Close via button
    app.get_by_test_id("stButton").filter(has_text="Close Dynamic Popover").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Content should not be visible
    expect(app.get_by_test_id("stPopoverBody")).not_to_be_visible()
