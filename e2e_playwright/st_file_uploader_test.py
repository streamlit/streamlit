# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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


def test_file_uploader_render_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the file uploader render as expected via screenshot matching."""
    file_uploaders = themed_app.get_by_test_id("stFileUploader")

    assert_snapshot(file_uploaders.nth(0), name="st_single-file-uploader")
    assert_snapshot(file_uploaders.nth(1), name="st_disabled-file-uploader")
    assert_snapshot(file_uploaders.nth(2), name="st_multi-file-uploader")
    assert_snapshot(file_uploaders.nth(4), name="st_hidden-label-file-uploader")
    assert_snapshot(file_uploaders.nth(5), name="st_collapsed-label-file-uploader")


def test_handles_date_selection(app: Page):
    """Test that selection of a date on the calendar works as expected."""
    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    uploader_index = 0

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploadDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[{"name": file_name1, "mimeType": "text/plain", "buffer": file_content1}]
    )

    wait_for_app_run(app)
    app.wait_for_timeout(250)

    expect(app.locator(".uploadedFileName")).to_have_text(
        file_name1, use_inner_text=True
    )

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content1), use_inner_text=True
    )

    expect(
        app.get_by_test_id("stMarkdownContainer").nth(uploader_index + 1)
    ).to_have_text("True", use_inner_text=True)

    # Upload a second file.This one will replace the first.
    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploadDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[{"name": file_name2, "mimeType": "text/plain", "buffer": file_content2}]
    )

    wait_for_app_run(app)
    app.wait_for_timeout(250)

    expect(app.locator(".uploadedFileName")).to_have_text(
        file_name2, use_inner_text=True
    )

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content2), use_inner_text=True
    )

    expect(
        app.get_by_test_id("stMarkdownContainer").nth(uploader_index + 1)
    ).to_have_text("True", use_inner_text=True)
