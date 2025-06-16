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

from __future__ import annotations

from typing import Any

import pytest
from playwright.sync_api import FrameLocator, Locator, Page, Route, expect

from e2e_playwright.conftest import IframedPage, ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import expect_prefixed_markdown, get_element_by_key
from e2e_playwright.shared.dataframe_utils import (
    calc_middle_cell_position,
    click_on_cell,
    expect_canvas_to_be_stable,
    expect_canvas_to_be_visible,
    get_open_cell_overlay,
    open_column_menu,
    retry_interaction,
    unfocus_dataframe,
)
from e2e_playwright.shared.react18_utils import (
    take_stable_snapshot,
    wait_for_react_stability,
)
from e2e_playwright.shared.toolbar_utils import (
    assert_fullscreen_toolbar_button_interactions,
)

# This test suite covers all interactions of dataframe & data_editor


def test_dataframe_toolbar_on_hover(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the toolbar is shown when hovering over a dataframe."""
    dataframe_element = themed_app.get_by_test_id("stDataFrame").nth(0)
    expect(dataframe_element).to_be_visible()
    dataframe_element.scroll_into_view_if_needed()

    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")
    expect(dataframe_toolbar).to_be_attached()

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
    expect(data_editor_element).to_be_visible()
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")
    expect(data_editor_toolbar).to_be_attached()

    # Ensure the canvas is stable before proceeding
    expect_canvas_to_be_stable(data_editor_element)

    # Check that it is currently not visible:
    expect(data_editor_toolbar).to_have_css("opacity", "0")

    # Hover over data editor:
    data_editor_element.hover()

    # Check that it is visible
    expect(data_editor_toolbar).to_have_css("opacity", "1")
    themed_app.wait_for_timeout(100)  # Brief wait for any animations to settle

    # Take a snapshot
    take_stable_snapshot(
        themed_app, data_editor_toolbar, assert_snapshot, name="st_data_editor-toolbar"
    )


# The snapshots are flaky on Firefox in CI.
@pytest.mark.skip_browser("firefox")
def test_data_editor_delete_row_via_toolbar(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a row can be deleted via the toolbar."""

    data_editor_element = themed_app.get_by_test_id("stDataFrame").nth(1)
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")

    # Ensure canvas is stable before any actions
    expect_canvas_to_be_stable(data_editor_element)

    # Select the second row
    data_editor_element.click(position={"x": 10, "y": 100})

    # Wait for the row to be selected
    themed_app.wait_for_timeout(100)

    # Take a snapshot to check if row is selected using stable snapshot:
    take_stable_snapshot(
        themed_app,
        data_editor_element,
        assert_snapshot,
        name="st_data_editor-selected_row_for_deletion",
    )
    expect(data_editor_element).to_have_css("height", "247px")

    # The toolbar should be locked (visible):
    expect(data_editor_toolbar).to_have_css("opacity", "1")
    # Take snapshot to check if trash icon is in toolbar:
    take_stable_snapshot(
        themed_app,
        data_editor_toolbar,
        assert_snapshot,
        name="st_data_editor-row_deletion_toolbar",
    )

    # Click row deletion button:
    delete_row_button = data_editor_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).get_by_label("Delete row(s)")
    delete_row_button.click()

    wait_for_react_stability(themed_app)
    # The height should reflect that one row is missing (247px-35px=212px):
    expect(data_editor_element).to_have_css("height", "212px")


