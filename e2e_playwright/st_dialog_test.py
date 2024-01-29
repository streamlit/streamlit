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


def test_displays_dialog_properly(app: Page):
    """Test that dialog is displayed properly."""
    app.get_by_text("Open Dialog").click()
    wait_for_app_run(app)
    main_dialog = app.locator("[data-testid='stModal']")
    expect(main_dialog).to_have_count(1)


def test_dialog_closes_properly(app: Page):
    """Test that dialog closes after clicking on action button."""
    app.get_by_text("Open Dialog").click()
    wait_for_app_run(app)
    main_dialog = app.locator("[data-testid='stModal']")
    expect(main_dialog).to_have_count(1)
    close_button = main_dialog.get_by_test_id("stButton").locator("button").first
    close_button.scroll_into_view_if_needed()
    close_button.click()
    wait_for_app_run(app)
    main_dialog = app.locator("[data-testid='stModal']")
    expect(main_dialog).to_have_count(0)


def test_dialog_dismisses_properly(app: Page):
    """Test that dialog is dismissed properly after clicking on modal close (= dismiss)."""
    app.get_by_text("Open Dialog").click()
    wait_for_app_run(app)
    main_dialog = app.locator("[data-testid='stModal']")
    expect(main_dialog).to_have_count(1)
    app.get_by_label("Close", exact=True).click()
    wait_for_app_run(app)
    main_dialog = app.locator("[data-testid='stModal']")
    expect(main_dialog).to_have_count(0)


def test_dialog_reopens_properly_after_dismiss(app: Page):
    """Test that dialog reopens after dismiss."""
    # open and close the dialog multiple times
    for _ in range(0, 10):
        app.get_by_text("Open Dialog").click()
        wait_for_app_run(app)
        main_dialog = app.locator("[data-testid='stModal']")
        expect(main_dialog).to_have_count(1)
        app.get_by_label("Close", exact=True).click()
        wait_for_app_run(app)
        main_dialog = app.locator("[data-testid='stModal']")
        expect(main_dialog).to_have_count(0)


def test_dialog_reopens_properly_after_close(app: Page):
    """Test that dialog reopens properly after closing by action button click."""
    # open and close the dialog multiple times
    for _ in range(0, 10):
        app.get_by_text("Open Dialog").click()
        wait_for_app_run(app)
        main_dialog = app.locator("[data-testid='stModal']")
        expect(main_dialog).to_have_count(1)
        close_button = main_dialog.get_by_test_id("stButton").locator("button").first
        close_button.scroll_into_view_if_needed()
        close_button.click()
        wait_for_app_run(app)
        main_dialog = app.locator("[data-testid='stModal']")
        expect(main_dialog).to_have_count(0)


def test_dialog_is_scrollable(app: Page):
    """Test that the dialog is scrollable"""
    app.get_by_text("Open Dialog").click()
    wait_for_app_run(app)
    main_dialog = app.locator("[data-testid='stModal']")
    close_button = main_dialog.locator("[data-testid='stButton']")
    expect(close_button).not_to_be_in_viewport()
    close_button.scroll_into_view_if_needed()
    expect(close_button).to_be_in_viewport()


def test_fullscreen_is_disabled_for_dialog_elements(app: Page):
    """Test that elemenets within the dialog do not show the fullscreen option."""
    app.get_by_text("Open Dialog").click()
    wait_for_app_run(app)
    main_dialog = app.locator("[data-testid='stModal']")
    expect(main_dialog).to_have_count(1)

    # check that the images do not have the fullscreen button
    expect(app.locator("[data-testid='StyledFullScreenButton']")).to_have_count(0)

    # check that the dataframe does not have the fullscreen button
    dataframe_toolbar = app.locator("[data-testid='stElementToolbarButton']")
    # 2 elements are in the toolbar as of today: download, search
    expect(dataframe_toolbar).to_have_count(2)


def test_dialog_displays_correctly(app: Page, assert_snapshot: ImageCompareFunction):
    app.get_by_text("Open Dialog").click()
    wait_for_app_run(app)
    assert_snapshot(app.locator(".main"), name="dialog-in-main")
