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

"""Unit tests for starlette_path_security_middleware module."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from streamlit.web.server.starlette.starlette_path_security_middleware import (
    PathSecurityMiddleware,
)

if TYPE_CHECKING:
    from starlette.websockets import WebSocket


def _create_test_app() -> Starlette:
    """Create a test Starlette app with the PathSecurityMiddleware."""

    async def echo_path(request):
        return PlainTextResponse(f"Path: {request.url.path}")

    app = Starlette(
        routes=[
            Route("/{path:path}", echo_path),
        ]
    )
    app.add_middleware(PathSecurityMiddleware)
    return app


def _create_websocket_app() -> Starlette:
    """Create a test app with a WebSocket endpoint."""
    from starlette.routing import WebSocketRoute

    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        await websocket.send_text("connected")
        await websocket.close()

    app = Starlette(
        routes=[
            WebSocketRoute("/ws", websocket_endpoint),
        ]
    )
    app.add_middleware(PathSecurityMiddleware)
    return app


class TestPathSecurityMiddleware:
    """Tests for PathSecurityMiddleware."""

    @pytest.mark.parametrize(
        ("path", "expected_path"),
        [
            ("/../../../etc/passwd", "/etc/passwd"),
            ("///attacker.com/share", "/attacker.com/share"),
        ],
        ids=[
            "forward-slash-traversal-normalized",
            "multiple-forward-slashes-normalized",
        ],
    )
    def test_starlette_normalizes_paths(self, path: str, expected_path: str) -> None:
        """Test that Starlette normalizes certain path patterns before middleware.

        These patterns are handled securely by the framework's path normalization,
        so they reach the middleware as safe paths.
        """
        app = _create_test_app()
        client = TestClient(app)

        response = client.get(path)

        assert response.status_code == 200
        assert f"Path: {expected_path}" in response.text

    @pytest.mark.parametrize(
        "unsafe_path",
        [
            "/..\\..\\etc\\passwd",
            "/C:/Windows/system32",
            "/D:/secrets",
            "/%5c%5cattacker%5cshare",  # \\attacker\share (URL-decoded by Starlette)
            "/file%00.txt",
        ],
        ids=[
            "path-traversal-backslash",
            "windows-drive-c",
            "windows-drive-d",
            "unc-backslash",
            "null-byte",
        ],
    )
    def test_blocks_unsafe_paths(self, unsafe_path: str) -> None:
        """Test that unsafe path patterns are blocked with 400.

        Note: Forward-slash path traversal (/../..) and multiple forward slashes
        (///) are normalized by Starlette before reaching the middleware, which
        is secure framework behavior. This test covers patterns that are NOT
        normalized by the framework.
        """
        app = _create_test_app()
        client = TestClient(app)

        response = client.get(unsafe_path)

        assert response.status_code == 400
        assert response.text == "Bad Request"

    @pytest.mark.parametrize(
        "safe_path",
        [
            "/",
            "/index.html",
            "/static/app.js",
            "/component/my_component/index.html",
            "/deeply/nested/path/to/file.css",
            "/file-with-dots.min.js",
            "/path.with.dots/file.txt",
            "/file..js",
            "/files/...hidden",
        ],
        ids=[
            "root",
            "simple-file",
            "static-dir",
            "component-path",
            "deeply-nested",
            "dots-in-filename",
            "dots-in-dirname",
            "double-dots-in-filename",
            "triple-dots-in-filename",
        ],
    )
    def test_allows_safe_paths(self, safe_path: str) -> None:
        """Test that safe path patterns are allowed."""
        app = _create_test_app()
        client = TestClient(app)

        response = client.get(safe_path)

        assert response.status_code == 200
        assert f"Path: {safe_path}" in response.text

    def test_websocket_connections_pass_through(self) -> None:
        """Test that WebSocket connections are not blocked by path validation."""
        app = _create_websocket_app()
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            data = websocket.receive_text()
            assert data == "connected"


class TestDoubleSlashBypass:
    """Tests for the double-slash UNC path bypass vulnerability.

    This tests a specific attack vector where `//server/share` (a UNC path on Windows)
    could bypass the middleware's path validation because lstrip("/") normalizes
    away the leading slashes before the check, but the original path remains in scope.

    Note: We test with raw ASGI scope rather than TestClient because TestClient
    interprets `//host/path` as a URL with authority component (host), not as a
    path starting with `//`. Raw ASGI scope tests the actual attack scenario.
    """

    @pytest.mark.parametrize(
        "unc_path",
        [
            "//attacker.com/share",
            "//192.168.1.1/admin",
            "//localhost/c$/Windows",
        ],
        ids=[
            "unc-domain",
            "unc-ip-address",
            "unc-localhost-admin-share",
        ],
    )
    @pytest.mark.anyio
    async def test_double_slash_unc_paths_are_blocked(self, unc_path: str) -> None:
        """Test that double-slash UNC paths are blocked by the middleware.

        The middleware must detect and block paths like `//server/share` which
        are UNC paths on Windows. These should NOT pass through even though
        `attacker.com/share` (after lstrip) looks like a safe relative path.

        We use raw ASGI scope to simulate an attacker sending a malicious request
        directly, bypassing URL parsing that would interpret // as authority.
        """
        # Build the app with middleware
        app = _create_test_app()

        # Construct a raw ASGI scope with the malicious path
        scope = {
            "type": "http",
            "method": "GET",
            "path": unc_path,
            "query_string": b"",
            "headers": [],
            "server": ("localhost", 8000),
            "asgi": {"version": "3.0"},
        }

        response_status: int | None = None
        response_body = b""

        async def receive():
            return {"type": "http.request", "body": b""}

        async def send(message):
            nonlocal response_status, response_body
            if message["type"] == "http.response.start":
                response_status = message["status"]
            elif message["type"] == "http.response.body":
                response_body += message.get("body", b"")

        await app(scope, receive, send)

        # These MUST be blocked - if they return 200, we have a security bypass
        assert response_status == 400, (
            f"UNC path {unc_path!r} was not blocked! "
            "Double-slash paths should be rejected for SSRF protection."
        )
        assert response_body == b"Bad Request"


class TestMiddlewarePosition:
    """Tests to verify the middleware is positioned correctly in the stack."""

    def test_middleware_is_first_in_streamlit_stack(self) -> None:
        """Test that PathSecurityMiddleware is the first middleware added."""
        from starlette.middleware import Middleware

        from streamlit.web.server.starlette.starlette_app import (
            create_streamlit_middleware,
        )

        middleware_list = create_streamlit_middleware()

        # PathSecurityMiddleware should be first
        assert len(middleware_list) >= 1
        first_middleware = middleware_list[0]
        assert isinstance(first_middleware, Middleware)
        assert first_middleware.cls is PathSecurityMiddleware

    def test_middleware_runs_before_other_processing(self) -> None:
        """Test that unsafe paths are blocked before reaching session middleware."""
        from starlette.middleware import Middleware
        from starlette.middleware.sessions import SessionMiddleware

        # Create app with both middlewares (path security first, then session)
        async def echo_path(request):
            # If we get here, path security didn't block us
            return PlainTextResponse(f"Path: {request.url.path}")

        app = Starlette(
            routes=[Route("/{path:path}", echo_path)],
            middleware=[
                Middleware(PathSecurityMiddleware),
                Middleware(SessionMiddleware, secret_key="test-secret"),
            ],
        )
        client = TestClient(app)

        # Safe path should work
        response = client.get("/safe/path")
        assert response.status_code == 200

        # Unsafe path (backslash traversal - not normalized by Starlette)
        # should be blocked before session processing
        response = client.get("/..\\..\\etc\\passwd")
        assert response.status_code == 400

    def test_middleware_protects_routes_without_explicit_validation(self) -> None:
        """Test that middleware blocks unsafe paths even when handler doesn't validate.

        This verifies the Swiss Cheese defense model: the middleware acts as a
        catch-all safety net for routes that forget to call is_unsafe_path_pattern().
        """
        # Track whether the handler was called
        handler_called = False

        async def naive_handler(request):
            """A deliberately vulnerable handler that does NOT validate the path.

            In production, this would be a security vulnerability without middleware.
            """
            nonlocal handler_called
            handler_called = True
            path = request.path_params.get("path", "")
            return PlainTextResponse(f"Received: {path}")

        app = Starlette(
            routes=[Route("/vulnerable/{path:path}", naive_handler)],
        )
        app.add_middleware(PathSecurityMiddleware)
        client = TestClient(app)

        # Safe path should reach the handler
        handler_called = False
        response = client.get("/vulnerable/safe/file.txt")
        assert response.status_code == 200
        assert handler_called is True

        # Unsafe path should be blocked by middleware BEFORE reaching handler
        handler_called = False
        response = client.get("/vulnerable/..\\..\\etc\\passwd")
        assert response.status_code == 400
        assert response.text == "Bad Request"
        assert handler_called is False  # Key assertion: handler was never called
