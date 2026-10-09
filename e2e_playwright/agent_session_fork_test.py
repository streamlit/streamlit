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

"""SPIKE: an agent forks the user's session instead of rebuilding it.

Each test changes the app in a browser, reads the fork grant off the page the
way a co-browsing client would, forks the browser session through the agent
API, and compares what the fork renders with what the browser shows.

When the frontend was built with the widget-state embedding
(`agent-build-embed-the-user-s`), the main scenario also replays the embedded
state the way that branch's reference client does, and writes both results to
`work-tmp/fork-spike/comparison.json`.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

import pytest
from playwright.sync_api import APIRequestContext, FilePayload, Page, expect

from e2e_playwright.conftest import build_app_url, wait_for_app_run, wait_until
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    click_form_button,
    get_multiselect,
    get_number_input,
    get_slider,
    get_text_input,
    goto_app,
    select_radio_option,
    select_selectbox_option,
)

_STATE_SELECTOR = "script#streamlit-agent-view-state[type='application/json']"
_USER_HEADER = "X-Test-User"
_RESULTS = Path(__file__).parents[1] / "work-tmp" / "fork-spike"
# What the comparison reads off each side, in the order the app prints them.
_LINES = (
    "VIEW ",
    "CODE ",
    "OBJECTS ",
    "HEADERS ",
    "RESOURCE ",
    "FRAGMENT ",
    "PINNED ",
)
_TOKEN_HEADER = "Sf-Context-Current-User-Token"
# Stands in for the caller's-rights token SPCS ingress adds to the handshake.
_BROWSER_TOKEN = "browser-handshake-token"


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    return [
        "--server.enableAgentApi",
        "true",
        "--server.trustedUserHeaders",
        json.dumps({_USER_HEADER: "user_name"}),
    ]


def _open_as(page: Page, app_base_url: str, user: str, *, path: str) -> None:
    """Open the app the way a deployment's proxy would deliver it to `user`."""
    page.set_extra_http_headers(
        {
            _USER_HEADER: user,
            "X-Fork-Probe": "browser",
            _TOKEN_HEADER: _BROWSER_TOKEN,
        }
    )
    goto_app(page, build_app_url(app_base_url, path=path, query={"ref": "campaign"}))


def _browser_text(page: Page, prefix: str) -> str | None:
    texts = page.get_by_test_id("stText").filter(has_text=prefix)
    if texts.count() == 0:
        return None
    return texts.first.text_content()


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


def _embedded_state(page: Page) -> dict[str, Any]:
    """The widget-state embedding's document, as a scraper reads it."""
    state: dict[str, Any] = json.loads(
        page.locator(_STATE_SELECTOR).text_content() or "{}"
    )
    return state


def _has_dialog(snapshot: Any) -> bool:
    """Whether an agent snapshot's tree contains an open `st.dialog`."""
    if isinstance(snapshot, dict):
        if snapshot.get("type") == "dialog":
            return True
        return any(_has_dialog(child) for child in snapshot.values())
    if isinstance(snapshot, list):
        return any(_has_dialog(child) for child in snapshot)
    return False


def _digest(value: str) -> str:
    """The app's digest of a header value, as it prints it."""
    return hashlib.sha256(value.encode()).hexdigest()[:8]


def _fields(line: str | None) -> dict[str, Any]:
    """The JSON object a `PREFIX {...}` line carries."""
    assert line is not None
    fields: dict[str, Any] = json.loads(line.split(" ", 1)[1])
    return fields


def _grant(page: Page) -> str:
    text = _browser_text(page, "FORK ")
    assert text is not None
    return text.removeprefix("FORK ")


