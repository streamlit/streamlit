# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""A browser that reconnects to a new session keeps its widget values."""

from __future__ import annotations

import re
from typing import Final

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import build_app_url, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    click_form_button,
    expect_connection_status,
    expect_markdown,
    get_element_by_key,
    get_text_input,
    select_selectbox_option,
)

_DISCONNECT_WEBSOCKET: Final = "window.streamlitDebug.disconnectWebsocket();"


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    # A disconnected session expires at once, so the browser reconnects to a
    # new session, as after a server restart.
    return ["--server.disconnectedSessionTTL", "0"]


def _new_session_count(app: Page, app_base_url: str) -> int:
    """The number of sessions the server created, from its session metrics."""
    response = app.request.get(
        build_app_url(
            app_base_url, path="/_stcore/metrics", query="families=session_events"
        )
    )
    match = re.search(
        r'session_events_total{type="connect"} (\d+(?:\.\d+)?)', response.text()
    )
    return int(float(match.group(1))) if match else 0


def test_values_survive_a_reconnect_to_a_new_session(
    app: Page, app_base_url: str
) -> None:
    """The new session restores the browser's values without running callbacks."""
    text_input = get_text_input(app, "Name").locator("input").first
    text_input.fill("Ann")
    text_input.press("Enter")
    wait_for_app_run(app)
    select_selectbox_option(app, "Pick", "b")
    click_checkbox(app, "Agree")
    expect_markdown(app, "values: Ann, b, True")
    expect_markdown(app, "changes: 3")
    sessions_before = _new_session_count(app, app_base_url)

    _reconnect_to_a_new_session(app)
    # An interaction sends the browser's whole widget map to the new session.
    click_button(app, "Rerun")

    assert _new_session_count(app, app_base_url) > sessions_before
    expect_markdown(app, "values: Ann, b, True")
    # The new session's state starts over, and no callback ran for the values.
    expect_markdown(app, "changes: 0")
    # The click reached a session that had registered nothing, and still counts.
    expect_markdown(app, "clicked: True")


def _reconnect_to_a_new_session(app: Page) -> None:
    """Drop the connection, so the browser reconnects to a new session."""
    expect_connection_status(app, "CONNECTING", _DISCONNECT_WEBSOCKET)
    expect(app.get_by_test_id("stStatusWidget")).not_to_be_attached()


def test_the_first_trigger_after_a_reconnect_lands(
    app: Page, app_base_url: str
) -> None:
    """A form submit or chat message that is the first interaction is not lost.

    The browser does not rerun when it reconnects, so the trigger reaches a
    session that registered no widget yet.
    """
    get_text_input(app, "City").locator("input").first.fill("Bern")
    expect_markdown(app, re.compile(r"^submitted: False,$"))
    sessions_before = _new_session_count(app, app_base_url)

    _reconnect_to_a_new_session(app)
    click_form_button(app, "Submit")

    assert _new_session_count(app, app_base_url) > sessions_before
    expect_markdown(app, "submitted: True, Bern")
    expect_markdown(app, "clicked: False")

    _reconnect_to_a_new_session(app)
    chat_input = get_element_by_key(app, "chat").locator("textarea").first
    chat_input.fill("hi")
    chat_input.press("Enter")
    wait_for_app_run(app)

    expect_markdown(app, "message: hi")
    # A form submit is a trigger too, so it does not come back.
    expect_markdown(app, "submitted: False, Bern")
