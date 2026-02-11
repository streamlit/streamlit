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

"""Unit tests for starlette_static module."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.testclient import TestClient

from streamlit.web.server.routes import STATIC_ASSET_CACHE_MAX_AGE_SECONDS
from streamlit.web.server.starlette.starlette_static_routes import (
    _RESERVED_STATIC_PATH_SUFFIXES,
    create_streamlit_static_handler,
)

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path


@pytest.fixture
def static_app(tmp_path: Path) -> Iterator[TestClient]:
    """Create a test client with static files mounted."""

    # Create static directory with test files
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html>Home</html>")
    (static_dir / "app.abc123.js").write_text("console.log('app')")
    (static_dir / "manifest.json").write_text("{}")
    (static_dir / "style.css").write_text("body {}")

    # Create subdirectory
    subdir = static_dir / "subdir"
    subdir.mkdir()
    (subdir / "page.html").write_text("<html>Page</html>")

    static_files = create_streamlit_static_handler(
        directory=str(static_dir), base_url=None
    )
    app = Starlette(routes=[Mount("/", app=static_files)])

    with TestClient(app) as client:
        yield client


class TestStreamlitStaticFiles:
    """Tests for the Streamlit static files handler."""

    def test_serves_index_html(self, static_app: TestClient) -> None:
        """Test that index.html is served."""
        response = static_app.get("/index.html")

        assert response.status_code == 200
        assert response.text == "<html>Home</html>"

    def test_serves_root_as_index(self, static_app: TestClient) -> None:
        """Test that root path serves index.html."""
        response = static_app.get("/")

        assert response.status_code == 200
        assert response.text == "<html>Home</html>"

    def test_serves_js_files(self, static_app: TestClient) -> None:
        """Test that JS files are served."""
        response = static_app.get("/app.abc123.js")

        assert response.status_code == 200
        assert response.text == "console.log('app')"

    def test_serves_css_files(self, static_app: TestClient) -> None:
        """Test that CSS files are served."""
        response = static_app.get("/style.css")

        assert response.status_code == 200
        assert response.text == "body {}"

    def test_spa_fallback_returns_index(self, static_app: TestClient) -> None:
        """Test that unknown paths fall back to index.html (SPA routing)."""
        response = static_app.get("/unknown/path")

        assert response.status_code == 200
        assert response.text == "<html>Home</html>"

    def test_cache_control_for_index(self, static_app: TestClient) -> None:
        """Test that index.html has no-cache header."""
        response = static_app.get("/index.html")

        assert response.headers["Cache-Control"] == "no-cache"

    def test_cache_control_for_manifest(self, static_app: TestClient) -> None:
        """Test that manifest.json has no-cache header."""
        response = static_app.get("/manifest.json")

        assert response.headers["Cache-Control"] == "no-cache"

    def test_cache_control_for_hashed_assets(self, static_app: TestClient) -> None:
        """Test that hashed assets have long cache headers."""
        response = static_app.get("/app.abc123.js")

        expected = f"public, immutable, max-age={STATIC_ASSET_CACHE_MAX_AGE_SECONDS}"
        assert response.headers["Cache-Control"] == expected

    def test_cache_control_for_css(self, static_app: TestClient) -> None:
        """Test that CSS files have long cache headers."""
        response = static_app.get("/style.css")

        expected = f"public, immutable, max-age={STATIC_ASSET_CACHE_MAX_AGE_SECONDS}"
        assert response.headers["Cache-Control"] == expected

    def test_spa_fallback_has_no_cache(self, static_app: TestClient) -> None:
        """Test that SPA fallback response has no-cache header."""
        response = static_app.get("/some/spa/route")

        assert response.headers["Cache-Control"] == "no-cache"


class TestReservedPaths:
    """Tests for reserved path handling."""

    def test_reserved_paths_constant(self) -> None:
        """Test that reserved paths are defined correctly."""
        assert "_stcore/health" in _RESERVED_STATIC_PATH_SUFFIXES
        assert "_stcore/host-config" in _RESERVED_STATIC_PATH_SUFFIXES

    def test_reserved_path_returns_404(self, static_app: TestClient) -> None:
        """Test that reserved paths return 404 instead of SPA fallback."""
        response = static_app.get("/_stcore/health")

        assert response.status_code == 404

    def test_reserved_path_host_config_returns_404(
        self, static_app: TestClient
    ) -> None:
        """Test that reserved host-config path returns 404."""
        response = static_app.get("/_stcore/host-config")

        assert response.status_code == 404

    def test_user_path_ending_with_reserved_suffix_returns_404(
        self, static_app: TestClient
    ) -> None:
        """Test that paths ending with reserved suffixes return 404.

        This matches Tornado's behavior where endswith() is used for reserved
        path matching. Paths like /my_stcore/health return 404 because they
        end with '_stcore/health'.

        TODO: Consider making this path-segment-aware in the future to avoid
        false positives.
        """
        response = static_app.get("/my_stcore/health")

        # Matches Tornado: endswith check treats this as reserved
        assert response.status_code == 404

    def test_user_path_custom_stcore_returns_404(self, static_app: TestClient) -> None:
        """Test that /custom_stcore/host-config returns 404 (matches Tornado)."""
        response = static_app.get("/custom_stcore/host-config")

        # Matches Tornado: endswith check treats this as reserved
        assert response.status_code == 404

    def test_nested_reserved_path_returns_404(self, static_app: TestClient) -> None:
        """Test that nested reserved paths like /foo/_stcore/health return 404."""
        response = static_app.get("/foo/_stcore/health")

        assert response.status_code == 404


class TestWithBaseUrl:
    """Tests for static files with base URL."""

    def test_serves_files_with_base_url(self, tmp_path: Path) -> None:
        """Test that files are served correctly with a base URL."""

        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Base</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url="myapp"
        )
        app = Starlette(routes=[Mount("/myapp", app=static_files)])

        with TestClient(app) as client:
            response = client.get("/myapp/index.html")

            assert response.status_code == 200
            assert response.text == "<html>Base</html>"

    def test_no_redirect_loop_when_mounted(self, tmp_path: Path) -> None:
        """Test that mount root with trailing slash doesn't cause redirect loop.

        When mounted at a path (e.g., /app), requests to /app/ should serve
        index.html, not redirect to /app which would then redirect back to /app/.
        """

        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Mounted</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url=""
        )
        app = Starlette(routes=[Mount("/app", app=static_files)])

        with TestClient(app, follow_redirects=False) as client:
            # /app should redirect to /app/ (Starlette's Mount behavior)
            response = client.get("/app")
            assert response.status_code == 307
            assert response.headers["location"] == "http://testserver/app/"

            # /app/ should serve content, NOT redirect to /app
            response = client.get("/app/")
            assert response.status_code == 200
            assert response.text == "<html>Mounted</html>"

    def test_nested_mount_no_redirect_loop(self, tmp_path: Path) -> None:
        """Test that nested mounts (like FastAPI mounting Streamlit) work correctly."""

        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Nested</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url=""
        )
        # Inner app with static files at root (like Streamlit does)
        inner_app = Starlette(routes=[Mount("/", app=static_files)])
        # Outer app mounting inner at /app (like FastAPI does)
        outer_app = Starlette(routes=[Mount("/app", app=inner_app)])

        with TestClient(outer_app, follow_redirects=False) as client:
            # /app/ should serve content without redirect loop
            response = client.get("/app/")
            assert response.status_code == 200
            assert response.text == "<html>Nested</html>"

        # Also verify it works with follow_redirects
        with TestClient(outer_app, follow_redirects=True) as client:
            response = client.get("/app")
            assert response.status_code == 200
            assert response.text == "<html>Nested</html>"


class TestDoubleSlashProtection:
    """Tests for double-slash (protocol-relative URL) security protection.

    Note: We need to test these with raw ASGI scope because HTTP clients
    interpret //evil.com as a protocol-relative URL, not a path.
    """

    @pytest.mark.anyio
    async def test_double_slash_returns_400(self, tmp_path: Path) -> None:
        """Test that paths starting with // return 400 Bad Request.

        Double-slash paths like //example.com could be misinterpreted as
        protocol-relative URLs if redirected, which is a security risk.
        """
        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Home</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url=None
        )

        # Create raw ASGI scope with // path
        scope = {
            "type": "http",
            "method": "GET",
            "path": "//evil.com",
            "query_string": b"",
            "root_path": "",
            "headers": [],
        }

        response_started = False
        response_status = 0
        response_body = b""

        async def receive() -> dict[str, object]:
            return {"type": "http.request", "body": b""}

        async def send(message: dict[str, object]) -> None:
            nonlocal response_started, response_status, response_body
            if message["type"] == "http.response.start":
                response_started = True
                response_status = message["status"]
            elif message["type"] == "http.response.body":
                response_body += message.get("body", b"")

        await static_files(scope, receive, send)

        assert response_status == 400
        assert response_body == b"Bad Request"

    @pytest.mark.anyio
    async def test_double_slash_with_path_returns_400(self, tmp_path: Path) -> None:
        """Test that paths like //evil.com/path return 400."""
        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Home</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url=None
        )

        scope = {
            "type": "http",
            "method": "GET",
            "path": "//evil.com/some/path",
            "query_string": b"",
            "root_path": "",
            "headers": [],
        }

        response_status = 0
        response_body = b""

        async def receive() -> dict[str, object]:
            return {"type": "http.request", "body": b""}

        async def send(message: dict[str, object]) -> None:
            nonlocal response_status, response_body
            if message["type"] == "http.response.start":
                response_status = message["status"]
            elif message["type"] == "http.response.body":
                response_body += message.get("body", b"")

        await static_files(scope, receive, send)

        assert response_status == 400
        assert response_body == b"Bad Request"

    @pytest.mark.anyio
    async def test_double_slash_at_root_returns_400(self, tmp_path: Path) -> None:
        """Test that just // returns 400."""
        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Home</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url=None
        )

        scope = {
            "type": "http",
            "method": "GET",
            "path": "//",
            "query_string": b"",
            "root_path": "",
            "headers": [],
        }

        response_status = 0
        response_body = b""

        async def receive() -> dict[str, object]:
            return {"type": "http.request", "body": b""}

        async def send(message: dict[str, object]) -> None:
            nonlocal response_status, response_body
            if message["type"] == "http.response.start":
                response_status = message["status"]
            elif message["type"] == "http.response.body":
                response_body += message.get("body", b"")

        await static_files(scope, receive, send)

        assert response_status == 400
        assert response_body == b"Bad Request"

    def test_single_slash_path_works(self, static_app: TestClient) -> None:
        """Test that normal single-slash paths still work correctly."""
        response = static_app.get("/index.html")

        assert response.status_code == 200
        assert response.text == "<html>Home</html>"

    def test_path_with_double_slash_in_middle_works(
        self, static_app: TestClient
    ) -> None:
        """Test that double slash not at start doesn't trigger protection.

        Only paths starting with // are blocked. Paths like /foo//bar
        are handled normally by the SPA fallback.
        """
        response = static_app.get("/foo//bar")

        # This falls through to SPA fallback, not blocked
        assert response.status_code == 200
        assert response.text == "<html>Home</html>"


