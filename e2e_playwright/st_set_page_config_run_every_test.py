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
    click_toggle,
    get_element_by_key,
    get_text_input,
)


def _tick_text(app: Page, key: str) -> str:
    text = get_element_by_key(app, key).get_by_test_id("stMarkdown").inner_text()
    assert text
    return text


def test_page_run_every_reruns_without_clearing_an_unsubmitted_form(
    app: Page,
) -> None:
    """A page interval reruns the script and keeps in-progress form input."""
    tick = get_element_by_key(app, "tick_count").get_by_test_id("stMarkdown")
    initial = _tick_text(app, "tick_count")

    expect(tick).not_to_have_text(initial)
    expect(app.get_by_test_id("stException")).to_have_count(0)

    name = get_text_input(app, "Name").locator("input")
    name.fill("Ada")
    filled_tick = _tick_text(app, "tick_count")
    expect(tick).not_to_have_text(filled_tick)
    expect(name).to_have_value("Ada")
    expect(app.get_by_test_id("stException")).to_have_count(0)


def test_page_run_every_pauses_while_a_dialog_is_open(app: Page) -> None:
    """Ticks wait while an st.dialog is open and resume after it closes."""
    tick = get_element_by_key(app, "tick_count").get_by_test_id("stMarkdown")
    expect(tick).not_to_have_text(_tick_text(app, "tick_count"))

    click_button(app, "Open dialog")
    expect(app.get_by_role("dialog")).to_be_visible()
    frozen = _tick_text(app, "tick_count")

    # The interval is 1s. Waiting past one tick must not change the counter.
    app.wait_for_timeout(2200)
    expect(tick).to_have_text(frozen)

    app.get_by_role("button", name="Close").click()
    expect(app.get_by_role("dialog")).to_have_count(0)
    expect(tick).not_to_have_text(frozen)
    expect(app.get_by_test_id("stException")).to_have_count(0)


def test_page_run_every_stops_when_disabled_or_the_page_changes(app: Page) -> None:
    """Explicit None and a page that omits run_every both stop the timer."""
    tick = get_element_by_key(app, "tick_count").get_by_test_id("stMarkdown")
    expect(tick).not_to_have_text(_tick_text(app, "tick_count"))

    click_toggle(app, "Auto-refresh")
    frozen = _tick_text(app, "tick_count")
    app.wait_for_timeout(2200)
    expect(tick).to_have_text(frozen)

    app.get_by_role("link", name="Quiet").click()
    wait_for_app_run(app)
    expect(app.get_by_text("quiet-page")).to_be_visible()
    quiet = get_element_by_key(app, "quiet_ticks").get_by_test_id("stMarkdown")
    quiet_text = _tick_text(app, "quiet_ticks")
    app.wait_for_timeout(2200)
    expect(quiet).to_have_text(quiet_text)
    expect(app.get_by_test_id("stException")).to_have_count(0)
