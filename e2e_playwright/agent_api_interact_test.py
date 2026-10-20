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

"""E2E tests for the agent API's `POST /_stcore/agent/interact` route.

The tests call the route over HTTP with `page.request`, which sends no
`Origin` header, like the programmatic clients the route serves. Externally
marked tests also run against a hosted deployment of `agent_api_interact.py`
with `server.enableAgentApi` on, so they derive every URL from `app_base_url`
and tolerate headers a hosting platform adds.
"""

from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING, Any, Final
from urllib.parse import quote, urljoin

import pytest

from e2e_playwright.conftest import build_app_url

if TYPE_CHECKING:
    from playwright.sync_api import APIResponse, Page

_INTERACT_PATH: Final = "/_stcore/agent/interact"
_SESSION_ID: Final = re.compile(r"s_[0-9a-f]{32}")
_TOKEN_HEADER: Final = "Sf-Context-Current-User-Token"
_TOKEN_VALUE: Final = "e2e-callers-rights-token"
# A value no deployment's real identity could have.
_SPOOFED_IDENTITY: Final = "spoofed-agent@e2e.invalid"
# Each retry waits up to `server.agentRunTimeout` on the server, so this bounds
# collecting the slow page's run at about 20 seconds without client-side sleeps.
_MAX_COLLECT_ATTEMPTS: Final = 10


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    """Turn the agent API on, with a run timeout the slow page outlasts."""
    return ["--server.enableAgentApi=true", "--server.agentRunTimeout=2"]


def _interact_url(app_base_url: str) -> str:
    return build_app_url(app_base_url, path=_INTERACT_PATH)


def _interact(
    page: Page,
    app_base_url: str,
    body: dict[str, Any],
    *,
    headers: dict[str, str] | None = None,
) -> APIResponse:
    return page.request.post(_interact_url(app_base_url), data=body, headers=headers)


def _snapshot(response: APIResponse) -> dict[str, Any]:
    """Return the snapshot of a successful interaction."""
    assert response.status == 200, response.text()
    assert response.headers["content-type"].startswith("application/json")
    document: dict[str, Any] = response.json()
    return document


def _refusal(response: APIResponse, status: int, code: str) -> dict[str, Any]:
    """Return the body of a refused interaction, checked for status and code."""
    assert response.status == status, response.text()
    body: dict[str, Any] = response.json()
    assert body["error"]["code"] == code, body
    assert body["error"]["message"]
    return body


def _collect(page: Page, app_base_url: str, session_id: str) -> dict[str, Any]:
    """Retry with only `session_id` until the timed-out run's snapshot arrives."""
    for _ in range(_MAX_COLLECT_ATTEMPTS):
        response = _interact(page, app_base_url, {"session_id": session_id})
        if response.status != 202:
            return _snapshot(response)
        _refusal(response, 202, "run_timed_out")
    pytest.fail(f"The run was not collected in {_MAX_COLLECT_ATTEMPTS} attempts.")