def test_data_editor_delete_row_via_hotkey(app: Page):
    """Test that a row can be deleted via delete hotkey."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    expect(data_editor_element).to_have_css("height", "247px")

    # Select the second row
    data_editor_element.click(position={"x": 10, "y": 100})

    # Wait for the row to be selected
    app.wait_for_timeout(100)

    # Press backspace to delete row:
    data_editor_element.press("Delete")

    # The height should reflect that one row is missing (247px-35px=212px):
    expect(data_editor_element).to_have_css("height", "212px")


# The snapshots are flaky on Firefox in CI.
@pytest.mark.skip_browser("firefox")
def test_data_editor_add_row_via_toolbar(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a row can be added via the toolbar."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    expect_canvas_to_be_stable(data_editor_element)

    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")
    expect(data_editor_element).to_have_css("height", "247px")

    # Activate toolbar:
    data_editor_element.hover()
    # Check that it is visible
    expect(data_editor_toolbar).to_have_css("opacity", "1")

    # Click add row button:
    add_row_button = data_editor_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).get_by_label("Add row")
    add_row_button.click()
    wait_for_app_run(app)

    # The height should reflect that one row is added (247px+35px=282px):
    expect(data_editor_element).to_have_css("height", "282px")

    # Add six more rows:
    add_row_button.click()
    add_row_button.click()
    add_row_button.click()
    add_row_button.click()
    add_row_button.click()
    add_row_button.click()
    wait_for_app_run(app)

    # Take a snapshot to check if rows are added:
    unfocus_dataframe(app)
    take_stable_snapshot(
        app,
        data_editor_element,
        assert_snapshot,
        name="st_data_editor-added_rows_via_toolbar",
    )


def test_data_editor_add_row_via_trailing_row(app: Page):
    """Test that a row can be added by clicking on the trailing row."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    expect(data_editor_element).to_have_css("height", "247px")

    # Click on the trailing row:
    data_editor_element.click(position={"x": 40, "y": 220})

    # Wait for the row to be selected
    app.wait_for_timeout(100)

    # The height should reflect that one row is added (247px+35px=282px):
    expect(data_editor_element).to_have_css("height", "282px")


# Firefox seems to be unable to run this test. But I tested it manually
# to make sure that it works correctly.
@pytest.mark.skip_browser("firefox")
def test_dataframe_toolbar_on_toolbar_hover(app: Page):
    """Test that the toolbar is shown when hovering over the toolbar."""
    dataframe_element = app.get_by_test_id("stDataFrame").nth(0)
    expect(dataframe_element).to_be_visible()
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")
    expect(dataframe_toolbar).to_be_attached()

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
    expect(dataframe_element).to_be_visible()
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")
    expect(dataframe_toolbar).to_be_attached()
    search_toolbar_button = dataframe_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).get_by_label("Search")

    # Check that it is currently not visible:
    expect(dataframe_toolbar).to_have_css("opacity", "0")

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

    expect(themed_app.locator(".gdg-search-bar-inner")).to_be_visible()

    # Check that it is visible
    assert_snapshot(dataframe_element, name="st_dataframe-trigger_search_via_toolbar")

    # Check that the search bar is responsive and changes width when the data grid
    # width is changed:
    expect(themed_app.locator(".gdg-seveqep")).to_have_css("width", "304px")
    # Change screen size to a smaller width:
    themed_app.set_viewport_size({"width": 100, "height": 1000})
    expect(themed_app.locator(".gdg-seveqep")).to_have_css("width", "96px")


def test_open_search_via_hotkey(app: Page):
    """Test that the search can be opened via a hotkey."""
    dataframe_element = app.get_by_test_id("stDataFrame").nth(0)

    # Select a cell to focus the dataframe:
    click_on_cell(dataframe_element, 2, 3)

    # Press hotkey to open search:
    dataframe_element.press("Control+f")

    expect(app.locator(".gdg-search-bar-inner")).to_be_visible()


