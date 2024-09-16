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

from e2e_playwright.conftest import ImageCompareFunction, rerun_app, wait_for_app_run
from e2e_playwright.shared.app_utils import check_top_level_class, get_element_by_key


def test_file_uploader_render_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the file uploader render as expected via screenshot matching."""
    file_uploaders = themed_app.get_by_test_id("stFileUploader")
    expect(file_uploaders).to_have_count(8)

    assert_snapshot(file_uploaders.nth(0), name="st_file_uploader-single_file")
    assert_snapshot(file_uploaders.nth(1), name="st_file_uploader-disabled")
    assert_snapshot(file_uploaders.nth(2), name="st_file_uploader-multiple_files")
    assert_snapshot(file_uploaders.nth(4), name="st_file_uploader-hidden_label")
    assert_snapshot(file_uploaders.nth(5), name="st_file_uploader-collapsed_label")


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
            {
                "name": file_name1,
                "mimeType": "application/json",
                "buffer": file_content1,
            }
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
        files=[{"name": file_name1, "mimeType": "text/plain", "buffer": file_content1}]
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
        files=[{"name": file_name2, "mimeType": "text/plain", "buffer": file_content2}]
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
        {"name": file_name1, "mimeType": "text/plain", "buffer": file_content1},
        {"name": file_name2, "mimeType": "text/plain", "buffer": file_content2},
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

    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        files[0]["buffer"].decode("utf-8"), use_inner_text=True
    )

    expect(app.get_by_test_id("stMarkdownContainer").nth(5)).to_have_text(
        "True", use_inner_text=True
    )


def test_uploads_multiple_files_one_by_one_quickly(app: Page):
    """Test that uploads and deletes multiple files quickly works correctly."""
    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    files = [
        {"name": file_name1, "mimeType": "text/plain", "buffer": file_content1},
        {"name": file_name2, "mimeType": "text/plain", "buffer": file_content2},
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
        {"name": file_name1, "mimeType": "text/plain", "buffer": file_content1},
        {"name": file_name2, "mimeType": "text/plain", "buffer": file_content2},
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

    uploader_index = 6

    # Script contains counter variable stored in session_state with
    # default value 0. We increment counter inside file_uploader callback
    # Since callback did not called at this moment, counter value should
    # be equal 0
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        "0", use_inner_text=True
    )

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

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

    uploader_index = 3

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[{"name": file_name1, "mimeType": "text/plain", "buffer": file_content1}]
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
    file_name1 = "form_file1.txt"
    file_content1 = b"form_file1content"

    expect(app.get_by_text("Runs: 1")).to_be_visible()
    expect(app.get_by_text("File uploader in Fragment: False")).to_be_visible()

    uploader_index = 7

    with app.expect_file_chooser() as fc_info:
        app.get_by_test_id("stFileUploaderDropzone").nth(uploader_index).click()

    file_chooser = fc_info.value
    file_chooser.set_files(
        files=[{"name": file_name1, "mimeType": "text/plain", "buffer": file_content1}]
    )
    wait_for_app_run(app)

    expect(app.get_by_text("File uploader in Fragment: True")).to_be_visible()
    expect(app.get_by_text("Runs: 1")).to_be_visible()
