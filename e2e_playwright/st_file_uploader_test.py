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

from __future__ import annotations

import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any

import pytest
from playwright.sync_api import FilePayload, Locator, Page, Route, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    rerun_app,
    wait_for_app_run,
    wait_until,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_checkbox,
    click_form_button,
    expect_text,
    get_element_by_key,
    goto_app,
)


def create_temp_directory_with_files(file_data: list[dict[str, Any]]) -> str:
    """
    Create a temporary directory with files for directory upload testing.

    Parameters
    ----------
    file_data : list[dict[str, Any]]
        List of dict with 'path' and 'content' keys

    Returns
    -------
    str
        Path to the temporary directory
    """
    # Use a deterministic directory name for consistent test results
    temp_base = tempfile.gettempdir()
    # Create a nested structure so the uploaded directory preserves relative paths
    test_base_dir = os.path.join(temp_base, "streamlit_e2e_test_base")
    temp_dir = os.path.join(test_base_dir, "upload_dir")
    temp_path = Path(temp_dir)

    # Clean up any existing directory
    base_path = Path(test_base_dir)
    if base_path.exists():
        shutil.rmtree(base_path)

    # Create the directory
    temp_path.mkdir(parents=True, exist_ok=True)

    for file_info in file_data:
        file_path = temp_path / file_info["path"]
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(file_info["content"])

    return str(temp_dir)


def verify_uploaded_files_in_widget(
    file_uploader: Locator, expected_files: list[str], expected_count: int
) -> None:
    """Verify uploaded file names within a specific file uploader container.

    Parameters
    ----------
    file_uploader : Locator
        The file uploader container locator.

    expected_files : list[str]
        Expected file names (partial matches allowed).

    expected_count : int
        Expected number of uploaded files shown in the widget.
    """
    file_name_elements = file_uploader.get_by_test_id("stFileUploaderFileName")

    expect(file_name_elements).to_have_count(expected_count)

    for expected_file in expected_files:
        expect(file_name_elements.filter(has_text=expected_file).first).to_be_visible()


def get_file_uploader(locator: Locator | Page, label: str | re.Pattern[str]) -> Locator:
    """Get a file uploader by its label using the widget label helper pattern."""
    if isinstance(label, re.Pattern):
        label_locator = locator.get_by_test_id("stWidgetLabel").filter(has_text=label)
    else:
        label_locator = locator.get_by_test_id("stWidgetLabel").get_by_text(
            label, exact=True
        )

    element = locator.get_by_test_id("stFileUploader").filter(has=label_locator).first
    expect(element).to_be_visible()
    return element


def test_file_uploader_render_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the file uploader render as expected via screenshot matching."""
    file_uploaders = themed_app.get_by_test_id("stFileUploader")
    expect(file_uploaders).to_have_count(16)

    assert_snapshot(
        get_file_uploader(themed_app, "Drop a file:"),
        name="st_file_uploader-single_file",
    )
    assert_snapshot(
        get_file_uploader(themed_app, "Can't drop a file:"),
        name="st_file_uploader-disabled",
    )
    assert_snapshot(
        get_file_uploader(themed_app, "Drop multiple files:"),
        name="st_file_uploader-multiple_files",
    )
    assert_snapshot(
        get_file_uploader(themed_app, "Drop a directory:"),
        name="st_file_uploader-directory",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "hidden_label"),
        name="st_file_uploader-hidden_label",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "collapsed_label"),
        name="st_file_uploader-collapsed_label",
    )
    # The other file uploaders do not need to be snapshot tested.
    assert_snapshot(
        get_element_by_key(themed_app, "file_uploader_markdown_label"),
        name="st_file_uploader-markdown_label",
    )
    assert_snapshot(
        get_file_uploader(themed_app, "Uses compact file uploader"),
        name="st_file_uploader-compact",
    )
    assert_snapshot(
        get_file_uploader(themed_app, "Restricted directory (only .txt files):"),
        name="st_file_uploader-restricted_directory",
    )
    assert_snapshot(
        get_file_uploader(themed_app, "File uploader with many file types:"),
        name="st_file_uploader-many_file_types",
    )


def test_file_uploader_error_message_disallowed_files(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that shows error message for disallowed files."""
    file_name1 = "example.json"
    file_content1 = b"{}"

    uploader = get_file_uploader(app, "Drop a file:")

    with app.expect_file_chooser() as fc_info:
        uploader.get_by_test_id("stFileUploaderDropzone").first.click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(
                name=file_name1,
                mimeType="application/json",
                buffer=file_content1,
            )
        ]
    )

    wait_for_app_run(app)

    expect(
        uploader.get_by_test_id("stFileUploaderFileErrorMessage").first
    ).to_have_text("application/json files are not allowed.", use_inner_text=True)

    assert_snapshot(uploader, name="st_file_uploader-error")


