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
    click_button,
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
    # The current st.session_state value is always written into a keyed
    # container so it can be asserted regardless of whether the widget renders.
    expect(get_element_by_key(app, f"{key}_value")).to_have_text(f"{key}: {expected}")


def _expect_input_value(app: Page, label: str, expected: str) -> None:
    # Assert the value actually rendered in the widget UI, not just the
    # st.session_state readout — a remounted widget must adopt the preserved
    # value rather than fall back to its default.
    expect(get_text_input(app, label).locator("input").first).to_have_value(expected)


def _navigate(app: Page, page_name: str) -> None:
    app.get_by_test_id("stSidebarNav").get_by_text(page_name, exact=True).click()
    wait_for_app_run(app)


def test_persist_state_survives_unmount_remount_on_same_page(app: Page) -> None:
    """Single-page lifecycle for persist_state: persisted values survive an
    unmount, are restored on the re-rendered widget, are not clobbered by a
    follow-up rerun, and are never written to the URL. A non-persisted widget
    resets, mirroring the default redisplay behavior covered in
    widget_state_test.py.
    """
    click_checkbox(app, "Show widgets")
    _fill_text_input(app, "Page-scoped", "page_value")
    _fill_text_input(app, "Session-scoped", "session_value")
    _fill_text_input(app, "Not persisted", "plain_value")

    # persist_state is server-side only and must not add URL query params.
    query_string = app.url.split("?", 1)[1] if "?" in app.url else ""
    assert query_string == ""

    # Hide the widgets so they stop being rendered, then rerun to settle the
    # post-cleanup state for the value readouts.
    click_checkbox(app, "Show widgets")
    click_button(app, "Rerun")

    # Persisted values survive the unmount; the non-persisted one is dropped.
    _expect_value(app, "page_text", "page_value")
    _expect_value(app, "session_text", "session_value")
    _expect_value(app, "plain_text", "UNSET")

    # Show the widgets again: the remounted widgets must render the preserved
    # values, not their default.
    click_checkbox(app, "Show widgets")
    _expect_input_value(app, "Page-scoped", "page_value")
    _expect_input_value(app, "Session-scoped", "session_value")

    # A follow-up rerun must not clobber the restored values.
    click_button(app, "Rerun")
    _expect_input_value(app, "Page-scoped", "page_value")
    _expect_input_value(app, "Session-scoped", "session_value")


def test_session_scoped_value_restored_after_page_switch(app: Page) -> None:
    """A persist_state="session" value survives an A -> B -> A page switch and
    is restored on the re-rendered widget.
    """
    click_checkbox(app, "Show widgets")
    _fill_text_input(app, "Session-scoped", "session_value")

    _navigate(app, "Page 2")
    expect(app.get_by_role("heading", name="Page 2")).to_be_visible()
    _navigate(app, "Page 1")
    expect(app.get_by_role("heading", name="Page 1")).to_be_visible()

    _expect_input_value(app, "Session-scoped", "session_value")


def test_page_scoped_value_does_not_leak_across_pages(app: Page) -> None:
    """A persist_state="page" value is dropped after switching pages and is not
    restored when returning to the originating page.
    """
    click_checkbox(app, "Show widgets")
    _fill_text_input(app, "Page-scoped", "page_value")

    _navigate(app, "Page 2")
    expect(app.get_by_role("heading", name="Page 2")).to_be_visible()
    click_button(app, "Rerun")

    # The page-scoped value from Page 1 must not carry over to Page 2.
    expect(get_element_by_key(app, "page_text_value")).not_to_contain_text("page_value")
    _expect_input_value(app, "Page-scoped", "")

    # Returning to Page 1 must not resurrect the dropped page-scoped value.
    _navigate(app, "Page 1")
    expect(app.get_by_role("heading", name="Page 1")).to_be_visible()
    _expect_input_value(app, "Page-scoped", "")


def test_page_scoped_value_dropped_when_other_page_skips_widget(app: Page) -> None:
    """A persist_state="page" widget rendered on Page 1 only is dropped after an
    A -> B -> A switch (Page 2 never renders it), while a session-scoped widget
    in the same flow is preserved and a non-persisted one is dropped.
    """
    click_checkbox(app, "Show widgets")
    _fill_text_input(app, "Solo page", "page_value")
    _fill_text_input(app, "Solo session", "session_value")
    _fill_text_input(app, "Solo plain", "plain_value")

    # Page 2 does not render the Page 1-only widgets.
    _navigate(app, "Page 2")
    expect(app.get_by_role("heading", name="Page 2")).to_be_visible()
    # The Page 1-only widgets must not be present on Page 2.
    expect(
        app.get_by_test_id("stTextInput").filter(has_text="Solo page")
    ).to_have_count(0)

    _navigate(app, "Page 1")
    expect(app.get_by_role("heading", name="Page 1")).to_be_visible()

    # The page-scoped widget must fall back to its default on return, and its
    # dropped value must not resurface in session_state.
    _expect_input_value(app, "Solo page", "")
    expect(get_element_by_key(app, "p1_page_text_value")).not_to_contain_text(
        "page_value"
    )
    # The session-scoped widget must keep its value across the page switch.
    _expect_input_value(app, "Solo session", "session_value")
    _expect_value(app, "p1_session_text", "session_value")
    # The non-persisted widget is also dropped.
    _expect_input_value(app, "Solo plain", "")
    expect(get_element_by_key(app, "p1_plain_text_value")).not_to_contain_text(
        "plain_value"
    )