class _AgentClient:
    """The agent's side, driven through the agent API."""

    def __init__(
        self, request: APIRequestContext, app_base_url: str, *, user: str | None
    ) -> None:
        self._request = request
        self._url = build_app_url(app_base_url, path="/_stcore/agent/v1/interact")
        self.headers = {} if user is None else {_USER_HEADER: user}
        self.session_id: str | None = None
        self.requests_sent = 0

    def interact(self, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        if self.session_id is not None:
            body = {"session_id": self.session_id, **body}
        response = self._request.post(self._url, data=body, headers=self.headers)
        self.requests_sent += 1
        result: dict[str, Any] = response.json()
        if response.ok:
            self.session_id = result["session_id"]
        return response.status, result

    def apply(self, state: dict[str, Any]) -> dict[str, Any]:
        """Replay embedded widget state, as the embedding branch's client does.

        Copied from `agent_view_state_test.py` on `agent-build-embed-the-user-s`:
        navigate, set every value in one request, fall back to one value at a
        time when dependent options refuse the batch, then submit each form.
        """
        status, snapshot = self.interact(
            {"page": state["page"], "query_params": state["query_params"]}
        )
        assert status == 200, snapshot
        if state["widget_state"]:
            status, result = self.interact({"widget_state": state["widget_state"]})
            if status == 200:
                snapshot = result
            else:
                snapshot = self._apply_one_at_a_time(state["widget_state"])
        for form in state["forms"]:
            status, snapshot = self.interact(form)
            assert status == 200, snapshot
        return snapshot

    def _apply_one_at_a_time(self, widget_state: dict[str, Any]) -> dict[str, Any]:
        pending = dict(widget_state)
        snapshot: dict[str, Any] = {}
        result: dict[str, Any] = {}
        while pending:
            applied = False
            for key, value in list(pending.items()):
                status, result = self.interact({"widget_state": {key: value}})
                if status == 200:
                    snapshot = result
                    del pending[key]
                    applied = True
            assert applied, f"Could not apply {pending}: {result}"
        return snapshot


def _select_multiselect_option(page: Page, label: str, option: str) -> None:
    multiselect = get_multiselect(page, label)
    multiselect.locator("input").click()
    page.get_by_role("option", name=option, exact=True).first.click()
    expect(multiselect.locator(f'span[title="{option}"]')).to_be_visible()
    page.keyboard.press("Escape")
    wait_for_app_run(page)


def _drive_dashboard(page: Page) -> None:
    """Every kind of state the comparison covers, set the way a user would."""
    click_button(page, "US preset")
    select_selectbox_option(page, "Country", "Texas")
    select_selectbox_option(page, "City", "Dallas")
    _select_multiselect_option(page, "Products", "C")
    get_slider(page, "Price").get_by_role("slider").first.press("ArrowRight")
    wait_for_app_run(page)
    click_checkbox(page, "Only active")
    search = get_text_input(page, "Search").locator("input")
    search.fill("widget")
    search.press("Enter")
    wait_for_app_run(page)
    token = get_text_input(page, "API token").locator("input")
    token.fill("s3cret-token")
    token.press("Enter")
    wait_for_app_run(page)
    select_selectbox_option(page, "Sort", "price")
    get_number_input(page, "Row limit").locator("input").fill("25")
    click_form_button(page, "Apply")
    click_button(page, "Pick favorite")
    with page.expect_file_chooser() as chooser:
        page.get_by_test_id("stFileUploaderDropzone").click()
    chooser.value.set_files(
        files=[FilePayload(name="q3.csv", mimeType="text/csv", buffer=b"a,b\n1,2\n")]
    )
    wait_for_app_run(page)
    select_radio_option(page, "line", label="Chart type")
    click_button(page, "Pin notes")
    note = get_text_input(page.get_by_role("dialog"), "Pinned note").locator("input")
    note.fill("remember")
    note.press("Enter")
    wait_for_app_run(page)
    expect(page.get_by_text("PINNED remember", exact=True)).to_be_visible()


def _read_lines(read: Any) -> dict[str, str | None]:
    return {prefix.strip(): read(prefix) for prefix in _LINES}


def test_fork_and_embedded_state_reproduce_the_view(
    page: Page, app_base_url: str
) -> None:
    """The fork carries what the browser session holds; the browser is untouched."""
    _open_as(page, app_base_url, "alice", path="")
    _drive_dashboard(page)
    browser = _read_lines(lambda prefix: _browser_text(page, prefix))
    assert browser["CODE"] is not None
    assert '"price_changes": 1' in browser["CODE"]
    grant = _grant(page)

    agent = _AgentClient(page.request, app_base_url, user="alice")
    started = time.perf_counter()
    status, fork = agent.interact({"fork_token": grant})
    fork_ms = (time.perf_counter() - started) * 1000
    assert status == 200, fork
    forked = _read_lines(lambda prefix: _snapshot_text(fork, prefix))

    # What the browser session holds on the server carries over exactly,
    # including the dialog it keeps open through session state and the upload.
    for line in ("VIEW", "CODE", "FRAGMENT", "PINNED"):
        assert forked[line] == browser[line], line
    assert _has_dialog(fork)
    # Values a deep copy cannot take are dropped, so the app builds them again;
    # the shared cached resource stays the same object.
    report = fork["fork"]
    assert report["dropped"] == {
        "db": "TypeError",
        "lock": "TypeError",
        "pending": "TypeError",
    }
    assert report["shared_resources"] == ["registry"]
    assert report["uploaded_files"] == 1
    assert forked["OBJECTS"] is not None
    assert '"registry_shared": true' in forked["OBJECTS"]
    assert '"pending_next": 0' in forked["OBJECTS"]
    # The browser connection's headers, including its handshake token, which
    # the fork's own session-scoped connection is then built with: a new
    # connection, made with the browser's token rather than a current one.
    headers = _fields(forked["HEADERS"])
    assert headers["token"] == _digest(_BROWSER_TOKEN)
    assert (headers["probe"], headers["user"]) == ("browser", "alice")
    connection = _fields(forked["RESOURCE"])
    assert connection["connected_with"] == _digest(_BROWSER_TOKEN)
    assert connection["id"] != _fields(browser["RESOURCE"])["id"]

    # Must not happen: the fork reruns the browser session, or fires a callback
    # in it. Its lines are exactly as they were.
    assert _read_lines(lambda prefix: _browser_text(page, prefix)) == browser
    # The fork is an ordinary agent session from here on, and acting on it
    # leaves the browser alone.
    status, changed = agent.interact({"widget_state": {"region": "EU"}})
    assert status == 200, changed
    assert '"region": "EU"' in (_snapshot_text(changed, "VIEW ") or "")
    assert '"region": "US"' in (_browser_text(page, "VIEW ") or "")

    results: dict[str, Any] = {
        "browser": browser,
        "fork": {
            "lines": forked,
            "matches": {line: forked[line] == browser[line] for line in browser},
            "requests": 1,
            "ms": round(fork_ms, 1),
            "report": report,
        },
    }

    if page.locator(_STATE_SELECTOR).count():
        wait_until(
            page, lambda: _embedded_state(page)["widget_state"].get("chart") == "line"
        )
        state = _embedded_state(page)
        replay = _AgentClient(page.request, app_base_url, user="alice")
        started = time.perf_counter()
        snapshot = replay.apply(state)
        replay_ms = (time.perf_counter() - started) * 1000
        replayed = _read_lines(lambda prefix: _snapshot_text(snapshot, prefix))
        results["embedded"] = {
            "lines": replayed,
            "matches": {line: replayed[line] == browser[line] for line in browser},
            "requests": replay.requests_sent,
            "ms": round(replay_ms, 1),
            "omitted": state.get("omitted", {}),
            "bytes": len(page.locator(_STATE_SELECTOR).text_content() or ""),
        }
    _RESULTS.mkdir(parents=True, exist_ok=True)
    (_RESULTS / "comparison.json").write_text(json.dumps(results, indent=2))


def test_fork_follows_the_users_page(page: Page, app_base_url: str) -> None:
    """A fork lands on the page the user is on, with that page's state."""
    _open_as(page, app_base_url, "alice", path="settings")
    select_radio_option(page, "compact", label="Density")
    expect(page.get_by_text("SETTINGS compact", exact=True)).to_be_visible()

    agent = _AgentClient(page.request, app_base_url, user="alice")
    status, fork = agent.interact({"fork_token": _grant(page)})

    assert status == 200, fork
    assert _snapshot_text(fork, "SETTINGS ") == "SETTINGS compact"
    assert _snapshot_text(fork, "VIEW ") is None


def test_fork_grant_is_bound_to_its_user_and_used_once(
    page: Page, app_base_url: str
) -> None:
    """Only the user the session belongs to can fork it, and only once."""
    _open_as(page, app_base_url, "alice", path="")
    alice = _AgentClient(page.request, app_base_url, user="alice")

    # Another identity is refused, and the attempt destroys the grant.
    grant = _grant(page)
    status, refused = _AgentClient(page.request, app_base_url, user="mallory").interact(
        {"fork_token": grant}
    )
    assert (status, refused["error"]["code"]) == (404, "unknown_fork")
    status, refused = alice.interact({"fork_token": grant})
    assert (status, refused["error"]["code"]) == (404, "unknown_fork")

    # No identity at all is a different identity too.
    click_checkbox(page, "Only active")
    status, refused = _AgentClient(page.request, app_base_url, user=None).interact(
        {"fork_token": _grant(page)}
    )
    assert (status, refused["error"]["code"]) == (404, "unknown_fork")

    # The rightful user can use a grant once.
    click_checkbox(page, "Only active")
    grant = _grant(page)
    status, fork = alice.interact({"fork_token": grant})
    assert status == 200, fork
    status, refused = _AgentClient(page.request, app_base_url, user="alice").interact(
        {"fork_token": grant}
    )
    assert (status, refused["error"]["code"]) == (404, "unknown_fork")

    # A grant an agent session mints names an agent session, which is refused:
    # only browser sessions are forked.
    agent_grant = (_snapshot_text(fork, "FORK ") or "").removeprefix("FORK ")
    status, refused = _AgentClient(page.request, app_base_url, user="alice").interact(
        {"fork_token": agent_grant}
    )
    assert (status, refused["error"]["code"]) == (404, "unknown_fork")

    # A fork takes its page and values from the browser, so it takes no others.
    click_checkbox(page, "Only active")
    status, refused = _AgentClient(page.request, app_base_url, user="alice").interact(
        {"fork_token": _grant(page), "page": "settings"}
    )
    assert (status, refused["error"]["code"]) == (400, "invalid_request")


def test_fork_cannot_reopen_a_button_opened_dialog(
    page: Page, app_base_url: str
) -> None:
    """A dialog a button opened closes in the fork, with its values dropped.

    The button's press reset when the run that saw it finished, so the fork has
    nothing to reopen the dialog with. A dialog kept open through session
    state, as in the main scenario, does carry over.
    """
    _open_as(page, app_base_url, "alice", path="")
    click_button(page, "Open notes")
    note = get_text_input(page.get_by_role("dialog"), "Note").locator("input")
    note.fill("draft")
    note.press("Enter")
    wait_for_app_run(page)
    expect(page.get_by_role("dialog")).to_be_visible()

    status, fork = _AgentClient(page.request, app_base_url, user="alice").interact(
        {"fork_token": _grant(page)}
    )

    assert status == 200, fork
    assert not _has_dialog(fork)
    assert '"draft"' not in json.dumps(fork)


def test_agent_session_reads_each_requests_headers(
    page: Page, app_base_url: str
) -> None:
    """Without a fork, an agent session reads the headers of the request driving it.

    So a caller's-rights token that the deployment attaches per request is the
    current one on every run. A session-scoped connection is still built once,
    from the token of the run that first needs it, as in a browser session.
    """
    agent = _AgentClient(page.request, app_base_url, user="alice")
    agent.headers[_TOKEN_HEADER] = "agent-token-1"
    status, first = agent.interact({"page": "settings"})
    assert status == 200, first
    assert _fields(_snapshot_text(first, "HEADERS "))["token"] == _digest(
        "agent-token-1"
    )

    agent.headers[_TOKEN_HEADER] = "agent-token-2"
    status, second = agent.interact({"widget_state": {"density": "compact"}})

    assert status == 200, second
    assert _fields(_snapshot_text(second, "HEADERS "))["token"] == _digest(
        "agent-token-2"
    )
    connection = _fields(_snapshot_text(second, "RESOURCE "))
    assert connection == _fields(_snapshot_text(first, "RESOURCE "))
    assert connection["connected_with"] == _digest("agent-token-1")
    # Must not happen: the request's cookies or credentials reach the app.
    assert _fields(_snapshot_text(second, "HEADERS "))["probe"] is None
