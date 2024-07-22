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
from playwright.sync_api import Error, FilePayload, Page, expect

from e2e_playwright.shared.app_utils import (
    click_button,
    expect_markdown,
    wait_for_app_run,
)

INCREMENTS_PER_DISCONNECT: Final[int] = 3
NUM_DISCONNECTS: Final[int] = 15

DISCONNECT_WEBSOCKET_ACTION: Final = "window.streamlitDebug.disconnectWebsocket();"


def _get_status(app: Page, expected_status: str, callable_action: str) -> str:
    """Wait for the expected_status to appear in the status widget.

    Uses the browser's MutationObserver API to observe changes to the DOM. This way,
    we will never have a race condition between calling disconnect and checking the
    status.
    If the status is not observed within 1 second, the promise will reject with a
    timeout which raises an exception in Playwright.
    Otherwise, the status is returned as a value.
    """

    return app.evaluate(
        """async ([expectedStatus]) => {
                const p = new Promise((resolve, reject) => {
                    // Define a timeoutId so that we can cancel the timeout in the
                    // callback upon success
                    let timeoutId = null

                    const callback = (mutationList, observer) => {
                        for (const mutation of mutationList) {
                            console.log(mutation)
                            if (mutation.type !== "childList") {
                                continue
                            }
                            if (mutation.addedNodes.length === 0) {
                                continue
                            }
                            for (const node of mutation.addedNodes) {
                                const testId = node.getAttribute('data-testid')
                                if (testId === 'stStatusWidget') {
                                    const status = node.textContent
                                    if (status.indexOf(expectedStatus) > -1) {
                                        if (timeoutId) clearTimeout(timeoutId)
                                        if (observer) observer.disconnect()
                                        resolve(status)
                                        return
                                    }
                                }
                            }
                        }
                    }
                    const observer = new MutationObserver(callback);
                    // Observe toolbar for changes, which includes status widget
                    const targetNode = document.querySelector('[data-testid=stToolbar]')
                    if (!targetNode) {
                        reject("toolbar not found")
                        return
                    }
                    const config = { childList: true, subtree: true };
                    observer.observe(targetNode, config);

            """
        + callable_action
        + """
                    timeoutId = setTimeout(() => {
                        if (observer) observer.disconnect()
                        reject(`timeout: did not observe status '${expectedStatus}'`)
                        return
                    }, 3000);
                })

                const status = await p
                return status
            }
            """,
        [expected_status],
    )


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
        status = _get_status(app, "Connecting", DISCONNECT_WEBSOCKET_ACTION)
        assert status == "Connecting"

        wait_for_app_run(app)
        expect_markdown(app, f"count: {expected_count}")


def test_dont_observe_invalid_status(
    app: Page,
):
    """Test that unknown status is not observed and raises an error."""
    with pytest.raises(Error) as e:
        _get_status(app, "Connecting2", DISCONNECT_WEBSOCKET_ACTION)
    assert "timeout: did not observe status 'Connecting2'" in e.value.message


def test_retain_uploaded_files_when_websocket_connection_drops_and_reconnects(
    app: Page,
):
    file_name1 = "file1.txt"
    file_content1 = b"blob"
    uploader_index = 0

    app.get_by_test_id("stFileUploaderDropzoneInput").nth(
        uploader_index
    ).set_input_files(
        [
            FilePayload(name=file_name1, buffer=file_content1, mimeType="text/plain"),
        ],
    )

    expect(app.get_by_test_id("stFileUploaderFileName")).to_have_text(file_name1)
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content1)
    )
    wait_for_app_run(app)

    status = _get_status(app, "Connecting", DISCONNECT_WEBSOCKET_ACTION)
    assert status == "Connecting"

    # wait until re-connected
    expect(app.get_by_test_id("stStatusWidget")).not_to_be_attached()

    # Confirm that our uploaded file is still there.
    expect(app.get_by_test_id("stText").nth(uploader_index)).to_have_text(
        str(file_content1)
    )


def test_retain_captured_pictures_when_websocket_connection_drops_and_reconnects(
    app: Page,
):
    expect(app.get_by_test_id("stToolbar")).to_be_attached()
    camera_input_button = app.get_by_test_id("stCameraInputButton").nth(0)
    expect(camera_input_button).to_be_visible()
    expect(camera_input_button).to_contain_text("Take Photo")
    camera_input_button.click()

    app.wait_for_function("document.querySelectorAll('img').length >= 2")
    app.wait_for_function(
        "document.querySelectorAll('[data-testid=\"stImage\"]').length >= 1"
    )

    # Wait for the image to be displayed
    expect(app.get_by_test_id("stImage")).to_be_visible()

    wait_for_app_run(app)

    # Disconnect
    status = _get_status(app, "Connecting", DISCONNECT_WEBSOCKET_ACTION)
    assert status == "Connecting"

    # wait until re-connected
    expect(app.get_by_test_id("stStatusWidget")).not_to_be_attached()

    # Confirm that our picture is still there.
    app.wait_for_function(
        "document.querySelectorAll('[data-testid=\"stImage\"]').length >= 1"
    )
