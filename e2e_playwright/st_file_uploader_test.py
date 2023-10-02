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


def test_file_uploader_error_message_disallowed_files(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that shows error message for disallowed files"""
    file_name1 = "example.json"
    file_content1 = b"{}"

    uploader_index = 0

    with themed_app.expect_file_chooser() as fc_info:
        themed_app.get_by_test_id("stFileUploadDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            {
                "name": file_name1,
                "mimeType": "application/json",
                "buffer": file_content1,
            }
        ]
    )

    wait_for_app_run(themed_app)
    themed_app.wait_for_timeout(1000)

    expect(
        themed_app.get_by_test_id("stUploadedFileErrorMessage").nth(uploader_index)
    ).to_have_text("application/json files are not allowed.", use_inner_text=True)

    file_uploader_in_error_state = themed_app.get_by_test_id("stFileUploader").nth(
        uploader_index
    )

    assert_snapshot(file_uploader_in_error_state, name="st_file_uploader-error")


def test_uploads_and_deletes_single_file_only(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that uploading a file for single file uploader works as expected."""
    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    uploader_index = 0

    with themed_app.expect_file_chooser() as fc_info:
        themed_app.get_by_test_id("stFileUploadDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[{"name": file_name1, "mimeType": "text/plain", "buffer": file_content1}]
    )

    wait_for_app_run(themed_app)
    themed_app.wait_for_timeout(1000)

    expect(themed_app.locator(".uploadedFileName")).to_have_text(
        file_name1, use_inner_text=True
    )

    expect(themed_app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content1), use_inner_text=True
    )

    file_uploader_uploaded_state = themed_app.get_by_test_id("stFileUploader").nth(
        uploader_index
    )

    assert_snapshot(
        file_uploader_uploaded_state, name="st_single_file_uploader-uploaded"
    )

    expect(
        themed_app.get_by_test_id("stMarkdownContainer").nth(uploader_index + 1)
    ).to_have_text("True", use_inner_text=True)

    # Upload a second file.This one will replace the first.
    with themed_app.expect_file_chooser() as fc_info:
        themed_app.get_by_test_id("stFileUploadDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[{"name": file_name2, "mimeType": "text/plain", "buffer": file_content2}]
    )

    wait_for_app_run(themed_app)
    themed_app.wait_for_timeout(1000)

    expect(themed_app.locator(".uploadedFileName")).to_have_text(
        file_name2, use_inner_text=True
    )

    expect(themed_app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content2), use_inner_text=True
    )

    expect(
        themed_app.get_by_test_id("stMarkdownContainer").nth(uploader_index + 1)
    ).to_have_text("True", use_inner_text=True)

    themed_app.get_by_test_id("stHeader").press("r")
    wait_for_app_run(themed_app)

    expect(themed_app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content2), use_inner_text=True
    )

    themed_app.get_by_test_id("fileDeleteBtn").nth(uploader_index).click()

    wait_for_app_run(themed_app)
    themed_app.wait_for_timeout(1000)

    expect(themed_app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        "No upload", use_inner_text=True
    )


def test_uploads_and_deletes_multiple_files(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that uploading multiple files at once works correctly."""
    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    files = [
        {"name": file_name1, "mimeType": "text/plain", "buffer": file_content1},
        {"name": file_name2, "mimeType": "text/plain", "buffer": file_content2},
    ]

    uploader_index = 2

    with themed_app.expect_file_chooser() as fc_info:
        themed_app.get_by_test_id("stFileUploadDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(files=files)

    wait_for_app_run(themed_app)
    themed_app.wait_for_timeout(1000)

    uploaded_file_names = themed_app.locator(".uploadedFileName")

    # The widget should show the names of the uploaded files in reverse order
    file_names = [files[1]["name"], files[0]["name"]]

    for i, element in enumerate(uploaded_file_names.all()):
        expect(element).to_have_text(file_names[i], use_inner_text=True)

    # The script should have printed the contents of the two files
    # into a st.text. (This tests that the upload actually went through.)
    content = "\n".join(
        [
            files[0]["buffer"].decode("utf-8"),
            files[1]["buffer"].decode("utf-8"),
        ]
    )
    expect(themed_app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        content, use_inner_text=True
    )

    file_uploader = themed_app.get_by_test_id("stFileUploader").nth(uploader_index)

    assert_snapshot(file_uploader, name="st_multi_file_uploader-uploaded")