class TestTrailingSlashRedirect:
    """Tests for trailing slash redirect behavior (301 redirects)."""

    def test_trailing_slash_redirects_to_without(self, tmp_path: Path) -> None:
        """Test that paths with trailing slash redirect to path without."""
        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Home</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url=None
        )
        app = Starlette(routes=[Mount("/", app=static_files)])

        with TestClient(app, follow_redirects=False) as client:
            response = client.get("/somepath/")

            assert response.status_code == 301
            assert response.headers["location"] == "/somepath"
            assert response.headers["Cache-Control"] == "no-cache"

    def test_nested_trailing_slash_redirects(self, tmp_path: Path) -> None:
        """Test that nested paths with trailing slash redirect correctly."""
        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Home</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url=None
        )
        app = Starlette(routes=[Mount("/", app=static_files)])

        with TestClient(app, follow_redirects=False) as client:
            response = client.get("/deep/nested/path/")

            assert response.status_code == 301
            assert response.headers["location"] == "/deep/nested/path"

    def test_trailing_slash_redirect_preserves_query_string(
        self, tmp_path: Path
    ) -> None:
        """Test that query string is preserved in trailing slash redirect."""
        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Home</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url=None
        )
        app = Starlette(routes=[Mount("/", app=static_files)])

        with TestClient(app, follow_redirects=False) as client:
            response = client.get("/somepath/?foo=bar&baz=qux")

            assert response.status_code == 301
            assert response.headers["location"] == "/somepath?foo=bar&baz=qux"

    def test_root_slash_does_not_redirect(self, tmp_path: Path) -> None:
        """Test that root path '/' does not redirect."""
        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Home</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url=None
        )
        app = Starlette(routes=[Mount("/", app=static_files)])

        with TestClient(app, follow_redirects=False) as client:
            response = client.get("/")

            # Should serve content, not redirect
            assert response.status_code == 200
            assert response.text == "<html>Home</html>"


