# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
from starlette.testclient import TestClient

from streamlit.web.server.routes import STATIC_ASSET_CACHE_MAX_AGE_SECONDS
from streamlit.web.server.starlette.starlette_static import (
    _RESERVED_STATIC_PATH_SUFFIXES,
    create_streamlit_static_files,
)

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path


@pytest.fixture
def static_app(tmp_path: Path) -> Iterator[TestClient]:
    """Create a test client with static files mounted."""
    from starlette.applications import Starlette
    from starlette.routing import Mount

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

    static_files = create_streamlit_static_files(
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


class TestWithBaseUrl:
    """Tests for static files with base URL."""

    def test_serves_files_with_base_url(self, tmp_path: Path) -> None:
        """Test that files are served correctly with a base URL."""
        from starlette.applications import Starlette
        from starlette.routing import Mount

        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>Base</html>")

        static_files = create_streamlit_static_files(
            directory=str(static_dir), base_url="myapp"
        )
        app = Starlette(routes=[Mount("/myapp", app=static_files)])

        with TestClient(app) as client:
            response = client.get("/myapp/index.html")

            assert response.status_code == 200
            assert response.text == "<html>Base</html>"