def test_uploads_and_deletes_single_file_only(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that uploading a file for single file uploader works as expected."""
    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    uploader = get_file_uploader(app, "Drop a file:")

    with app.expect_file_chooser() as fc_info:
        uploader.get_by_test_id("stFileUploaderDropzone").first.click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1)
        ]
    )
    wait_for_app_run(app)

    expect(uploader.get_by_test_id("stFileUploaderFileName")).to_have_text(
        file_name1, use_inner_text=True
    )

    expect_text(app, str(file_content1))

    assert_snapshot(uploader, name="st_file_uploader-single_file_uploaded")

    # Upload a second file. This one will replace the first.
    with app.expect_file_chooser() as fc_info:
        uploader.get_by_test_id("stFileUploaderDropzone").first.click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(name=file_name2, mimeType="text/plain", buffer=file_content2)
        ]
    )

    wait_for_app_run(app)

    expect(uploader.get_by_test_id("stFileUploaderFileName")).to_have_text(
        file_name2, use_inner_text=True
    )

    expect_text(app, str(file_content2))

    rerun_app(app)

    expect_text(app, str(file_content2))

    uploader.get_by_test_id("stFileUploaderDeleteBtn").first.click()

    wait_for_app_run(app)

    expect_text(app, "No upload")


def test_uploads_and_deletes_multiple_files(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that uploading multiple files at once works correctly."""
    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    files = [
        FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1),
        FilePayload(name=file_name2, mimeType="text/plain", buffer=file_content2),
    ]

    uploader = get_file_uploader(app, "Drop multiple files:")
    dropzone = uploader.get_by_test_id("stFileUploaderDropzone").first
    expect(dropzone).to_be_visible()

    with app.expect_file_chooser() as fc_info:
        dropzone.click()

    file_chooser = fc_info.value
    file_chooser.set_files(files=files)

    wait_for_app_run(app, wait_delay=500)

    uploaded_file_names = uploader.get_by_test_id("stFileUploaderFileName")

    # The widget should show the names of the uploaded files in reverse order
    file_names = [files[1]["name"], files[0]["name"]]

    for i, element in enumerate(uploaded_file_names.all()):
        expect(element).to_have_text(file_names[i], use_inner_text=True)

    # The script should have printed the contents of the two files into a st.text.
    # This tests that the upload actually went through.
    content = "\n".join(
        [
            files[0]["buffer"].decode("utf-8"),
            files[1]["buffer"].decode("utf-8"),
        ]
    )
    expect_text(app, content)

    assert_snapshot(uploader, name="st_file_uploader-multi_file_uploaded")

    #  Delete the second file. The second file is on top because it was
    #  most recently uploaded. The first file should still exist.
    uploader.get_by_test_id("stFileUploaderDeleteBtn").first.click()

    wait_for_app_run(app)

    uploaded_file_names = uploader.get_by_test_id("stFileUploaderFileName")
    expect(uploaded_file_names).to_have_count(1)

    expect(uploaded_file_names).to_have_text(files[0]["name"], use_inner_text=True)

    expect_text(app, files[0]["buffer"].decode("utf-8"))

    assert_snapshot(uploader, name="st_file_uploader-multi_file_one_deleted")

    # Delete the remaining file
    uploader.get_by_test_id("stFileUploaderDeleteBtn").first.click()
    wait_for_app_run(app)

    expect_text(app, "No upload")


