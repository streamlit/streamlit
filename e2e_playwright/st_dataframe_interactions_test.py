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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction

# This test suite covers all interactions of dataframe & data_editor


def test_dataframe_toolbar_on_hover(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the toolbar is shown when hovering over a dataframe."""
    dataframe_element = themed_app.get_by_test_id("stDataFrame").nth(0)
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")

    # Check that it is currently not visible:
    expect(dataframe_toolbar).to_have_css("opacity", "0")

    # Hover over dataframe
    dataframe_element.hover()

    # Check that it is visible
    expect(dataframe_toolbar).to_have_css("opacity", "1")

    # Take a snapshot
    assert_snapshot(dataframe_toolbar, name="st_dataframe-toolbar")


def test_data_editor_toolbar_on_hover(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the toolbar is shown when hovering over a data editor component."""
    data_editor_element = themed_app.get_by_test_id("stDataFrame").nth(1)
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")

    # Check that it is currently not visible:
    expect(data_editor_toolbar).to_have_css("opacity", "0")

    # Hover over data editor:
    data_editor_element.hover()

    # Check that it is visible
    expect(data_editor_toolbar).to_have_css("opacity", "1")

    # Take a snapshot
    assert_snapshot(data_editor_toolbar, name="st_data_editor-toolbar")


def test_data_editor_delete_row_via_toolbar(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a row can be deleted via the toolbar."""
    data_editor_element = themed_app.get_by_test_id("stDataFrame").nth(1)
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")

    # Select the second row
    data_editor_element.click(position={"x": 10, "y": 100})
    # Take a snapshot to check if row is selected:
    assert_snapshot(
        data_editor_element, name="st_data_editor-selected_row_for_deletion"
    )
    expect(data_editor_element).to_have_css("height", "248px")

    # The toolbar should be locked (visible):
    expect(data_editor_toolbar).to_have_css("opacity", "1")
    # Take snapshot to check if trash icon is in toolbar:
    assert_snapshot(data_editor_toolbar, name="st_data_editor-row_deletion_toolbar")

    # Click row deletion button:
    delete_row_button = data_editor_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).nth(0)
    delete_row_button.click()
    # The height should reflect that one row is missing (248px-35px=213px):
    expect(data_editor_element).to_have_css("height", "213px")


def test_data_editor_delete_row_via_hotkey(app: Page):
    """Test that a row can be deleted via delete hotkey."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    expect(data_editor_element).to_have_css("height", "248px")

    # Select the second row
    data_editor_element.click(position={"x": 10, "y": 100})

    # Press backspace to delete row:
    data_editor_element.press("Delete")

    # The height should reflect that one row is missing (248px-35px=213px):
    expect(data_editor_element).to_have_css("height", "213px")


def test_data_editor_add_row_via_toolbar(app: Page):
    """Test that a row can be added via the toolbar."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")
    expect(data_editor_element).to_have_css("height", "248px")

    # Activate toolbar:
    data_editor_element.hover()
    # Check that it is visible
    expect(data_editor_toolbar).to_have_css("opacity", "1")

    # Click add row button:
    add_row_button = data_editor_toolbar.get_by_test_id("stElementToolbarButton").nth(0)
    add_row_button.click()

    # The height should reflect that one row is added (248px+35px=283px):
    expect(data_editor_element).to_have_css("height", "283px")


def test_data_editor_add_row_via_trailing_row(app: Page):
    """Test that a row can be added by clicking on the trailing row."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    expect(data_editor_element).to_have_css("height", "248px")

    # Click on the trailing row:
    data_editor_element.click(position={"x": 40, "y": 220})

    # The height should reflect that one row is added (248px+35px=283px):
    expect(data_editor_element).to_have_css("height", "283px")


# Firefox seems to be unable to run this test. But I tested it manually
# to make sure that it works correctly.
@pytest.mark.skip_browser("firefox")
def test_dataframe_toolbar_on_toolbar_hover(app: Page):
    """Test that the toolbar is shown when hovering over the toolbar."""
    dataframe_element = app.get_by_test_id("stDataFrame").nth(0)
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")

    # Check that it is currently not visible:
    expect(dataframe_toolbar).to_have_css("opacity", "0")

    # Hover over dataframe toolbar itself (which is position)
    dataframe_toolbar.hover(force=True, position={"x": 0, "y": 0})

    # Check that it is visible
    expect(dataframe_toolbar).to_have_css("opacity", "1")


def test_open_search_via_toolbar(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that clicking on search toolbar button triggers dataframe search."""
    dataframe_element = themed_app.get_by_test_id("stDataFrame").nth(0)
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")
    search_toolbar_button = dataframe_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).nth(1)

    # Activate toolbar:
    dataframe_element.hover()
    # Check that it is visible
    expect(dataframe_toolbar).to_have_css("opacity", "1")

    # Hover search icon:
    search_toolbar_button.hover()
    # Test if tooltip works:
    expect(themed_app.get_by_test_id("stTooltipContent")).to_have_text("Search")
    # Take a screenshot to capture hover effect:
    assert_snapshot(dataframe_toolbar, name="st_dataframe-toolbar_hover_search")

    # Click on search button:
    search_toolbar_button.click()

    # Check that it is visible
    assert_snapshot(dataframe_element, name="st_dataframe-trigger_search_via_toolbar")


def test_open_search_via_hotkey(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the search can be opened via a hotkey."""
    dataframe_element = app.get_by_test_id("stDataFrame").nth(0)

    # Press hotkey to open search:
    dataframe_element.press("Control+F")

    # Check that the search is visible:
    assert_snapshot(dataframe_element, name="st_dataframe-trigger_search_via_hotkey")


def test_clicking_on_fullscreen_toolbar_button(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that clicking on fullscreen toolbar button expands the dataframe into fullscreen."""

    dataframe_element = app.get_by_test_id("stDataFrame").nth(0)
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")
    fullscreen_wrapper = app.get_by_test_id("stFullScreenFrame").nth(0)

    fullscreen_toolbar_button = dataframe_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).nth(2)

    # Activate toolbar:
    dataframe_element.hover()
    # Check that it is visible
    expect(dataframe_toolbar).to_have_css("opacity", "1")

    # Click on expand to fullscreen button:
    fullscreen_toolbar_button.click()

    # Check that it is visible
    assert_snapshot(
        fullscreen_wrapper,
        name="st_dataframe-fullscreen_expanded",
    )

    # Click again on fullscreen button to close fullscreen mode:
    fullscreen_toolbar_button.click()
    assert_snapshot(
        fullscreen_wrapper,
        name="st_dataframe-fullscreen_collapsed",
    )


# TODO(lukasmasuch): Add additional interactive tests:
# - Selecting a cell
# - Opening a cell
# - Applying a cell edit
# - Copy data to clipboard
# - Paste in data
# - Download data via toolbar: I wasn't able to find out how to detect the
#   showSaveFilePicker the filechooser doesn't work.
