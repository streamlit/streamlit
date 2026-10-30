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

"""E2E tests for the agent API's interact route and its OpenAPI document.

`POST /_stcore/agent/interact` drives the app, and the app's HTML links
`GET /_stcore/agent/openapi.json`, which describes it.

The tests call the routes over HTTP with `page.request`, which sends no
`Origin` header, like the programmatic clients the route serves. Externally
marked tests also run against a hosted deployment of `agent_api_interact.py`
with `server.enableAgentApi` on, so they derive agent route URLs from
`agent_api_base_url` and tolerate headers a hosting platform adds. They open
the app before calling the route, because a host that guards the app's origin
with a login cookie, as Snowflake does, sets it while the app loads, and
`page.request` sends the browser context's cookies.
"""

from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING, Any, Final
from urllib.parse import quote, urljoin, urlsplit

import pyarrow as pa
import pytest
from playwright.sync_api import expect

from e2e_playwright.conftest import build_app_url

if TYPE_CHECKING:
    from playwright.sync_api import APIResponse, Page

    from e2e_playwright.shared.app_target import AppTarget

_INTERACT_PATH: Final = "/_stcore/agent/interact"
_SCHEMA_PATH: Final = "/_stcore/agent/openapi.json"
_ARROW_MIMETYPE: Final = "application/vnd.apache.arrow.stream"
_SESSION_ID: Final = re.compile(r"s_[0-9a-f]{32}")
_TOKEN_HEADER: Final = "Sf-Context-Current-User-Token"
_TOKEN_VALUE: Final = "e2e-callers-rights-token"
# A value no deployment's real identity could have.
_SPOOFED_IDENTITY: Final = "spoofed-agent@e2e.invalid"
# Each retry waits up to `server.agentWaitTimeout` on the server, so this bounds
# collecting the slow page's run without client-side sleeps.
_MAX_COLLECT_ATTEMPTS: Final = 6


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    """Turn the agent API on, with a wait timeout the slow page outlasts."""
    return ["--server.enableAgentApi=true", "--server.agentWaitTimeout=5"]


@pytest.fixture
def app_page(app_target: AppTarget) -> Page:
    """Return the page after the app has loaded, so its context holds any
    login cookie the host sets.
    """
    return app_target.page


def _configured_backend_base_url(app_target: AppTarget) -> str | None:
    """Return ``window.__streamlit.BACKEND_BASE_URL`` when the host set one."""
    backend = app_target.locator("html").evaluate(
        "() => window.__streamlit?.BACKEND_BASE_URL || null"
    )
    if isinstance(backend, str) and backend.strip():
        return backend.strip()
    return None


@pytest.fixture
def agent_api_base_url(app_target: AppTarget, app_base_url: str) -> str:
    """Return the base URL for agent API HTTP calls.

    Some hosts, such as Streamlit in Snowflake, serve the app's HTML from one
    origin (an iframe) and the Streamlit server from another (a Snowpark
    Container Services container). The host points the app at the server
    through ``window.__streamlit.BACKEND_BASE_URL``, and agent API requests
    must go there. When the value is unset (locally, or when one origin serves
    both), this returns ``app_base_url``.
    """
    return _configured_backend_base_url(app_target) or app_base_url


def _advertised_schema_url(app_target: AppTarget, agent_api_base_url: str) -> str:
    """Check the description link and return the schema URL it points to.

    The page Streamlit ships links the schema with a relative href, which
    resolves against ``agent_api_base_url`` when one origin serves both. A host
    that sets ``BACKEND_BASE_URL`` serves its own page, whose link is an
    absolute URL on that backend, so it does not resolve against the iframe.
    """
    link = app_target.locator("link[rel='service-desc']")
    backend_base_url = _configured_backend_base_url(app_target)
    if backend_base_url is None:
        expect(link).to_have_attribute("href", f".{_SCHEMA_PATH}")
        return build_app_url(agent_api_base_url, path=_SCHEMA_PATH)
    href = link.get_attribute("href") or ""
    advertised, backend = urlsplit(href), urlsplit(backend_base_url)
    assert (advertised.scheme, advertised.netloc.lower()) == (
        backend.scheme,
        backend.netloc.lower(),
    ), href
    assert advertised.path.endswith(_SCHEMA_PATH), href
    return href


