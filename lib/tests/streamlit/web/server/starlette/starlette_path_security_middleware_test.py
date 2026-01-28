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

    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        await websocket.send_text("connected")
        await websocket.close()

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

    def test_allows_safe_paths(self) -> None:
        """Test that normal safe paths are allowed through."""
        app = _create_test_app()
        client = TestClient(app)

        response = client.get("/static/file.js")

        assert response.status_code == 200
        assert "Path: /static/file.js" in response.text

    def test_allows_root_path(self) -> None:
        """Test that the root path is allowed."""
        app = _create_test_app()
        client = TestClient(app)

        response = client.get("/")

        assert response.status_code == 200
        assert "Path: /" in response.text

    def test_allows_nested_directories(self) -> None:
        """Test that nested directory paths are allowed."""
        app = _create_test_app()
        client = TestClient(app)

        response = client.get("/subdir/nested/file.txt")

        assert response.status_code == 200
        assert "Path: /subdir/nested/file.txt" in response.text

    def test_blocks_backslash_path_traversal(self) -> None:
        """Test that backslash path traversal attempts are blocked with 400.

        Note: Starlette normalizes forward-slash path traversal (/../..) before
        it reaches middleware, so we can only catch backslash-based traversal.
        """
        app = _create_test_app()
        client = TestClient(app)

        response = client.get("/..\\..\\etc\\passwd")

        assert response.status_code == 400
        assert response.text == "Bad Request"

    def test_forward_slash_path_traversal_normalized_by_framework(self) -> None:
        """Test that forward-slash path traversal is normalized by Starlette.

        Starlette normalizes /../../../etc/passwd to /etc/passwd before it
        reaches the middleware, which is actually secure behavior - the path
        traversal is eliminated by the framework.
        """
        app = _create_test_app()
        client = TestClient(app)

        # This gets normalized to /etc/passwd by Starlette
        response = client.get("/../../../etc/passwd")

        # After normalization, this is a safe path
        assert response.status_code == 200
        assert "Path: /etc/passwd" in response.text

    def test_blocks_windows_drive_paths(self) -> None:
        """Test that Windows drive paths are blocked."""
        app = _create_test_app()
        client = TestClient(app)

        response = client.get("/C:/Windows/system32")

        assert response.status_code == 400
        assert response.text == "Bad Request"

    def test_blocks_unc_paths_backslash(self) -> None:
        """Test that UNC paths with backslashes are blocked."""
        app = _create_test_app()
        client = TestClient(app)

        # URL-encoded backslash: %5c = '\'
        response = client.get("/%5c%5cattacker.com%5cshare")

        assert response.status_code == 400
        assert response.text == "Bad Request"

    def test_multiple_forward_slashes_normalized_by_framework(self) -> None:
        """Test that multiple forward slashes are normalized by Starlette.

        Starlette normalizes ///attacker.com/share to /attacker.com/share,
        which prevents UNC path interpretation. This is secure framework behavior.
        """
        app = _create_test_app()
        client = TestClient(app)

        # This gets normalized to /attacker.com/share by Starlette
        response = client.get("///attacker.com/share")

        # After normalization, this is just a regular path segment
        assert response.status_code == 200
        assert "Path: /attacker.com/share" in response.text

    def test_blocks_null_bytes(self) -> None:
        """Test that paths with null bytes are blocked."""
        app = _create_test_app()
        client = TestClient(app)

        # %00 = null byte
        response = client.get("/file.txt%00.js")

        assert response.status_code == 400
        assert response.text == "Bad Request"

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
    def test_blocks_various_unsafe_paths(self, unsafe_path: str) -> None:
        """Test that various unsafe path patterns are blocked.

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
        ],
        ids=[
            "root",
            "simple-file",
            "static-dir",
            "component-path",
            "deeply-nested",
            "dots-in-filename",
            "dots-in-dirname",
        ],
    )
    def test_allows_various_safe_paths(self, safe_path: str) -> None:
        """Test that various safe path patterns are allowed."""
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

    def test_does_not_block_safe_paths_that_look_suspicious(self) -> None:
        """Test that paths with '..' in filenames (not traversal) are allowed."""
        app = _create_test_app()
        client = TestClient(app)

        # A file literally named "..something" (not traversal)
        response = client.get("/files/...hidden")

        assert response.status_code == 200
        assert "Path: /files/...hidden" in response.text


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
