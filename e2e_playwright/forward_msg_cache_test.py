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

from typing import TYPE_CHECKING, Final

import pytest

from e2e_playwright.shared.app_utils import (
    click_button,
    click_toggle,
    fill_number_input,
    goto_app,
)

if TYPE_CHECKING:
    from playwright.sync_api import Page, WebSocket


def _rerun_app(app: Page, times: int):
    for _ in range(times):
        click_button(app, "Re-run")


@pytest.mark.performance
@pytest.mark.repeat(2)  # only repeat 2 times since otherwise it would take too long
def test_simulate_large_data_usage_performance(app: Page):
    # Rerun app a couple of times:
    _rerun_app(app, 5)

    # Show dataframe:
    click_toggle(app, "Show dataframes")
    # Rerun app a couple of times:
    _rerun_app(app, 5)

    # # Set 50k rows:
    fill_number_input(app, "Number of rows", 50000)

    # Rerun app a couple of times:
    _rerun_app(app, 5)

    # Show more text messages:
    fill_number_input(app, "Number of small messages", 100)

    # Rerun app a couple of times:
    _rerun_app(app, 10)


@pytest.mark.performance
@pytest.mark.repeat(2)  # only repeat 2 times since otherwise it would take too long
def test_simulate_many_small_messages_performance(app: Page):
    # Show 150 unique texts with 50kb each:
    fill_number_input(app, "Number of small messages", 150)
    _rerun_app(app, 5)

    # Reduce the size of every message to 15KB:
    fill_number_input(app, "Message KB size", 15)
    _rerun_app(app, 10)


def test_check_total_websocket_message_number_and_size(page: Page, app_port: int):
    """Test that verifies the number and total size of websocket messages
    during the simluated forward message cache run is under a configured threshold.
    """

    # Define an acceptable threshold for total websocket message size (in MB)
    # for a simulated forward message cache run with large messages.
    # If the threshold is exceeded significantly, it might indicate a bug with
    # the forward message cache. You can modify this threshold if it's needed,
    # justified, and expected.

    # BackMsg's
    TOTAL_WEBSOCKET_SENT_SIZE_THRESHOLD_MB: Final = 0.1  # noqa: N806
    # Number of websocket messages sent
    EXPECTED_WEBSOCKET_MESSAGES_SENT: Final = 34  # noqa: N806

    # ForwardMsg's
    TOTAL_WEBSOCKET_RECEIVED_SIZE_THRESHOLD_MB: Final = 55  # noqa: N806
    # Max number of websocket messages received.
    EXPECTED_WEBSOCKET_MESSAGES_RECEIVED: Final = 2540  # noqa: N806
    # There can be a bit of fluctuation because of optimization logic:
    # See the composable messages logic in
    # lib/streamlit/runtime/forward_msg_queue.py (-> `_maybe_compose_delta_msgs`)
    # the queues can be flushed to the browser before
    # the optimization is able to be applied.
    ALLOWED_WEBSOCKET_MESSAGES_RECEIVED_DIFFERENCE: Final = 25  # noqa: N806

    total_websocket_sent_size_bytes: int = 0
    total_websocket_received_size_bytes: int = 0
    total_websocket_messages_sent: int = 0
    total_websocket_messages_received: int = 0

    def on_web_socket(ws: WebSocket) -> None:
        print(f"WebSocket opened: {ws.url}")

        def on_frame_sent(payload: str | bytes):
            nonlocal total_websocket_sent_size_bytes
            nonlocal total_websocket_messages_sent
            if isinstance(payload, str):
                payload = payload.encode("utf-8")
            total_websocket_sent_size_bytes += len(payload)
            total_websocket_messages_sent += 1

        def on_frame_received(payload: str | bytes):
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

    goto_app(page, f"http://localhost:{app_port}/")
    # Wait until all dependent resources are loaded:
    page.wait_for_load_state()

    # Rerun app a couple of times:
    _rerun_app(page, 5)

    # Show dataframe:
    click_toggle(page, "Show dataframes")
    # Rerun app a couple of times:
    _rerun_app(page, 5)

    # # Set 50k rows:
    fill_number_input(page, "Number of rows", 50000)

    # Rerun fragment a couple of times:
    click_button(page, "Rerun fragment")
    click_button(page, "Rerun fragment")
    click_button(page, "Rerun fragment")
    click_button(page, "Rerun fragment")
    click_button(page, "Rerun fragment")
    # -> Running fragments should not clear cached messages of non-fragments

    # Rerun app a couple of times:
    _rerun_app(page, 5)

    # Show more text messages:
    fill_number_input(page, "Number of small messages", 100)

    # Rerun app a couple of times:
    _rerun_app(page, 10)

    # Assert that the total number of websocket messages received and sent is equal
    assert (
        abs(total_websocket_messages_received - EXPECTED_WEBSOCKET_MESSAGES_RECEIVED)
        < ALLOWED_WEBSOCKET_MESSAGES_RECEIVED_DIFFERENCE
    ), (
        f"Total number of websocket messages received by the frontend "
        f"{total_websocket_messages_received} but expected to receive"
        f"{EXPECTED_WEBSOCKET_MESSAGES_RECEIVED} +/- "
        f"{ALLOWED_WEBSOCKET_MESSAGES_RECEIVED_DIFFERENCE}. In case this is expected, "
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
        < TOTAL_WEBSOCKET_RECEIVED_SIZE_THRESHOLD_MB * 1024 * 1024
    ), (
        f"Total received size of websocket messages "
        f"({total_websocket_received_size_bytes / 1024 / 1024:.2f}MB) "
        "exceeds the configured threshold "
        f"({TOTAL_WEBSOCKET_RECEIVED_SIZE_THRESHOLD_MB}MB)"
        "In case this is expected and justified, you can change the "
        "threshold in the test."
    )
    assert (
        total_websocket_sent_size_bytes
        < TOTAL_WEBSOCKET_SENT_SIZE_THRESHOLD_MB * 1024 * 1024
    ), (
        "Total sent size of websocket messages "
        f"({total_websocket_sent_size_bytes / 1024 / 1024:.2f}MB) "
        "exceeds the configured threshold "
        f"({TOTAL_WEBSOCKET_SENT_SIZE_THRESHOLD_MB}MB)"
        "In case this is expected and justified, you can change the "
        "threshold in the test."
    )
