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

import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from playwright.sync_api import FilePayload, Page, Route, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    rerun_app,
    wait_for_app_run,
    wait_until,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
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
    app: Page, uploader_index: int, expected_files: list[str], expected_count: int
) -> None:
    """Helper function to verify uploaded files in the file uploader widget.

    Args:
        app: The Page object
        uploader_index: The index of the file uploader widget
        expected_files: List of expected file names (partial matches allowed)
        expected_count: Expected number of uploaded files
    """
    # Get all file names from the specific file uploader widget
    file_uploader = app.get_by_test_id("stFileUploader").nth(uploader_index)
    file_name_elements = file_uploader.get_by_test_id("stFileUploaderFileName")

    # Verify the expected count
    expect(file_name_elements).to_have_count(expected_count)

    # Verify all expected files are present (order-independent)
    # We need to check that each expected file appears in at least one element
    for expected_file in expected_files:
        # Create a locator that will match if any element contains the expected file
        matching_elements = file_name_elements.filter(has_text=expected_file)
        # Expect at least one element to contain this file
        expect(matching_elements.first).to_be_visible()


def test_file_uploader_render_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the file uploader render as expected via screenshot matching."""
    file_uploaders = themed_app.get_by_test_id("stFileUploader")
    expect(file_uploaders).to_have_count(16)

    assert_snapshot(file_uploaders.nth(0), name="st_file_uploader-single_file")
    assert_snapshot(file_uploaders.nth(1), name="st_file_uploader-disabled")
    assert_snapshot(file_uploaders.nth(2), name="st_file_uploader-multiple_files")
    assert_snapshot(file_uploaders.nth(3), name="st_file_uploader-directory")
    assert_snapshot(file_uploaders.nth(5), name="st_file_uploader-hidden_label")
    assert_snapshot(file_uploaders.nth(6), name="st_file_uploader-collapsed_label")
    # The other file uploaders do not need to be snapshot tested.
    assert_snapshot(file_uploaders.nth(9), name="st_file_uploader-markdown_label")
    assert_snapshot(file_uploaders.nth(10), name="st_file_uploader-compact")
    assert_snapshot(
        file_uploaders.nth(13), name="st_file_uploader-restricted_directory"
    )
    assert_snapshot(file_uploaders.nth(15), name="st_file_uploader-many_file_types")


def test_file_uploader_error_message_disallowed_files(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that shows error message for disallowed files."""
    file_name1 = "example.json"
    file_content1 = b"{}"

    uploader_index = 0

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

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
        app.get_by_test_id("stFileUploaderFileErrorMessage").nth(uploader_index)
    ).to_have_text("application/json files are not allowed.", use_inner_text=True)

    file_uploader_in_error_state = app.get_by_test_id("stFileUploader").nth(
        uploader_index
    )

    assert_snapshot(file_uploader_in_error_state, name="st_file_uploader-error")