# The snapshots are flaky on Firefox in CI.
@pytest.mark.skip_browser("firefox")
def test_clicking_on_fullscreen_toolbar_button(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that clicking on fullscreen toolbar button expands the dataframe into
    fullscreen.
    """

    assert_fullscreen_toolbar_button_interactions(
        app,
        assert_snapshot=assert_snapshot,
        widget_test_id="stDataFrame",
        filename_prefix="st_dataframe",
        nth=4,
    )


def test_data_editor_keeps_state_after_unmounting(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the data editor keeps state correctly after unmounting."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    expect(data_editor_element).to_be_visible()
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")
    expect(data_editor_element).to_have_css("height", "247px")

    # Check that the toolbar is currently not visible:
    expect(data_editor_toolbar).to_have_css("opacity", "0")

    # Activate toolbar:
    data_editor_element.hover()
    # Check that it is visible
    expect(data_editor_toolbar).to_have_css("opacity", "1")

    # Click add row button:
    add_row_button = data_editor_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).get_by_label("Add row")
    add_row_button.click()

    # The height should reflect that one row is added (247px+35px=282px):
    expect(data_editor_element).to_have_css("height", "282px")
    # The added row will trigger a rerun after a bounce, so we need to wait
    # for the app to finish running before we unmount the component.
    wait_for_app_run(app, 500)

    # Click button to unmount the component:
    app.get_by_test_id("stButton").locator("button").click()
    wait_for_app_run(app, 4000)

    # Check the height again, the row should be still attached:
    expect(data_editor_element).to_have_css("height", "282px")

    # Take a screenshot after unmounting:
    assert_snapshot(
        data_editor_element,
        name="st_data_editor-after_unmounting",
    )


def _test_csv_download(
    page: Page,
    locator: FrameLocator | Locator,
    click_enter_on_file_picker: bool = False,
):
    dataframe_element = locator.get_by_test_id("stDataFrame").nth(0)
    expect(dataframe_element).to_be_visible()
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")
    expect(dataframe_toolbar).to_be_attached()

    download_csv_toolbar_button = dataframe_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).get_by_label("Download as CSV")

    # Check that the toolbar is currently not visible:
    expect(dataframe_toolbar).to_have_css("opacity", "0")

    # Activate toolbar:
    dataframe_element.scroll_into_view_if_needed()
    dataframe_element.hover()
    # Check that it is visible
    expect(dataframe_toolbar).to_have_css("opacity", "1")
    expect(download_csv_toolbar_button).to_be_visible()

    with page.expect_download(timeout=10000) as download_info:
        download_csv_toolbar_button.click()

        # playwright does not support all fileaccess APIs yet (see this
        # issue: https://github.com/microsoft/playwright/issues/8850) This means we
        # don't know if the system dialog opened to pick a location (expect_file_chooser
        # does not work). So as a workaround, we wait for now and then press enter.
        if click_enter_on_file_picker:
            page.wait_for_timeout(1000)
            page.keyboard.press("Enter")

    download = download_info.value
    download_path = download.path()
    with open(download_path, encoding="UTF-8") as f:
        content = f.read()
        # the app uses a fixed seed, so the data is always the same. This is the reason
        # why we can check it here.
        some_row = (
            "1,-0.977277879876411,0.9500884175255894,-0.1513572082976979,"
            "-0.10321885179355784,0.41059850193837233"
        )
        # we usually try to avoid assert in playwright tests, but since we don't have to
        # wait for any UI interaction or DOM state, it's ok here
        assert some_row in content


def test_csv_download_button(
    app: Page, browser_name: str, browser_type_launch_args: dict[str, Any]
):
    """Test that the csv download button works.

    Note that the library we are using calls the file picker API to download the file.
    This is not supported in headless mode. Hence, the test triggers different code
    paths in the app depending on the browser and the launch arguments.
    """

    click_enter_on_file_picker = False

    # right now the filechooser will only be opened on Chrome. Maybe this will change in
    # the future and the check has to be updated; or maybe playwright will support the
    # file-access APIs better. In headless mode, the file-access API our csv-download
    # button uses under-the-hood does not work. So we monkey-patch it to throw an error
    # and trigger our alternative download logic.
    if browser_name == "chromium":
        if browser_type_launch_args.get("headless", False):
            click_enter_on_file_picker = True
        else:
            app.evaluate(
                """() => window.showSaveFilePicker = () => {
                    throw new Error('Monkey-patched showOpenFilePicker')
                }""",
            )
    _test_csv_download(app, app.locator("body"), click_enter_on_file_picker)


@pytest.mark.flaky(reruns=4)
def test_csv_download_button_in_iframe(iframed_app: IframedPage):
    """Test that the csv download button works in an iframe.

    Based on the test behavior and the fact that we don't have to patch the
    'window.showSaveFilePicker' as in the test above, it seems that the fallback
    download method is used.
    """

    page: Page = iframed_app.page
    frame_locator: FrameLocator = iframed_app.open_app(None)

    _test_csv_download(page, frame_locator)


def test_csv_download_button_in_iframe_with_new_tab_host_config(
    iframed_app: IframedPage,
):
    """Test that the csv download button works in an iframe and the host-config enforced
    download in new tab.

    Based on the test behavior and the fact that we don't have to patch the
    'window.showSaveFilePicker' as in the test above,
    it seems that the fallback download method is used.
    If this ever changes, the host-config[enforceDownloadInNewTab] might not take any
    effect as it is only used in the fallback mechanism.
    """
    page: Page = iframed_app.page

    def fulfill_host_config_request(route: Route):
        response = route.fetch()
        result = response.json()
        result["enforceDownloadInNewTab"] = True
        route.fulfill(json=result)

    page.route("**/_stcore/host-config", fulfill_host_config_request)

    # ensure that the route interception works and we get the correct
    # enforceDownloadInNewTab config
    with page.expect_event(
        "response",
        lambda response: response.url.endswith("_stcore/host-config")
        and response.json()["enforceDownloadInNewTab"] is True,
        timeout=10000,
    ):
        frame_locator: FrameLocator = iframed_app.open_app(None)
        _test_csv_download(page, frame_locator)


def test_number_cell_read_only_overlay_formatting(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the number cell overlay is formatted correctly."""
    overlay_test_df = themed_app.get_by_test_id("stDataFrame").nth(2)
    expect_canvas_to_be_visible(overlay_test_df)
    # Click on the first cell of the table
    click_on_cell(overlay_test_df, 1, 0, double_click=True, column_width="medium")
    cell_overlay = get_open_cell_overlay(themed_app)
    # Get the (number) input element and check the value
    expect(cell_overlay.locator(".gdg-input")).to_have_attribute("value", "1231231.41")
    assert_snapshot(cell_overlay, name="st_dataframe-number_col_overlay")


def _test_number_cell_editing(
    themed_app: Page,
    assert_snapshot: ImageCompareFunction,
    *,
    skip_snapshot: bool = False,
):
    """Test that the number cell can be edited."""
    cell_overlay_test_df = themed_app.get_by_test_id("stDataFrame").nth(3)
    expect_canvas_to_be_visible(cell_overlay_test_df)

    # Click on the first cell of the table
    click_on_cell(cell_overlay_test_df, 1, 0, double_click=True, column_width="medium")
    cell_overlay = get_open_cell_overlay(themed_app)
    # On some browsers the cell content is highlighted, so we enforce it to make the
    # test consistent and stable across all browsers
    cell_overlay.click()
    cell_overlay.press("ControlOrMeta+A")

    # Get the (number) input element and check the value
    expect(cell_overlay.locator(".gdg-input")).to_have_attribute("value", "1231231.41")
    if not skip_snapshot:
        assert_snapshot(cell_overlay, name="st_data_editor-number_col_editor")

    # Change the value
    cell_overlay.locator(".gdg-input").fill("9876.54")
    # Press Enter to apply the change
    themed_app.keyboard.press("Enter")
    wait_for_app_run(themed_app)

    # Check if that the value was submitted
    expect_prefixed_markdown(themed_app, "Edited DF:", "9876.54", exact_match=False)


def test_number_cell_editing(themed_app: Page, assert_snapshot: ImageCompareFunction):
    _test_number_cell_editing(themed_app, assert_snapshot)


@pytest.mark.performance
def test_number_cell_editing_performance(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the number cell can be edited."""
    _test_number_cell_editing(app, assert_snapshot, skip_snapshot=True)


def test_text_cell_read_only_overlay_formatting(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the text cell overlay is formatted correctly."""
    overlay_test_df = themed_app.get_by_test_id("stDataFrame").nth(2)
    expect_canvas_to_be_visible(overlay_test_df)

    # Click on the first cell of the table
    click_on_cell(overlay_test_df, 1, 1, double_click=True, column_width="medium")
    cell_overlay = get_open_cell_overlay(themed_app)

    # Get the (text) input element and check the value
    expect(cell_overlay.locator(".gdg-input")).to_have_text("hello\nworld")
    assert_snapshot(cell_overlay, name="st_dataframe-text_col_overlay")


def test_text_cell_editing(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the number cell can be edited."""
    cell_overlay_test_df = themed_app.get_by_test_id("stDataFrame").nth(3)
    expect_canvas_to_be_visible(cell_overlay_test_df)

    # Click on the first cell of the table
    click_on_cell(cell_overlay_test_df, 1, 1, double_click=True, column_width="medium")
    cell_overlay = get_open_cell_overlay(themed_app)

    # On some browsers the cell content is highlighted, so we enforce it to make the
    # test consistent and stable across all browsers
    cell_overlay.click()
    cell_overlay.press("ControlOrMeta+A")
    # Get the (number) input element and check the value
    expect(cell_overlay.locator(".gdg-input")).to_have_text("hello\nworld")
    assert_snapshot(cell_overlay, name="st_data_editor-text_col_editor")

    # Change the value
    cell_overlay.locator(".gdg-input").fill("edited value")
    # Press Enter to apply the change
    themed_app.keyboard.press("Enter")
    wait_for_app_run(themed_app)

    # Check if that the value was submitted
    expect_prefixed_markdown(
        themed_app, "Edited DF:", "edited value", exact_match=False
    )


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "data_editor")).to_be_visible()


# Skipping because the test is flaky on webkit. I validated it manually in
# Safari and it works as expected. Getting automated validation in Chromium +
# Firefox should be enough.
@pytest.mark.skip_browser("webkit")
def test_column_reorder_via_ui(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that columns can be reordered via drag and drop on the UI."""
    dataframe_element = app.get_by_test_id("stDataFrame").nth(0)
    expect_canvas_to_be_stable(dataframe_element)

    # 1. Move Column A behind Column C:

    # Calculate positions for source (Column A) and target (Column C) headers
    source_x, source_y = calc_middle_cell_position(0, 1, "small")  # Column A header
    target_x, target_y = calc_middle_cell_position(0, 3, "small")  # Column C header

    # Perform drag and drop using drag_to
    dataframe_element.drag_to(
        dataframe_element,
        source_position={"x": source_x, "y": source_y},
        target_position={"x": target_x, "y": target_y},
    )

    wait_for_react_stability(app)
    expect_canvas_to_be_stable(dataframe_element)

    # 2. Move Column D in front of the index column:
    # This also tests that column D should get pinned since it is moved before a
    # pinned column (index column). This is visible via the grey text color.

    # Calculate positions for source (Column D) and target (Index column) headers
    source_x, source_y = calc_middle_cell_position(0, 4, "small")  # Column D header
    target_x, target_y = calc_middle_cell_position(0, 0, "small")  # Index column header

    # Perform drag and drop using drag_to
    dataframe_element.drag_to(
        dataframe_element,
        source_position={"x": source_x, "y": source_y},
        target_position={"x": target_x, "y": target_y},
    )

    expect_canvas_to_be_stable(dataframe_element)
    # Verify column order changed by taking a screenshot
    take_stable_snapshot(
        app,
        dataframe_element,
        assert_snapshot,
        name="st_dataframe-reorder_columns_via_ui",
    )


def test_row_hover_highlight(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that a row gets highlighted when hovering over a cell in the row."""
    df = themed_app.get_by_test_id("stDataFrame").nth(0)
    expect_canvas_to_be_visible(df)
    column_middle_width_px, row_middle_height_px = calc_middle_cell_position(
        2, 2, "small"
    )
    df.hover(position={"x": column_middle_width_px, "y": row_middle_height_px})

    assert_snapshot(df, name="st_dataframe-row_hover_highlight")


def test_autosize_column_via_ui(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that a column can be autosized via the UI via the column menu."""
    df = app.get_by_test_id("stDataFrame").nth(0)
    expect_canvas_to_be_visible(df)

    initial_canvas_bounding_box = df.locator("canvas").first.bounding_box()
    assert initial_canvas_bounding_box is not None

    # Open the column menu of the index column and autosize the column:
    open_column_menu(df, 0, "small")
    app.get_by_test_id("stDataFrameColumnMenu").get_by_text("Autosize").click()
    unfocus_dataframe(app)
    # Take a screenshot of the dataframe with the autosized column:
    assert_snapshot(df, name="st_dataframe-autosized_column")

    autosized_canvas_bounding_box = df.locator("canvas").first.bounding_box()
    assert autosized_canvas_bounding_box is not None
    # Ensure that the new bounding box is smaller than the initial bounding box
    assert initial_canvas_bounding_box["width"] > autosized_canvas_bounding_box["width"]


def test_sorting_column_via_ui(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that a column can be sorted via the UI by clicking on the column
    header and via the column menu.
    """
    df = app.get_by_test_id("stDataFrame").nth(0)
    expect_canvas_to_be_stable(df)

    unfocus_dataframe(app)
    take_stable_snapshot(app, df, assert_snapshot, name="st_dataframe-no_sorting")

    # Click on the column header to sort in ascending order:
    click_on_cell(df, 0, 2, column_width="small", wait_after_ms=500)
    unfocus_dataframe(app)
    take_stable_snapshot(app, df, assert_snapshot, name="st_dataframe-sorted_ascending")

    # Click on the column header again to sort in descending order:
    click_on_cell(df, 0, 2, column_width="small", wait_after_ms=500)
    unfocus_dataframe(app)
    take_stable_snapshot(
        app, df, assert_snapshot, name="st_dataframe-sorted_descending"
    )

    # Click on the column header again to remove sorting:
    click_on_cell(df, 0, 2, column_width="small", wait_after_ms=500)
    unfocus_dataframe(app)
    take_stable_snapshot(app, df, assert_snapshot, name="st_dataframe-no_sorting")

    # Open the column menu and sort in ascending order:
    def open_menu_and_click_sort_asc():
        open_column_menu(df, 2, "small")
        app.get_by_test_id("stDataFrameColumnMenu").get_by_text(
            "Sort ascending"
        ).click()

    retry_interaction(open_menu_and_click_sort_asc)
    unfocus_dataframe(app)
    take_stable_snapshot(app, df, assert_snapshot, name="st_dataframe-sorted_ascending")

    # Open the column menu and sort in descending order:
    def open_menu_and_click_sort_desc():
        open_column_menu(df, 2, "small")
        app.get_by_test_id("stDataFrameColumnMenu").get_by_text(
            "Sort descending"
        ).click()

    retry_interaction(open_menu_and_click_sort_desc)
    unfocus_dataframe(app)
    take_stable_snapshot(
        app, df, assert_snapshot, name="st_dataframe-sorted_descending"
    )

    # Remove sorting by clicking again on the column header:
    def open_menu_and_click_sort_none():
        open_column_menu(df, 2, "small")
        app.get_by_test_id("stDataFrameColumnMenu").get_by_text(
            "Sort descending"
        ).click()

    retry_interaction(open_menu_and_click_sort_none)
    unfocus_dataframe(app)
    take_stable_snapshot(app, df, assert_snapshot, name="st_dataframe-no_sorting")


def test_opening_column_menu(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the column menu can be opened."""
    df = (
        get_element_by_key(themed_app, "column-menu-test")
        .get_by_test_id("stDataFrame")
        .first
    )
    expect_canvas_to_be_visible(df)

    open_column_menu(df, 2, "small")
    expect(themed_app.get_by_test_id("stDataFrameColumnMenu")).to_be_visible()
    assert_snapshot(df, name="st_dataframe-column_menu")


def test_column_hiding_via_column_menu(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a column can be hidden via the column menu."""
    df_element = (
        get_element_by_key(app, "column-menu-test").get_by_test_id("stDataFrame").first
    )
    expect_canvas_to_be_visible(df_element)
    open_column_menu(df_element, 2, "small")
    expect(app.get_by_test_id("stDataFrameColumnMenu")).to_be_visible()
    app.get_by_test_id("stDataFrameColumnMenu").get_by_text("Hide column").click()
    unfocus_dataframe(app)
    # The column menu should be closed after hiding a column:
    expect(app.get_by_test_id("stDataFrameColumnMenu")).not_to_be_visible()
    assert_snapshot(df_element, name="st_dataframe-column_hidden_via_column_menu")


def test_column_hiding_via_visibility_menu(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a column can be hidden via the visibility menu."""
    df_element = (
        get_element_by_key(app, "column-menu-test").get_by_test_id("stDataFrame").first
    )
    expect_canvas_to_be_visible(df_element)

    df_toolbar = df_element.get_by_test_id("stElementToolbar")
    expect(df_toolbar).to_be_attached()
    expect(df_toolbar).to_have_css("opacity", "0")

    # Open toolbar:
    df_element.hover()
    expect(df_toolbar).to_have_css("opacity", "1")
    # Open columns visibility menu:
    open_visibility_menu_button = df_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).get_by_label("Show/hide columns")
    expect(open_visibility_menu_button).to_be_visible()
    open_visibility_menu_button.click()
    column_visibility_menu = app.get_by_test_id("stDataFrameColumnVisibilityMenu")
    expect(column_visibility_menu).to_be_visible()

    # Make a screenshot of the column visibility menu:
    assert_snapshot(column_visibility_menu, name="st_dataframe-column_visibility_menu")

    # Hide Column A:
    column_visibility_menu.get_by_text("Column A").click()
    unfocus_dataframe(app)
    assert_snapshot(df_element, name="st_dataframe-column_hidden_via_visibility_menu")


def test_column_pinning_via_ui(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that a column can be pinned via the column menu."""

    df = app.get_by_test_id("stDataFrame").nth(0)
    expect_canvas_to_be_visible(df)

    unfocus_dataframe(app)
    assert_snapshot(df, name="st_dataframe-column_unpinned")

    open_column_menu(df, 2, "small")
    app.get_by_test_id("stDataFrameColumnMenu").get_by_text("Pin column").click()
    unfocus_dataframe(app)
    assert_snapshot(df, name="st_dataframe-column_pinned")

    open_column_menu(df, 1, "small")
    app.get_by_test_id("stDataFrameColumnMenu").get_by_text("Unpin column").click()
    unfocus_dataframe(app)
    assert_snapshot(df, name="st_dataframe-column_unpinned")


# TODO(lukasmasuch): Add additional interactive tests:
# - Copy data to clipboard
# - Paste in data
