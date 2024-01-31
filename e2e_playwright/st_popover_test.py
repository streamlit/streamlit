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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def test_popover_button_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the popover buttons are correctly rendered via screenshot matching."""
    popover_elements = themed_app.get_by_test_id("stPopover")
    expect(popover_elements).to_have_count(5)

    assert_snapshot(popover_elements.nth(0), name="st_popover-sidebar")
    assert_snapshot(popover_elements.nth(1), name="st_popover-empty")
    assert_snapshot(popover_elements.nth(2), name="st_popover-use_container_width")
    assert_snapshot(popover_elements.nth(3), name="st_popover-normal")


def test_popover_container_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the popover container is correctly rendered via screenshot matching."""
    # Get the widgets popover container:
    popover_elements = themed_app.get_by_test_id("stPopover").nth(3)

    popover_elements.locator("button").click()

    popover_container = themed_app.get_by_test_id("stPopoverBody")
    expect(popover_container).to_be_visible()
    expect(popover_container.get_by_test_id("stTextInput")).to_have_count(4)
    # Close and open again to guarantee persistent width
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})

    assert_snapshot(popover_container, name="st_popover-container")


def test_applying_changes_from_popover_container(app: Page):
    """Test that changes made in the popover container are applied correctly."""
    # Get the widgets popover container:
    popover_element = app.get_by_test_id("stPopover").nth(3)
    # Click the button to open it:
    popover_element.locator("button").click()

    # Check that it is open
    popover_container = app.get_by_test_id("stPopoverBody")
    expect(popover_container).to_be_visible()
    expect(popover_container.get_by_test_id("stMarkdown")).to_have_text("Hello World 👋")

    # Click somewhere outside the close popover container
    app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    expect(popover_container).not_to_be_visible()

    # Click the button to open it:
    popover_element.locator("button").click()

    popover_container = app.get_by_test_id("stPopoverBody")
    expect(popover_container).to_be_visible()

    # Write a text into a text input
    text_input_element = popover_container.get_by_test_id("stTextInput").nth(0)
    text_input_element.locator("input").first.fill("Input text in popover")
    wait_for_app_run(app)

    # Check that it is still open after rerun:
    expect(popover_container).to_be_visible()
    expect(popover_container.get_by_test_id("stMarkdown")).to_have_text("Hello World 👋")

    # The main app should render this text:
    expect(app.get_by_test_id("stMarkdown")).to_have_text("Input text in popover")


def test_fullscreen_mode_is_disabled_in_popover(app: Page):
    """Test that the fullscreen mode is disabled within a popover container."""
    # Get the fullscreen elements popover container:
    popover_element = app.get_by_test_id("stPopover").nth(4)
    # Click the button to open it:
    popover_element.locator("button").click()

    popover_container = app.get_by_test_id("stPopoverBody")
    expect(popover_container).to_be_visible()

    # check that the image does not have the fullscreen button
    expect(popover_container.get_by_test_id("StyledFullScreenButton")).to_have_count(0)

    # Check dataframe toolbar:
    dataframe_element = popover_container.get_by_test_id("stDataFrame").nth(0)
    expect(dataframe_element).to_be_visible()
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")
    # Hover over dataframe
    dataframe_element.hover()
    # Should only have  two buttons, search + download CSV
    expect(dataframe_toolbar.get_by_test_id("stElementToolbarButton")).to_have_count(2)