def _interact_url(app_base_url: str) -> str:
    return build_app_url(app_base_url, path=_INTERACT_PATH)


def _interact(
    page: Page,
    app_base_url: str,
    body: dict[str, Any],
    *,
    headers: dict[str, str] | None = None,
) -> APIResponse:
    # A login redirect can turn the POST into a GET without its body, which
    # the route refuses with a 405 that hides the redirect.
    return page.request.post(
        _interact_url(app_base_url), data=body, headers=headers, max_redirects=0
    )


def _describe(response: APIResponse) -> str:
    """Return the headers and body that show who answered a failed request.

    A redirect sets `Location`. The route's own 405 sends `Allow: POST`, so a
    405 without it came from a proxy in front of the app.
    """
    headers = response.headers
    return (
        f"Location: {headers.get('location')}, Allow: {headers.get('allow')}, "
        f"body: {response.text()!r}"
    )


def _snapshot(response: APIResponse) -> dict[str, Any]:
    """Return the snapshot of a successful interaction."""
    assert response.status == 200, _describe(response)
    assert response.headers["content-type"].startswith("application/json")
    document: dict[str, Any] = response.json()
    return document


def _refusal(response: APIResponse, status: int, code: str) -> dict[str, Any]:
    """Return the body of a refused interaction, checked for status and code."""
    assert response.status == status, _describe(response)
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
        _refusal(response, 202, "wait_timed_out")
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
    `page` navigates, and an unknown page, or navigation with widget changes,
    is refused before anything runs.
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
    # Navigation is its own transition, so it cannot carry widget changes.
    _refusal(
        _interact(
            page,
            app_base_url,
            {
                "session_id": session_id,
                "page": "report",
                "widget_state": {"region": "APAC"},
            },
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
    """A run past `server.agentWaitTimeout` keeps going; a different request is
    refused while it runs, and retries with only `session_id` collect that one
    run instead of starting another.
    """
    timed_out = _refusal(
        _interact(page, app_base_url, {"page": "slow"}), 202, "wait_timed_out"
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


def test_data_urls_serve_every_row_the_snapshot_counts(
    page: Page, app_base_url: str
) -> None:
    """A table's and a chart's `data.url`, resolved against the request's URL,
    serve the Arrow stream their `data` describes, rows past the preview
    included; a table that shrinks under the preview limit is complete.
    """
    created = _snapshot(_interact(page, app_base_url, {"page": "data"}))
    table = _keyed(created, "orders")["data"]
    assert table["row_count"] == 250
    assert table["complete"] is False
    assert len(table["preview"]["rows"]) == 100
    assert "unavailable" not in table
    chart = next(
        node["data"] for node in _nodes(created) if node["type"] == "line_chart"
    )
    for data in (table, chart):
        assert data["url"].startswith("../../media/")
        served = page.request.get(urljoin(_interact_url(app_base_url), data["url"]))
        assert served.status == 200
        assert served.headers["content-type"] == _ARROW_MIMETYPE
        arrow = pa.ipc.open_stream(served.body()).read_all()
        assert arrow.num_rows == data["row_count"]
        assert arrow.column_names == [column["name"] for column in data["columns"]]

    shrunk = _snapshot(
        _interact(
            page,
            app_base_url,
            {"session_id": created["session_id"], "widget_state": {"rows": 40}},
        )
    )
    small_table = _keyed(shrunk, "orders")["data"]
    assert small_table["complete"] is True
    assert len(small_table["preview"]["rows"]) == small_table["row_count"] == 40
    # The URL follows the table rather than serving the one it replaced.
    assert small_table["url"] != table["url"]


@pytest.mark.external_test
def test_snapshot_urls_context_and_headers_follow_the_request(
    app_page: Page, agent_api_base_url: str
) -> None:
    """Media URLs resolve against the request's URL, `context` reaches the
    app's `st.context`, and every interaction's run sees that request's
    caller's-rights token header.

    Locally, and on hosts that do not set the token header themselves, the
    header the test sends is the one the app sees.
    """
    token_header = {_TOKEN_HEADER: _TOKEN_VALUE}
    response = _interact(
        app_page,
        agent_api_base_url,
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
    image = app_page.request.get(urljoin(_interact_url(agent_api_base_url), image_url))
    assert image.status == 200
    assert image.headers["content-type"].startswith("image/")

    rerun = _snapshot(
        _interact(
            app_page,
            agent_api_base_url,
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
    app_page: Page, app_base_url: str, agent_api_base_url: str
) -> None:
    """A web page's request and other methods than POST are refused without
    the app's HTML, and neither made-up identity headers nor cookies, a forged
    login cookie included, reach `st.user` or `st.context.cookies`.
    """
    _refusal(
        _interact(
            app_page,
            agent_api_base_url,
            {},
            headers={"Origin": "https://e2e.invalid"},
        ),
        403,
        "origin_not_allowed",
    )
    for method in ["GET", "PUT"]:
        response = app_page.request.fetch(
            _interact_url(agent_api_base_url), method=method, max_redirects=0
        )
        assert response.status == 405, f"{method}: {_describe(response)}"
        assert "text/html" not in response.headers.get("content-type", "")

    forged_login = json.dumps({"is_logged_in": True, "email": _SPOOFED_IDENTITY})
    # Forge the cookie for the API's host, where the request goes, and for the
    # document's host, in case the server reads cookies there. On hosts that
    # set BACKEND_BASE_URL the two differ.
    app_page.context.add_cookies(
        [
            {
                "name": "_streamlit_user",
                "value": quote(forged_login),
                "url": build_app_url(base_url, path="/"),
            }
            for base_url in {app_base_url, agent_api_base_url}
        ]
    )
    identity_headers = [
        "X-Forwarded-Email",
        "X-Forwarded-User",
        "X-Auth-Request-Email",
        "Remote-User",
    ]
    response = _interact(
        app_page,
        agent_api_base_url,
        {},
        headers=dict.fromkeys(identity_headers, _SPOOFED_IDENTITY),
    )
    lines = _lines(_snapshot(response))
    assert lines["logged_in"] == "False"
    assert lines["cookies"] == "0"
    assert _SPOOFED_IDENTITY not in response.text()


@pytest.mark.external_test
def test_the_app_links_a_description_that_reaches_the_api(
    app_target: AppTarget, agent_api_base_url: str
) -> None:
    """The loaded app's HTML links the OpenAPI document, in its head and in the
    text a reader without JavaScript gets. The link is relative to the page,
    unless the host set ``BACKEND_BASE_URL``, in which case it is an absolute
    URL on that backend. The schema is fetched from the URL the link points
    to. The document says the API is on, and its server, resolved against
    that schema URL, reaches the interact route through `server.baseUrlPath`
    and any prefix a host adds.

    The `Link` header is not checked, because hosts may strip it.
    """
    schema_url = _advertised_schema_url(app_target, agent_api_base_url)
    # Read from the DOM, since Playwright's text matching skips `<noscript>`.
    noscript = app_target.locator("noscript").text_content() or ""
    assert _SCHEMA_PATH.lstrip("/") in noscript

    page = app_target.page
    # Fetch the schema from the backend, which on split-origin hosts is not
    # the origin that served the HTML.
    response = page.request.get(schema_url, max_redirects=0)
    assert response.status == 200, _describe(response)
    assert response.headers["content-type"].startswith("application/json")
    document: dict[str, Any] = response.json()
    assert document["openapi"].startswith("3.1")
    assert document["info"]["x-streamlit-agent-api"] == "available"

    [interact_path] = [
        path for path, item in document["paths"].items() if "post" in item
    ]
    root = urljoin(schema_url, document["servers"][0]["url"])
    interact_url = root + interact_path.lstrip("/")
    assert (
        urlsplit(interact_url).path == urlsplit(_interact_url(agent_api_base_url)).path
    )
    created = _snapshot(page.request.post(interact_url, data={}, max_redirects=0))
    assert _SESSION_ID.fullmatch(created["session_id"])