def _nodes(document: dict[str, Any]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    pending = [document["tree"]]
    while pending:
        node = pending.pop()
        found.append(node)
        pending.extend(node.get("children") or [])
    return found


def _keyed(document: dict[str, Any], key: str) -> dict[str, Any]:
    matches = [node for node in _nodes(document) if node.get("key") == key]
    assert len(matches) == 1, matches
    return matches[0]


def _lines(document: dict[str, Any]) -> dict[str, str]:
    """Return the app's `name=value` text lines as a mapping."""
    bodies = (
        node["props"]["body"] for node in _nodes(document) if node["type"] == "text"
    )
    return dict(body.split("=", 1) for body in bodies if "=" in body)


def _url_paths(pages: list[dict[str, Any]]) -> list[str]:
    return [page["url_path"] for page in pages]


def _home_path(document: dict[str, Any]) -> str:
    url_path: str = next(
        page["url_path"] for page in document["pages"] if page["title"] == "Home"
    )
    return url_path


def test_create_rerun_navigate_and_refuse_unknown_page(
    page: Page, app_base_url: str
) -> None:
    """A creating call runs the app, a rerun keeps the session's state,
    `page` navigates, and an unknown page or field is refused before anything
    runs.
    """
    created = _snapshot(_interact(page, app_base_url, {}))
    session_id = created["session_id"]
    assert _SESSION_ID.fullmatch(session_id)
    assert created["status"] == "ready"
    assert isinstance(created["schema_version"], int)
    assert created["page"]["url_path"] == _home_path(created)
    assert {"report", "slow"} <= set(_url_paths(created["pages"]))
    region_action = next(
        action for action in created["actions"] if action["key"] == "region"
    )
    assert (region_action["kind"], region_action["type"]) == ("value", "selectbox")
    assert _keyed(created, "region")["value"] == "EMEA"
    assert _lines(created)["runs"] == "1"

    rerun = _snapshot(_interact(page, app_base_url, {"session_id": session_id}))
    assert rerun["session_id"] == session_id
    assert _lines(rerun)["runs"] == "2"

    report = _snapshot(
        _interact(page, app_base_url, {"session_id": session_id, "page": "report"})
    )
    assert report["page"]["url_path"] == "report"
    assert _keyed(report, "quarter")["value"] == "Q1"
    assert _lines(report)["runs"] == "3"

    unknown_page = _refusal(
        _interact(page, app_base_url, {"session_id": session_id, "page": "nope"}),
        404,
        "unknown_page",
    )
    assert _url_paths(unknown_page["error"]["pages"]) == _url_paths(report["pages"])
    # Only a creating call's errors carry a session to continue with.
    assert "session_id" not in unknown_page
    # Setting values is not part of the API yet, so the field is unknown.
    _refusal(
        _interact(
            page,
            app_base_url,
            {"session_id": session_id, "widget_state": {"region": "APAC"}},
        ),
        400,
        "invalid_request",
    )

    after_refusals = _snapshot(
        _interact(page, app_base_url, {"session_id": session_id})
    )
    assert after_refusals["page"]["url_path"] == "report"
    assert _keyed(after_refusals, "region")["value"] == "EMEA"
    # Neither refused request ran the app.
    assert _lines(after_refusals)["runs"] == "4"


def test_parameterized_report_in_one_creating_call(
    page: Page, app_base_url: str
) -> None:
    """`page` and `query_params` open a parameterized page in one call; leaving
    it keeps the shared widget's parameter and drops the rest; an unknown page
    on a creating call hands back a usable session.
    """
    report = _snapshot(
        _interact(
            page,
            app_base_url,
            {
                "page": "report",
                "query_params": {
                    "region": ["APAC"],
                    "quarter": ["Q2"],
                    "utm": ["ad"],
                },
            },
        )
    )
    assert report["page"]["url_path"] == "report"
    assert _keyed(report, "region")["value"] == "APAC"
    assert _keyed(report, "quarter")["value"] == "Q2"
    assert _lines(report)["runs"] == "1"

    home = _snapshot(
        _interact(
            page,
            app_base_url,
            {"session_id": report["session_id"], "page": _home_path(report)},
        )
    )
    assert home["page"]["url_path"] == _home_path(report)
    assert _keyed(home, "region")["value"] == "APAC"
    # `utm` is bound to nothing, and `quarter` to a widget of the page left.
    assert home["query_params"] == {"region": ["APAC"]}

    unknown_page = _refusal(
        _interact(page, app_base_url, {"page": "nope"}), 404, "unknown_page"
    )
    session_id = unknown_page["session_id"]
    assert _SESSION_ID.fullmatch(session_id)
    assert session_id != report["session_id"]
    assert {"report", "slow"} <= set(_url_paths(unknown_page["error"]["pages"]))

    continued = _snapshot(_interact(page, app_base_url, {"session_id": session_id}))
    assert continued["page"]["url_path"] == _home_path(continued)
    # The creating call ran the app once before it was refused.
    assert _lines(continued)["runs"] == "2"


def test_slow_run_times_out_and_is_collected(page: Page, app_base_url: str) -> None:
    """A run past `server.agentRunTimeout` keeps going; a different request is
    refused while it runs, and retries with only `session_id` collect that one
    run instead of starting another.
    """
    timed_out = _refusal(
        _interact(page, app_base_url, {"page": "slow"}), 202, "run_timed_out"
    )
    session_id = timed_out["session_id"]
    assert _SESSION_ID.fullmatch(session_id)

    _refusal(
        _interact(
            page,
            app_base_url,
            {"session_id": session_id, "query_params": {"region": ["APAC"]}},
        ),
        409,
        "session_busy",
    )

    collected = _collect(page, app_base_url, session_id)
    assert collected["session_id"] == session_id
    assert collected["page"]["url_path"] == "slow"
    lines = _lines(collected)
    assert (lines["starts"], lines["done"], lines["runs"]) == ("1", "1", "1")


@pytest.mark.external_test
def test_snapshot_urls_context_and_headers_follow_the_request(
    page: Page, app_base_url: str
) -> None:
    """Media URLs resolve against the request's URL, `context` reaches the
    app's `st.context`, and every interaction's run sees that request's
    caller's-rights token header.

    Locally, and on hosts that do not set the token header themselves, the
    header the test sends is the one the app sees.
    """
    token_header = {_TOKEN_HEADER: _TOKEN_VALUE}
    response = _interact(
        page,
        app_base_url,
        {"context": {"timezone": "Asia/Kolkata", "locale": "de-DE"}},
        headers=token_header,
    )
    created = _snapshot(response)
    lines = _lines(created)
    assert lines["timezone"] == "Asia/Kolkata"
    assert lines["locale"] == "de-DE"
    # A browser-only field the API never guesses.
    assert lines["url"] == "None"
    assert lines["token"] == "present"
    assert _TOKEN_VALUE not in response.text()

    image_url = next(
        node["props"]["url"] for node in _nodes(created) if node["type"] == "image"
    )
    # Relative to the request, the one base a path-stripping proxy cannot hide.
    assert image_url.startswith("../../media/")
    image = page.request.get(urljoin(_interact_url(app_base_url), image_url))
    assert image.status == 200
    assert image.headers["content-type"].startswith("image/")

    rerun = _snapshot(
        _interact(
            page,
            app_base_url,
            {"session_id": created["session_id"]},
            headers=token_header,
        )
    )
    lines = _lines(rerun)
    assert lines["token"] == "present"
    # Omitting `context` keeps what the session was told.
    assert lines["timezone"] == "Asia/Kolkata"


@pytest.mark.external_test
def test_refuses_web_pages_and_ignores_client_identity(
    page: Page, app_base_url: str
) -> None:
    """A web page's request and other methods than POST are refused without
    the app's HTML, and neither made-up identity headers nor cookies, a forged
    login cookie included, reach `st.user` or `st.context.cookies`.
    """
    _refusal(
        _interact(page, app_base_url, {}, headers={"Origin": "https://e2e.invalid"}),
        403,
        "origin_not_allowed",
    )
    for method in ["GET", "PUT"]:
        response = page.request.fetch(_interact_url(app_base_url), method=method)
        assert response.status == 405, f"{method}: {response.status}"
        assert "text/html" not in response.headers.get("content-type", "")

    forged_login = json.dumps({"is_logged_in": True, "email": _SPOOFED_IDENTITY})
    page.context.add_cookies(
        [
            {
                "name": "_streamlit_user",
                "value": quote(forged_login),
                "url": build_app_url(app_base_url, path="/"),
            }
        ]
    )
    identity_headers = [
        "X-Forwarded-Email",
        "X-Forwarded-User",
        "X-Auth-Request-Email",
        "Remote-User",
    ]
    response = _interact(
        page,
        app_base_url,
        {},
        headers=dict.fromkeys(identity_headers, _SPOOFED_IDENTITY),
    )
    lines = _lines(_snapshot(response))
    assert lines["logged_in"] == "False"
    assert lines["cookies"] == "0"
    assert _SPOOFED_IDENTITY not in response.text()
