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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    get_element_by_key,
    get_number_input,
    get_text_input,
    get_toggle,
)

# A remount replaces the element's DOM node, which drops this marker.
_MARKER = "data-retention-probe"


def _mark(locator: Locator) -> None:
    locator.evaluate(f"el => el.setAttribute('{_MARKER}', 'original')")


def _commit_text(app: Page, label: str, value: str) -> None:
    text_input = get_text_input(app, label).locator("input")
    text_input.fill(value)
    text_input.press("Enter")
    wait_for_app_run(app)


def test_shifted_elements_stay_mounted(app: Page):
    """Output inserted above keyed elements doesn't remount them."""
    _commit_text(app, "Name", "Ada")
    _commit_text(app, "In column", "Bob")

    name = get_element_by_key(app, "name")
    editor = get_element_by_key(app, "editor")
    _mark(name)
    _mark(editor)

    get_toggle(app, "Insert notice").locator("label").click()

    # While the run sleeps, the displaced input is hidden, not duplicated.
    expect(app.get_by_text("Inserted notice")).to_be_visible()
    expect(name).to_be_hidden()
    wait_for_app_run(app)

    expect(name).to_be_visible()
    expect(name).to_have_attribute(_MARKER, "original")
    expect(editor).to_have_attribute(_MARKER, "original")
    expect(name.locator("input")).to_have_value("Ada")
    expect(app.get_by_test_id("stTextInput").filter(has_text="Name")).to_have_count(1)
    # The input inside the displaced columns block remounts but keeps its value.
    expect(get_text_input(app, "In column").locator("input")).to_have_value("Bob")


def test_displaced_input_keeps_focus(app: Page):
    """A focused input that a rerun displaces stays visible and focused."""
    query = get_element_by_key(app, "query")
    _mark(query)
    query_input = query.locator("input")

    query_input.fill("streamlit")
    query_input.press("Enter")

    expect(app.get_by_text("Searching for streamlit")).to_be_visible()
    expect(query_input).to_be_visible()
    wait_for_app_run(app)

    expect(query_input).to_be_focused()
    expect(query).to_have_attribute(_MARKER, "original")
    expect(query_input).to_have_value("streamlit")


def test_replaced_widget_is_hidden_then_removed(app: Page):
    """A displaced element that the run never re-emits leaves no ghost."""
    label = get_element_by_key(app, "label")
    expect(label).to_be_visible()

    get_toggle(app, "Use number input").locator("label").click()

    expect(get_number_input(app, "Amount")).to_be_visible()
    expect(label).to_be_hidden()
    wait_for_app_run(app)

    expect(label).not_to_be_attached()


def test_input_after_spinner_is_visible_during_run(app: Page):
    """An input re-emitted over a spinner's delta path shows before the run ends."""
    after_spinner = get_element_by_key(app, "after_spinner")
    _mark(after_spinner)

    get_toggle(app, "Add notice before spinner").locator("label").click()

    expect(app.get_by_text("Notice above spinner", exact=True)).to_be_visible()
    expect(after_spinner).to_be_visible()
    # The run still sleeps, so the input didn't wait for stale cleanup to show.
    expect(app.get_by_test_id("stApp")).to_have_attribute(
        "data-test-script-state", "running"
    )
    wait_for_app_run(app)

    expect(after_spinner).to_have_attribute(_MARKER, "original")
