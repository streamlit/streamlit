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
    click_button,
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
    expect(popover_elements).to_have_count(21)

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
    # Should have three buttons: search, download CSV, column visibility
    expect(dataframe_toolbar.get_by_test_id("stElementToolbarButton")).to_have_count(3)


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
    # Initially closed — content should not have executed
    expect(app.get_by_text("Popover execution count: 0")).to_be_visible()

    # Open the dynamic popover
    open_popover(app, "Dynamic popover")
    wait_for_app_run(app)

    # Content should have executed once
    expect(app.get_by_text("Popover execution count: 1")).to_be_visible()

    # Close the popover by pressing Escape
    app.keyboard.press("Escape")
    wait_for_app_run(app)

    # Count should stay at 1
    expect(app.get_by_text("Popover execution count: 1")).to_be_visible()

    # Popover content should not be visible when closed
    expect(app.get_by_text("Popover content executed 1 times")).not_to_be_visible()


def test_dynamic_popover_programmatic_control(app: Page):
    """Test programmatic control of dynamic popover via session state."""
    # Open via button
    click_button(app, "Open Popover")

    # Popover content should be visible
    expect(app.get_by_text("Programmatically controlled popover")).to_be_visible()

    # Close via button
    click_button(app, "Close Popover")

    # Content should not be visible
    expect(app.get_by_text("Programmatically controlled popover")).not_to_be_visible()


def test_popover_key_only_does_not_trigger_rerun(app: Page):
    """Test that a popover with key but no on_change does not trigger reruns."""
    # Record the initial rerun count
    rerun_text = app.get_by_text("Key-only rerun count:")
    expect(rerun_text).to_be_visible()
    initial_count = rerun_text.text_content()

    # Open the key-only popover
    open_popover(app, "Key-only popover")

    # Rerun count should NOT have changed (no rerun triggered)
    expect(rerun_text).to_have_text(initial_count or "")

    # Close via Escape
    app.keyboard.press("Escape")

    # Still no rerun
    expect(rerun_text).to_have_text(initial_count or "")


def test_dynamic_popover_in_fragment(app: Page):
    """Test that a dynamic popover works correctly inside a fragment."""
    # Initially closed — fragment content should not have executed
    expect(app.get_by_text("Fragment popover exec count: 0")).to_be_visible()

    # Open the fragment popover
    open_popover(app, "Fragment popover")
    wait_for_app_run(app)

    # Content should have executed once
    expect(app.get_by_text("Fragment popover exec count: 1")).to_be_visible()

    # Close the popover
    app.keyboard.press("Escape")
    wait_for_app_run(app)

    # Count should stay at 1
    expect(app.get_by_text("Fragment popover exec count: 1")).to_be_visible()

    # Popover content should not be visible when closed
    expect(
        app.get_by_text("Fragment popover content executed 1 times")
    ).not_to_be_visible()


def test_popover_callback_fires_on_open_and_close(app: Page):
    """Test that a callable on_change callback fires when popover is toggled."""
    # Initially, callback count should be 0
    expect(app.get_by_text("Callback count: 0", exact=True)).to_be_visible()

    # Open the callback popover
    open_popover(app, "Basic callback popover")
    wait_for_app_run(app)

    # Callback should have fired once (popover opened)
    expect(app.get_by_text("Callback count: 1", exact=True)).to_be_visible()

    # Popover content should be visible
    expect(app.get_by_text("Callback popover content", exact=True)).to_be_visible()

    # Close the popover by pressing Escape
    app.keyboard.press("Escape")
    wait_for_app_run(app)

    # Callback should have fired again (popover closed)
    expect(app.get_by_text("Callback count: 2", exact=True)).to_be_visible()

    # Popover content should not be visible
    expect(app.get_by_text("Callback popover content", exact=True)).not_to_be_visible()


def test_popover_callback_with_args_kwargs(app: Page):
    """Test that a callback with args and kwargs receives the correct values."""
    # Initially, the args result should not be set
    expect(app.get_by_text("Callback args result: not called")).to_be_visible()

    # Open the args popover
    open_popover(app, "Callback args popover")
    wait_for_app_run(app)

    # Callback should have fired with args/kwargs
    expect(
        app.get_by_text("Callback args result: my_prefix-toggled-my_suffix")
    ).to_be_visible()


def test_popover_callback_in_fragment(app: Page):
    """Test that a popover callback works correctly inside a fragment."""
    # Initially, fragment callback count should be 0
    expect(app.get_by_text("Fragment callback count: 0")).to_be_visible()

    # Open the fragment callback popover
    open_popover(app, "Fragment callback popover")
    wait_for_app_run(app)

    # Callback should have fired once
    expect(app.get_by_text("Fragment callback count: 1")).to_be_visible()

    # Popover content should be visible
    expect(app.get_by_text("Fragment callback popover content")).to_be_visible()

    # Close the popover
    app.keyboard.press("Escape")
    wait_for_app_run(app)

    # Callback should have fired again
    expect(app.get_by_text("Fragment callback count: 2")).to_be_visible()
