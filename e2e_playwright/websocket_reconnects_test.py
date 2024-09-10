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

from typing import Final

import pytest
from playwright.sync_api import FilePayload, Page, expect

from e2e_playwright.shared.app_utils import (
    click_button,
    expect_connection_status,
    expect_markdown,
    get_checkbox,
    wait_for_app_run,
)

INCREMENTS_PER_DISCONNECT: Final[int] = 3
NUM_DISCONNECTS: Final[int] = 15

DISCONNECT_WEBSOCKET_ACTION: Final = "window.streamlitDebug.disconnectWebsocket();"


def test_dont_observe_invalid_status(
    app: Page,
):
    """Test that unknown status is not observed and raises an error."""
    with pytest.raises(AssertionError) as e:
        expect_connection_status(app, "Connecting2", DISCONNECT_WEBSOCKET_ACTION)
    assert "timeout: did not observe status 'Connecting2'" in e.value.args


def test_retain_session_state_when_websocket_connection_drops_and_reconnects(
    app: Page,
):
    expected_count = 0
    for _ in range(NUM_DISCONNECTS):
        expected_count += INCREMENTS_PER_DISCONNECT

        # click disconnect button
        for _ in range(INCREMENTS_PER_DISCONNECT):
            click_button(app, "click me!")

        # disconnect and wait for status to change
        expect_connection_status(app, "CONNECTING", DISCONNECT_WEBSOCKET_ACTION)

        wait_for_app_run(app)
        expect_markdown(app, f"count: {expected_count}")


def test_reruns_script_when_interrupted_by_websocket_disconnect(
    app: Page,
):
    # Click on the checkbox, but don't wait for the app to finish running.
    get_checkbox(app, "do something slow").locator("label").click()

    expect_connection_status(app, "CONNECTING", DISCONNECT_WEBSOCKET_ACTION)

    wait_for_app_run(app)
    expect_markdown(app, "slow operations attempted: 2")


def test_retain_uploaded_files_when_websocket_connection_drops_and_reconnects(
    app: Page,
):
    file_name = "file1.txt"
    file_content = b"blob"

    app.get_by_test_id("stFileUploaderDropzoneInput").set_input_files(
        [
            FilePayload(name=file_name, buffer=file_content, mimeType="text/plain"),
        ],
    )

    expect(app.get_by_test_id("stFileUploaderFileName")).to_have_text(file_name)
    expect(app.get_by_test_id("stText").first).to_have_text(str(file_content))
    wait_for_app_run(app)

    # Disconnect
    expect_connection_status(app, "CONNECTING", DISCONNECT_WEBSOCKET_ACTION)

    # Wait until re-connected
    expect(app.get_by_test_id("stStatusWidget")).not_to_be_attached()

    # Confirm that our uploaded file is still there.
    expect(app.get_by_test_id("stText").first).to_have_text(str(file_content))


# skip webkit because the camera permission cannot be set programmatically
@pytest.mark.skip_browser("webkit")
def test_retain_captured_pictures_when_websocket_connection_drops_and_reconnects(
    app: Page, app_port: int
):
    # wait for the media call that is made when the image is returned
    with app.expect_event(
        "response",
        predicate=lambda response: response.url.startswith(
            f"http://localhost:{app_port}/media/"
        ),
    ):
        expect(app.get_by_test_id("stToolbar")).to_be_attached()
        camera_input_button = app.get_by_test_id("stCameraInputButton").nth(0)
        expect(camera_input_button).to_be_visible()
        expect(camera_input_button).to_contain_text("Take Photo")
        camera_input_button.click()

    app.wait_for_function("document.querySelectorAll('img').length == 2")
    expect(app.get_by_test_id("stImage")).to_have_count(1)

    # Wait for the image to be displayed
    expect(app.get_by_test_id("stImage")).to_be_visible()

    # Disconnect
    expect_connection_status(app, "CONNECTING", DISCONNECT_WEBSOCKET_ACTION)

    # Wait until re-connected
    expect(app.get_by_test_id("stStatusWidget")).not_to_be_attached()

    # Confirm that our picture is still there.
    expect(app.get_by_test_id("stImage")).to_have_count(1)
