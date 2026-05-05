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


async def _call_asgi_with_path(app: Starlette, path: str) -> tuple[int | None, bytes]:
    """Call an ASGI app with a raw HTTP scope for the given path.

    This bypasses URL parsing that would interpret // as authority, allowing
    us to test raw path handling.
    """
    scope = {
        "type": "http",
        "method": "GET",
        "path": path,
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
    return response_status, response_body


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
        app = _create_test_app()

        response_status, response_body = await _call_asgi_with_path(app, unc_path)

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


class TestSafePathFastPath:
    """Tests for the safe path fast-path optimization.

    These tests verify that known-safe routes skip the is_unsafe_path_pattern()
    check for performance, while still being protected by the double-slash check.
    """

    @pytest.mark.parametrize(
        "safe_path",
        [
            "/_stcore/health",
            "/_stcore/script-health-check",
            "/_stcore/metrics",
            "/_stcore/host-config",
            "/_stcore/upload_file/abc123/file456",
        ],
        ids=[
            "health",
            "script-health-check",
            "metrics",
            "host-config",
            "upload-file",
        ],
    )
    def test_safe_prefixes_pass_through(self, safe_path: str) -> None:
        """Test that known-safe route prefixes pass through without full validation.

        Smoke test: verifies fast-path doesn't accidentally block these routes.
        """
        app = _create_test_app()
        client = TestClient(app)

        response = client.get(safe_path)

        # These routes should reach the handler (200), not be blocked (400)
        assert response.status_code == 200

    @pytest.mark.parametrize(
        "safe_path",
        [
            "/_stcore/health",
            "/_stcore/script-health-check",
            "/_stcore/metrics",
            "/_stcore/host-config",
            "/_stcore/upload_file/abc123/file456",
        ],
        ids=[
            "health",
            "script-health-check",
            "metrics",
            "host-config",
            "upload-file",
        ],
    )
    def test_safe_paths_skip_unsafe_pattern_check(
        self, safe_path: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that safe paths skip the is_unsafe_path_pattern() check.

        This verifies the fast-path optimization is actually working by
        monkeypatching is_unsafe_path_pattern to raise if called.
        """
        from streamlit.web.server.starlette import starlette_path_security_middleware

        def _raise_if_called(path: str) -> bool:
            raise AssertionError(
                f"is_unsafe_path_pattern() was called for {safe_path!r} "
                "but should have been skipped by the fast-path"
            )

        monkeypatch.setattr(
            starlette_path_security_middleware,
            "is_unsafe_path_pattern",
            _raise_if_called,
        )

        app = _create_test_app()
        client = TestClient(app)

        # Should not raise - fast-path should skip is_unsafe_path_pattern
        response = client.get(safe_path)
        assert response.status_code == 200

    @pytest.mark.parametrize(
        "safe_path",
        [
            "//_stcore/health",
            "//_stcore/script-health-check",
            "//_stcore/metrics",
            "//_stcore/host-config",
            "//_stcore/upload_file/abc123/file456",
        ],
        ids=[
            "health",
            "script-health-check",
            "metrics",
            "host-config",
            "upload-file",
        ],
    )
    @pytest.mark.anyio
    async def test_safe_paths_still_check_double_slash(self, safe_path: str) -> None:
        """Test that safe prefixes still get the double-slash UNC check.

        Even though /_stcore/health is a safe prefix, a request to
        //_stcore/health (note the double slash) should still be blocked.
        This parametrizes over all safe paths to ensure regression protection.
        """
        app = _create_test_app()

        response_status, _ = await _call_asgi_with_path(app, safe_path)

        # Double-slash must still be blocked even with safe prefix
        assert response_status == 400

    @pytest.mark.parametrize(
        "traversal_path",
        [
            "/_stcore/health/..\\..\\etc\\passwd",
            "/_stcore/metrics/..\\..\\etc\\passwd",
            "/_stcore/host-config/..\\..\\etc\\passwd",
        ],
        ids=[
            "health-backslash-traversal",
            "metrics-backslash-traversal",
            "host-config-backslash-traversal",
        ],
    )
    def test_exact_paths_dont_match_traversal_suffixes(
        self, traversal_path: str
    ) -> None:
        """Test that exact-match safe paths don't match paths with traversal suffixes.

        This documents the defense-in-depth behavior: paths like
        /_stcore/health/..\\..\\etc\\passwd should NOT match the safe exact path
        /_stcore/health and should go through full validation.

        Note: Forward-slash traversal (/../..) is normalized by Starlette before
        reaching the middleware (see TestPathSecurityMiddleware.test_starlette_normalizes_paths),
        so we only test backslash traversal here.
        """
        app = _create_test_app()
        client = TestClient(app)

        response = client.get(traversal_path)

        # These should be blocked - they don't match exact paths and contain
        # traversal patterns that fail is_unsafe_path_pattern()
        assert response.status_code == 400

    @pytest.mark.parametrize(
        "unsafe_route",
        [
            "/media/..\\..\\etc\\passwd",
            "/component/..\\..\\etc\\passwd",
            "/_stcore/bidi-components/..\\..\\etc\\passwd",
            "/app/static/..\\..\\etc\\passwd",
        ],
        ids=[
            "media-traversal",
            "component-traversal",
            "bidi-component-traversal",
            "app-static-traversal",
        ],
    )
    def test_non_safe_routes_still_validated(self, unsafe_route: str) -> None:
        """Test that routes NOT in the safe prefix list are still validated."""
        app = _create_test_app()
        client = TestClient(app)

        response = client.get(unsafe_route)

        # These routes should be blocked by the middleware
        assert response.status_code == 400


class TestBaseUrlPathCompatibility:
    """Tests for baseUrlPath compatibility with the safe path fast-path.

    When server.baseUrlPath is configured (e.g., "/myapp"), routes are mounted
    with that prefix, and scope["path"] includes it (e.g., "/myapp/_stcore/health").
    The fast-path optimization must account for this prefix.
    """

    @pytest.mark.parametrize(
        "safe_route",
        [
            "/_stcore/health",
            "/_stcore/script-health-check",
            "/_stcore/metrics",
            "/_stcore/host-config",
            "/_stcore/upload_file/abc123/file456",
        ],
        ids=[
            "health",
            "script-health-check",
            "metrics",
            "host-config",
            "upload-file",
        ],
    )
    def test_safe_paths_with_base_url_prefix(
        self, safe_route: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that safe paths work correctly when server.baseUrlPath is configured.

        The fast-path should work for paths like /myapp/_stcore/health when
        baseUrlPath is set to /myapp.
        """
        from streamlit import config

        base_url = "/myapp"
        monkeypatch.setattr(
            config,
            "get_option",
            lambda key: base_url if key == "server.baseUrlPath" else None,
        )

        # Build the expected full path with base URL
        full_path = f"{base_url}{safe_route}"

        app = _create_test_app()
        client = TestClient(app)

        response = client.get(full_path)

        # These routes should reach the handler (200), not be blocked (400)
        assert response.status_code == 200

    @pytest.mark.parametrize(
        "safe_route",
        [
            "/_stcore/health",
            "/_stcore/script-health-check",
            "/_stcore/metrics",
            "/_stcore/host-config",
            "/_stcore/upload_file/abc123/file456",
        ],
        ids=[
            "health",
            "script-health-check",
            "metrics",
            "host-config",
            "upload-file",
        ],
    )
    def test_safe_paths_with_base_url_skip_unsafe_pattern_check(
        self, safe_route: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that safe paths with baseUrlPath skip the is_unsafe_path_pattern() check.

        This verifies the fast-path optimization works with baseUrlPath by
        monkeypatching is_unsafe_path_pattern to raise if called.
        """
        from streamlit import config
        from streamlit.web.server.starlette import starlette_path_security_middleware

        base_url = "/myapp"
        monkeypatch.setattr(
            config,
            "get_option",
            lambda key: base_url if key == "server.baseUrlPath" else None,
        )

        full_path = f"{base_url}{safe_route}"

        def _raise_if_called(path: str) -> bool:
            raise AssertionError(
                f"is_unsafe_path_pattern() was called for {full_path!r} "
                "but should have been skipped by the fast-path"
            )

        monkeypatch.setattr(
            starlette_path_security_middleware,
            "is_unsafe_path_pattern",
            _raise_if_called,
        )

        app = _create_test_app()
        client = TestClient(app)

        # Should not raise - fast-path should skip is_unsafe_path_pattern
        response = client.get(full_path)
        assert response.status_code == 200
