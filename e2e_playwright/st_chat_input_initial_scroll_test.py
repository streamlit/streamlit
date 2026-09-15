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

"""E2E tests for initial scrolling with a bottom chat input."""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import build_app_url, wait_until
from e2e_playwright.shared.app_utils import goto_app


def test_bottom_chat_input_without_messages_starts_at_top(app: Page):
    """Verify a bottom chat input alone does not scroll a dashboard to the bottom."""
    expect(app.get_by_test_id("stAppScrollToBottomContainer")).not_to_be_attached()

    main = app.get_by_test_id("stMain")
    expect(app.get_by_text("Dashboard heading")).to_be_in_viewport()
    expect(app.get_by_text("Dashboard row 29")).not_to_be_in_viewport()

    consecutive_zero_reads = 0

    def scroll_stayed_at_top() -> bool:
        nonlocal consecutive_zero_reads
        if main.evaluate("(element) => element.scrollTop") != 0:
            consecutive_zero_reads = 0
            return False

        consecutive_zero_reads += 1
        return consecutive_zero_reads >= 5

    wait_until(app, scroll_stayed_at_top, timeout=2000, interval=100)


def test_bottom_chat_input_with_messages_starts_at_bottom(app: Page, app_base_url: str):
    """Verify an existing chat transcript retains initial auto-scroll."""
    app.set_viewport_size({"width": 1280, "height": 720})
    goto_app(
        app,
        build_app_url(app_base_url, query={"messages": "true"}),
    )

    expect(app.get_by_test_id("stAppScrollToBottomContainer")).to_be_attached()
    expect(app.get_by_text("Dashboard heading")).not_to_be_in_viewport()
    expect(app.get_by_text("Transcript message 29")).to_be_in_viewport()
