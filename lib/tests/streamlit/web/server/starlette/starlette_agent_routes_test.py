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

"""Tests for the agent API route."""

from __future__ import annotations

import asyncio
import json
import textwrap
from contextlib import asynccontextmanager, contextmanager
from typing import TYPE_CHECKING, Any, Final
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import urljoin

import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.testclient import TestClient

from streamlit.elements.lib import agent_spec
from streamlit.runtime import Runtime, RuntimeConfig, runtime_util
from streamlit.runtime.agent.errors import (
    ERROR_CATALOG,
    AgentErrorCode,
    AgentRequestError,
    error_status,
)
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_session_storage import MemorySessionStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.web.server.starlette import (
    starlette_agent_routes,
    starlette_app_utils,
)
from streamlit.web.server.starlette.starlette_routes import create_media_routes
from tests.streamlit.runtime.agent import run_gate
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator, Generator, Iterator
    from pathlib import Path

_PATH: Final = "/_stcore/agent/interact"
_OTHER_METHODS: Final = ["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]


@pytest.fixture
def runtime() -> MagicMock:
    return MagicMock()


@pytest.fixture
def interact() -> Iterator[AsyncMock]:
    """Stand in for `interact`, so a passing request runs nothing."""
    with patch.object(
        starlette_agent_routes.interaction,
        "interact",
        new=AsyncMock(return_value=b'{"ok":true}'),
    ) as fake:
        yield fake


@contextmanager
def _client(
    runtime: Any, *, enabled: bool = True, **overrides: Any
) -> Generator[TestClient, None, None]:
    with patch_config_options({"server.enableAgentApi": enabled, **overrides}):
        app = Starlette(routes=starlette_agent_routes.create_agent_routes(runtime, ""))
        with TestClient(app) as client:
            yield client


@pytest.mark.parametrize("enabled", [True, False])
@pytest.mark.parametrize("method", _OTHER_METHODS)
def test_any_other_method_is_not_allowed(
    runtime: MagicMock, interact: AsyncMock, method: str, enabled: bool
) -> None:
    """Every method but POST gets 405, so none falls through to the app's HTML."""
    with _client(runtime, enabled=enabled) as client:
        response = client.request(method, _PATH)

    assert response.status_code == 405
    assert response.headers["Allow"] == "POST"
    interact.assert_not_awaited()


def test_off_answers_not_available(runtime: MagicMock, interact: AsyncMock) -> None:
    """With the API off, a POST is refused and nothing runs."""
    with _client(runtime, enabled=False) as client:
        response = client.post(_PATH, json={})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "not_available"
    interact.assert_not_awaited()
    runtime.connect_session.assert_not_called()


def test_disallowed_host_is_refused(runtime: MagicMock, interact: AsyncMock) -> None:
    """The WebSocket's Host allow-list applies."""
    with _client(runtime, **{"server.allowedHosts": ["app.example"]}) as client:
        refused = client.post(_PATH, json={}, headers={"Host": "evil.example"})
        allowed = client.post(_PATH, json={}, headers={"Host": "app.example"})

    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "host_not_allowed"
    assert allowed.status_code == 200
    interact.assert_awaited_once()


def test_an_origin_is_refused_unless_listed(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """A request from a web page is refused, same-origin included, unless the
    operator lists its origin.
    """
    listed = {"server.corsAllowedOrigins": ["https://app.example"]}
    with _client(runtime, **listed) as client:
        same_origin = client.post(
            _PATH, json={}, headers={"Origin": "http://testserver"}
        )
        allowed = client.post(_PATH, json={}, headers={"Origin": "https://app.example"})

    assert same_origin.status_code == 403
    assert same_origin.json()["error"]["code"] == "origin_not_allowed"
    assert allowed.status_code == 200
    interact.assert_awaited_once()


def test_a_body_over_the_limit_is_refused(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """The body is bounded by its declared length and while it streams."""
    with (
        patch.object(runtime_util, "get_max_widget_state_size_bytes", return_value=8),
        _client(runtime) as client,
    ):
        declared = client.post(_PATH, content=b'{"page": "report"}')
        streamed = client.post(_PATH, content=iter([b'{"page"', b': "report"}']))
        within = client.post(_PATH, content=iter([b"{", b"}"]))

    assert declared.status_code == 413
    assert declared.json()["error"]["code"] == "request_too_large"
    assert streamed.status_code == 413
    assert within.status_code == 200
    interact.assert_awaited_once()


@pytest.mark.anyio
async def test_read_body_refuses_a_length_too_long_to_parse() -> None:
    """A `Content-Length` of thousands of digits is too large, not a crash."""
    request = MagicMock()
    request.headers = {"Content-Length": "9" * 5000}

    assert await starlette_agent_routes._read_body(request, 100) is None


@pytest.mark.parametrize(
    "body",
    [
        b"{",
        b'{"page": NaN}',
        b'{"page": Infinity}',
        b'{"page": -Infinity}',
        b"\xff\xfe{}",
        # Deep enough to exhaust a worker thread's larger stack as well.
        b"[" * 1_000_000 + b"]" * 1_000_000,
        b'{"page": ' + b"1" * 5000 + b"}",
    ],
    ids=[
        "truncated",
        "nan",
        "infinity",
        "negative_infinity",
        "not_utf8",
        "deep_nesting",
        "huge_integer",
    ],
)
def test_a_body_that_is_not_strict_json_is_refused(
    runtime: MagicMock, interact: AsyncMock, body: bytes
) -> None:
    """Anything strict JSON does not allow is an invalid request."""
    with _client(runtime) as client:
        response = client.post(_PATH, content=body)

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "invalid_request"
    assert error["message"].startswith("The body is not valid JSON")
    interact.assert_not_awaited()


@pytest.mark.parametrize("body", [b"[]", b'"x"', b"1", b"null"])
def test_a_body_that_is_not_an_object_is_refused(
    runtime: MagicMock, interact: AsyncMock, body: bytes
) -> None:
    """The body must be a JSON object."""
    with _client(runtime) as client:
        response = client.post(_PATH, content=body)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"
    interact.assert_not_awaited()


@pytest.mark.parametrize("body", [b"", b" \n"])
def test_an_empty_body_is_an_empty_request(
    runtime: MagicMock, interact: AsyncMock, body: bytes
) -> None:
    """An empty body is `{}`, a creating call, answered as JSON."""
    with _client(runtime) as client:
        response = client.post(_PATH, content=body)

    assert response.status_code == 200
    assert response.headers["Content-Type"] == "application/json"
    assert response.content == b'{"ok":true}'
    assert interact.await_args is not None
    assert interact.await_args.args[2] == {}


def test_interact_gets_the_request_headers_and_trusted_identity(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """Identity comes from the trusted headers alone; the headers are passed on."""
    trusted = {"server.trustedUserHeaders": {"X-Email": "email"}}
    with _client(runtime, **trusted) as client:
        client.post(_PATH, json={"page": "x"}, headers={"X-Email": "a@example.com"})

    assert interact.await_args is not None
    assert interact.await_args.kwargs["user_info"] == {"email": "a@example.com"}
    assert ("x-email", "a@example.com") in interact.await_args.kwargs["headers"]


@pytest.mark.parametrize("code", list(ERROR_CATALOG))
def test_an_agent_request_error_is_answered_from_the_catalog(
    runtime: MagicMock, interact: AsyncMock, code: AgentErrorCode
) -> None:
    """Each code gets its catalog status, its details, and the session."""
    interact.side_effect = AgentRequestError(
        code, "Explained.", session_id="s_1", details={"pages": [{"url_path": ""}]}
    )
    with _client(runtime) as client:
        response = client.post(_PATH, json={})

    assert response.status_code == error_status(code)
    assert response.json() == {
        "error": {"code": code, "message": "Explained.", "pages": [{"url_path": ""}]},
        "session_id": "s_1",
    }


def test_an_unexpected_failure_hides_its_cause(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """An internal error is logged with its cause, which the response omits."""
    interact.side_effect = RuntimeError("secret detail")
    with (
        patch.object(starlette_agent_routes._LOGGER, "exception") as log_exception,
        _client(runtime) as client,
    ):
        response = client.post(_PATH, json={})

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "secret detail" not in response.text
    assert "session_id" not in response.json()
    log_exception.assert_called_once()


def test_a_client_that_disconnects_cancels_the_wait(
    runtime: MagicMock, interact: AsyncMock
) -> None:
    """A disconnect cancels the interaction, which counts as timed out."""
    cancelled = asyncio.Event()

    async def wait_forever(*_args: Any, **_kwargs: Any) -> bytes:
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled.set()
            raise
        return b"{}"  # pragma: no cover - never reached

    async def disconnect() -> dict[str, Any]:
        return {"type": "http.disconnect"}

    interact.side_effect = wait_forever
    with (
        # The body is read from the request's own stream, so this only replaces
        # what arrives after it.
        patch.object(Request, "receive", new=property(lambda _self: disconnect)),
        _client(runtime) as client,
    ):
        response = client.post(_PATH, json={})

    assert response.status_code == 202
    assert response.json()["error"]["code"] == "run_timed_out"
    assert cancelled.is_set()


@asynccontextmanager
async def _lifespan_with(runtime: Runtime) -> AsyncGenerator[None, None]:
    await runtime.start()
    try:
        yield
    finally:
        run_gate.opened.set()
        runtime.stop()
        await runtime.stopped


@contextmanager
def _served_app(
    tmp_path: Path, script: str, overrides: dict[str, Any], *, base_url: str = ""
) -> Generator[TestClient, None, None]:
    """A real Runtime on ``script``, behind the agent and media routes.

    ``overrides`` is read at every lookup, so a test can change an option while
    the app runs.
    """
    main_script = tmp_path / "app.py"
    main_script.write_text(textwrap.dedent(script))
    media_storage = MemoryMediaFileStorage("/media")
    registered = agent_spec._agent_session_ids
    run_gate.reset()
    Runtime._instance = None
    defaults = {
        "server.enableAgentApi": True,
        "server.fileWatcherType": "none",
        "server.baseUrlPath": base_url,
        "server.agentRunTimeout": 10,
    }
    for name, value in defaults.items():
        overrides.setdefault(name, value)
    try:
        with patch_config_options(overrides):
            runtime = Runtime(
                RuntimeConfig(
                    script_path=str(main_script),
                    media_file_storage=media_storage,
                    uploaded_file_manager=MemoryUploadedFileManager(
                        "/_stcore/upload_file"
                    ),
                    cache_storage_manager=MemoryCacheStorageManager(),
                    session_storage=MemorySessionStorage(),
                )
            )
            app = Starlette(
                routes=[
                    *starlette_agent_routes.create_agent_routes(runtime, base_url),
                    *create_media_routes(media_storage, base_url),
                ],
                lifespan=lambda _app: _lifespan_with(runtime),
            )
            with TestClient(app) as client:
                yield client
    finally:
        run_gate.opened.set()
        Runtime._instance = None
        agent_spec._agent_session_ids = registered


_GATED_SCRIPT: Final = """
import streamlit as st
from tests.streamlit.runtime.agent import run_gate

run_gate.wait()
st.text(f"runs={run_gate.count('runs')}")
"""


def test_statuses_end_to_end(tmp_path: Path) -> None:
    """A real runtime answers 200, 202, 404, 409, and 429 as the catalog says."""
    overrides = {"server.agentMaxSessions": 1, "server.agentRunTimeout": 0.2}
    with _served_app(tmp_path, _GATED_SCRIPT, overrides) as client:
        run_gate.close()
        timed_out = client.post(_PATH, json={})
        handle = timed_out.json()["session_id"]
        busy = client.post(
            _PATH, json={"session_id": handle, "query_params": {"q": ["1"]}}
        )
        full = client.post(_PATH, json={})
        unknown = client.post(_PATH, json={"session_id": "s_unknown"})

        overrides["server.agentRunTimeout"] = 10
        run_gate.opened.set()
        collected = client.post(_PATH, json={"session_id": handle})

    assert timed_out.status_code == 202
    assert timed_out.json()["error"]["code"] == "run_timed_out"
    assert busy.status_code == 409
    assert busy.json()["error"]["code"] == "session_busy"
    assert full.status_code == 429
    assert full.json()["error"]["code"] == "too_many_sessions"
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "unknown_session"
    assert collected.status_code == 200
    assert collected.json()["session_id"] == handle


def test_media_urls_resolve_against_the_request_under_a_base_path(
    tmp_path: Path,
) -> None:
    """Under `server.baseUrlPath`, the route lives below it, and a media URL
    joined with the request's URL reaches the media route.
    """
    script = """
    import numpy as np
    import streamlit as st

    st.image(np.zeros((2, 2, 3), dtype=np.uint8))
    """
    with _served_app(tmp_path, script, {}, base_url="base") as client:
        unprefixed = client.post(_PATH, json={})
        response = client.post(f"/base{_PATH}", json={})
        image = next(
            child
            for child in response.json()["tree"]["children"][0]["children"]
            if child["type"] == "image"
        )
        media_url = urljoin(str(response.url), image["props"]["url"])
        media = client.get(media_url)

    assert unprefixed.status_code == 404
    assert response.status_code == 200
    assert image["props"]["url"].startswith("../../media/")
    assert media_url.startswith("http://testserver/base/media/")
    assert media.status_code == 200
    assert media.headers["Content-Type"].startswith("image/")


def test_a_login_cookie_does_not_authenticate(tmp_path: Path) -> None:
    """The route reads no cookie: a valid `st.login` cookie leaves `st.user`
    anonymous and `st.context` without cookies.
    """
    script = """
    import streamlit as st

    st.text(f"logged_in={st.user.get('is_logged_in')}")
    st.text(f"email={st.user.get('email')}")
    st.text(f"cookies={dict(st.context.cookies)}")
    st.text(f"cookie_header={st.context.headers.get('Cookie')}")
    """
    login = starlette_app_utils.create_signed_value(
        "test-secret",
        "_streamlit_user",
        json.dumps(
            {
                "origin": "http://testserver",
                "is_logged_in": True,
                "email": "a@example.com",
            }
        ),
    )
    with _served_app(
        tmp_path, script, {"server.cookieSecret": "test-secret"}
    ) as client:
        client.cookies.set("_streamlit_user", login.decode())
        response = client.post(_PATH, json={})

    texts = [
        child["props"]["body"]
        for child in response.json()["tree"]["children"][0]["children"]
    ]
    assert texts == [
        "logged_in=None",
        "email=None",
        "cookies={}",
        "cookie_header=None",
    ]
