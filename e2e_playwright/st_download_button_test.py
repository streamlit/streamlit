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
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_checkbox,
    get_element_by_key,
)

DOWNLOAD_BUTTON_ELEMENTS = 15


def check_download_button_source_error_count(messages: list[str], expected_count: int):
    """Check that the expected number of download button source error messages are logged."""
    assert (
        len(
            [
                message
                for message in messages
                if "Client Error: Download Button source error" in message
            ]
        )
        == expected_count
    )


def test_download_button_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that download buttons are correctly rendered via screenshot matching."""
    download_buttons = themed_app.get_by_test_id("stDownloadButton")
    expect(download_buttons).to_have_count(15)

    assert_snapshot(download_buttons.nth(0), name="st_download_button-default")
    assert_snapshot(download_buttons.nth(1), name="st_download_button-disabled")

    assert_snapshot(
        download_buttons.nth(4), name="st_download_button-use_container_width"
    )
    assert_snapshot(
        download_buttons.nth(5), name="st_download_button-use_container_width_help"
    )
    assert_snapshot(download_buttons.nth(6), name="st_download_button-primary")
    assert_snapshot(download_buttons.nth(7), name="st_download_button-emoji_icon")
    assert_snapshot(download_buttons.nth(8), name="st_download_button-material_icon")
    assert_snapshot(download_buttons.nth(9), name="st_download_button-tertiary")
    assert_snapshot(
        download_buttons.nth(10), name="st_download_button-disabled_tertiary"
    )
    assert_snapshot(download_buttons.nth(11), name="st_download_button-help")


def test_show_tooltip_on_hover(app: Page):
    download_button = app.get_by_test_id("stDownloadButton").nth(5)
    download_button.hover()
    expect(app.get_by_test_id("stTooltipContent")).to_have_text("Example help text")


def test_value_correct_on_click(app: Page):
    download_button = app.get_by_test_id("stDownloadButton").nth(12).locator("button")
    download_button.click()
    expect(app.get_by_test_id("stMarkdown").first).to_have_text("value: True")


def test_value_not_reset_on_reclick(app: Page):
    download_button = app.get_by_test_id("stDownloadButton").nth(12).locator("button")
    download_button.click()
    download_button.click()
    expect(app.get_by_test_id("stMarkdown").first).to_have_text("value: True")


def test_value_correct_on_ignore_click(app: Page):
    with app.expect_download() as download_info:
        download_button = get_element_by_key(
            app, "download_button_ignore_rerun"
        ).locator("button")
        download_button.click()

    # Check that rerun does not happen
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text(
        "Ignore rerun download button value: False"
    )
    # Check that the actual download happened
    download = download_info.value
    file_name = download.suggested_filename
    file_text = download.path().read_text()

    assert file_name == "ignore_click.txt"
    assert file_text == "do not ignore the data, ignore rerun :)"


def test_click_calls_callback(app: Page):
    download_button = get_element_by_key(app, "download_button").locator("button")
    expect(app.get_by_test_id("stMarkdown").nth(4)).to_contain_text(
        "Download Button was clicked: False"
    )
    download_button.click()
    expect(app.get_by_test_id("stMarkdown").nth(4)).to_have_text(
        "Download Button was clicked: True"
    )
    expect(app.get_by_test_id("stMarkdown").nth(5)).to_have_text("times clicked: 1")
    expect(app.get_by_test_id("stMarkdown").nth(6)).to_have_text("arg value: 1")
    expect(app.get_by_test_id("stMarkdown").nth(7)).to_have_text("kwarg value: 2")


def test_reset_on_other_widget_change(app: Page):
    download_button = app.get_by_test_id("stDownloadButton").nth(14).locator("button")
    download_button.click()
    expect(app.get_by_test_id("stMarkdown").nth(2)).to_have_text("value: True")
    expect(app.get_by_test_id("stMarkdown").nth(3)).to_have_text(
        "value from state: True"
    )

    click_checkbox(app, "reset button return value")
    expect(app.get_by_test_id("stMarkdown").nth(2)).to_have_text("value: False")
    expect(app.get_by_test_id("stMarkdown").nth(3)).to_have_text(
        "value from state: False"
    )


def test_downloads_rar_file_on_click(app: Page):
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


def test_downloads_image_file_on_click(app: Page):
    # Start waiting for the download
    with app.expect_download() as download_info:
        # Perform the action that initiates download
        download_button_element = (
            app.get_by_test_id("stDownloadButton").locator("button").nth(3)
        )
        download_button_element.click()

    download = download_info.value
    file_name = download.suggested_filename

    assert file_name == "cat.jpg"


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


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stDownloadButton")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "download_button")).to_be_visible()


@pytest.mark.flaky(reruns=4)
def test_download_button_source_error(app: Page, app_port: int):
    """Test that the download button source error is correctly logged."""
    # Ensure download source request return a 404 status
    app.route(
        f"http://localhost:{app_port}/media/**",
        lambda route: route.fulfill(
            status=404, headers={"Content-Type": "text/plain"}, body="Not Found"
        ),
    )

    # Capture console messages
    messages = []
    app.on("console", lambda msg: messages.append(msg.text))

    # Navigate to the app
    app.goto(f"http://localhost:{app_port}")

    # Wait until the expected error is logged, indicating CLIENT_ERROR was sent
    wait_until(
        app,
        lambda: check_download_button_source_error_count(
            messages, DOWNLOAD_BUTTON_ELEMENTS
        ),
        timeout=10000,
    )
