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

"""Unit tests for starlette_routes module."""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

from streamlit.web.server.starlette.starlette_routes import (
    _set_cors_headers,
    _with_base,
)
from tests.testutil import patch_config_options


class TestWithBase:
    """Tests for _with_base function."""

    @patch_config_options({"server.baseUrlPath": ""})
    def test_no_base_url(self) -> None:
        """Test path with no base URL configured."""
        result = _with_base("_stcore/health")

        assert result == "/_stcore/health"

    @patch_config_options({"server.baseUrlPath": ""})
    def test_no_base_url_with_leading_slash(self) -> None:
        """Test path with leading slash and no base URL."""
        result = _with_base("/_stcore/health")

        assert result == "/_stcore/health"

    @patch_config_options({"server.baseUrlPath": "myapp"})
    def test_with_base_url(self) -> None:
        """Test path with base URL configured."""
        result = _with_base("_stcore/health")

        assert result == "/myapp/_stcore/health"

    @patch_config_options({"server.baseUrlPath": "/myapp/"})
    def test_strips_slashes_from_base(self) -> None:
        """Test that slashes are stripped from base URL."""
        result = _with_base("_stcore/health")

        assert result == "/myapp/_stcore/health"

    @patch_config_options({"server.baseUrlPath": "shouldbeignored"})
    def test_explicit_base_url_overrides_config(self) -> None:
        """Test that explicit base_url parameter overrides config."""
        result = _with_base("_stcore/health", base_url="custom")

        assert result == "/custom/_stcore/health"

    @patch_config_options({"server.baseUrlPath": "shouldbeignored"})
    def test_explicit_empty_base_url(self) -> None:
        """Test that explicit empty base_url works."""
        result = _with_base("_stcore/health", base_url="")

        assert result == "/_stcore/health"

    @patch_config_options({"server.baseUrlPath": "fromconfig"})
    def test_explicit_none_base_url_uses_config(self) -> None:
        """Test that explicit None uses config."""
        result = _with_base("_stcore/health", base_url=None)

        assert result == "/fromconfig/_stcore/health"


class TestSetCorsHeaders:
    """Tests for _set_cors_headers function."""

    @patch_config_options({"server.enableCORS": False})
    def test_allows_all_when_cors_disabled(self) -> None:
        """Test that all origins are allowed when CORS is disabled."""

        request = MagicMock()
        response = MagicMock()
        response.headers = {}

        asyncio.run(_set_cors_headers(request, response))

        assert response.headers["Access-Control-Allow-Origin"] == "*"

    @patch_config_options({"global.developmentMode": True, "server.enableCORS": True})
    def test_allows_all_in_dev_mode(self) -> None:
        """Test that all origins are allowed in development mode."""
        request = MagicMock()
        response = MagicMock()
        response.headers = {}

        asyncio.run(_set_cors_headers(request, response))

        assert response.headers["Access-Control-Allow-Origin"] == "*"

    @patch_config_options(
        {
            "server.enableCORS": True,
            "global.developmentMode": False,
        }
    )
    def test_no_header_when_origin_not_allowed(self) -> None:
        """Test that no header is set when origin is not in allowed list."""
        request = MagicMock()
        request.headers = MagicMock()
        # This origin won't be in any allowed list by default
        request.headers.get.return_value = "http://random-untrusted-origin.com"
        response = MagicMock()
        response.headers = {}

        asyncio.run(_set_cors_headers(request, response))

        assert "Access-Control-Allow-Origin" not in response.headers

    @patch_config_options(
        {
            "server.enableCORS": True,
            "global.developmentMode": False,
        }
    )
    def test_no_header_when_no_origin(self) -> None:
        """Test that no header is set when request has no Origin header."""
        request = MagicMock()
        request.headers = MagicMock()
        request.headers.get.return_value = None
        response = MagicMock()
        response.headers = {}

        asyncio.run(_set_cors_headers(request, response))

        assert "Access-Control-Allow-Origin" not in response.headers