class TestCacheHeadersOnRedirects:
    """Tests for cache headers behavior on redirect responses."""

    def test_redirect_responses_keep_their_cache_headers(self, tmp_path: Path) -> None:
        """Test that redirect responses don't get cache headers overwritten.

        The _apply_cache_headers method should skip adding cache headers
        to redirect responses (301, 302, etc.) to avoid overwriting
        the redirect-specific Cache-Control header.
        """
        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Home</html>")

        static_files = create_streamlit_static_handler(
            directory=str(static_dir), base_url=None
        )
        app = Starlette(routes=[Mount("/", app=static_files)])

        with TestClient(app, follow_redirects=False) as client:
            response = client.get("/somepath/")

            # Should have the redirect-specific no-cache header, not the
            # static asset caching header
            assert response.status_code == 301
            assert response.headers["Cache-Control"] == "no-cache"
            assert "immutable" not in response.headers["Cache-Control"]

    def test_regular_html_has_no_cache(self, static_app: TestClient) -> None:
        """Test that regular HTML files have no-cache header (not redirect)."""
        response = static_app.get("/index.html")

        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "no-cache"

    def test_hashed_js_has_long_cache(self, static_app: TestClient) -> None:
        """Test that hashed JS files have long cache headers (not redirect)."""
        response = static_app.get("/app.abc123.js")

        assert response.status_code == 200
        expected = f"public, immutable, max-age={STATIC_ASSET_CACHE_MAX_AGE_SECONDS}"
        assert response.headers["Cache-Control"] == expected