@pytest.mark.flaky(reruns=3)
def test_uploads_directory_with_multiple_files(app: Page):
    """Test that directory upload works correctly with multiple files.

    Note: We don't test the visual order of files in the widget because:
    1. The frontend intentionally displays files in reverse chronological order (newest first)
    2. The order in which browsers return directory files is non-deterministic
    3. We verify functionality by checking that all files are uploaded correctly
    """
    # Create temporary directory structure with multiple files
    directory_data = [
        {"path": "folder/file1.txt", "content": b"content1"},
        {"path": "folder/file2.py", "content": b"print('hello')"},
        {"path": "folder/subfolder/file3.md", "content": b"# Markdown"},
    ]

    temp_dir = create_temp_directory_with_files(directory_data)

    uploader = get_file_uploader(app, "Drop a directory:")
    dropzone = uploader.get_by_test_id("stFileUploaderDropzone").first
    expect(dropzone).to_be_visible()

    with app.expect_file_chooser() as fc_info:
        dropzone.click()

    file_chooser = fc_info.value
    file_chooser.set_files(files=[temp_dir])

    wait_for_app_run(app, wait_delay=1000)

    # Verify files appear in the widget using the helper function
    expected_files = [
        "upload_dir/folder/file1.txt",
        "upload_dir/folder/file2.py",
        "upload_dir/folder/subfolder/file3.md",
    ]
    verify_uploaded_files_in_widget(uploader, expected_files, 3)

    # Test deleting files from directory upload
    delete_button = uploader.get_by_test_id("stFileUploaderDeleteBtn").first
    expect(delete_button).to_be_visible()
    delete_button.click()
    wait_for_app_run(app)

    # Verify file count decreased
    expect_text(app, "Directory contains 2 files:")


@pytest.mark.flaky(reruns=3)
def test_directory_upload_with_file_type_filtering(app: Page):
    """Test that directory upload correctly filters files by type.

    Note: We don't test the visual order of files in the widget because:
    1. The frontend intentionally displays files in reverse chronological order (newest first)
    2. The order in which browsers return directory files is non-deterministic
    3. We verify functionality by checking that files are filtered and uploaded correctly
    """
    uploader = get_file_uploader(app, "Restricted directory (only .txt files):")
    # Create a temporary directory with test files
    directory_data = [
        {"path": "allowed.txt", "content": b"allowed content"},
        {"path": "disallowed.pdf", "content": b"pdf content"},
        {"path": "another_allowed.txt", "content": b"another txt file"},
        {"path": "nested/deep/file.txt", "content": b"nested file"},
    ]

    temp_dir = create_temp_directory_with_files(directory_data)
    file_dropzone = uploader.get_by_test_id("stFileUploaderDropzone").first
    expect(file_dropzone).to_be_visible()

    with app.expect_file_chooser() as fc_info:
        file_dropzone.click()

    file_chooser = fc_info.value
    file_chooser.set_files(files=[temp_dir])

    wait_for_app_run(app, wait_delay=1000)

    # Verify files appear in the widget using the helper function
    expected_txt_files = ["allowed.txt", "another_allowed.txt", "nested/deep/file.txt"]
    verify_uploaded_files_in_widget(uploader, expected_txt_files, 3)

    # Additionally verify the .pdf file was NOT uploaded (it should have been filtered)
    expect(uploader).to_be_visible()
    file_name_elements = uploader.get_by_test_id("stFileUploaderFileName").all()
    all_file_names = [elem.inner_text() for elem in file_name_elements]
    assert not any("disallowed.pdf" in name for name in all_file_names), (
        "PDF file should have been filtered out"
    )


