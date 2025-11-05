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

from playwright.sync_api import Page, expect


def test_deferred_download_csv_success(app: Page):
    """Test successful deferred CSV download."""
    # Get the CSV download button (second button in the app)
    csv_button = app.get_by_test_id("stDownloadButton").nth(1).locator("button")
    expect(csv_button).to_contain_text("Download CSV (Deferred)")

    # Click and expect download
    with app.expect_download() as download_info:
        csv_button.click()

    download = download_info.value
    assert download.suggested_filename == "data.csv"

    # Verify downloaded content
    content = download.path().read_text()
    assert "Name,Age,City" in content
    assert "Alice,30,NYC" in content
    assert "Bob,25,LA" in content


def test_deferred_download_lambda_text(app: Page):
    """Test deferred download with lambda function."""
    # Get the lambda download button (third button)
    lambda_button = app.get_by_test_id("stDownloadButton").nth(2).locator("button")
    expect(lambda_button).to_contain_text("Download Lambda Text")

    # Click and expect download
    with app.expect_download() as download_info:
        lambda_button.click()

    download = download_info.value
    assert download.suggested_filename == "lambda_output.txt"

    # Verify downloaded content contains dynamic text
    content = download.path().read_text()
    assert "Generated at " in content
    assert "This is dynamically generated text" in content


def test_deferred_download_binary(app: Page):
    """Test deferred download returning binary data."""
    # Get the binary download button (fourth button)
    binary_button = app.get_by_test_id("stDownloadButton").nth(3).locator("button")
    expect(binary_button).to_contain_text("Download Binary (Deferred)")

    # Click and expect download
    with app.expect_download() as download_info:
        binary_button.click()

    download = download_info.value
    assert download.suggested_filename == "binary.dat"

    # Verify downloaded binary content
    content = download.path().read_bytes()
    assert content == b"Binary data: \x00\x01\x02\x03\x04\x05"


def test_deferred_download_error_handling(app: Page):
    """Test that deferred download with failing callable shows error."""
    # Get the error button (fifth button)
    error_button = app.get_by_test_id("stDownloadButton").nth(4).locator("button")
    expect(error_button).to_contain_text("Download Error (Should Fail)")

    # Click the button
    error_button.click()

    # Wait for error message to appear
    error_message = app.get_by_test_id("stDownloadButtonError")
    expect(error_message).to_be_visible(timeout=5000)
    expect(error_message).to_contain_text("Callable execution failed")


def test_deferred_download_large_file(app: Page):
    """Test deferred download with large data."""
    # Get the large file download button (sixth button)
    large_button = app.get_by_test_id("stDownloadButton").nth(5).locator("button")
    expect(large_button).to_contain_text("Download Large File (Deferred)")

    # Click and expect download
    with app.expect_download() as download_info:
        large_button.click()

    download = download_info.value
    assert download.suggested_filename == "large.txt"

    # Verify downloaded content is large
    content = download.path().read_text()
    lines = content.split("\n")
    assert len(lines) == 1000
    assert "Row 0: " in lines[0]
    assert "Row 999: " in lines[999]


def test_deferred_download_with_ignore_rerun(app: Page):
    """Test deferred download with on_click='ignore'."""
    # Get the no-rerun download button (seventh button)
    no_rerun_button = app.get_by_test_id("stDownloadButton").nth(6).locator("button")
    expect(no_rerun_button).to_contain_text("Download (No Rerun)")

    # Click and expect download
    with app.expect_download() as download_info:
        no_rerun_button.click()

    download = download_info.value
    assert download.suggested_filename == "no_rerun.txt"
    assert download.path().read_text() == "No rerun content"

    # Since we used on_click="ignore", the app should not rerun
    # We can verify this by checking that no new script run happened
    # (In a real scenario, we'd check that some state didn't change)


def test_regular_download_still_works(app: Page):
    """Test that regular (non-deferred) download still works."""
    # Get the first button (regular download)
    regular_button = app.get_by_test_id("stDownloadButton").nth(0).locator("button")
    expect(regular_button).to_contain_text("Download Regular String")

    # Click and expect download
    with app.expect_download() as download_info:
        regular_button.click()

    download = download_info.value
    assert download.suggested_filename == "regular.txt"
    assert download.path().read_text() == "This is regular string data"


def test_deferred_download_button_count(app: Page):
    """Test that all download buttons are rendered correctly."""
    download_buttons = app.get_by_test_id("stDownloadButton")
    # 1 regular + 6 deferred = 7 buttons total
    expect(download_buttons).to_have_count(7)
