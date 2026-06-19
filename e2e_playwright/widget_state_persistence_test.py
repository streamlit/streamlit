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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_checkbox,
    get_element_by_key,
    get_text_input,
)


def _fill_text_input(app: Page, label: str, value: str) -> None:
    field = get_text_input(app, label).locator("input").first
    field.fill(value)
    field.press("Enter")
    wait_for_app_run(app)


def _expect_value(app: Page, key: str, expected: str) -> None:
    expect(get_element_by_key(app, f"{key}_value")).to_contain_text(
        f"{key}: {expected}"
    )


def _navigate(app: Page, page_name: str) -> None:
    app.get_by_test_id("stSidebarNav").get_by_text(page_name, exact=True).click()
    wait_for_app_run(app)


def test_persist_state_when_not_rendered_on_same_page(app: Page) -> None:
    """page/session-scoped values survive unmounting; plain values reset."""
    click_checkbox(app, "Show widgets")

    _fill_text_input(app, "Page-scoped", "page_value")
    _fill_text_input(app, "Session-scoped", "session_value")
    _fill_text_input(app, "Not persisted", "plain_value")

    # Hide the widgets so they stop being rendered on the current page.
    click_checkbox(app, "Show widgets")

    _expect_value(app, "page_text", "page_value")
    _expect_value(app, "session_text", "session_value")
    # The non-persisted widget loses its value once unmounted.
    _expect_value(app, "plain_text", "UNSET")

    # Re-rendering restores the persisted values into the inputs.
    click_checkbox(app, "Show widgets")
    expect(get_text_input(app, "Page-scoped").locator("input")).to_have_value(
        "page_value"
    )
    expect(get_text_input(app, "Session-scoped").locator("input")).to_have_value(
        "session_value"
    )
    expect(get_text_input(app, "Not persisted").locator("input")).to_have_value("")


def test_session_scope_survives_page_switch_but_page_scope_does_not(
    app: Page,
) -> None:
    """Across a page switch, only session-scoped values are preserved."""
    click_checkbox(app, "Show widgets")
    _fill_text_input(app, "Page-scoped", "page_value")
    _fill_text_input(app, "Session-scoped", "session_value")

    _navigate(app, "Page 2")
    expect(app.get_by_role("heading", name="Page 2")).to_be_visible()

    # The session-scoped value is preserved on the new page; the page-scoped
    # value is dropped and falls back to its default (empty) value.
    expect(get_text_input(app, "Session-scoped").locator("input")).to_have_value(
        "session_value"
    )
    expect(get_text_input(app, "Page-scoped").locator("input")).to_have_value("")

    # Navigating back keeps the session value and still drops the page value.
    _navigate(app, "Page 1")
    expect(app.get_by_role("heading", name="Page 1")).to_be_visible()
    expect(get_text_input(app, "Session-scoped").locator("input")).to_have_value(
        "session_value"
    )
    expect(get_text_input(app, "Page-scoped").locator("input")).to_have_value("")


def test_persist_state_does_not_touch_query_params(app: Page) -> None:
    """persist_state is server-side only and must not add URL query params."""
    click_checkbox(app, "Show widgets")
    _fill_text_input(app, "Page-scoped", "page_value")
    _fill_text_input(app, "Session-scoped", "session_value")

    assert "?" not in app.url or app.url.split("?", 1)[1] == ""