def test_uploads_and_deletes_single_file_only(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that uploading a file for single file uploader works as expected."""
    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    uploader_index = 0

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1)
        ]
    )
    wait_for_app_run(app)

    expect(app.get_by_test_id("stFileUploaderFileName")).to_have_text(
        file_name1, use_inner_text=True
    )

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content1), use_inner_text=True
    )

    file_uploader_uploaded_state = app.get_by_test_id("stFileUploader").nth(
        uploader_index
    )

    assert_snapshot(
        file_uploader_uploaded_state, name="st_file_uploader-single_file_uploaded"
    )

    expect(
        app.get_by_test_id("stMarkdownContainer").nth(uploader_index + 1)
    ).to_have_text("True", use_inner_text=True)

    # Upload a second file. This one will replace the first.
    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(name=file_name2, mimeType="text/plain", buffer=file_content2)
        ]
    )

    wait_for_app_run(app)

    expect(app.get_by_test_id("stFileUploaderFileName")).to_have_text(
        file_name2, use_inner_text=True
    )

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content2), use_inner_text=True
    )

    expect(
        app.get_by_test_id("stMarkdownContainer").nth(uploader_index + 1)
    ).to_have_text("True", use_inner_text=True)

    rerun_app(app)

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content2), use_inner_text=True
    )

    app.get_by_test_id("stFileUploaderDeleteBtn").nth(uploader_index).click()

    wait_for_app_run(app)

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        "No upload", use_inner_text=True
    )


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

    uploader_index = 2

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(files=files)

    wait_for_app_run(app, wait_delay=500)

    uploaded_file_names = app.get_by_test_id("stFileUploaderFileName")

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
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        content, use_inner_text=True
    )

    file_uploader = app.get_by_test_id("stFileUploader").nth(uploader_index)
    assert_snapshot(file_uploader, name="st_file_uploader-multi_file_uploaded")

    #  Delete the second file. The second file is on top because it was
    #  most recently uploaded. The first file should still exist.
    app.get_by_test_id("stFileUploaderDeleteBtn").first.click()

    wait_for_app_run(app)

    uploaded_file_names = app.get_by_test_id("stFileUploaderFileName")
    expect(uploaded_file_names).to_have_count(1)

    expect(uploaded_file_names).to_have_text(files[0]["name"], use_inner_text=True)

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        files[0]["buffer"].decode("utf-8"), use_inner_text=True
    )

    file_uploader = app.get_by_test_id("stFileUploader").nth(uploader_index)
    assert_snapshot(file_uploader, name="st_file_uploader-multi_file_one_deleted")

    # Delete the remaining file
    app.get_by_test_id("stFileUploaderDeleteBtn").first.click()
    wait_for_app_run(app)

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        "No upload", use_inner_text=True
    )


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

    uploader_index = 3  # Directory uploader index

    file_uploader_dropzone = app.get_by_test_id("stFileUploaderDropzone").nth(
        uploader_index
    )
    expect(file_uploader_dropzone).to_be_visible()

    with app.expect_file_chooser() as fc_info:
        file_uploader_dropzone.click()

    file_chooser = fc_info.value
    file_chooser.set_files(files=[temp_dir])

    wait_for_app_run(app, wait_delay=1000)

    # Verify files appear in the widget using the helper function
    expected_files = [
        "upload_dir/folder/file1.txt",
        "upload_dir/folder/file2.py",
        "upload_dir/folder/subfolder/file3.md",
    ]
    verify_uploaded_files_in_widget(app, uploader_index, expected_files, 3)

    # Test deleting files from directory upload
    delete_button = app.get_by_test_id("stFileUploaderDeleteBtn").first
    expect(delete_button).to_be_visible()
    delete_button.click()
    wait_for_app_run(app)

    # Verify file count decreased
    uploader_text = app.get_by_test_id("stText").nth(uploader_index)
    expect(uploader_text).to_contain_text("Directory contains 2 files:")


def test_directory_upload_with_file_type_filtering(app: Page):
    """Test that directory upload correctly filters files by type.

    Note: We don't test the visual order of files in the widget because:
    1. The frontend intentionally displays files in reverse chronological order (newest first)
    2. The order in which browsers return directory files is non-deterministic
    3. We verify functionality by checking that files are filtered and uploaded correctly
    """
    uploader_index = 13  # Restricted directory uploader index

    # Create a temporary directory with test files
    directory_data = [
        {"path": "allowed.txt", "content": b"allowed content"},
        {"path": "disallowed.pdf", "content": b"pdf content"},
        {"path": "another_allowed.txt", "content": b"another txt file"},
        {"path": "nested/deep/file.txt", "content": b"nested file"},
    ]

    temp_dir = create_temp_directory_with_files(directory_data)

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(files=[temp_dir])

    wait_for_app_run(app, wait_delay=1000)

    # Verify files appear in the widget using the helper function
    expected_txt_files = ["allowed.txt", "another_allowed.txt", "nested/deep/file.txt"]
    verify_uploaded_files_in_widget(app, uploader_index, expected_txt_files, 3)

    # Additionally verify the .pdf file was NOT uploaded (it should have been filtered)
    file_uploader = app.get_by_test_id("stFileUploader").nth(uploader_index)
    file_name_elements = file_uploader.get_by_test_id("stFileUploaderFileName").all()
    all_file_names = [elem.inner_text() for elem in file_name_elements]
    assert not any("disallowed.pdf" in name for name in all_file_names), (
        "PDF file should have been filtered out"
    )


def test_directory_upload_empty_directory(app: Page):
    """Test that directory upload handles empty directories gracefully."""
    uploader_index = 3  # Directory uploader index

    # Click and cancel dialog to simulate empty directory selection
    with app.expect_file_chooser():
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    wait_for_app_run(app, wait_delay=500)

    # Verify empty directory is handled correctly
    uploader_text = app.get_by_test_id("stText").nth(uploader_index)
    expect(uploader_text).to_have_text("No directory upload", use_inner_text=True)


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

    uploader_index = 2

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(files=files[0])

    # The widget should show the name of the uploaded file
    expect(app.get_by_test_id("stFileUploaderFileName")).to_have_text(
        file_name1, use_inner_text=True
    )

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value

    with app.expect_request("**/upload_file/**"):
        file_chooser.set_files(files=files[1])

    uploaded_file_names = app.get_by_test_id("stFileUploaderFileName")

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
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        content, use_inner_text=True
    )

    #  Delete the second file. The second file is on top because it was
    #  most recently uploaded. The first file should still exist.
    app.get_by_test_id("stFileUploaderDeleteBtn").first.click()

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        files[0]["buffer"].decode("utf-8"), use_inner_text=True
    )

    expect(app.get_by_test_id("stMarkdownContainer").nth(5)).to_have_text(
        "True", use_inner_text=True
    )


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

    uploader_index = 2

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    # Here we wait for the first file to be uploaded before uploading the second
    with app.expect_request("**/upload_file/**"):
        file_chooser.set_files(files=files[0])

    # The widget should show the name of the uploaded file
    expect(app.get_by_test_id("stFileUploaderFileName")).to_have_text(
        file_name1, use_inner_text=True
    )

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value

    with app.expect_request("**/upload_file/**"):
        file_chooser.set_files(files=files[1])

    uploaded_file_names = app.get_by_test_id("stFileUploaderFileName")

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
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        content, use_inner_text=True
    )

    #  Delete the second file. The second file is on top because it was
    #  most recently uploaded. The first file should still exist.
    app.get_by_test_id("stFileUploaderDeleteBtn").first.click()

    wait_for_app_run(app)

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        files[0]["buffer"].decode("utf-8"), use_inner_text=True
    )

    expect(app.get_by_test_id("stMarkdownContainer").nth(5)).to_have_text(
        "True", use_inner_text=True
    )


def test_does_not_call_callback_when_not_changed(app: Page):
    """Test that the file uploader does not call a callback when not changed."""
    file_name1 = "example5.txt"
    file_content1 = b"Hello world!"

    uploader_index = 7

    # Script contains counter variable stored in session_state with
    # default value 0. We increment counter inside file_uploader callback
    # Since callback did not called at this moment, counter value should
    # be equal 0

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

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
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        "1", use_inner_text=True
    )
    rerun_app(app)

    # Counter should be still equal 1
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        "1", use_inner_text=True
    )


def test_works_inside_form(app: Page):
    """Test that uploading a file inside form works as expected."""
    file_name1 = "form_file1.txt"
    file_content1 = b"form_file1content"

    uploader_index = 4

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[
            FilePayload(name=file_name1, mimeType="text/plain", buffer=file_content1)
        ]
    )
    wait_for_app_run(app)

    # We should be showing the uploaded file name
    expect(app.get_by_test_id("stFileUploaderFileName")).to_have_text(
        file_name1, use_inner_text=True
    )
    # But our uploaded text should contain nothing yet, as we haven't submitted.
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        "No upload", use_inner_text=True
    )

    # Submit the form
    app.get_by_test_id("stFormSubmitButton").first.locator("button").click()
    wait_for_app_run(app)

    # Now we should see the file's contents
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content1), use_inner_text=True
    )

    # Press the delete button. Again, nothing should happen - we
    # should still see the file's contents.
    app.get_by_test_id("stFileUploaderDeleteBtn").first.click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content1), use_inner_text=True
    )

    # Submit again. Now the file should be gone.
    app.get_by_test_id("stFormSubmitButton").first.locator("button").click()
    wait_for_app_run(app)

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        "No upload", use_inner_text=True
    )


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

    uploader_index = 8

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

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
    uploader_index = 0

    # Upload a file
    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

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
    uploader_index = 0

    # Upload a file
    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

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

    stretch_uploader = file_uploaders.nth(11)
    pixel_width_uploader = file_uploaders.nth(12)

    assert_snapshot(stretch_uploader, name="st_file_uploader-width_stretch")
    assert_snapshot(pixel_width_uploader, name="st_file_uploader-width_300px")


def test_toggle_disable_after_upload_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Upload a file, then disable the uploader and snapshot its disabled visual state."""
    # Index of the toggle uploader is the last one (added at the end of the script)
    uploader_index = 14

    # Upload a file
    file_name = "snap.txt"
    file_content = b"snapshot content"

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[FilePayload(name=file_name, mimeType="text/plain", buffer=file_content)]
    )

    wait_for_app_run(app)

    # Toggle checkbox to disable the uploader (click label since input may be visually hidden)
    app.get_by_test_id("stCheckbox").filter(has_text="Disable toggle uploader").click()
    wait_for_app_run(app)

    # Snapshot the uploader in disabled state with an uploaded file
    toggled_uploader = app.get_by_test_id("stFileUploader").nth(uploader_index)
    assert_snapshot(
        toggled_uploader, name="st_file_uploader-toggle_disabled_after_upload"
    )