def test_directory_upload_empty_directory(app: Page):
    """Test that directory upload handles empty directories gracefully."""
    # Click and cancel dialog to simulate empty directory selection
    file_dropzone = (
        get_file_uploader(app, "Drop a directory:")
        .get_by_test_id("stFileUploaderDropzone")
        .first
    )
    expect(file_dropzone).to_be_visible()
    with app.expect_file_chooser():
        file_dropzone.click()

    wait_for_app_run(app, wait_delay=500)

    # Verify empty directory is handled correctly
    expect_text(app, "No directory upload")


def test_uploads_multiple_files_one_by_one_quickly(app: Page):
    """Test that uploads and deletes multiple files quickly works correctly."""
    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    files = [
        FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1),
        FilePayload(name=file_name2, mimeType="text/plain", buffer=file_content2),
    ]

    uploader = get_file_uploader(app, "Drop multiple files:")
    file_dropzone = uploader.get_by_test_id("stFileUploaderDropzone").first
    expect(file_dropzone).to_be_visible()

    with app.expect_file_chooser() as fc_info:
        file_dropzone.click()

    file_chooser = fc_info.value
    file_chooser.set_files(files=files[0])

    # The widget should show the name of the uploaded file
    expect(uploader.get_by_test_id("stFileUploaderFileName")).to_have_text(
        file_name1, use_inner_text=True
    )

    with app.expect_file_chooser() as fc_info:
        uploader.get_by_test_id("stFileUploaderDropzone").first.click()

    file_chooser = fc_info.value

    with app.expect_request("**/upload_file/**"):
        file_chooser.set_files(files=files[1])

    uploaded_file_names = uploader.get_by_test_id("stFileUploaderFileName")

    # The widget should show the names of the uploaded files in reverse order
    file_names = [files[1]["name"], files[0]["name"]]

    for i, element in enumerate(uploaded_file_names.all()):
        expect(element).to_have_text(file_names[i], use_inner_text=True)

    # The script should have printed the contents of the two files into a st.text.
    # This tests that the upload actually went through.
    content = "\n".join(
        [
            files[0]["buffer"].decode("utf-8"),
            files[1]["buffer"].decode("utf-8"),
        ]
    )
    expect_text(app, content)

    #  Delete the second file. The second file is on top because it was
    #  most recently uploaded. The first file should still exist.
    file_uploader_delete_btn = uploader.get_by_test_id("stFileUploaderDeleteBtn").first
    expect(file_uploader_delete_btn).to_be_visible()
    file_uploader_delete_btn.click()

    expect_text(app, files[0]["buffer"].decode("utf-8"))


# NOTE: This test is essentially identical to the one above. The only
# difference is that we add a short delay to uploading the two files to
# ensure that two script runs happen separately (sufficiently rapid widget
# changes will often be batched into a single script run) to test for the
# failure mode in https://github.com/streamlit/streamlit/issues/3531.
def test_uploads_multiple_files_one_by_one_slowly(app: Page):
    """Test that uploads and deletes multiple files slowly works."""
    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    files = [
        FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1),
        FilePayload(name=file_name2, mimeType="text/plain", buffer=file_content2),
    ]

    uploader = get_file_uploader(app, "Drop multiple files:")
    file_dropzone = uploader.get_by_test_id("stFileUploaderDropzone").first
    expect(file_dropzone).to_be_visible()

    with app.expect_file_chooser() as fc_info:
        file_dropzone.click()

    file_chooser = fc_info.value
    # Here we wait for the first file to be uploaded before uploading the second
    with app.expect_request("**/upload_file/**"):
        file_chooser.set_files(files=files[0])

    # The widget should show the name of the uploaded file
    expect(uploader.get_by_test_id("stFileUploaderFileName")).to_have_text(
        file_name1, use_inner_text=True
    )

    with app.expect_file_chooser() as fc_info:
        uploader.get_by_test_id("stFileUploaderDropzone").first.click()

    file_chooser = fc_info.value

    with app.expect_request("**/upload_file/**"):
        file_chooser.set_files(files=files[1])

    uploaded_file_names = uploader.get_by_test_id("stFileUploaderFileName")

    # The widget should show the names of the uploaded files in reverse order
    file_names = [files[1]["name"], files[0]["name"]]

    for i, element in enumerate(uploaded_file_names.all()):
        expect(element).to_have_text(file_names[i], use_inner_text=True)

    # The script should have printed the contents of the two files into a st.text.
    # This tests that the upload actually went through.
    content = "\n".join(
        [
            files[0]["buffer"].decode("utf-8"),
            files[1]["buffer"].decode("utf-8"),
        ]
    )
    expect_text(app, content)

    #  Delete the second file. The second file is on top because it was
    #  most recently uploaded. The first file should still exist.
    file_uploader_delete_btn = uploader.get_by_test_id("stFileUploaderDeleteBtn").first
    expect(file_uploader_delete_btn).to_be_visible()
    file_uploader_delete_btn.click()

    wait_for_app_run(app)

    expect_text(app, files[0]["buffer"].decode("utf-8"))


