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

"""Unit tests for starlette_gzip_middleware module.

Some behaviors depend on the installed Starlette version: on Starlette >= 1.5.0
the stock middleware excludes already-compressed media content types by default
and skips compressing partial 206 responses, so the wrapper stops bypassing the
``/media/`` path and ``Range`` requests. Tests that differ between versions
branch on ``_STARLETTE_HANDLES_MEDIA_AND_RANGE``.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

import pytest
from starlette.applications import Starlette
from starlette.responses import Response, StreamingResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from streamlit.web.server.starlette.starlette_gzip_middleware import (
    _STARLETTE_HANDLES_MEDIA_AND_RANGE,
    SelectiveGZipMiddleware,
    _is_media_path,
    _route_path,
    _should_bypass_gzip,
)

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from starlette.types import ASGIApp, Message, Receive, Scope, Send


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
    """Path-based bypass of static assets, plus media/range handling."""

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

    @pytest.mark.parametrize("content_type", ["audio/mpeg", "video/mp4", "image/png"])
    def test_media_content_types_not_compressed(self, content_type: str) -> None:
        """Already-compressed media on /media/ is never compressed.

        On Starlette < 1.5 the whole /media/ path is bypassed; on >= 1.5 these
        content types (audio/*, video/*, image/png, ...) are excluded by the
        stock middleware's default exclude list.
        """
        client = _build_client(_text_route("/media/file123", content_type=content_type))

        response = client.get("/media/file123", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_media_octet_stream_download(self) -> None:
        """application/octet-stream downloads on /media/ depend on the version.

        Starlette < 1.5 bypasses the whole /media/ path, so octet-stream
        downloads are never compressed. Starlette >= 1.5 does not exclude
        octet-stream by content type, so a full 200 download is compressed
        (partial 206 range downloads are still skipped natively).
        """
        client = _build_client(
            _text_route("/media/file.bin", content_type="application/octet-stream")
        )

        response = client.get("/media/file.bin", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        if _STARLETTE_HANDLES_MEDIA_AND_RANGE:
            assert response.headers.get("content-encoding") == "gzip"
        else:
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

    def test_media_content_type_excluded_outside_media_path(self) -> None:
        """Already-compressed media outside /media/ depends on the version.

        The point of delegating to the stock middleware is that it excludes
        already-compressed content types wherever they are served, not just
        under /media/ (e.g. a custom component asset or an /app/static/ file).
        Starlette >= 1.5 skips a video/mp4 body on this non-media, non-static
        path via its default content-type exclusion, so nothing here relies on
        the /media/ path bypass. Starlette < 1.5 has no such exclusion, so the
        same body is compressed.
        """
        client = _build_client(
            _text_route("/app/static/clip.mp4", content_type="video/mp4")
        )

        response = client.get(
            "/app/static/clip.mp4", headers={"Accept-Encoding": "gzip"}
        )

        assert response.status_code == 200
        if _STARLETTE_HANDLES_MEDIA_AND_RANGE:
            assert response.headers.get("content-encoding") is None
        else:
            assert response.headers.get("content-encoding") == "gzip"

    def test_media_with_base_url_not_compressed(self) -> None:
        """Media is not compressed even when a base URL prefix is configured.

        Path-bypassed on Starlette < 1.5 and content-type-excluded on >= 1.5.
        """
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

    def test_does_not_compress_partial_206_response(self) -> None:
        """A partial 206 response is never compressed.

        Compressing a partial response would corrupt its Content-Range/
        Content-Length, which describe the uncompressed byte range. This is
        skipped via the Range-request bypass on Starlette < 1.5 and via native
        206 handling on >= 1.5. The path here is non-media so that, on modern
        Starlette, native 206 handling (not a path bypass) is what applies.
        """

        async def endpoint(_: Any) -> Response:
            return Response(
                content=b"x" * 1000,
                status_code=206,
                media_type="text/plain",
                headers={"Content-Range": "bytes 0-999/5000"},
            )

        client = _build_client(Route("/_stcore/data", endpoint))

        response = client.get(
            "/_stcore/data",
            headers={"Accept-Encoding": "gzip", "Range": "bytes=0-999"},
        )

        assert response.status_code == 206
        assert response.headers.get("content-encoding") is None

    def test_full_200_response_to_range_request(self) -> None:
        """A full 200 response to a Range request depends on the version.

        Starlette < 1.5 bypasses any request carrying a Range header, so the
        response is uncompressed. Starlette >= 1.5 only skips actual 206
        responses, so this full 200 body (the endpoint ignores the Range header)
        is compressed.
        """
        client = _build_client(_text_route("/_stcore/data"))

        response = client.get(
            "/_stcore/data",
            headers={"Accept-Encoding": "gzip", "Range": "bytes=0-10"},
        )

        assert response.status_code == 200
        if _STARLETTE_HANDLES_MEDIA_AND_RANGE:
            assert response.headers.get("content-encoding") == "gzip"
        else:
            assert response.headers.get("content-encoding") is None


class TestLegacyBypass:
    """Legacy (<1.5) dispatch branch, forced on regardless of installed version.

    On the installed Starlette this branch is only reached on the min-version
    CI job (Starlette 0.46.0). These tests monkeypatch the version flag off so
    the /media/ path bypass and Range bypass (and _is_range_request) are
    exercised on every run. The wrapper serves bypassed paths via ``self.app``,
    so this faithfully reproduces the legacy dispatch independent of the stock
    middleware's version-specific internals.
    """

    @pytest.fixture(autouse=True)
    def _force_legacy(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Force the legacy dispatch branch by disabling the version flag."""
        monkeypatch.setattr(
            "streamlit.web.server.starlette.starlette_gzip_middleware."
            "_STARLETTE_HANDLES_MEDIA_AND_RANGE",
            False,
        )

    def test_bypasses_media_octet_stream(self) -> None:
        """The /media/ path is bypassed for any content type on legacy Starlette."""
        client = _build_client(
            _text_route("/media/file.bin", content_type="application/octet-stream")
        )

        response = client.get("/media/file.bin", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_bypasses_full_200_range_request(self) -> None:
        """Any Range request is bypassed on legacy Starlette, even a full 200."""
        client = _build_client(_text_route("/_stcore/data"))

        response = client.get(
            "/_stcore/data",
            headers={"Accept-Encoding": "gzip", "Range": "bytes=0-10"},
        )

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_still_compresses_regular_path(self) -> None:
        """Non-media, non-range paths are still compressed on legacy Starlette."""
        client = _build_client(_text_route("/_stcore/data"))

        response = client.get("/_stcore/data", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"


class TestShouldBypassGzip:
    """Unit tests for the _should_bypass_gzip predicate (static + root only)."""

    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            ("/", True),
            ("", True),
            ("/static/app.123.js", True),
            # Media is no longer an always-bypass path; see _is_media_path.
            ("/media/abc123", False),
            ("/app/static/logo.svg", False),
            ("/assets/theme.css", False),
            ("/_stcore/metrics", False),
            ("/_stcore/host-config", False),
        ],
    )
    def test_without_base_url(self, path: str, expected: bool) -> None:
        """Root and static paths bypass; everything else (incl. media) does not."""
        assert _should_bypass_gzip(path) is expected

    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            ("/my-app", True),
            ("/my-app/", True),
            ("/my-app/static/app.js", True),
            ("/my-app/media/abc123", False),
            ("/my-app/_stcore/data", False),
            # A path that merely starts with the base string but is not the base
            # segment must not be treated as the base URL.
            ("/my-application/static/abc", False),
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
            ("/my-app/media/abc123", False),
            ("/my-app/_stcore/data", False),
        ],
    )
    def test_with_slash_wrapped_base_url(self, path: str, expected: bool) -> None:
        """A slash-wrapped base URL (the shape from server.baseUrlPath) is normalized.

        ``config.get_option("server.baseUrlPath")`` can return a value with
        surrounding slashes (e.g. ``"/my-app/"``); the ``strip("/")`` in
        ``_strip_base_url`` must handle it the same as ``"my-app"``.
        """
        assert _should_bypass_gzip(path, base_url="/my-app/") is expected


class TestIsMediaPath:
    """Unit tests for the _is_media_path predicate."""

    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            ("/media/abc123", True),
            # Bare "/media" (no trailing slash) is not the media file route.
            ("/media", False),
            ("/static/app.js", False),
            ("/", False),
            ("/_stcore/data", False),
        ],
    )
    def test_without_base_url(self, path: str, expected: bool) -> None:
        """Only the /media/ file route matches."""
        assert _is_media_path(path) is expected

    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            ("/my-app/media/abc123", True),
            ("/my-app/static/app.js", False),
            # A path that merely starts with the base string is not the base.
            ("/my-application/media/abc", False),
        ],
    )
    def test_with_base_url(self, path: str, expected: bool) -> None:
        """The base URL prefix is stripped before matching the media route."""
        assert _is_media_path(path, base_url="my-app") is expected


def _make_echo_app(content_type: bytes = b"text/plain") -> ASGIApp:
    """Build a minimal ASGI app returning a body of the given content type."""

    async def app(scope: Scope, receive: Receive, send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", content_type)],
            }
        )
        await send({"type": "http.response.body", "body": b"x" * 2000})

    return app


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
    prefix, so path handling must strip ``root_path`` (like Starlette's router)
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

    @pytest.mark.parametrize("path", ["/app/static/app.123.js", "/app"])
    def test_bypasses_static_and_root_under_root_path(self, path: str) -> None:
        """Static assets and the root doc are served uncompressed under root_path."""
        middleware = SelectiveGZipMiddleware(_make_echo_app(), minimum_size=100)
        scope: Scope = {
            "type": "http",
            "path": path,
            "root_path": "/app",
            "headers": [(b"accept-encoding", b"gzip")],
        }

        assert _content_encoding(_drive(middleware, scope)) is None

    def test_media_not_compressed_under_root_path(self) -> None:
        """Media video under root_path is uncompressed on every Starlette version.

        Path-bypassed on Starlette < 1.5 and content-type-excluded on >= 1.5
        (video/*), so the encoding must be absent regardless of version.
        """
        middleware = SelectiveGZipMiddleware(
            _make_echo_app(b"video/mp4"), minimum_size=100
        )
        scope: Scope = {
            "type": "http",
            "path": "/app/media/clip.mp4",
            "root_path": "/app",
            "headers": [(b"accept-encoding", b"gzip")],
        }

        assert _content_encoding(_drive(middleware, scope)) is None

    def test_compresses_api_under_root_path(self) -> None:
        """Non-bypassed paths under a root_path are still compressed."""
        middleware = SelectiveGZipMiddleware(_make_echo_app(), minimum_size=100)
        scope: Scope = {
            "type": "http",
            "path": "/app/_stcore/data",
            "root_path": "/app",
            "headers": [(b"accept-encoding", b"gzip")],
        }

        assert _content_encoding(_drive(middleware, scope)) == b"gzip"

    def test_combined_root_path_and_base_url(self) -> None:
        """root_path and server.baseUrlPath are stripped in sequence.

        A media path under both an ASGI mount root_path and a configured base
        URL must still be recognized (uncompressed on every version: path-bypass
        on <1.5, content-type exclusion on >=1.5), while a regular API path
        under both prefixes is still compressed.
        """
        media_mw = SelectiveGZipMiddleware(
            _make_echo_app(b"video/mp4"), minimum_size=100, base_url="my-app"
        )
        media_scope: Scope = {
            "type": "http",
            "path": "/app/my-app/media/clip.mp4",
            "root_path": "/app",
            "headers": [(b"accept-encoding", b"gzip")],
        }
        assert _content_encoding(_drive(media_mw, media_scope)) is None

        api_mw = SelectiveGZipMiddleware(
            _make_echo_app(), minimum_size=100, base_url="my-app"
        )
        api_scope: Scope = {
            "type": "http",
            "path": "/app/my-app/_stcore/data",
            "root_path": "/app",
            "headers": [(b"accept-encoding", b"gzip")],
        }
        assert _content_encoding(_drive(api_mw, api_scope)) == b"gzip"
