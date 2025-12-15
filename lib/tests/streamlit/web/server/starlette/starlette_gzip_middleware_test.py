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

import pytest
from starlette.applications import Starlette
from starlette.responses import Response
from starlette.routing import Route
from starlette.testclient import TestClient

from streamlit.web.server.starlette.starlette_gzip_middleware import (
    _EXCLUDED_CONTENT_TYPES,
    MediaAwareGZipMiddleware,
)


def _create_test_app(content_type: str, body: bytes = b"x" * 1000) -> Starlette:
    """Create a test Starlette app that returns a response with the given content type."""

    async def endpoint(request):
        return Response(content=body, media_type=content_type)

    app = Starlette(routes=[Route("/", endpoint)])
    app.add_middleware(MediaAwareGZipMiddleware, minimum_size=100)
    return app


class TestMediaAwareGZipMiddleware:
    """Tests for MediaAwareGZipMiddleware."""

    def test_compresses_text_content(self) -> None:
        """Test that text content is compressed when client supports gzip."""
        app = _create_test_app("text/plain")
        client = TestClient(app)

        response = client.get("/", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"

    def test_compresses_json_content(self) -> None:
        """Test that JSON content is compressed when client supports gzip."""
        app = _create_test_app("application/json")
        client = TestClient(app)

        response = client.get("/", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"

    def test_does_not_compress_audio_content(self) -> None:
        """Test that audio content is not compressed."""
        app = _create_test_app("audio/mpeg")
        client = TestClient(app)

        response = client.get("/", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_does_not_compress_video_content(self) -> None:
        """Test that video content is not compressed."""
        app = _create_test_app("video/mp4")
        client = TestClient(app)

        response = client.get("/", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    @pytest.mark.parametrize(
        "content_type",
        [
            "audio/mpeg",
            "audio/wav",
            "audio/ogg",
            "audio/webm",
            "video/mp4",
            "video/webm",
            "video/ogg",
        ],
        ids=[
            "audio/mpeg",
            "audio/wav",
            "audio/ogg",
            "audio/webm",
            "video/mp4",
            "video/webm",
            "video/ogg",
        ],
    )
    def test_excludes_various_media_types(self, content_type: str) -> None:
        """Test that various audio/video types are excluded from compression."""
        app = _create_test_app(content_type)
        client = TestClient(app)

        response = client.get("/", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_does_not_compress_when_client_does_not_support_gzip(self) -> None:
        """Test that content is not compressed when client doesn't support gzip."""
        app = _create_test_app("text/plain")
        client = TestClient(app)

        # Explicitly set Accept-Encoding to something other than gzip
        response = client.get("/", headers={"Accept-Encoding": "identity"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    def test_does_not_compress_small_content(self) -> None:
        """Test that small content is not compressed (below minimum_size)."""
        app = _create_test_app("text/plain", body=b"small")
        client = TestClient(app)

        response = client.get("/", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        # Small content should not be compressed
        assert response.headers.get("content-encoding") is None


class TestExcludedContentTypes:
    """Tests for the _EXCLUDED_CONTENT_TYPES constant."""

    def test_includes_audio_prefix(self) -> None:
        """Test that audio/ prefix is in the excluded types."""
        assert "audio/" in _EXCLUDED_CONTENT_TYPES

    def test_includes_video_prefix(self) -> None:
        """Test that video/ prefix is in the excluded types."""
        assert "video/" in _EXCLUDED_CONTENT_TYPES

    def test_includes_starlette_defaults(self) -> None:
        """Test that Starlette default exclusions are preserved."""
        # text/event-stream is excluded by Starlette by default (for SSE)
        assert "text/event-stream" in _EXCLUDED_CONTENT_TYPES

    def test_extends_starlette_defaults(self) -> None:
        """Test that our exclusion list extends (not replaces) Starlette defaults."""
        from starlette.middleware.gzip import DEFAULT_EXCLUDED_CONTENT_TYPES

        # All Starlette defaults should be included
        for content_type in DEFAULT_EXCLUDED_CONTENT_TYPES:
            assert content_type in _EXCLUDED_CONTENT_TYPES