def test_does_not_call_callback_when_not_changed(app: Page):
    """Test that the file uploader does not call a callback when not changed."""
    file_name1 = "example5.txt"
    file_content1 = b"Hello world!"

    uploader = get_file_uploader(app, "Drop a file (with callback):")

    # Script contains counter variable stored in session_state with
    # default value 0. We increment counter inside file_uploader callback
    # Since callback did not called at this moment, counter value should
    # be equal 0

    file_dropzone = uploader.get_by_test_id("stFileUploaderDropzone").first
    expect(file_dropzone).to_be_visible()

    with app.expect_file_chooser() as fc_info:
        file_dropzone.click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(
                name=file_name1,
                mimeType="application/json",
                buffer=file_content1,
            )
        ]
    )

    wait_for_app_run(app)

    # Make sure callback called
    expect_text(app, "Rerun counter: 1")
    rerun_app(app)

    # Counter should be still equal 1
    expect_text(app, "Rerun counter: 1")


def test_works_inside_form(app: Page):
    """Test that uploading a file inside form works as expected."""
    file_name1 = "form_file1.txt"
    file_content1 = b"form_file1content"

    uploader = get_file_uploader(app, "Inside form:")
    file_dropzone = uploader.get_by_test_id("stFileUploaderDropzone").first
    expect(file_dropzone).to_be_visible()

    with app.expect_file_chooser() as fc_info:
        file_dropzone.click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1)
        ]
    )
    wait_for_app_run(app)

    # We should be showing the uploaded file name
    expect(uploader.get_by_test_id("stFileUploaderFileName")).to_have_text(
        file_name1, use_inner_text=True
    )
    # But our uploaded text should contain nothing yet, as we haven't submitted.
    expect_text(app, "No upload")

    # Submit the form
    click_form_button(app, "Submit")
    wait_for_app_run(app)

    # Now we should see the file's contents
    expect_text(app, str(file_content1))

    # Press the delete button. Again, nothing should happen - we
    # should still see the file's contents.
    uploader.get_by_test_id("stFileUploaderDeleteBtn").first.click()
    wait_for_app_run(app)
    expect_text(app, str(file_content1))

    # Submit again. Now the file should be gone.
    click_form_button(app, "Submit")
    wait_for_app_run(app)

    expect_text(app, "No upload")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stFileUploader")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "single")).to_be_visible()


