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

"""Tests for the agent API's MCP route, `/_stcore/agent/mcp`."""

from __future__ import annotations

import base64
import json
import re
import types
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Final
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import urljoin

import pyarrow as pa
import pytest
from starlette.applications import Starlette
from starlette.requests import ClientDisconnect
from starlette.testclient import TestClient

from streamlit.elements.lib import agent_data
from streamlit.runtime import runtime_util
from streamlit.runtime.agent import interaction, mcp, protocol
from streamlit.runtime.agent.errors import (
    ERROR_CATALOG,
    AgentErrorCode,
    AgentRequestError,
)
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.web.server.starlette import starlette_agent_routes
from tests.streamlit.runtime.agent import run_gate
from tests.streamlit.web.server.starlette import agent_served_app
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import Generator, Iterator
    from pathlib import Path

    import httpx2

_MCP_PATH: Final = "/_stcore/agent/mcp"
_INTERACT_PATH: Final = "/_stcore/agent/interact"
_SCHEMA_PATH: Final = "/_stcore/agent/openapi.json"
_OTHER_METHODS: Final = ["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]
_LINK: Final = '<openapi.json>; rel="service-desc"'
_LISTED_ORIGIN: Final = {"server.corsAllowedOrigins": ["https://app.example"]}


@pytest.fixture
def runtime() -> MagicMock:
    runtime = MagicMock()
    runtime.media_file_mgr = MediaFileManager(MemoryMediaFileStorage("/media"))
    return runtime


@pytest.fixture
def interact() -> Iterator[AsyncMock]:
    """Stand in for `interact`, so a passing call runs nothing."""
    with patch.object(
        starlette_agent_routes.interaction,
        "interact",
        new=AsyncMock(return_value=b'{"ok":true}'),
    ) as fake:
        yield fake


@contextmanager
def _client(
    runtime: Any, *, enabled: bool = True, base_url: str = "", **overrides: Any
) -> Generator[TestClient, None, None]:
    with patch_config_options({"server.enableAgentApi": enabled, **overrides}):
        app = Starlette(
            routes=starlette_agent_routes.create_agent_routes(runtime, base_url)
        )
        with TestClient(app) as client:
            yield client


def _message(method: str, params: Any = None, *, request_id: Any = 1) -> dict[str, Any]:
    message: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        message["params"] = params
    return message


def _call(
    client: TestClient,
    name: str,
    arguments: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Call a tool and return its result."""
    params: dict[str, Any] = {"name": name}
    if arguments is not None:
        params["arguments"] = arguments
    response = client.post(_MCP_PATH, json=_message("tools/call", params), **kwargs)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == 1
    result: dict[str, Any] = body["result"]
    return result


def _text(result: dict[str, Any]) -> dict[str, Any]:
    """A tool result's JSON text."""
    [content] = result["content"]
    assert content["type"] == "text"
    parsed: dict[str, Any] = json.loads(content["text"])
    return parsed


def _jsonrpc_error(response: Any, status: int, code: int, request_id: Any) -> str:
    """The message of a JSON-RPC error, checked for its status, code, and id."""
    assert response.status_code == status, response.text
    assert response.headers["Content-Type"] == "application/json"
    body = response.json()
    assert body["jsonrpc"] == "2.0"
    assert body["id"] == request_id
    assert body["error"]["code"] == code
    assert "result" not in body
    message: str = body["error"]["message"]
    return message


@pytest.mark.parametrize("enabled", [True, False])
@pytest.mark.parametrize("method", _OTHER_METHODS)
def test_any_other_method_is_not_allowed(
    runtime: MagicMock, interact: AsyncMock, method: str, enabled: bool
) -> None:
    """Every method but POST gets an empty 405: there is no stream to open, and
    nothing falls through to the app's HTML.
    """
    with _client(runtime, enabled=enabled) as client:
        response = client.request(method, _MCP_PATH)

    assert response.status_code == 405
    assert response.headers["Allow"] == "POST"
    assert response.content == b""
    interact.assert_not_awaited()


@pytest.mark.parametrize(
    "message",
    [
        _message("initialize", {"protocolVersion": "2025-11-25"}),
        _message("server/discover"),
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        _message("tools/call", {"name": "interact", "arguments": {}}),
    ],
    ids=["initialize", "discover", "notification", "tools_call"],
)
def test_off_refuses_every_message_with_400(
    runtime: MagicMock, interact: AsyncMock, message: dict[str, Any]
) -> None:
    """With the API off, every message, a notification included, is a 400
    that names the setting, not the interact route's 403, which MCP clients
    read as an authorization failure.
    """
    with _client(runtime, enabled=False) as client:
        response = client.post(_MCP_PATH, json=message)

    text = _jsonrpc_error(response, 400, mcp.INVALID_REQUEST, None)
    assert text.startswith("not_available: ")
    assert "`server.enableAgentApi`" in text
    assert "serverInfo" not in response.text
    interact.assert_not_awaited()
    runtime.connect_session.assert_not_called()


def test_disallowed_hosts_and_origins_are_refused(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """The Host allow-list and the `Origin` check apply, as on the interact
    route, with `id: null` since nothing was parsed.
    """
    initialize = _message("initialize")
    with _client(runtime, **{"server.allowedHosts": ["app.example"]}) as client:
        host = client.post(_MCP_PATH, json=initialize, headers={"Host": "evil.example"})
        allowed = client.post(
            _MCP_PATH, json=initialize, headers={"Host": "app.example"}
        )
    with _client(runtime) as client:
        origin = client.post(
            _MCP_PATH, json=initialize, headers={"Origin": "http://testserver"}
        )

    assert _jsonrpc_error(host, 403, mcp.INVALID_REQUEST, None).startswith(
        "host_not_allowed: "
    )
    assert _jsonrpc_error(origin, 403, mcp.INVALID_REQUEST, None).startswith(
        "origin_not_allowed: "
    )
    assert allowed.status_code == 200


@pytest.mark.parametrize(
    ("content", "content_type"),
    [
        (b'{"jsonrpc":"2.0","id":1,"method":"ping"}', "text/plain"),
        (b"a=b", "application/x-www-form-urlencoded"),
        (b"", None),
    ],
    ids=["text_plain", "form", "empty_without_media_type"],
)
def test_a_listed_pages_request_must_be_json(
    runtime: MagicMock, interact: AsyncMock, content: bytes, content_type: str | None
) -> None:
    """A request a page on a listed origin could send without a preflight is
    refused, so such a page cannot call `interact` blind.
    """
    headers = {"Origin": "https://app.example"}
    if content_type is not None:
        headers["Content-Type"] = content_type
    with _client(runtime, **_LISTED_ORIGIN) as client:
        response = client.post(_MCP_PATH, content=content, headers=headers)

    text = _jsonrpc_error(response, 400, mcp.INVALID_REQUEST, None)
    assert text.startswith("invalid_request: ")
    assert "`Content-Type: application/json`" in text


def test_json_with_parameters_and_programs_without_an_origin_are_answered(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """A page's JSON may carry a charset, and a program sends no `Origin`."""
    ping = json.dumps(_message("ping")).encode()
    with _client(runtime, **_LISTED_ORIGIN) as client:
        page = client.post(
            _MCP_PATH,
            content=ping,
            headers={
                "Origin": "https://app.example",
                "Content-Type": "application/json; charset=utf-8",
            },
        )
        program = client.post(_MCP_PATH, content=ping)

    assert page.json()["result"] == {}
    assert program.json()["result"] == {}


@pytest.mark.parametrize(
    "body",
    [b"{", b"", b" \n", b'{"id": NaN}', b"\xff\xfe{}"],
    ids=["truncated", "empty", "whitespace", "nan", "not_utf8"],
)
def test_a_body_that_is_not_json_is_a_parse_error(
    runtime: MagicMock, interact: AsyncMock, body: bytes
) -> None:
    """Anything strict JSON does not allow, an empty body included, is -32700."""
    with _client(runtime) as client:
        response = client.post(_MCP_PATH, content=body)

    assert _jsonrpc_error(response, 400, mcp.PARSE_ERROR, None).startswith(
        "Parse error"
    )


def test_json_that_is_not_a_jsonrpc_message_is_refused(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """JSON the server cannot read as a message, here a request with a null
    `id`, is an HTTP error, as the transport prescribes, with `id: null`.
    """
    with _client(runtime) as client:
        response = client.post(
            _MCP_PATH, json={"jsonrpc": "2.0", "id": None, "method": "ping"}
        )

    _jsonrpc_error(response, 400, mcp.INVALID_REQUEST, None)


def test_a_batch_is_refused_without_running_anything(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """A batch would run several interactions in one request, so it is one
    -32600 error rather than several answers.
    """
    batch = [_message("tools/call", {"name": "interact", "arguments": {}})] * 2
    with _client(runtime) as client:
        response = client.post(_MCP_PATH, json=batch)

    assert "Batches" in _jsonrpc_error(response, 200, mcp.INVALID_REQUEST, None)
    interact.assert_not_awaited()


@pytest.mark.parametrize(
    "message",
    [
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 4, "result": {}},
    ],
    ids=["notification", "response"],
)
def test_notifications_and_responses_are_accepted_without_a_body(
    runtime: MagicMock, interact: AsyncMock, message: dict[str, Any]
) -> None:
    """A notification or a response gets 202 and no body."""
    with _client(runtime) as client:
        response = client.post(_MCP_PATH, json=message)

    assert response.status_code == 202
    assert response.content == b""


def test_an_unknown_method_is_not_found(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """Methods beyond the four this server implements are -32601, echoing the
    request's id but not its method.
    """
    with _client(runtime) as client:
        response = client.post(
            _MCP_PATH, json=_message("resources/list", request_id="r-1")
        )

    text = _jsonrpc_error(response, 200, mcp.METHOD_NOT_FOUND, "r-1")
    assert "resources/list" not in text


def test_a_tool_call_must_name_a_tool_of_this_server(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """An unknown tool is -32602, echoing the request's id but not the tool's
    name, and runs nothing.
    """
    with _client(runtime) as client:
        response = client.post(
            _MCP_PATH,
            json=_message("tools/call", {"name": "browse", "arguments": {}}),
        )

    text = _jsonrpc_error(response, 200, mcp.INVALID_PARAMS, 1)
    assert "browse" not in text
    interact.assert_not_awaited()


def test_initialize_negotiates_a_revision_and_names_the_server(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """A supported revision the client asks for is echoed, with tools as the
    only capability and the overview as `instructions`, and no MCP session.
    """
    with _client(runtime) as client:
        response = client.post(
            _MCP_PATH,
            json=_message(
                "initialize",
                {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "1"},
                },
            ),
        )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["protocolVersion"] == "2025-06-18"
    assert result["capabilities"] == {"tools": {"listChanged": False}}
    assert result["serverInfo"]["name"] == "streamlit"
    assert "title" not in result["serverInfo"]
    assert result["instructions"] == protocol.MCP_INSTRUCTIONS
    assert "Mcp-Session-Id" not in response.headers


def test_the_2026_probe_falls_back_to_initialize(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """`server/discover` with the `2026-07-28` header is a 400 with -32600
    echoing its id, which makes a `2026-07-28` client fall back. The fallback
    `initialize` is answered even with the probe's header.
    """
    header = {mcp.PROTOCOL_VERSION_HEADER: "2026-07-28"}
    with _client(runtime) as client:
        probe = client.post(
            _MCP_PATH, json=_message("server/discover", request_id=4), headers=header
        )
        initialize = client.post(
            _MCP_PATH,
            json=_message("initialize", {"protocolVersion": "2025-11-25"}),
            headers=header,
        )

    assert "data" not in probe.json()["error"]
    assert "`initialize`" in _jsonrpc_error(probe, 400, mcp.INVALID_REQUEST, 4)
    assert initialize.json()["result"]["protocolVersion"] == "2025-11-25"


def test_an_unsupported_version_header_refuses_a_tool_call_before_it_runs(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """A `tools/call` with a revision this server does not speak is a 400
    with -32600 echoing its id, and `interact` never runs.
    """
    with _client(runtime) as client:
        response = client.post(
            _MCP_PATH,
            json=_message(
                "tools/call", {"name": "interact", "arguments": {}}, request_id=6
            ),
            headers={mcp.PROTOCOL_VERSION_HEADER: "2026-07-28"},
        )

    text = _jsonrpc_error(response, 400, mcp.INVALID_REQUEST, 6)
    assert f"`{mcp.PROTOCOL_VERSION_HEADER}`" in text
    interact.assert_not_awaited()


def test_a_client_that_leaves_while_sending_the_body_runs_nothing(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """An aborted upload gets a bare 400, without an error raised or logged."""
    with (
        patch.object(
            starlette_agent_routes,
            "_read_body",
            new=AsyncMock(side_effect=ClientDisconnect()),
        ),
        patch.object(starlette_agent_routes._LOGGER, "exception") as log_exception,
        _client(runtime) as client,
    ):
        response = client.post(_MCP_PATH, json=_message("ping"))

    assert response.status_code == 400
    assert response.content == b""
    interact.assert_not_awaited()
    log_exception.assert_not_called()


def test_ping_is_empty_and_tools_list_is_fixed_with_the_configured_ttl(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """`ping` is empty, and `tools/list` is the same two tools on every call,
    with the configured session TTL in `interact`'s description.
    """
    with _client(runtime, **{"server.agentSessionTTL": 120}) as client:
        ping = client.post(_MCP_PATH, json=_message("ping"))
        first = client.post(_MCP_PATH, json=_message("tools/list"))
        second = client.post(_MCP_PATH, json=_message("tools/list"))

    assert ping.json() == {"jsonrpc": "2.0", "id": 1, "result": {}}
    assert first.content == second.content
    tools = first.json()["result"]["tools"]
    assert [tool["name"] for tool in tools] == ["interact", "get_data"]
    assert "after 2 minutes without a call" in tools[0]["description"]
    interact.assert_not_awaited()


def test_interact_runs_the_interact_operation(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """The tool's arguments are the request, with the call's trusted identity
    and headers, and its text is the response body, unchanged.
    """
    trusted = {"server.trustedUserHeaders": {"X-Email": "email"}}
    with _client(runtime, **trusted) as client:
        result = _call(
            client,
            "interact",
            {"session_id": "s_1", "page": "x"},
            headers={"X-Email": "a@example.com"},
        )
        created = _call(client, "interact")

    assert result == {
        "content": [{"type": "text", "text": '{"ok":true}'}],
        "isError": False,
    }
    first, second = interact.await_args_list
    assert first.args[1] == {"session_id": "s_1", "page": "x"}
    assert first.kwargs["user_info"] == {"email": "a@example.com"}
    assert ("x-email", "a@example.com") in first.kwargs["headers"]
    assert first.kwargs["encode"] is starlette_agent_routes._encode_snapshot
    assert second.args[1] == {}
    assert created["isError"] is False


@pytest.mark.parametrize("code", list(ERROR_CATALOG))
def test_a_refused_interaction_is_a_tool_result_with_the_http_body(
    runtime: MagicMock, interact: AsyncMock, code: AgentErrorCode
) -> None:
    """Each refusal's text is exactly the interact route's body, and only
    `wait_timed_out`, whose run goes on, is not an error.
    """
    interact.side_effect = AgentRequestError(
        code, "Explained.", session_id="s_1", details={"pages": [{"url_path": ""}]}
    )
    with _client(runtime) as client:
        result = _call(client, "interact", {})
        over_http = client.post(_INTERACT_PATH, json={})

    assert result["isError"] is (code != "wait_timed_out")
    [content] = result["content"]
    assert content["text"].encode() == over_http.content
    assert _text(result)["error"]["code"] == code


def test_an_unexpected_interaction_failure_hides_its_cause(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """An internal error is logged with its cause, which the result omits."""
    interact.side_effect = RuntimeError("secret detail")
    with (
        patch.object(starlette_agent_routes._LOGGER, "exception") as log_exception,
        _client(runtime) as client,
    ):
        result = _call(client, "interact", {})

    assert result["isError"] is True
    assert _text(result)["error"]["code"] == "internal_error"
    assert "secret detail" not in json.dumps(result)
    log_exception.assert_called_once()


def test_an_unexpected_failure_outside_a_tool_is_an_internal_error(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """A method that fails unexpectedly answers -32603 with its id, logged."""
    with (
        patch.object(mcp, "answer", side_effect=RuntimeError("secret detail")),
        patch.object(starlette_agent_routes._LOGGER, "exception") as log_exception,
        _client(runtime) as client,
    ):
        response = client.post(_MCP_PATH, json=_message("ping", request_id=5))

    assert "secret" not in _jsonrpc_error(response, 200, mcp.INTERNAL_ERROR, 5)
    log_exception.assert_called_once()


def test_get_data_never_creates_a_session(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """Without a `session_id`, or with one the server does not know, a read
    is refused, and its message says `interact` starts a session rather than
    to omit `session_id`.
    """
    with _client(runtime, **{"server.agentSessionTTL": 120}) as client:
        missing = _call(client, "get_data", {"url": "../../media/x"})
        unknown = _call(client, "get_data", {"session_id": "s_x", "url": "x"})
        empty = _call(client, "get_data")

    assert _text(missing)["error"]["code"] == "invalid_request"
    assert _text(empty)["error"]["code"] == "invalid_request"
    message = _text(unknown)["error"]["message"]
    assert _text(unknown)["error"]["code"] == "unknown_session"
    assert "`get_data` cannot start a session" in message
    assert "2 minutes" in message
    assert "Omit" not in message
    assert all(result["isError"] for result in (missing, unknown, empty))
    runtime.connect_session.assert_not_called()
    interact.assert_not_awaited()


def test_checks_run_in_the_interact_routes_order(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """Enablement, then Host, then `Origin`, then a page's content type, then
    body size, then parsing: each request fails the earliest check it fails,
    as a -32600 error with `id: null` that names the agent API's code.
    """
    hosts = {"server.allowedHosts": ["app.example"], **_LISTED_ORIGIN}
    evil_host = {"Host": "evil.example", "Origin": "https://evil.example"}
    with _client(runtime, enabled=False, **hosts) as client:
        disabled = client.post(_MCP_PATH, content=b"{", headers=evil_host)
    with (
        patch.object(runtime_util, "get_max_widget_state_size_bytes", return_value=4),
        _client(runtime, **hosts) as client,
    ):
        host = client.post(_MCP_PATH, content=b"{", headers=evil_host)
        origin = client.post(
            _MCP_PATH,
            content=b"{",
            headers={"Host": "app.example", "Origin": "https://evil.example"},
        )
        content_type = client.post(
            _MCP_PATH,
            content=b"{" * 10,
            headers={"Host": "app.example", "Origin": "https://app.example"},
        )
        size = client.post(
            _MCP_PATH, content=b"{" * 10, headers={"Host": "app.example"}
        )

    refusals = {
        "not_available": (disabled, 400),
        "host_not_allowed": (host, 403),
        "origin_not_allowed": (origin, 403),
        "invalid_request": (content_type, 400),
        "request_too_large": (size, 413),
    }
    for code, (response, status) in refusals.items():
        message = _jsonrpc_error(response, status, mcp.INVALID_REQUEST, None)
        assert message.startswith(f"{code}: "), code


def test_every_mcp_response_links_the_description(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """Each way the route can answer carries the `Link` header, and its target,
    resolved against the request's URL, is the served document.
    """
    responses = {}
    with _client(runtime, enabled=False) as client:
        responses["not_available"] = client.post(_MCP_PATH, json=_message("ping"))
    with _client(runtime) as client:
        responses["method_not_allowed"] = client.get(_MCP_PATH)
        responses["origin_not_allowed"] = client.post(
            _MCP_PATH, json=_message("ping"), headers={"Origin": "https://evil.example"}
        )
        responses["parse_error"] = client.post(_MCP_PATH, content=b"{")
        responses["batch"] = client.post(_MCP_PATH, json=[_message("ping")])
        responses["notification"] = client.post(
            _MCP_PATH, json={"jsonrpc": "2.0", "method": "notifications/initialized"}
        )
        responses["discover"] = client.post(_MCP_PATH, json=_message("server/discover"))
        responses["initialize"] = client.post(_MCP_PATH, json=_message("initialize"))
        responses["tool_call"] = client.post(
            _MCP_PATH, json=_message("tools/call", {"name": "interact"})
        )
        responses["get_data"] = client.post(
            _MCP_PATH, json=_message("tools/call", {"name": "get_data"})
        )
        with patch.object(
            runtime_util, "get_max_widget_state_size_bytes", return_value=1
        ):
            responses["request_too_large"] = client.post(
                _MCP_PATH, json=_message("ping")
            )
        targets = {
            urljoin(str(response.url), "openapi.json")
            for response in responses.values()
        }
        described = [client.get(target) for target in targets]

    assert {name: response.status_code for name, response in responses.items()} == {
        "not_available": 400,
        "method_not_allowed": 405,
        "origin_not_allowed": 403,
        "parse_error": 400,
        "batch": 200,
        "notification": 202,
        "discover": 400,
        "initialize": 200,
        "tool_call": 200,
        "get_data": 200,
        "request_too_large": 413,
    }
    for name, response in responses.items():
        assert response.headers.get("Link") == _LINK, name
    assert targets == {f"http://testserver{_SCHEMA_PATH}"}
    assert [response.json()["openapi"] for response in described] == ["3.1.0"]


@pytest.mark.parametrize("base_url", ["", "base", "a/b"])
def test_the_documented_mcp_path_is_the_route(
    runtime: MagicMock, interact: AsyncMock, base_url: str
) -> None:
    """Under `server.baseUrlPath`, the document's MCP path, joined to its
    server, is the route, and the route sits beside the interact route, so a
    result's relative media URLs reach the same files from both.
    """
    base_path = f"/{base_url}" if base_url else ""
    schema_url = f"http://testserver{base_path}{_SCHEMA_PATH}"
    with _client(runtime, base_url=base_url) as client:
        document = client.get(schema_url).json()
        [mcp_path] = [
            path
            for path, item in document["paths"].items()
            if item.get("post", {}).get("operationId") == "mcp"
        ]
        server_url = urljoin(schema_url, document["servers"][0]["url"])
        mcp_url = server_url + mcp_path.lstrip("/")
        initialized = client.post(mcp_url, json=_message("initialize"))

    assert mcp_path == f"{base_path}{_MCP_PATH}"
    assert mcp_url == urljoin(schema_url, "mcp")
    assert initialized.status_code == 200
    interact_url = urljoin(schema_url, "interact")
    assert urljoin(mcp_url, "../../media/x") == urljoin(interact_url, "../../media/x")


_DATA_SCRIPT: Final = """
import numpy as np
import pandas as pd
import streamlit as st
from tests.streamlit.runtime.agent import run_gate

run_gate.wait()
st.text(f"runs={run_gate.count('runs')}")
st.dataframe(pd.DataFrame({"order": range(250), "amount": [n * 1.5 for n in range(250)]}))
st.image(np.full((4, 4, 3), 200, dtype=np.uint8))
st.download_button("Export", "a,b\\n1,2\\n", file_name="export.csv", mime="text/csv")
"""


def _nodes(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    pending = [snapshot["tree"]]
    while pending:
        node = pending.pop()
        found.append(node)
        pending.extend(node.get("children") or [])
    return found


def _of_type(snapshot: dict[str, Any], node_type: str) -> dict[str, Any]:
    [node] = [node for node in _nodes(snapshot) if node["type"] == node_type]
    return node


def _without_run_facts(document: dict[str, Any]) -> dict[str, Any]:
    """A snapshot without what differs from one run to the next: when it was
    observed, and the script's run counter.
    """
    comparable: dict[str, Any] = json.loads(
        re.sub(r'"runs=\d+"', '"runs=N"', json.dumps(document))
    )
    del comparable["observed_at"]
    return comparable


def test_interact_and_get_data_end_to_end(tmp_path: Path) -> None:
    """With a real runtime, the `interact` tool returns the snapshot the
    interact route returns, and `get_data` reads its table past the preview,
    its image, and its download as the media route serves them, without
    running the app.
    """
    mcp_url = f"http://testserver{_MCP_PATH}"
    with agent_served_app.served_app(tmp_path, _DATA_SCRIPT, {}) as client:
        created = _call(client, "interact", {})
        snapshot = _text(created)
        session_id = snapshot["session_id"]
        over_mcp = _text(_call(client, "interact", {"session_id": session_id}))
        over_http = client.post(_INTERACT_PATH, json={"session_id": session_id}).json()
        table = _of_type(snapshot, "dataframe")["data"]
        image_url = _of_type(snapshot, "image")["props"]["url"]
        download_url = _of_type(snapshot, "download_button")["props"]["url"]
        runs = run_gate.value("runs")
        page = _text(
            _call(
                client,
                "get_data",
                {
                    "session_id": session_id,
                    "url": table["url"],
                    "offset": len(table["preview"]["rows"]),
                },
            )
        )
        image = _call(client, "get_data", {"session_id": session_id, "url": image_url})
        download = _call(
            client, "get_data", {"session_id": session_id, "url": download_url}
        )
        served_table = client.get(urljoin(mcp_url, table["url"])).content
        served_image = client.get(urljoin(mcp_url, image_url))
        runs_after_reads = run_gate.value("runs")

    assert created["isError"] is False
    assert snapshot["status"] == "ready"
    assert _without_run_facts(over_mcp) == _without_run_facts(over_http)
    assert table["url"].startswith("../../media/")
    assert table["complete"] is False
    arrow = pa.ipc.open_stream(served_table).read_all()
    assert page["columns"] == table["columns"]
    assert page["row_count"] == arrow.num_rows == 250
    assert page["rows"] == agent_data.arrow_rows(arrow, offset=100, limit=150)
    assert page["next_offset"] is None
    # `st.image` stores an array without transparency as a JPEG.
    assert image["content"] == [
        {
            "type": "image",
            "data": base64.b64encode(served_image.content).decode(),
            "mimeType": served_image.headers["Content-Type"],
        }
    ]
    assert served_image.headers["Content-Type"] == "image/jpeg"
    assert download["content"] == [{"type": "text", "text": "a,b\n1,2\n"}]
    # Reading files ran nothing.
    assert runs_after_reads == runs


def test_get_data_answers_only_the_identity_that_created_the_session(
    tmp_path: Path,
) -> None:
    """A session answers only its creator's identity, so another caller's
    read is `unknown_session`, as if the session did not exist.
    """
    overrides = {"server.trustedUserHeaders": {"X-Email": "email"}}
    with agent_served_app.served_app(tmp_path, _DATA_SCRIPT, overrides) as client:
        snapshot = _text(
            _call(client, "interact", {}, headers={"X-Email": "a@example.com"})
        )
        read = {
            "session_id": snapshot["session_id"],
            "url": _of_type(snapshot, "image")["props"]["url"],
        }
        own = _call(client, "get_data", read, headers={"X-Email": "a@example.com"})
        other = _call(client, "get_data", read, headers={"X-Email": "b@example.com"})
        anonymous = _call(client, "get_data", read)

    assert own["isError"] is False
    for refused in (other, anonymous):
        assert refused["isError"] is True
        error = _text(refused)["error"]
        assert error["code"] == "unknown_session"
        assert "`get_data` cannot start a session" in error["message"]


class _Clock:
    """A monotonic clock a test moves by hand."""

    def __init__(self) -> None:
        self.now = 1000.0

    def monotonic(self) -> float:
        return self.now


def test_a_read_restarts_the_sessions_idle_timer(tmp_path: Path) -> None:
    """A read counts as use of the session, so a model paging a table with
    `get_data` alone keeps it past the TTL measured from the last run.
    """
    clock = _Clock()
    overrides = {"server.agentSessionTTL": 100}
    with (
        patch.object(
            interaction, "time", types.SimpleNamespace(monotonic=clock.monotonic)
        ),
        agent_served_app.served_app(tmp_path, _DATA_SCRIPT, overrides) as client,
    ):
        snapshot = _text(_call(client, "interact", {}))
        read = {
            "session_id": snapshot["session_id"],
            "url": _of_type(snapshot, "image")["props"]["url"],
        }
        results = []
        for now in (1090.0, 1150.0, 1260.0):
            clock.now = now
            results.append(_call(client, "get_data", read))

    assert [result["isError"] for result in results] == [False, False, True]
    assert _text(results[-1])["error"]["code"] == "unknown_session"


def test_get_data_reads_while_an_interaction_is_in_flight(tmp_path: Path) -> None:
    """A read takes no in-flight lock, so it runs beside an interaction on its
    session, and reads the files of the result before it, while another
    interaction is refused as busy.
    """
    with (
        agent_served_app.served_app(tmp_path, _DATA_SCRIPT, {}) as client,
        ThreadPoolExecutor(max_workers=1) as pool,
    ):
        snapshot = _text(_call(client, "interact", {}))
        session_id = snapshot["session_id"]
        table = _of_type(snapshot, "dataframe")["data"]
        run_gate.close()
        in_flight = pool.submit(_call, client, "interact", {"session_id": session_id})
        assert run_gate.reached.wait(5)
        read = _call(
            client,
            "get_data",
            {"session_id": session_id, "url": table["url"], "offset": 240},
        )
        busy = _call(client, "interact", {"session_id": session_id})
        run_gate.opened.set()
        finished = in_flight.result(timeout=10)

    assert read["isError"] is False
    assert len(_text(read)["rows"]) == 10
    assert _text(busy)["error"]["code"] == "session_busy"
    assert finished["isError"] is False


def test_a_run_timed_out_over_mcp_is_collected_over_http(tmp_path: Path) -> None:
    """Both transports drive the same sessions: a creating call that times
    out is not an error and carries the `session_id`, and a plain request on
    the interact route collects its run.
    """
    overrides: dict[str, Any] = {"server.agentWaitTimeout": 0.2}
    with agent_served_app.served_app(tmp_path, _DATA_SCRIPT, overrides) as client:
        run_gate.close()
        timed_out = _call(client, "interact", {})
        body = _text(timed_out)
        overrides["server.agentWaitTimeout"] = 10
        run_gate.opened.set()
        collected = client.post(_INTERACT_PATH, json={"session_id": body["session_id"]})

    assert timed_out["isError"] is False
    assert body["error"]["code"] == "wait_timed_out"
    assert collected.status_code == 200
    assert collected.json()["session_id"] == body["session_id"]
    assert run_gate.value("runs") == 1


def test_get_data_pages_a_wide_table_to_its_end(tmp_path: Path) -> None:
    """After a page the character budget cut short, `next_offset` is the row
    after its last, and following it from the preview's end reads every row
    the media route serves.
    """
    script = """
    import pandas as pd
    import streamlit as st

    st.dataframe(
        pd.DataFrame(
            {f"c{i}": [f"cell {i}-{n:04} " * 2 for n in range(300)] for i in range(40)}
        )
    )
    """
    with agent_served_app.served_app(tmp_path, script, {}) as client:
        snapshot = _text(_call(client, "interact", {}))
        table = _of_type(snapshot, "dataframe")["data"]
        served = client.get(
            urljoin(f"http://testserver{_MCP_PATH}", table["url"])
        ).content
        pages = []
        offset: int | None = len(table["preview"]["rows"])
        while offset is not None:
            result = _call(
                client,
                "get_data",
                {
                    "session_id": snapshot["session_id"],
                    "url": table["url"],
                    "offset": offset,
                },
            )
            page = _text(result)
            pages.append(page)
            offset = page["next_offset"]

    first = pages[0]
    assert len(first["rows"]) < mcp.PAGE_ROWS
    assert first["next_offset"] == first["offset"] + len(first["rows"])
    rows = [row for page in pages for row in page["rows"]]
    arrow = pa.ipc.open_stream(served).read_all()
    assert table["preview"]["rows"] + rows == agent_data.arrow_rows(arrow, limit=300)


@pytest.mark.require_integration
def test_the_official_mcp_client_connects_and_uses_both_tools(tmp_path: Path) -> None:
    """The official Python MCP client connects in its default mode, which
    probes `server/discover` first and falls back to `initialize`, and in its
    handshake-only mode, then calls both tools. Like a hosted connector, it
    sends no `Origin`, and it opens no stream and ends no session. Given the
    URL with a trailing slash, it follows the static files' 308 to the route.
    """
    import httpx2
    from mcp.client import Client
    from mcp.client.streamable_http import streamable_http_client

    sent: list[httpx2.Request] = []

    async def record(request: httpx2.Request) -> None:
        # A redirected request carries its body as a stream until it is read.
        await request.aread()
        sent.append(request)

    async def connect(
        app: Any, mode: str, url: str = f"http://testserver{_MCP_PATH}"
    ) -> dict[str, Any]:
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app),
            base_url="http://testserver",
            event_hooks={"request": [record]},
        ) as http:
            transport = streamable_http_client(url, http_client=http)
            async with Client(transport, mode=mode) as session:
                tools = await session.list_tools()
                created = await session.call_tool("interact", {})
                snapshot = json.loads(created.content[0].text)
                table = _of_type(snapshot, "dataframe")["data"]
                page = await session.call_tool(
                    "get_data",
                    {
                        "session_id": snapshot["session_id"],
                        "url": table["url"],
                        "offset": 100,
                        "limit": 5,
                    },
                )
                refused = await session.call_tool(
                    "get_data",
                    {"session_id": snapshot["session_id"], "url": "logo.png"},
                )
                return {
                    "protocol_version": session.protocol_version,
                    "server_name": session.server_info.name
                    if session.server_info
                    else None,
                    "instructions": session.instructions,
                    "tools": [tool.name for tool in tools.tools],
                    "annotations": tools.tools[0].annotations,
                    "created": created.is_error,
                    "page": json.loads(page.content[0].text),
                    "refused": (refused.is_error, json.loads(refused.content[0].text)),
                }

    with agent_served_app.served_app(
        tmp_path, _DATA_SCRIPT, {}, static_assets=True
    ) as client:
        assert client.portal is not None
        auto = client.portal.call(connect, client.app, "auto")
        auto_requests = list(sent)
        sent.clear()
        legacy = client.portal.call(connect, client.app, "legacy")
        legacy_requests = list(sent)
        sent.clear()
        slashed = client.portal.call(
            connect, client.app, "auto", f"http://testserver{_MCP_PATH}/"
        )

    for connected in (auto, legacy, slashed):
        assert connected["protocol_version"] == "2025-11-25"
        assert connected["server_name"] == "streamlit"
        assert connected["instructions"] == protocol.MCP_INSTRUCTIONS
        assert connected["tools"] == ["interact", "get_data"]
        assert connected["annotations"].read_only_hint is False
        assert connected["created"] is False
        assert connected["page"]["offset"] == 100
        assert connected["page"]["next_offset"] == 105
        is_error, body = connected["refused"]
        assert is_error is True
        assert body["error"]["code"] == "unknown_file"
    methods = [json.loads(request.content).get("method") for request in auto_requests]
    assert methods[:3] == ["server/discover", "initialize", "notifications/initialized"]
    assert json.loads(legacy_requests[0].content)["method"] == "initialize"
    # Each message to the URL with the slash is sent again, with the same
    # body, to the route the 308 names.
    assert [request.url.path for request in sent] == [
        f"{_MCP_PATH}/",
        _MCP_PATH,
    ] * len(auto_requests)
    assert [request.content for request in sent[::2]] == [
        request.content for request in sent[1::2]
    ]
    assert [json.loads(request.content).get("method") for request in sent[1::2]] == (
        methods
    )
    for request in [*auto_requests, *legacy_requests, *sent]:
        assert request.method == "POST"
        assert "origin" not in request.headers
