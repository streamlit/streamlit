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

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    expect_font,
    reset_hovering,
)
from e2e_playwright.shared.dataframe_utils import (
    click_on_cell,
    expect_canvas_to_be_stable,
    expect_canvas_to_be_visible,
    get_open_cell_overlay,
    open_column_menu,
)


def test_dataframe_supports_various_configurations(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Screenshot test that st.dataframe supports various configuration options."""
    dataframe_elements = themed_app.get_by_test_id("stDataFrame")
    expect(dataframe_elements).to_have_count(30)
    # Wait for material icons font to be loaded for more stable tests:
    expect_font(themed_app, "Material Symbols Rounded")

    # The dataframe component might require a bit more time for rendering the canvas
    themed_app.wait_for_timeout(250)

    assert_snapshot(dataframe_elements.nth(0), name="st_dataframe-hide_index")
    assert_snapshot(dataframe_elements.nth(1), name="st_dataframe-show_index")
    assert_snapshot(dataframe_elements.nth(2), name="st_dataframe-custom_column_order")
    assert_snapshot(dataframe_elements.nth(3), name="st_dataframe-column_labels")
    assert_snapshot(dataframe_elements.nth(4), name="st_dataframe-hide_columns")
    assert_snapshot(dataframe_elements.nth(5), name="st_dataframe-set_column_width")
    assert_snapshot(dataframe_elements.nth(6), name="st_dataframe-help_tooltips")
    assert_snapshot(dataframe_elements.nth(7), name="st_dataframe-ignore_edit_options")
    assert_snapshot(dataframe_elements.nth(8), name="st_dataframe-text_column")
    assert_snapshot(dataframe_elements.nth(9), name="st_dataframe-number_column")
    assert_snapshot(dataframe_elements.nth(10), name="st_dataframe-checkbox_column")
    assert_snapshot(dataframe_elements.nth(11), name="st_dataframe-selectbox_column")

    assert_snapshot(dataframe_elements.nth(12), name="st_dataframe-link_column")
    assert_snapshot(dataframe_elements.nth(13), name="st_dataframe-datetime_column")
    assert_snapshot(dataframe_elements.nth(14), name="st_dataframe-date_column")
    assert_snapshot(dataframe_elements.nth(15), name="st_dataframe-time_column")
    assert_snapshot(dataframe_elements.nth(16), name="st_dataframe-progress_column")
    assert_snapshot(dataframe_elements.nth(17), name="st_dataframe-list_column")
    assert_snapshot(dataframe_elements.nth(18), name="st_dataframe-bar_chart_column")
    assert_snapshot(dataframe_elements.nth(19), name="st_dataframe-line_chart_column")
    assert_snapshot(dataframe_elements.nth(20), name="st_dataframe-area_chart_column")
    assert_snapshot(dataframe_elements.nth(21), name="st_dataframe-image_column")
    assert_snapshot(dataframe_elements.nth(22), name="st_dataframe-auto_sized_columns")
    assert_snapshot(
        dataframe_elements.nth(23), name="st_dataframe-hierarchical_headers"
    )

    # The pinned columns webkit snapshot is a bit flaky (vertical scrollbar is sometimes visible)
    # And needs a bit of extra handling:
    dataframe_elements.nth(23).scroll_into_view_if_needed()
    expect_canvas_to_be_stable(dataframe_elements.nth(23))
    assert_snapshot(dataframe_elements.nth(24), name="st_dataframe-pinned_columns")

    assert_snapshot(dataframe_elements.nth(25), name="st_dataframe-row_height")
    assert_snapshot(dataframe_elements.nth(26), name="st_dataframe-number_formatting")
    assert_snapshot(dataframe_elements.nth(27), name="st_dataframe-datetime_formatting")
    assert_snapshot(dataframe_elements.nth(28), name="st_dataframe-json_column")
    # 29th is the localized date/number formatting test - screenshot taken separately
    # below so that the set locale doesn't impact other tests/screenshots


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stDataFrame")


def _open_json_cell_overlay(
    dataframe_element: Locator, row: int, column: int
) -> Locator:
    page = dataframe_element.page
    # Close other overlays:
    page.keyboard.press("Escape")
    # Click on the first cell of the dict column
    click_on_cell(
        dataframe_element, row, column, double_click=True, column_width="medium"
    )
    cell_overlay = get_open_cell_overlay(page)
    expect(cell_overlay.get_by_test_id("stJsonColumnViewer")).to_be_visible()
    # Reset the hovering to ensure that there aren't unexpected UI elements visible
    reset_hovering(page)
    return cell_overlay


@pytest.mark.skip(
    reason="Flaky when running locally and in CI due to the reset_hovering function"
)
def test_json_cell_overlay(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the JSON cell overlay works correctly."""
    dataframe_element = themed_app.get_by_test_id("stDataFrame").nth(28)
    expect_canvas_to_be_visible(dataframe_element)
    dataframe_element.scroll_into_view_if_needed()

    # Click on the first cell of the dict column
    cell_overlay = _open_json_cell_overlay(dataframe_element, 1, 0)
    assert_snapshot(cell_overlay, name="st_dataframe-json_column_overlay_dict")

    # Click on the first cell of the string json column
    cell_overlay = _open_json_cell_overlay(dataframe_element, 1, 1)
    assert_snapshot(cell_overlay, name="st_dataframe-json_column_overlay_string_json")

    # Click on the first cell of the list column
    cell_overlay = _open_json_cell_overlay(dataframe_element, 1, 2)
    assert_snapshot(cell_overlay, name="st_dataframe-json_column_overlay_list")

    # Click on the first cell of the string list column
    cell_overlay = _open_json_cell_overlay(dataframe_element, 1, 3)
    assert_snapshot(cell_overlay, name="st_dataframe-json_column_overlay_string_list")

    # Click on the first cell of the incompatible values column
    themed_app.keyboard.press("Escape")
    # Click on the first cell of the dict column
    click_on_cell(dataframe_element, 1, 4, double_click=True, column_width="medium")
    cell_overlay = get_open_cell_overlay(themed_app)
    # It should not use the json viewer:
    expect(cell_overlay.get_by_test_id("stJsonColumnViewer")).not_to_be_attached()
    assert_snapshot(
        cell_overlay, name="st_dataframe-json_column_overlay_incompatible_values"
    )


def test_list_cell_overlay(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the list cell overlay works correctly."""
    dataframe_element = themed_app.get_by_test_id("stDataFrame").nth(17)
    expect_canvas_to_be_visible(dataframe_element)
    dataframe_element.scroll_into_view_if_needed()

    # Click on the first cell of the list column
    click_on_cell(dataframe_element, 1, 1, double_click=True, column_width="medium")

    cell_overlay = get_open_cell_overlay(themed_app)
    assert_snapshot(cell_overlay, name="st_dataframe-list_column_overlay")


def test_number_column_formatting_via_ui(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the column formatting works correctly."""
    number_col_df = app.get_by_test_id("stDataFrame").nth(9)

    expect_canvas_to_be_visible(number_col_df)

    # Open the column menu:
    open_column_menu(number_col_df, 0, column_width="medium")
    # Hover on the format option:
    app.get_by_test_id("stDataFrameColumnMenu").get_by_text("Format").click()
    formatting_menu = app.get_by_test_id("stDataFrameColumnFormattingMenu")
    expect(formatting_menu).to_be_visible()
    assert_snapshot(formatting_menu, name="st_dataframe-number_column_formatting_menu")
    # Click on the dollar format option:
    expect(formatting_menu.get_by_text("Dollar")).to_be_visible()
    formatting_menu.get_by_text("Dollar").click()
    # Add a quick timeout to wait for the column to be adjusted/autosized before
    # taking a snapshot:
    app.wait_for_timeout(250)
    expect_canvas_to_be_stable(number_col_df)
    assert_snapshot(number_col_df, name="st_dataframe-number_column_format_changed")


def test_progress_column_formatting_via_ui(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the progress column formatting works correctly."""
    progress_col_df = app.get_by_test_id("stDataFrame").nth(16)
    expect_canvas_to_be_visible(progress_col_df)

    # Open the column menu:
    open_column_menu(progress_col_df, 0, column_width="medium")
    # Hover on the format option:
    app.get_by_test_id("stDataFrameColumnMenu").get_by_text("Format").click()
    formatting_menu = app.get_by_test_id("stDataFrameColumnFormattingMenu")
    expect(formatting_menu).to_be_visible()
    assert_snapshot(
        formatting_menu, name="st_dataframe-progress_column_formatting_menu"
    )
    # Click on the percent format option:
    formatting_menu.get_by_text("Dollar").click()
    # Add a quick timeout to wait for the column to be adjusted/autosized before
    # taking a snapshot:
    app.wait_for_timeout(250)
    expect_canvas_to_be_stable(progress_col_df)
    assert_snapshot(progress_col_df, name="st_dataframe-progress_column_format_changed")


# Seeing some flakiness with firefox, so skip until can be debugged.
@pytest.mark.skip_browser("firefox")
def test_datetime_column_formatting_via_ui(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the datetime column formatting works correctly."""
    datetime_col_df = app.get_by_test_id("stDataFrame").nth(13)
    expect_canvas_to_be_visible(datetime_col_df)

    # Open the column menu:
    open_column_menu(datetime_col_df, 0, column_width="medium")
    # Hover on the format option:
    app.get_by_test_id("stDataFrameColumnMenu").get_by_text("Format").click()
    formatting_menu = app.get_by_test_id("stDataFrameColumnFormattingMenu")
    expect(formatting_menu).to_be_visible()
    assert_snapshot(
        formatting_menu, name="st_dataframe-datetime_column_formatting_menu"
    )
    # Click on the date format option:
    formatting_menu.get_by_text("Calendar").click()
    # Add a quick timeout to wait for the column to be adjusted/autosized before
    # taking a snapshot:
    app.wait_for_timeout(250)
    expect_canvas_to_be_stable(datetime_col_df)
    assert_snapshot(datetime_col_df, name="st_dataframe-datetime_column_format_changed")


def test_time_column_formatting_via_ui(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the time column formatting works correctly."""
    time_col_df = app.get_by_test_id("stDataFrame").nth(14)
    expect_canvas_to_be_visible(time_col_df)

    # Open the column menu:
    open_column_menu(time_col_df, 0, column_width="medium")

    # Hover on the format option:
    app.get_by_test_id("stDataFrameColumnMenu").get_by_text("Format").click()
    formatting_menu = app.get_by_test_id("stDataFrameColumnFormattingMenu")
    expect(formatting_menu).to_be_visible()
    assert_snapshot(formatting_menu, name="st_dataframe-time_column_formatting_menu")
    # Click on the time format option:
    formatting_menu.get_by_text("Localized").click()
    # Add a quick timeout to wait for the column to be adjusted/autosized before
    # taking a snapshot:
    app.wait_for_timeout(250)
    expect_canvas_to_be_stable(time_col_df)
    assert_snapshot(time_col_df, name="st_dataframe-time_column_format_changed")


# Seeing some flakiness with firefox, so skip until can be debugged.
@pytest.mark.skip_browser("firefox")
def test_date_column_formatting_via_ui(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the date column formatting works correctly."""
    date_col_df = app.get_by_test_id("stDataFrame").nth(14)
    expect_canvas_to_be_visible(date_col_df)

    # Open the column menu:
    open_column_menu(date_col_df, 0, column_width="medium")

    # Hover on the format option:
    app.get_by_test_id("stDataFrameColumnMenu").get_by_text("Format").click()
    formatting_menu = app.get_by_test_id("stDataFrameColumnFormattingMenu")
    expect(formatting_menu).to_be_visible()
    assert_snapshot(formatting_menu, name="st_dataframe-date_column_formatting_menu")
    # Click on the date format option:
    formatting_menu.get_by_text("Localized").click()
    # Add a quick timeout to wait for the column to be adjusted/autosized before
    # taking a snapshot:
    app.wait_for_timeout(250)
    expect_canvas_to_be_stable(date_col_df)
    assert_snapshot(date_col_df, name="st_dataframe-date_column_format_changed")


def test_changing_column_order_from_code_updates_ui(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that changing the column order from code updates the UI correctly."""
    dataframe_element = app.get_by_test_id("stDataFrame").nth(2)
    expect_canvas_to_be_visible(dataframe_element)
    click_button(app, "Change column order")

    expect_canvas_to_be_stable(dataframe_element)
    # Verify that the column order has changed:
    assert_snapshot(dataframe_element, name="st_dataframe-column_order_changed")


# Issue #11291 - st.column_config 'localized' option
@pytest.mark.browser_context_args(locale="pt-BR")
# Seeing some flakiness with firefox, so skip until can be debugged.
@pytest.mark.skip_browser("firefox")
def test_localized_date_and_number_formatting(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the localized date and number formatting works correctly."""
    dataframe_element = app.get_by_test_id("stDataFrame").nth(29)
    expect_canvas_to_be_visible(dataframe_element)
    assert_snapshot(
        dataframe_element, name="st_dataframe-localized_date_and_number_formatting"
    )
