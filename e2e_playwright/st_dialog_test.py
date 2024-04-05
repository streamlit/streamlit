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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run

modal_test_id = "stModal"


def open_dialog_with_images(app: Page):
    app.get_by_text("Open Dialog with Images").click()


def open_dialog_without_images(app: Page):
    app.get_by_text("Open Dialog without Images").click()


def open_largewidth_dialog(app: Page):
    app.get_by_text("Open large-width Dialog").click()


def open_sidebar_dialog(app: Page):
    app.get_by_text("Open Sidebar-Dialog").click()


def click_to_dismiss(app: Page):
    # Click somewhere outside the close popover container:
    app.get_by_test_id(modal_test_id).click(position={"x": 0, "y": 0})


def test_displays_dialog_properly(app: Page):
    """Test that dialog is displayed properly."""
    open_dialog_with_images(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)


def test_dialog_closes_properly(app: Page):
    """Test that dialog closes after clicking on action button."""
    open_dialog_with_images(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)
    close_button = main_dialog.get_by_test_id("stButton").locator("button").first
    close_button.scroll_into_view_if_needed()
    close_button.click()
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(0)


def test_dialog_dismisses_properly(app: Page):
    """Test that dialog is dismissed properly after clicking on modal close (= dismiss)."""
    open_dialog_with_images(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)

    click_to_dismiss(app)
    expect(main_dialog).not_to_be_visible()
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(0)


# on webkit this test was flaky and manually reproducing the flaky error did not work, so we skip it for now
@pytest.mark.skip_browser("webkit")
def test_dialog_reopens_properly_after_dismiss(app: Page):
    """Test that dialog reopens after dismiss."""
    # open and close the dialog multiple times
    for i in range(0, 10):
        # don't click indefinitely fast to give the dialog time to set the state
        app.wait_for_timeout(100)

        open_dialog_without_images(app)
        wait_for_app_run(app)
        main_dialog = app.get_by_test_id(modal_test_id)
        expect(main_dialog).to_have_count(1)

        click_to_dismiss(app)
        expect(main_dialog).not_to_be_attached()

        main_dialog = app.get_by_test_id(modal_test_id)
        expect(main_dialog).to_have_count(0)


def test_dialog_reopens_properly_after_close(app: Page):
    """Test that dialog reopens properly after closing by action button click."""
    # open and close the dialog multiple times
    for _ in range(0, 10):
        open_dialog_with_images(app)
        wait_for_app_run(app)
        main_dialog = app.get_by_test_id(modal_test_id)
        expect(main_dialog).to_have_count(1)
        close_button = main_dialog.get_by_test_id("stButton").locator("button").first
        close_button.scroll_into_view_if_needed()
        close_button.click()
        wait_for_app_run(app)
        main_dialog = app.get_by_test_id(modal_test_id)
        expect(main_dialog).to_have_count(0)


def test_dialog_is_scrollable(app: Page):
    """Test that the dialog is scrollable"""
    open_dialog_with_images(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    close_button = main_dialog.get_by_test_id("stButton")
    expect(close_button).not_to_be_in_viewport()
    close_button.scroll_into_view_if_needed()
    expect(close_button).to_be_in_viewport()


def test_fullscreen_is_disabled_for_dialog_elements(app: Page):
    """Test that elemenets within the dialog do not show the fullscreen option."""
    open_dialog_with_images(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)

    # check that the images do not have the fullscreen button
    expect(app.get_by_test_id("StyledFullScreenButton")).to_have_count(0)

    # check that the dataframe does not have the fullscreen button
    dataframe_toolbar = app.get_by_test_id("stElementToolbarButton")
    # 2 elements are in the toolbar as of today: download, search
    expect(dataframe_toolbar).to_have_count(2)


def test_dialog_displays_correctly(app: Page, assert_snapshot: ImageCompareFunction):
    open_dialog_without_images(app)
    wait_for_app_run(app)
    dialog = app.get_by_role("dialog")
    expect(dialog.get_by_test_id("stButton")).to_be_visible()
    assert_snapshot(dialog, name="dialog-in-main")


def test_largewidth_dialog_displays_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    open_largewidth_dialog(app)
    wait_for_app_run(app)
    dialog = app.get_by_role("dialog")
    expect(dialog.get_by_test_id("stButton")).to_be_visible()
    assert_snapshot(dialog, name="dialog-with-large-width")


def test_sidebardialog_displays_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    open_dialog_without_images(app)
    wait_for_app_run(app)
    dialog = app.get_by_role("dialog")
    expect(dialog.get_by_test_id("stButton")).to_be_visible()
    assert_snapshot(dialog, name="dialog-in-sidebar")
