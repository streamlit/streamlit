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

from typing import Final

import pytest
from playwright.sync_api import Page, Response, WebSocket, expect

from e2e_playwright.conftest import wait_for_app_loaded


def test_is_webdriver_set(app: Page):
    """Test that verifies that the window.navigator.webdriver is set to True
    when running inside an end-to-end test.

    This isn't great but it's the best way we came up with to double-check that
    MetricsManager.isWebdriver() does what we want it to. We basically just
    copy the contents of that function here for testing :( .
    """
    content = app.evaluate("window.navigator.webdriver")
    assert content, "window.navigator.webdriver is set to False"


def test_total_loaded_assets_size_under_threshold(page: Page, app_port: int):
    """Test that verifies the total size of loaded web assets is under a
    configured threshold.
    """

    # Define an acceptable threshold for total size of web assets loaded on the
    # frontend (in MB) for a basic app run. While its important to keep the total
    # size of web assets low, you can modify this threshold if it's really needed
    # to add some new features. But make sure that its justified and intended.
    TOTAL_ASSET_SIZE_THRESHOLD_MB: Final = 7.5  # noqa: N806

    total_size_bytes = 0

    def handle_response(response: Response):
        nonlocal total_size_bytes
        try:
            # First try content-length header
            content_length = response.headers.get("content-length")
            if content_length:
                total_size_bytes += int(content_length)
            else:
                # If that fails, read the body (expensive for large files)
                body = response.body()
                total_size_bytes += len(body)
        except Exception as ex:
            print(f"Error calculating size of web assets: {ex}")

    # Register the response handler
    page.on("response", handle_response)

    page.goto(f"http://localhost:{app_port}/")
    wait_for_app_loaded(page)
    # Wait until all dependent resources are loaded:
    page.wait_for_load_state()
    # Wait until Hello world is visible:
    expect(page.get_by_text("Hello world")).to_be_visible()
    # Additional wait for lazy-loaded resources to load:
    page.wait_for_timeout(1000)

    # Convert to MB and assert it's under threshold
    total_size_mb = total_size_bytes / (1024 * 1024)
    assert total_size_mb < TOTAL_ASSET_SIZE_THRESHOLD_MB, (
        f"Total web asset size loaded on the frontend ({total_size_mb:.2f}MB) for a "
        f"basic app exceeds {TOTAL_ASSET_SIZE_THRESHOLD_MB}MB limit. "
        "In case this is expected and justified, you can change the "
        "threshold in the test."
    )


def test_check_total_websocket_message_number_and_size(page: Page, app_port: int):
    """Test that verifies the number and total size of websocket messages
    of the basic app is under a configured threshold.
    """

    # Define an acceptable threshold for total websocket message size (in bytes)
    # for a basic app run. While its important to keep the total websocket message
    # size low, you can modify this threshold if it's really needed, justified,
    # and expected

    # BackMsg's; currently: ~70 bytes
    TOTAL_WEBSOCKET_SENT_SIZE_THRESHOLD_BYTES: Final = 150  # noqa: N806
    # Number of websocket messages sent
    EXPECTED_WEBSOCKET_MESSAGES_SENT: Final = 1  # noqa: N806

    # ForwardMsg's; currently: ~1200 bytes
    TOTAL_WEBSOCKET_RECEIVED_SIZE_THRESHOLD_BYTES: Final = 2000  # noqa: N806
    # Number of websocket messages received
    EXPECTED_WEBSOCKET_MESSAGES_RECEIVED: Final = 8  # noqa: N806

    total_websocket_sent_size_bytes = 0
    total_websocket_received_size_bytes = 0
    total_websocket_messages_sent = 0
    total_websocket_messages_received = 0

    def on_web_socket(ws: WebSocket) -> None:
        print(f"WebSocket opened: {ws.url}")

        def on_frame_sent(payload: str | bytes) -> None:
            nonlocal total_websocket_sent_size_bytes
            nonlocal total_websocket_messages_sent
            if isinstance(payload, str):
                payload = payload.encode("utf-8")
            total_websocket_sent_size_bytes += len(payload)
            total_websocket_messages_sent += 1

        def on_frame_received(payload: str | bytes) -> None:
            nonlocal total_websocket_received_size_bytes
            nonlocal total_websocket_messages_received
            if isinstance(payload, str):
                payload = payload.encode("utf-8")
            total_websocket_received_size_bytes += len(payload)
            total_websocket_messages_received += 1

        ws.on("framesent", on_frame_sent)
        ws.on("framereceived", on_frame_received)
        ws.on("close", lambda _: print("WebSocket closed"))

    # Register websocket handler
    page.on("websocket", on_web_socket)

    page.goto(f"http://localhost:{app_port}/")
    wait_for_app_loaded(page)
    # Wait until all dependent resources are loaded:
    page.wait_for_load_state()
    # Wait until Hello world is visible:
    expect(page.get_by_text("Hello world")).to_be_visible()

    # Assert that the total number of websocket messages received and sent is equal
    assert total_websocket_messages_received == EXPECTED_WEBSOCKET_MESSAGES_RECEIVED, (
        f"Total number of websocket messages received by the frontend "
        f"{total_websocket_messages_received} but expected to receive "
        f"{EXPECTED_WEBSOCKET_MESSAGES_RECEIVED}. In case this is expected, "
        "you can change the number in the test."
    )
    assert total_websocket_messages_sent == EXPECTED_WEBSOCKET_MESSAGES_SENT, (
        f"Total number of websocket messages sent by the frontend "
        f"{total_websocket_messages_sent} but expected to send "
        f"{EXPECTED_WEBSOCKET_MESSAGES_SENT}. In case this is expected, "
        "you can change the number in the test."
    )

    # Assert that the total size of websocket messages is under the threshold:
    assert (
        total_websocket_received_size_bytes
        < TOTAL_WEBSOCKET_RECEIVED_SIZE_THRESHOLD_BYTES
    ), (
        f"Total received size of websocket messages "
        f"({total_websocket_received_size_bytes} bytes) "
        "exceeds the configured threshold "
        f"({TOTAL_WEBSOCKET_RECEIVED_SIZE_THRESHOLD_BYTES} bytes)"
        "In case this is expected and justified, you can change the "
        "threshold in the test."
    )
    assert (
        total_websocket_sent_size_bytes < TOTAL_WEBSOCKET_SENT_SIZE_THRESHOLD_BYTES
    ), (
        "Total sent size of websocket messages "
        f"({total_websocket_sent_size_bytes} bytes) "
        "exceeds the configured threshold "
        f"({TOTAL_WEBSOCKET_SENT_SIZE_THRESHOLD_BYTES} bytes)"
        "In case this is expected and justified, you can change the "
        "threshold in the test."
    )


@pytest.mark.performance
def test_basic_app_performance(app: Page):
    """Collect performance metrics for a basic app."""
    # Wait until all dependent resources are loaded:
    app.wait_for_load_state()
    expect(app.get_by_text("Hello world")).to_be_visible()
