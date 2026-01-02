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

"""Unit tests for starlette_routes module."""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch

from starlette.responses import Response

from streamlit.web.server.starlette.starlette_routes import (
    _ensure_xsrf_cookie,
    _set_cors_headers,
    _set_unquoted_cookie,
    _with_base,
)
from streamlit.web.server.starlette.starlette_server_config import XSRF_COOKIE_NAME
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

    @patch_config_options(
        {
            "server.enableCORS": True,
            "global.developmentMode": False,
            "server.corsAllowedOrigins": ["http://allowed.example.com"],
        }
    )
    def test_allows_configured_origin(self) -> None:
        """Test that configured allowed origins are permitted."""
        request = MagicMock()
        request.headers = MagicMock()
        request.headers.get.return_value = "http://allowed.example.com"
        response = MagicMock()
        response.headers = {}

        asyncio.run(_set_cors_headers(request, response))

        assert (
            response.headers["Access-Control-Allow-Origin"]
            == "http://allowed.example.com"
        )


class TestEnsureXsrfCookie:
    """Tests for _ensure_xsrf_cookie function."""

    @patch_config_options({"server.enableXsrfProtection": False})
    def test_no_cookie_when_xsrf_disabled(self) -> None:
        """Test that no cookie is set when XSRF protection is disabled."""
        request = MagicMock()
        request.cookies = {}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        cookie_headers = [
            value
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 0

    @patch_config_options(
        {"server.enableXsrfProtection": True, "server.sslCertFile": None}
    )
    def test_generates_new_token_when_no_cookie(self) -> None:
        """Test that a new XSRF token is generated when no cookie exists."""
        request = MagicMock()
        request.cookies = {}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert cookie_headers[0].startswith(f"{XSRF_COOKIE_NAME}=2|")
        assert "Secure" not in cookie_headers[0]

    @patch_config_options(
        {"server.enableXsrfProtection": True, "server.sslCertFile": "/path/to/cert"}
    )
    def test_sets_secure_flag_with_ssl(self) -> None:
        """Test that Secure flag is added when SSL is configured."""
        request = MagicMock()
        request.cookies = {}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "Secure" in cookie_headers[0]

    @patch_config_options(
        {"server.enableXsrfProtection": True, "server.sslCertFile": None}
    )
    @patch(
        "streamlit.web.server.starlette.starlette_routes.starlette_app_utils.decode_xsrf_token_string"
    )
    @patch(
        "streamlit.web.server.starlette.starlette_routes.starlette_app_utils.generate_xsrf_token_string"
    )
    def test_preserves_existing_token(
        self, mock_generate: MagicMock, mock_decode: MagicMock
    ) -> None:
        """Test that existing token bytes and timestamp are preserved."""
        existing_token = b"existing_token_bytes"
        existing_timestamp = 1234567890
        mock_decode.return_value = (existing_token, existing_timestamp)
        mock_generate.return_value = "2|mocked|token|1234567890"

        request = MagicMock()
        request.cookies = {XSRF_COOKIE_NAME: "existing_cookie_value"}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        mock_decode.assert_called_once_with("existing_cookie_value")
        mock_generate.assert_called_once_with(existing_token, existing_timestamp)


class TestSetUnquotedCookie:
    """Tests for _set_unquoted_cookie function."""

    def test_sets_cookie_without_quoting(self) -> None:
        """Test that cookie value is set without URL encoding or quoting."""

        response = Response()
        cookie_value = "2|abcd1234|efgh5678|1234567890"

        _set_unquoted_cookie(response, "test_cookie", cookie_value, secure=False)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert cookie_headers[0].startswith(f"test_cookie={cookie_value};")
        assert "Path=/" in cookie_headers[0]
        assert "SameSite=Lax" in cookie_headers[0]
        assert "Secure" not in cookie_headers[0]

    def test_sets_secure_flag_when_requested(self) -> None:
        """Test that Secure flag is added when secure=True."""

        response = Response()

        _set_unquoted_cookie(response, "test_cookie", "value", secure=True)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "Secure" in cookie_headers[0]

    def test_replaces_existing_cookie_with_same_name(self) -> None:
        """Test that setting a cookie replaces any existing cookie with the same name."""

        response = Response()
        response.set_cookie("test_cookie", "old_value")

        _set_unquoted_cookie(response, "test_cookie", "new_value", secure=False)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "new_value" in cookie_headers[0]
        assert "old_value" not in cookie_headers[0]
