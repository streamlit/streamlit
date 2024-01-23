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


def test_dialog_is_scrollable(app: Page):
    """Test that the dialog is scrollable"""
    app.get_by_text("Open Dialog").click()
    wait_for_app_run(app)
    main_dialog = app.locator("[data-testid='stModal']")
    close_button = main_dialog.locator("[data-testid='stButton']")
    expect(close_button).not_to_be_in_viewport()
    close_button.scroll_into_view_if_needed()
    expect(close_button).to_be_in_viewport()


def test_dialog_displays_correctly(app: Page, assert_snapshot: ImageCompareFunction):
    app.get_by_text("Open Dialog").click()
    wait_for_app_run(app)
    assert_snapshot(app.locator(".main"), name="dialog-in-main")
