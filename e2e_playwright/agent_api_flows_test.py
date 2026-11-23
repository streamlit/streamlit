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

"""E2E tests for the agent API's write flows.

Each test drives a browser session and an agent session through the same
gestures, one `POST /_stcore/agent/interact` request per gesture, and checks
that both show the same `name=value` text lines: the callback log, the
resulting values, and the app's other output.
"""

from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING, Any, Final

import pytest
from playwright.sync_api import expect

from e2e_playwright.conftest import build_app_url, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_form_button,
    get_element_by_key,
    get_multiselect,
    get_number_input,
    get_slider,
    get_text_input,
    goto_app,
    select_radio_option,
    select_selectbox_option,
)

if TYPE_CHECKING:
    from playwright.sync_api import APIResponse, Locator, Page

_INTERACT_PATH: Final = "/_stcore/agent/interact"
_FILTER_LINES: Final = ("values", "rows", "log")
_AMER: Final = {"region": ["AMER"]}


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    """Turn the agent API on."""
    return ["--server.enableAgentApi=true"]


def _snapshot(response: APIResponse) -> dict[str, Any]:
    assert response.status == 200, response.text()
    document: dict[str, Any] = response.json()
    return document


def _refusal(response: APIResponse, status: int, code: str) -> None:
    assert response.status == status, response.text()
    assert response.json()["error"]["code"] == code


class _AgentSession:
    """An agent API session the test sends one request per gesture."""

    def __init__(self, page: Page, app_base_url: str, create: dict[str, Any]) -> None:
        self._page = page
        self._url = build_app_url(app_base_url, path=_INTERACT_PATH)
        self.created = _snapshot(page.request.post(self._url, data=create))
        self._session_id = self.created["session_id"]

    def send(self, **fields: Any) -> APIResponse:
        body = {"session_id": self._session_id, **fields}
        return self._page.request.post(self._url, data=body)

    def act(self, **fields: Any) -> dict[str, Any]:
        return _snapshot(self.send(**fields))


