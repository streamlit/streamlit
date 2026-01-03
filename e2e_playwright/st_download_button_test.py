# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_for_app_run,
    wait_until,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_checkbox,
    click_toggle,
    expect_markdown,
    expect_prefixed_markdown,
    get_element_by_key,
    get_expander,
    goto_app,
)

DOWNLOAD_BUTTON_ELEMENTS = 19


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
    expect(download_buttons).to_have_count(DOWNLOAD_BUTTON_ELEMENTS)

    assert_snapshot(
        get_element_by_key(themed_app, "default_download_button"),
        name="st_download_button-default",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "disabled_dl_button"),
        name="st_download_button-disabled",
    )

    assert_snapshot(
        get_element_by_key(themed_app, "primary_download_button"),
        name="st_download_button-primary",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "emoji_download_button"),
        name="st_download_button-emoji_icon",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "material_icon_download_button"),
        name="st_download_button-material_icon",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "tertiary_download_button"),
        name="st_download_button-tertiary",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "disabled_tertiary_download_button"),
        name="st_download_button-disabled_tertiary",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "help_download_button"),
        name="st_download_button-help",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "shortcut_download_button"),
        name="st_download_button-shortcut",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "download_emoji_right"),
        name="st_download_button-icon_position_right_emoji",
    )


def test_show_tooltip_on_hover(app: Page):
    download_button = app.get_by_test_id("stDownloadButton").nth(9)
    download_button.hover()
    expect(app.get_by_test_id("stTooltipContent")).to_have_text("help text")


def test_value_correct_on_click(app: Page):
    download_button = app.get_by_role("button", name="Download random text")
    download_button.click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Random download value:", "True", exact_match=True)


def test_value_not_reset_on_reclick(app: Page):
    download_button = app.get_by_role("button", name="Download random text")
    download_button.click()
    wait_for_app_run(app)
    download_button.click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Random download value:", "True", exact_match=True)


def test_value_correct_on_ignore_click(app: Page):
    with app.expect_download() as download_info:
        download_button = get_element_by_key(
            app, "download_button_ignore_rerun"
        ).locator("button")
        download_button.click()

    # Check that rerun does not happen

    # While a rerun isn't expected, we still wait for a rerun here to ensure that the text actually
    # fails if the rerun happens.
    # The reason is that the default download button return is false, so if we do the
    # markdown check immidately it might suceedd even if the rerun happens slightly later.
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Ignore rerun download button value:",
        "False",
        exact_match=True,
    )
    # Check that the actual download happened
    download = download_info.value
    file_name = download.suggested_filename
    file_text = download.path().read_text()

    assert file_name == "ignore_click.txt"
    assert file_text == "do not ignore the data, ignore rerun :)"


def test_click_calls_callback(app: Page):
    download_button = get_element_by_key(app, "download_button").locator("button")
    expect_prefixed_markdown(
        app,
        "Download Button was clicked:",
        "False",
        exact_match=True,
    )
    download_button.click()
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app,
        "Download Button was clicked:",
        "True",
        exact_match=True,
    )
    expect_prefixed_markdown(app, "times clicked:", "1")
    expect_prefixed_markdown(app, "callback arg value:", "1")
    expect_prefixed_markdown(app, "callback kwarg value:", "2")


def test_reset_on_other_widget_change(app: Page):
    download_button = get_element_by_key(app, "download_button").locator("button")
    download_button.click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Download button with on_click value:", "True")
    expect_prefixed_markdown(
        app, "Download button with on_click value from state:", "True"
    )

    click_checkbox(app, "reset button return value")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Download button with on_click value:", "False")
    expect_prefixed_markdown(
        app, "Download button with on_click value from state:", "False"
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
    goto_app(app, f"http://localhost:{app_port}")

    # Wait until the expected error is logged, indicating CLIENT_ERROR was sent
    wait_until(
        app,
        lambda: check_download_button_source_error_count(
            messages, DOWNLOAD_BUTTON_ELEMENTS
        ),
        timeout=10000,
    )


def test_download_button_width_examples(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test download button width examples via screenshot matching."""
    download_expander = get_expander(app, "Download Button Width Examples")
    download_elements = download_expander.get_by_test_id("stDownloadButton")

    assert_snapshot(download_elements.nth(0), name="st_download_button-width_content")
    assert_snapshot(download_elements.nth(1), name="st_download_button-width_stretch")
    assert_snapshot(download_elements.nth(2), name="st_download_button-width_300px")


def test_dynamic_download_button(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the download button can be updated dynamically."""
    dynamic_button = get_element_by_key(app, "dynamic_download_button_with_key")
    expect(dynamic_button).to_be_visible()

    # Initial state
    expect(dynamic_button).to_contain_text("Initial dynamic button")
    assert_snapshot(dynamic_button, name="st_download_button-dynamic_initial")
    dynamic_button.hover()
    expect(app.get_by_test_id("stTooltipContent")).to_have_text("initial help")
    # Clean hovering before clicking the toggle:
    app.get_by_text("Dynamic download button props:").hover(force=True)
    expect(app.get_by_test_id("stTooltipContent")).not_to_be_visible()

    # Click the toggle to update the button props
    click_toggle(app, "Update button props")

    # Updated state
    expect(dynamic_button).to_contain_text("Updated dynamic button")
    dynamic_button.scroll_into_view_if_needed()
    assert_snapshot(dynamic_button, name="st_download_button-dynamic_updated")
    dynamic_button.hover()
    expect(app.get_by_test_id("stTooltipContent")).to_have_text("updated help")

    # Click the download button and verify the download
    with app.expect_download() as download_info:
        dynamic_button.click()

    download = download_info.value
    assert download.suggested_filename == "updated.txt"
    assert download.path().read_text() == "Updated data"

    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Clicked updated button:", "True")


def test_download_button_shortcut_triggers(app: Page):
    """Ensure pressing the shortcut activates the download button."""
    shortcut_button = get_element_by_key(app, "shortcut_download_button")
    expect(shortcut_button).to_be_visible()
    expect(shortcut_button.locator("kbd")).to_have_text(
        re.compile(r"(Ctrl|⌘) \+ (Alt|Option|⌥) \+ D")
    )

    # Press hotkey to trigger the button:
    with app.expect_download() as download_info:
        app.keyboard.press("ControlOrMeta+Alt+D")
    download = download_info.value
    assert download.suggested_filename == "shortcut.txt"
    wait_for_app_run(app)
    expect_markdown(app, "Shortcut download triggered!")
