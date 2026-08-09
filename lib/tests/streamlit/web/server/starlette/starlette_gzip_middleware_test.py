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

"""Unit tests for starlette_gzip_middleware module."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

import pytest
from starlette.applications import Starlette
from starlette.responses import Response, StreamingResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from streamlit.web.server.starlette.starlette_gzip_middleware import (
    SelectiveGZipMiddleware,
    _route_path,
    _should_bypass_gzip,
)

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from starlette.types import Message, Receive, Scope, Send


def _build_client(
    *routes: Route,
    minimum_size: int = 100,
    base_url: str = "",
) -> TestClient:
    """Build a TestClient for an app wrapped in SelectiveGZipMiddleware."""
    app = Starlette(routes=list(routes))
    app.add_middleware(
        SelectiveGZipMiddleware,
        minimum_size=minimum_size,
        compresslevel=5,
        base_url=base_url,
    )
    return TestClient(app)


def _text_route(
    path: str, *, content_type: str = "text/plain", size: int = 1000
) -> Route:
    """Create a route returning a body of the given content type and size."""

    async def endpoint(_: Any) -> Response:
        return Response(content=b"x" * size, media_type=content_type)

    return Route(path, endpoint)


class TestCompression:
    """Compression behavior delegated to Starlette's GZipMiddleware."""

    def test_compresses_text_on_regular_path(self) -> None:
        """Text responses on non-bypassed paths are gzip compressed."""
        client = _build_client(_text_route("/_stcore/data"))

        response = client.get("/_stcore/data", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"

    def test_compresses_json_on_regular_path(self) -> None:
        """JSON responses on non-bypassed paths are gzip compressed."""
        client = _build_client(
            _text_route("/_stcore/host-config", content_type="application/json")
        )

        response = client.get(
            "/_stcore/host-config", headers={"Accept-Encoding": "gzip"}
        )

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"

    def test_does_not_compress_without_gzip_accept_encoding(self) -> None:
        """Responses are not compressed when the client does not accept gzip."""
        client = _build_client(_text_route("/_stcore/data"))

        response = client.get("/_stcore/data", headers={"Accept-Encoding": "identity"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_does_not_compress_small_body(self) -> None:
        """Bodies below minimum_size are not compressed."""
        client = _build_client(_text_route("/_stcore/data", size=10))

        response = client.get("/_stcore/data", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_does_not_compress_event_stream(self) -> None:
        """text/event-stream is excluded by Starlette's built-in middleware."""
        client = _build_client(
            _text_route("/_stcore/stream", content_type="text/event-stream")
        )

        response = client.get("/_stcore/stream", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_compresses_streaming_response(self) -> None:
        """Streaming responses on non-bypassed paths are still compressed."""

        async def stream_endpoint(_: Any) -> StreamingResponse:
            async def body() -> AsyncIterator[bytes]:
                for _ in range(10):
                    yield b"x" * 200

            return StreamingResponse(body(), media_type="text/plain")

        client = _build_client(Route("/_stcore/data", stream_endpoint))

        response = client.get("/_stcore/data", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"
        # The decompressed stream is intact.
        assert response.content == b"x" * 2000


class TestBypass:
    """Path-based bypass of static assets and media."""

    def test_bypasses_static_path(self) -> None:
        """Frontend static assets are served uncompressed."""
        client = _build_client(
            _text_route("/static/app.123.js", content_type="application/javascript")
        )

        response = client.get("/static/app.123.js", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_bypasses_root_path(self) -> None:
        """The root document is served uncompressed."""
        client = _build_client(_text_route("/", content_type="text/html"))

        response = client.get("/", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    @pytest.mark.parametrize(
        "content_type",
        ["audio/mpeg", "video/mp4", "image/png", "application/octet-stream"],
    )
    def test_bypasses_media_path(self, content_type: str) -> None:
        """All media route responses are served uncompressed regardless of type."""
        client = _build_client(_text_route("/media/file123", content_type=content_type))

        response = client.get("/media/file123", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_compresses_app_static_path(self) -> None:
        """User app-static assets (/app/static) are still compressed."""
        client = _build_client(
            _text_route("/app/static/data.json", content_type="application/json")
        )

        response = client.get(
            "/app/static/data.json", headers={"Accept-Encoding": "gzip"}
        )

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"

    def test_bypasses_media_with_base_url(self) -> None:
        """Media is bypassed even when a base URL prefix is configured."""
        client = _build_client(
            _text_route("/my-app/media/file123", content_type="video/mp4"),
            base_url="my-app",
        )

        response = client.get(
            "/my-app/media/file123", headers={"Accept-Encoding": "gzip"}
        )

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_compresses_regular_path_with_base_url(self) -> None:
        """Non-bypassed paths under a base URL are still compressed."""
        client = _build_client(
            _text_route("/my-app/_stcore/data"),
            base_url="my-app",
        )

        response = client.get(
            "/my-app/_stcore/data", headers={"Accept-Encoding": "gzip"}
        )

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"

    def test_does_not_compress_range_request(self) -> None:
        """A request carrying a Range header is served uncompressed.

        This verifies the request-level bypass: the endpoint here ignores the
        Range header and returns a full 200, but the presence of the Range
        header alone must still disable compression. That bypass is what keeps
        real partial (206) responses intact, since their
        Content-Range/Content-Length describe the uncompressed byte range.
        """
        client = _build_client(_text_route("/_stcore/data"))

        response = client.get(
            "/_stcore/data",
            headers={"Accept-Encoding": "gzip", "Range": "bytes=0-10"},
        )

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None


class TestShouldBypassGzip:
    """Unit tests for the _should_bypass_gzip predicate."""

    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            ("/", True),
            ("", True),
            ("/static/app.123.js", True),
            ("/media/abc123", True),
            ("/app/static/logo.svg", False),
            ("/assets/theme.css", False),
            ("/_stcore/metrics", False),
            ("/_stcore/host-config", False),
        ],
    )
    def test_without_base_url(self, path: str, expected: bool) -> None:
        """Root, static, and media paths bypass; everything else compresses."""
        assert _should_bypass_gzip(path) is expected

    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            ("/my-app", True),
            ("/my-app/", True),
            ("/my-app/static/app.js", True),
            ("/my-app/media/abc123", True),
            ("/my-app/_stcore/data", False),
            # A path that merely starts with the base string but is not the base
            # segment must not be treated as the base URL.
            ("/my-application/media/abc", False),
        ],
    )
    def test_with_base_url(self, path: str, expected: bool) -> None:
        """The base URL prefix is stripped before matching bypass routes."""
        assert _should_bypass_gzip(path, base_url="my-app") is expected

    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            ("/my-app", True),
            ("/my-app/", True),
            ("/my-app/static/app.js", True),
            ("/my-app/media/abc123", True),
            ("/my-app/_stcore/data", False),
        ],
    )
    def test_with_slash_wrapped_base_url(self, path: str, expected: bool) -> None:
        """A slash-wrapped base URL (the shape from server.baseUrlPath) is normalized.

        ``config.get_option("server.baseUrlPath")`` can return a value with
        surrounding slashes (e.g. ``"/my-app/"``); the ``strip("/")`` in
        ``_should_bypass_gzip`` must handle it the same as ``"my-app"``.
        """
        assert _should_bypass_gzip(path, base_url="/my-app/") is expected


async def _echo_app(scope: Scope, receive: Receive, send: Send) -> None:
    """Minimal ASGI app returning a compressible text/plain body."""
    await send(
        {
            "type": "http.response.start",
            "status": 200,
            "headers": [(b"content-type", b"text/plain")],
        }
    )
    await send({"type": "http.response.body", "body": b"x" * 2000})


def _drive(app: Any, scope: Scope) -> list[Message]:
    """Drive an ASGI app once with an empty request body and collect messages."""
    messages: list[Message] = []

    async def receive() -> Message:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: Message) -> None:
        messages.append(message)

    asyncio.run(app(scope, receive, send))
    return messages


def _content_encoding(messages: list[Message]) -> bytes | None:
    """Return the Content-Encoding header from the response start message."""
    for message in messages:
        if message["type"] == "http.response.start":
            return dict(message["headers"]).get(b"content-encoding")
    return None


class TestRootPath:
    """Bypass must work under an ASGI root_path (mount / reverse-proxy base URL).

    Streamlit can be served under a base URL via ``root_path`` even without
    ``server.baseUrlPath`` set. In that case ``scope["path"]`` keeps the mount
    prefix, so the bypass must strip ``root_path`` (like Starlette's router)
    before matching ``/static/`` and ``/media/``.
    """

    @pytest.mark.parametrize(
        ("scope", "expected"),
        [
            ({"path": "/app/media/x", "root_path": "/app"}, "/media/x"),
            ({"path": "/app/static/a.js", "root_path": "/app"}, "/static/a.js"),
            ({"path": "/app", "root_path": "/app"}, "/"),
            ({"path": "/app/", "root_path": "/app"}, "/"),
            # Boundary: root_path "/app" must not strip a "/application" prefix.
            ({"path": "/application/x", "root_path": "/app"}, "/application/x"),
            ({"path": "/media/x", "root_path": ""}, "/media/x"),
            ({"path": "/media/x"}, "/media/x"),
        ],
    )
    def test_route_path(self, scope: Scope, expected: str) -> None:
        """root_path is stripped only at a path-segment boundary."""
        assert _route_path(scope) == expected

    @pytest.mark.parametrize(
        "path", ["/app/media/clip.mp4", "/app/static/app.123.js", "/app"]
    )
    def test_bypasses_static_and_media_under_root_path(self, path: str) -> None:
        """Static/media/root are served uncompressed even under a root_path."""
        middleware = SelectiveGZipMiddleware(_echo_app, minimum_size=100)
        scope: Scope = {
            "type": "http",
            "path": path,
            "root_path": "/app",
            "headers": [(b"accept-encoding", b"gzip")],
        }

        assert _content_encoding(_drive(middleware, scope)) is None

    def test_compresses_api_under_root_path(self) -> None:
        """Non-bypassed paths under a root_path are still compressed."""
        middleware = SelectiveGZipMiddleware(_echo_app, minimum_size=100)
        scope: Scope = {
            "type": "http",
            "path": "/app/_stcore/data",
            "root_path": "/app",
            "headers": [(b"accept-encoding", b"gzip")],
        }

        assert _content_encoding(_drive(middleware, scope)) == b"gzip"