def test_file_uploader_works_with_fragments(app: Page):
    """Test that file uploader works correctly within fragments."""
    file_name1 = "form_file1.txt"
    file_content1 = b"form_file1content"

    expect(app.get_by_text("Runs: 1")).to_be_visible()
    expect(app.get_by_text("File uploader in Fragment: False")).to_be_visible()

    uploader = get_file_uploader(app, "file uploader")
    file_dropzone = uploader.get_by_test_id("stFileUploaderDropzone").first
    expect(file_dropzone).to_be_visible()

    with app.expect_file_chooser() as fc_info:
        file_dropzone.click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1)
        ]
    )
    wait_for_app_run(app)

    expect(app.get_by_text("File uploader in Fragment: True")).to_be_visible()
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_file_uploader_upload_error(app: Page, app_port: int):
    """Test that the file uploader upload error is correctly logged."""
    # Ensure file upload source request return a 404 status
    app.route(
        f"http://localhost:{app_port}/_stcore/upload_file/**",
        lambda route: route.fulfill(
            status=404, headers={"Content-Type": "text/plain"}, body="Not Found"
        ),
    )

    # Capture console messages
    messages = []
    app.on("console", lambda msg: messages.append(msg.text))

    # Navigate to the app
    goto_app(app, f"http://localhost:{app_port}")

    file_name1 = "file1.txt"
    file_content1 = b"file1content"
    uploader = get_file_uploader(app, "Drop a file:")

    # Upload a file
    with app.expect_file_chooser() as fc_info:
        uploader.get_by_test_id("stFileUploaderDropzone").first.click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1)
        ]
    )
    wait_for_app_run(app)

    # Wait until the expected error is logged, indicating CLIENT_ERROR was sent
    wait_until(
        app,
        lambda: any(
            "Client Error: File uploader error on file upload" in message
            for message in messages
        ),
    )


def test_file_uploader_delete_error(app: Page, app_port: int):
    """Test that the file uploader delete error is correctly logged."""

    # Allow GET requests to pass through, but block DELETE requests
    def allow_file_upload_block_delete(route: Route):
        if route.request.method == "DELETE":
            route.fulfill(
                status=404, headers={"Content-Type": "text/plain"}, body="Not Found"
            )
        else:
            route.fallback()

    # Ensure file upload source request return a 404 status
    app.route(
        f"http://localhost:{app_port}/_stcore/upload_file/**",
        allow_file_upload_block_delete,
    )

    # Capture console messages
    messages = []
    app.on("console", lambda msg: messages.append(msg.text))

    # Navigate to the app
    goto_app(app, f"http://localhost:{app_port}")

    file_name1 = "file1.txt"
    file_content1 = b"file1content"
    uploader = get_file_uploader(app, "Drop a file:")

    # Upload a file
    with app.expect_file_chooser() as fc_info:
        uploader.get_by_test_id("stFileUploaderDropzone").first.click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1)
        ]
    )
    wait_for_app_run(app)

    # Delete the file
    app.get_by_test_id("stFileUploaderDeleteBtn").first.click()
    wait_for_app_run(app)

    # Wait until the expected error is logged, indicating CLIENT_ERROR was sent
    wait_until(
        app,
        lambda: any(
            "Client Error: File uploader error on file delete" in message
            for message in messages
        ),
    )


def test_file_uploader_widths(
    app: Page,
    assert_snapshot: ImageCompareFunction,
):
    """Test that file_uploader renders correctly with different width settings."""
    file_uploaders = app.get_by_test_id("stFileUploader")

    expect(file_uploaders).to_have_count(16)

    stretch_uploader = get_file_uploader(app, "Width Stretch")
    pixel_width_uploader = get_file_uploader(app, "Width 300px")

    assert_snapshot(stretch_uploader, name="st_file_uploader-width_stretch")
    assert_snapshot(pixel_width_uploader, name="st_file_uploader-width_300px")


def test_toggle_disable_after_upload_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Upload a file, then disable the uploader and snapshot its disabled visual state."""
    uploader = get_file_uploader(app, "Toggle disabled after upload:")

    # Upload a file
    file_name = "snap.txt"
    file_content = b"snapshot content"

    file_dropzone = uploader.get_by_test_id("stFileUploaderDropzone").first
    expect(file_dropzone).to_be_visible()

    with app.expect_file_chooser() as fc_info:
        file_dropzone.click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[FilePayload(name=file_name, mimeType="text/plain", buffer=file_content)]
    )

    wait_for_app_run(app)

    # Toggle checkbox to disable the uploader
    click_checkbox(app, "Disable toggle uploader")

    # Snapshot the uploader in disabled state with an uploaded file
    expect(uploader).to_be_visible()
    assert_snapshot(uploader, name="st_file_uploader-toggle_disabled_after_upload")
