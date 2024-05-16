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
from playwright.sync_api import FrameLocator, Locator, Page, Route, expect

from e2e_playwright.conftest import IframedPage, ImageCompareFunction, wait_for_app_run

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
    expect(data_editor_element).to_have_css("height", "247px")

    # The toolbar should be locked (visible):
    expect(data_editor_toolbar).to_have_css("opacity", "1")
    # Take snapshot to check if trash icon is in toolbar:
    assert_snapshot(data_editor_toolbar, name="st_data_editor-row_deletion_toolbar")

    # Click row deletion button:
    delete_row_button = data_editor_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).nth(0)
    delete_row_button.click()
    # The height should reflect that one row is missing (247px-35px=212px):
    expect(data_editor_element).to_have_css("height", "212px")


def test_data_editor_delete_row_via_hotkey(app: Page):
    """Test that a row can be deleted via delete hotkey."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    expect(data_editor_element).to_have_css("height", "247px")

    # Select the second row
    data_editor_element.click(position={"x": 10, "y": 100})

    # Press backspace to delete row:
    data_editor_element.press("Delete")

    # The height should reflect that one row is missing (247px-35px=212px):
    expect(data_editor_element).to_have_css("height", "212px")


def test_data_editor_add_row_via_toolbar(app: Page):
    """Test that a row can be added via the toolbar."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")
    expect(data_editor_element).to_have_css("height", "247px")

    # Activate toolbar:
    data_editor_element.hover()
    # Check that it is visible
    expect(data_editor_toolbar).to_have_css("opacity", "1")

    # Click add row button:
    add_row_button = data_editor_toolbar.get_by_test_id("stElementToolbarButton").nth(0)
    add_row_button.click()

    # The height should reflect that one row is added (247px+35px=282px):
    expect(data_editor_element).to_have_css("height", "282px")


def test_data_editor_add_row_via_trailing_row(app: Page):
    """Test that a row can be added by clicking on the trailing row."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    expect(data_editor_element).to_have_css("height", "247px")

    # Click on the trailing row:
    data_editor_element.click(position={"x": 40, "y": 220})

    # The height should reflect that one row is added (247px+35px=282px):
    expect(data_editor_element).to_have_css("height", "282px")


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
    ).last

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


def test_data_editor_keeps_state_after_unmounting(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the data editor keeps state correctly after unmounting."""
    data_editor_element = app.get_by_test_id("stDataFrame").nth(1)
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")
    expect(data_editor_element).to_have_css("height", "247px")

    # Activate toolbar:
    data_editor_element.hover()
    # Check that it is visible
    expect(data_editor_toolbar).to_have_css("opacity", "1")

    # Click add row button:
    add_row_button = data_editor_toolbar.get_by_test_id("stElementToolbarButton").nth(0)
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
    dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")

    download_csv_toolbar_button = dataframe_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).first

    # Activate toolbar:
    dataframe_element.hover()
    # Check that it is visible
    expect(dataframe_toolbar).to_have_css("opacity", "1")

    with page.expect_download(timeout=10000) as download_info:
        download_csv_toolbar_button.click()

        # playwright does not support all fileaccess APIs yet (see this issue: https://github.com/microsoft/playwright/issues/8850)
        # this means we don't know if the system dialog opened to pick a location (expect_file_chooser does not work). So as a workaround, we wait for now and then press enter.
        if click_enter_on_file_picker:
            page.wait_for_timeout(1000)
            page.keyboard.press("Enter")

    download = download_info.value
    download_path = download.path()
    with open(download_path, "r", encoding="UTF-8") as f:
        content = f.read()
        # the app uses a fixed seed, so the data is always the same. This is the reason why we can check it here.
        some_row = "1,-0.977277879876411,0.9500884175255894,-0.1513572082976979,-0.10321885179355784,0.41059850193837233"
        assert some_row in content


def test_csv_download_button(
    app: Page, browser_name: str, browser_type_launch_args: dict
):
    """Test that the csv download button works.

    Note that the library we are using calls the file picker API to download the file. This is not supported in headless mode. Hence, the test
    triggers different code paths in the app depending on the browser and the launch arguments.
    """

    click_enter_on_file_picker = False

    # right now the filechooser will only be opened on Chrome. Maybe this will change in the future and the
    # check has to be updated; or maybe playwright will support the file-access APIs better.
    # In headless mode, the file-access API our csv-download button uses under-the-hood does not work. So we monkey-patch it to throw an error and trigger our alternative download logic.
    if browser_name == "chromium":
        if browser_type_launch_args.get("headless", False):
            click_enter_on_file_picker = True
        else:
            app.evaluate(
                "() => window.showSaveFilePicker = () => {throw new Error('Monkey-patched showOpenFilePicker')}",
            )
    _test_csv_download(app, app.locator("body"), click_enter_on_file_picker)


def test_csv_download_button_in_iframe(iframed_app: IframedPage):
    page: Page = iframed_app.page
    frame_locator: FrameLocator = iframed_app.open_app()

    _test_csv_download(page, frame_locator)


def test_csv_download_button_in_iframe_with_new_tab_host_config(
    iframed_app: IframedPage,
):
    page: Page = iframed_app.page

    def fulfill_host_config_request(route: Route):
        response = route.fetch()
        result = response.json()
        result["enforceDownloadInNewTab"] = True
        route.fulfill(json=result)

    page.route("**/_stcore/host-config", fulfill_host_config_request)

    # ensure that the route interception works and we get the correct enforceDownloadInNewTab config
    with page.expect_event(
        "response",
        lambda response: response.url.endswith("_stcore/host-config")
        and response.json()["enforceDownloadInNewTab"] == True,
        timeout=10000,
    ):
        frame_locator: FrameLocator = iframed_app.open_app()
        _test_csv_download(page, frame_locator)


# TODO(lukasmasuch): Add additional interactive tests:
# - Selecting a cell
# - Opening a cell
# - Applying a cell edit
# - Copy data to clipboard
# - Paste in data
