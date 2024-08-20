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

from e2e_playwright.conftest import ImageCompareFunction


def test_download_button_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that download buttons are correctly rendered via screenshot matching."""
    download_buttons = themed_app.get_by_test_id("stDownloadButton")
    expect(download_buttons).to_have_count(7)

    assert_snapshot(download_buttons.nth(0), name="st_download_button-default")
    assert_snapshot(download_buttons.nth(1), name="st_download_button-disabled")

    assert_snapshot(
        download_buttons.nth(3), name="st_download_button-use_container_width"
    )
    assert_snapshot(
        download_buttons.nth(4), name="st_download_button-use_container_width_help"
    )
    assert_snapshot(download_buttons.nth(5), name="st_download_button-primary")


def test_show_tooltip_on_hover(app: Page, assert_snapshot: ImageCompareFunction):
    download_button = app.get_by_test_id("stDownloadButton").nth(4)
    download_button.hover()
    # Not taking a snapshot of the tooltip since it isn't visible in the screenshot
    expect(app.get_by_test_id("stTooltipContent")).to_have_text("Example help text")


def test_value_correct_on_click(app: Page):
    download_button = app.get_by_test_id("stDownloadButton").locator("button").last
    download_button.click()
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text("value: True")


def test_value_not_reset_on_reclick(app: Page):
    download_button_element = (
        app.get_by_test_id("stDownloadButton").locator("button").last
    )
    download_button_element.click()
    download_button_element.click()
    expect(app.get_by_test_id("stMarkdown").first).to_have_text("value: True")


def test_downloads_RAR_file_on_click(app: Page):
    # Start waiting for the download
    with app.expect_download() as download_info:
        # Perform the action that initiates download
        download_button_element = (
            app.get_by_test_id("stDownloadButton").locator("button").nth(2)
        )
        download_button_element.click()

    download = download_info.value
    file_name = download.suggested_filename

    assert file_name == "archive.rar"


def test_downloads_txt_file_on_click(app: Page):
    # Start waiting for the download
    with app.expect_download() as download_info:
        # Perform the action that initiates download
        download_button_element = (
            app.get_by_test_id("stDownloadButton").locator("button").first
        )
        download_button_element.click()

    download = download_info.value
    file_name = download.suggested_filename
    file_text = download.path().read_text()

    assert file_name == "hello.txt"
    assert file_text == "Hello world!"