def _nodes(document: dict[str, Any]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    pending = [document["tree"]]
    while pending:
        node = pending.pop()
        found.append(node)
        pending.extend(node.get("children") or [])
    return found


def _keyed(document: dict[str, Any], key: str) -> dict[str, Any]:
    [node] = [node for node in _nodes(document) if node.get("key") == key]
    return node


def _dialog(document: dict[str, Any]) -> dict[str, Any] | None:
    dialogs = [node for node in _nodes(document) if node["type"] == "dialog"]
    assert len(dialogs) <= 1, dialogs
    return dialogs[0] if dialogs else None


def _lines(document: dict[str, Any]) -> dict[str, str]:
    """Return the app's `name=value` text lines as a mapping."""
    bodies = (
        node["props"]["body"] for node in _nodes(document) if node["type"] == "text"
    )
    return dict(body.split("=", 1) for body in bodies if "=" in body)


def _count(document: dict[str, Any], name: str) -> int:
    return int(_lines(document)[name])


def _browser_line(page: Page, name: str) -> Locator:
    return page.get_by_test_id("stText").filter(has_text=re.compile(f"^{name}="))


def _browser_count(page: Page, name: str) -> int:
    return int(_browser_line(page, name).inner_text().split("=", 1)[1])


def _expect_browser_shows(page: Page, document: dict[str, Any], *names: str) -> None:
    """Expect the browser to show the agent snapshot's lines called `names`."""
    lines = _lines(document)
    for name in names:
        expect(_browser_line(page, name)).to_have_text(f"{name}={lines[name]}")


def test_dashboard_and_form_flows_match_a_browser_session(
    page: Page, app_base_url: str
) -> None:
    """Filters, a widget in a fragment, and a form with two submit buttons end
    with the same callback log, values, and output in both sessions.
    """
    goto_app(page, build_app_url(app_base_url, query={"region": "AMER"}))
    agent = _AgentSession(page, app_base_url, {"query_params": _AMER})
    _expect_browser_shows(page, agent.created, *_FILTER_LINES)

    select_selectbox_option(page, "Region", "APAC")
    region = agent.act(widget_state={"region": "APAC"})
    _expect_browser_shows(page, region, *_FILTER_LINES)
    # The browser rewrites its address. The agent session drops the stale
    # parameter instead, so the next run keeps the new value either way.
    expect(page).to_have_url(re.compile(r"[?&]region=APAC"))
    assert "region" not in region["query_params"]

    multiselect = get_multiselect(page, "Metrics")
    multiselect.locator("input").click()
    page.get_by_role("option", name="users", exact=True).click()
    expect(multiselect.locator('span[title="users"]')).to_be_visible()
    page.keyboard.press("Escape")
    wait_for_app_run(page)
    metrics = agent.act(widget_state={"metrics": ["revenue", "users"]})
    _expect_browser_shows(page, metrics, *_FILTER_LINES)

    get_slider(page, "Year").get_by_role("slider").press("ArrowLeft")
    wait_for_app_run(page)
    year = agent.act(widget_state={"year": 2025})
    _expect_browser_shows(page, year, *_FILTER_LINES)

    # The radio is in a fragment, so in both sessions only the fragment reruns.
    page_runs = _browser_count(page, "page_runs")
    fragment_runs = _browser_count(page, "fragment_runs")
    select_radio_option(page, "full", label="Detail")
    detail = agent.act(widget_state={"detail": "full"})
    _expect_browser_shows(page, detail, "log")
    expect(_browser_line(page, "fragment_runs")).to_have_text(
        f"fragment_runs={fragment_runs + 1}"
    )
    expect(_browser_line(page, "page_runs")).to_have_text(f"page_runs={page_runs}")
    assert _count(detail, "page_runs") == _count(year, "page_runs")
    assert _count(detail, "fragment_runs") == _count(year, "fragment_runs") + 1

    # One request with all three filters lands where the three gestures did.
    batched = _AgentSession(page, app_base_url, {"query_params": _AMER})
    batch = batched.act(
        widget_state={"region": "APAC", "metrics": ["revenue", "users"], "year": 2025}
    )
    assert _lines(batch)["values"] == _lines(year)["values"]
    assert _lines(batch)["rows"] == _lines(year)["rows"]
    # A batch has no gesture order, so only which callbacks ran is compared.
    assert sorted(json.loads(_lines(batch)["log"])) == sorted(
        json.loads(_lines(year)["log"])
    )

    goto_app(page, build_app_url(app_base_url, path="/profile"))
    form = _AgentSession(page, app_base_url, {"page": "profile"})
    get_text_input(page, "Name").locator("input").fill("Ada")
    get_number_input(page, "Age").locator("input").fill("36")
    click_form_button(page, "Draft")
    draft = form.act(widget_state={"name": "Ada", "age": 36}, trigger={"key": "draft"})
    _expect_browser_shows(page, draft, "log")

    # Refused whole: had the name been applied, the next submit would log it.
    _refusal(form.send(widget_state={"name": "Bob"}), 400, "missing_form_submit")

    # The browser sends the name it still shows; the agent session keeps the
    # submitted one, so the request leaves it out.
    get_number_input(page, "Age").locator("input").fill("40")
    click_form_button(page, "Save")
    saved = form.act(widget_state={"age": 40}, trigger={"key": "save"})
    _expect_browser_shows(page, saved, "log")
    assert _count(saved, "page_runs") == _count(draft, "page_runs") + 1


def test_chat_and_dialog_flows_match_a_browser_session(
    page: Page, app_base_url: str
) -> None:
    """Two chat turns, and a two-step dialog that is confirmed, reopened, and
    dismissed, end with the same callback log and output in both sessions.
    """
    goto_app(page, build_app_url(app_base_url, path="/chat"))
    chat = _AgentSession(page, app_base_url, {"page": "chat"})
    prompt = get_element_by_key(page, "prompt").locator("textarea")
    for text in ("hi", "bye"):
        prompt.fill(text)
        prompt.press("Enter")
        wait_for_app_run(page)
        turn = chat.act(trigger={"key": "prompt", "value": text})
        _expect_browser_shows(page, turn, "transcript", "log")

    goto_app(page, build_app_url(app_base_url, path="/rename"))
    rename = _AgentSession(page, app_base_url, {"page": "rename"})
    dialog = page.get_by_test_id("stDialog")

    click_button(page, "Rename project")
    opened = rename.act(trigger={"key": "open_rename"})
    expect(dialog).to_be_visible()
    _expect_browser_shows(page, opened, "step", "project", "log")
    page_runs = _browser_count(page, "page_runs")

    new_name = get_text_input(dialog, "New name").locator("input")
    new_name.fill("Ada")
    new_name.press("Enter")
    wait_for_app_run(page)
    rename.act(widget_state={"new_name": "Ada"})
    click_button(page, "Next")
    stepped = rename.act(trigger={"key": "next"})
    _expect_browser_shows(page, stepped, "step", "draft")
    # Each step reran only the dialog, which stayed open.
    expect(_browser_line(page, "page_runs")).to_have_text(f"page_runs={page_runs}")
    assert _count(stepped, "page_runs") == _count(opened, "page_runs")

    click_button(page, "Confirm")
    confirmed = rename.act(trigger={"key": "confirm"})
    expect(dialog).not_to_be_attached()
    assert _dialog(confirmed) is None
    _expect_browser_shows(page, confirmed, "project", "log")

    click_button(page, "Rename project")
    reopened = rename.act(trigger={"key": "open_rename"})
    expect(dialog).to_be_visible()
    _refusal(
        rename.send(widget_state={"new_name": "Bob", "archive": True}),
        400,
        "cross_dialog_batch",
    )
    # The refused request ran nothing, so the dialog is still open to a write.
    new_name.fill("Bob")
    new_name.press("Enter")
    wait_for_app_run(page)
    renamed = rename.act(widget_state={"new_name": "Bob"})
    open_dialog = _dialog(renamed)
    assert open_dialog is not None
    assert open_dialog["props"]["is_open"] is True
    assert _keyed(renamed, "archive")["value"] is False
    assert _count(renamed, "page_runs") == _count(reopened, "page_runs")

    dialog.get_by_label("Close").click()
    wait_for_app_run(page)
    dismissed = rename.act(trigger={"key": open_dialog["key"]})
    expect(dialog).not_to_be_attached()
    assert _dialog(dismissed) is None
    _expect_browser_shows(page, dismissed, "project", "log")
