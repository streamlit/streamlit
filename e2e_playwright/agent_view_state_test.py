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

"""An agent reproduces the user's view from the state embedded in the page.

Each test changes filters in the browser, scrapes the embedded state the way a
co-browsing agent would, replays it through the agent API in a session of its
own, and compares what that session renders with what the browser shows.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from playwright.sync_api import APIRequestContext, Page, expect

from e2e_playwright.conftest import build_app_url, wait_for_app_run, wait_until
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    click_form_button,
    get_expander,
    get_multiselect,
    get_number_input,
    get_slider,
    get_text_input,
    goto_app,
    select_radio_option,
    select_selectbox_option,
)

_STATE_SELECTOR = "script#streamlit-agent-view-state[type='application/json']"


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    return ["--server.enableAgentApi", "true"]


def _scrape_state(app: Page) -> dict[str, Any]:
    """Read the embedded state from the page, as a scraper would."""
    raw = app.locator(_STATE_SELECTOR).text_content()
    assert raw is not None
    state: dict[str, Any] = json.loads(raw)
    return state


def _call_state_function(app: Page, max_length: int | None = None) -> str:
    """Read the state the way an in-page bridge would, through its function."""
    raw = app.evaluate(
        "maxLength => window.streamlitAgentViewState("
        "maxLength === null ? undefined : { maxLength })",
        max_length,
    )
    assert isinstance(raw, str)
    return raw


def _browser_text(app: Page, prefix: str) -> str:
    text = app.get_by_test_id("stText").filter(has_text=prefix).text_content()
    assert text is not None
    return text


def _snapshot_text(snapshot: Any, prefix: str) -> str | None:
    """Find the first string in an agent snapshot that starts with `prefix`."""
    if isinstance(snapshot, str):
        return snapshot if snapshot.startswith(prefix) else None
    children = (
        snapshot.values()
        if isinstance(snapshot, dict)
        else snapshot
        if isinstance(snapshot, list)
        else []
    )
    for child in children:
        if (found := _snapshot_text(child, prefix)) is not None:
            return found
    return None


def _find_node(snapshot: Any, key: str) -> dict[str, Any] | None:
    """Find the snapshot node with the given key."""
    if isinstance(snapshot, dict):
        if snapshot.get("key") == key:
            return snapshot
        children: Any = snapshot.values()
    elif isinstance(snapshot, list):
        children = snapshot
    else:
        return None
    for child in children:
        if (found := _find_node(child, key)) is not None:
            return found
    return None


def _accepts(snapshot: dict[str, Any], key: str, value: Any) -> bool:
    """Whether the snapshot offers `key`, and `value` among its options."""
    settable = {
        action["key"]
        for action in snapshot.get("actions", [])
        if action.get("kind") == "value"
    }
    if key not in settable:
        return False
    props = (_find_node(snapshot, key) or {}).get("props") or {}
    options = props.get("options")
    if not isinstance(options, list) or props.get("accept_new_options"):
        return True
    items = value if isinstance(value, list) else [value]
    return all(item is None or str(item) in options for item in items)


class _AgentClient:
    """The agent's side: its own session, driven through the agent API."""

    def __init__(self, request: APIRequestContext, app_base_url: str) -> None:
        self._request = request
        self._url = build_app_url(app_base_url, path="/_stcore/agent/v1/interact")
        self.session_id: str | None = None
        self.requests_sent = 0
        # Values the session never offered, or refused on their own.
        self.unapplied: dict[str, Any] = {}

    def interact(self, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        if self.session_id is not None:
            body = {"session_id": self.session_id, **body}
        response = self._request.post(self._url, data=body)
        self.requests_sent += 1
        result: dict[str, Any] = response.json()
        if response.ok:
            self.session_id = result["session_id"]
        return response.status, result

    def apply(self, state: dict[str, Any]) -> dict[str, Any]:
        """Reproduce a scraped view: navigate, set values, then submit forms.

        The agent API checks a request against the options its session offers
        now and refuses it whole, so a value whose options depend on another
        value cannot share its request. Each request therefore holds every
        value the latest snapshot accepts: one request per level of
        dependency, rather than one per value. A request refused anyway is
        retried one value at a time, so one bad value cannot hold back the
        rest.
        """
        status, snapshot = self.interact(
            {"page": state["page"], "query_params": state["query_params"]}
        )
        assert status == 200, snapshot

        pending = dict(state["widget_state"])
        while ready := {
            key: value
            for key, value in pending.items()
            if _accepts(snapshot, key, value)
        }:
            for key in ready:
                del pending[key]
            status, result = self.interact({"widget_state": ready})
            if status == 200:
                snapshot = result
                continue
            for key, value in ready.items():
                status, result = self.interact({"widget_state": {key: value}})
                if status == 200:
                    snapshot = result
                else:
                    self.unapplied[key] = result
        self.unapplied.update(pending)

        for form in state["forms"]:
            status, snapshot = self.interact(form)
            assert status == 200, snapshot
        return snapshot


def _select_multiselect_option(app: Page, label: str, option: str) -> None:
    multiselect = get_multiselect(app, label)
    multiselect.locator("input").click()
    app.get_by_role("option", name=option, exact=True).first.click()
    expect(multiselect.locator(f'span[title="{option}"]')).to_be_visible()
    app.keyboard.press("Escape")
    wait_for_app_run(app)


def test_agent_reproduces_view_with_dependent_filters(
    app: Page, app_base_url: str
) -> None:
    """Dependent, keyless, form, fragment, and code-set values all carry over."""
    # Set only through session state, by a button callback.
    click_button(app, "US preset")
    # Options depend on the region.
    select_selectbox_option(app, "Country", "Texas")
    # Keyless, and options depend on the country.
    select_selectbox_option(app, "City", "Dallas")
    _select_multiselect_option(app, "Products", "C")
    get_slider(app, "Price").get_by_role("slider").first.press("ArrowRight")
    wait_for_app_run(app)
    get_slider(app, "Since").get_by_role("slider").press("ArrowRight")
    wait_for_app_run(app)
    click_checkbox(app, "Only active")
    search = get_text_input(app, "Search").locator("input")
    search.fill("widget")
    search.press("Enter")
    wait_for_app_run(app)
    token = get_text_input(app, "API token").locator("input")
    token.fill("s3cret-token")
    token.press("Enter")
    wait_for_app_run(app)
    get_number_input(app, "Row limit").locator("input").fill("25")
    click_form_button(app, "Apply")
    select_radio_option(app, "line", label="Chart type")

    browser_view = _browser_text(app, "VIEW ")
    assert '"city": "Dallas"' in browser_view
    assert '"limit": 25' in browser_view

    # The fragment's change lands without a full rerun; wait for it.
    wait_until(app, lambda: _scrape_state(app)["widget_state"].get("chart") == "line")
    state = _scrape_state(app)

    raw = app.locator(_STATE_SELECTOR).text_content() or ""
    assert "s3cret-token" not in raw
    assert state["omitted"] == {"token": "sensitive"}
    assert state["widget_state"]["region"] == "US"
    assert state["widget_state"]["since"] == ["2024-01-02"]
    city_keys = [key for key in state["widget_state"] if key.startswith("$$ID-")]
    assert len(city_keys) == 3, state["widget_state"]  # City, Products, Search.
    assert len(state["forms"]) == 1
    assert state["forms"][0]["trigger"] == {"key": "FormSubmitter:limits-Apply"}

    # The function a bridge calls returns the same document, and keeps a
    # smaller budget it is given without breaking the JSON.
    assert json.loads(_call_state_function(app)) == state
    short = _call_state_function(app, max_length=300)
    assert len(short) <= 300
    assert json.loads(short)["complete"] is False
    # The page's own element with the same ID does not shadow the document.
    assert app.evaluate(
        "id => [document.querySelectorAll('#' + id).length,"
        " document.getElementById(id).tagName]",
        "streamlit-agent-view-state",
    ) == [2, "SCRIPT"]

    agent = _AgentClient(app.request, app_base_url)
    snapshot = agent.apply(state)

    assert _snapshot_text(snapshot, "VIEW ") == browser_view
    assert _snapshot_text(snapshot, "FRAGMENT ") == _browser_text(app, "FRAGMENT ")
    assert agent.unapplied == {}
    # Create, then region with the independent values, then country, then the
    # keyless city whose ID only exists once country is set, then the form.
    assert agent.requests_sent == 5


def test_agent_reproduces_independent_values_in_one_request(
    app: Page, app_base_url: str
) -> None:
    """Every settable widget type's value is accepted verbatim, in one request."""
    goto_app(app, build_app_url(app_base_url, query={"ref": "email"}))
    _select_multiselect_option(app, "Products", "B")
    click_checkbox(app, "Only active")
    get_slider(app, "Price").get_by_role("slider").last.press("ArrowLeft")
    wait_for_app_run(app)
    # Non-default values for the remaining widget types, set from code.
    click_button(app, "Load preset")
    app.get_by_role("tab", name="Chart").click()
    wait_for_app_run(app)
    get_expander(app, "Details").locator("summary").click()
    wait_for_app_run(app)
    browser_view = _browser_text(app, "VIEW ")
    browser_more = _browser_text(app, "MORE ")
    assert '"ref": "email"' in browser_view
    assert '"chart_tab": true' in browser_more
    assert '"details": true' in browser_more
    assert '"page_no": 3' in browser_more

    wait_until(app, lambda: _scrape_state(app)["widget_state"].get("details"))
    state = _scrape_state(app)
    assert state["query_params"] == {"ref": ["email"]}
    # A form the user never submitted is not handed over.
    assert state["forms"] == []
    # Temporal sliders carry microseconds; the agent API takes ISO text.
    assert state["widget_state"]["hour"] == ["14:00"]
    assert state["widget_state"]["stamp"] == ["2024-06-02T06:00"]
    # `st.feedback` is reported by index, as the agent API's snapshot does.
    assert state["widget_state"]["rating"] == 3
    # A value cannot end the script element that carries it.
    assert "</script>" not in (app.locator(_STATE_SELECTOR).text_content() or "")
    assert state["widget_state"]["notes_area"] == "multi\nline </script>"

    agent = _AgentClient(app.request, app_base_url)
    _, before = agent.interact(
        {"page": state["page"], "query_params": state["query_params"]}
    )
    assert _snapshot_text(before, "VIEW ") != browser_view
    assert _snapshot_text(before, "MORE ") != browser_more

    status, snapshot = agent.interact({"widget_state": state["widget_state"]})

    assert status == 200, snapshot
    assert _snapshot_text(snapshot, "VIEW ") == browser_view
    assert _snapshot_text(snapshot, "MORE ") == browser_more

    # A value inside an open dialog is named, but not handed over.
    click_button(app, "Open notes")
    note = get_text_input(app.get_by_role("dialog"), "Note").locator("input")
    note.fill("remember")
    note.press("Enter")
    wait_for_app_run(app)
    wait_until(app, lambda: "note" in _scrape_state(app)["omitted"])
    state = _scrape_state(app)
    assert state["omitted"]["note"] == "in_dialog"
    assert "note" not in state["widget_state"]
