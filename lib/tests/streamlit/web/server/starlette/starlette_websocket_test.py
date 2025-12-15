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

"""Unit tests for starlette_websocket module."""

from __future__ import annotations

import json
from unittest.mock import MagicMock

from streamlit.web.server.starlette import starlette_app_utils
from streamlit.web.server.starlette.starlette_websocket import (
    _gather_user_info,
    _parse_subprotocols,
    _parse_user_cookie_signed,
    _validate_xsrf_token,
)
from tests.testutil import patch_config_options


class TestParseSubprotocols:
    """Tests for _parse_subprotocols function."""

    def test_returns_none_when_header_missing(self) -> None:
        """Test that None values are returned when header is missing."""
        headers = MagicMock()
        headers.get.return_value = None

        selected, xsrf, session = _parse_subprotocols(headers)

        assert selected is None
        assert xsrf is None
        assert session is None

    def test_returns_none_when_header_empty(self) -> None:
        """Test that None values are returned when header is empty."""
        headers = MagicMock()
        headers.get.return_value = ""

        selected, xsrf, session = _parse_subprotocols(headers)

        assert selected is None
        assert xsrf is None
        assert session is None

    def test_parses_single_subprotocol(self) -> None:
        """Test parsing a single subprotocol value."""
        headers = MagicMock()
        headers.get.return_value = "streamlit"

        selected, xsrf, session = _parse_subprotocols(headers)

        assert selected == "streamlit"
        assert xsrf is None
        assert session is None

    def test_parses_two_subprotocols(self) -> None:
        """Test parsing two subprotocol values (with XSRF token)."""
        headers = MagicMock()
        headers.get.return_value = "streamlit, xsrf-token-value"

        selected, xsrf, session = _parse_subprotocols(headers)

        assert selected == "streamlit"
        assert xsrf == "xsrf-token-value"
        assert session is None

    def test_parses_three_subprotocols(self) -> None:
        """Test parsing three subprotocol values (with session ID)."""
        headers = MagicMock()
        headers.get.return_value = "streamlit, xsrf-token, session-123"

        selected, xsrf, session = _parse_subprotocols(headers)

        assert selected == "streamlit"
        assert xsrf == "xsrf-token"
        assert session == "session-123"

    def test_strips_whitespace(self) -> None:
        """Test that whitespace is stripped from values."""
        headers = MagicMock()
        headers.get.return_value = "  streamlit  ,  xsrf  ,  session  "

        selected, xsrf, session = _parse_subprotocols(headers)

        assert selected == "streamlit"
        assert xsrf == "xsrf"
        assert session == "session"

    def test_ignores_empty_entries(self) -> None:
        """Test that empty entries are filtered out."""
        headers = MagicMock()
        headers.get.return_value = "streamlit, , , session"

        selected, xsrf, session = _parse_subprotocols(headers)

        assert selected == "streamlit"
        assert xsrf == "session"  # Second non-empty entry
        assert session is None  # Only 2 non-empty entries


class TestGatherUserInfo:
    """Tests for _gather_user_info function."""

    @patch_config_options({"server.trustedUserHeaders": {}})
    def test_returns_empty_dict_when_no_mapping(self) -> None:
        """Test that empty dict is returned when no header mapping configured."""
        headers = MagicMock()

        result = _gather_user_info(headers)

        assert result == {}

    @patch_config_options({"server.trustedUserHeaders": None})
    def test_returns_empty_dict_when_mapping_not_dict(self) -> None:
        """Test that empty dict is returned when mapping is not a dict."""
        headers = MagicMock()

        result = _gather_user_info(headers)

        assert result == {}

    @patch_config_options({"server.trustedUserHeaders": {"X-User-Email": "email"}})
    def test_extracts_header_value(self) -> None:
        """Test that header values are extracted correctly."""
        headers = MagicMock()
        headers.getlist.return_value = ["user@example.com"]

        result = _gather_user_info(headers)

        assert result == {"email": "user@example.com"}
        headers.getlist.assert_called_with("X-User-Email")

    @patch_config_options({"server.trustedUserHeaders": {"X-User-Email": "email"}})
    def test_returns_none_for_missing_header(self) -> None:
        """Test that None is returned for missing headers."""
        headers = MagicMock()
        headers.getlist.return_value = []

        result = _gather_user_info(headers)

        assert result == {"email": None}

    @patch_config_options(
        {
            "server.trustedUserHeaders": {
                "X-User-Email": "email",
                "X-User-Name": "name",
            }
        }
    )
    def test_extracts_multiple_headers(self) -> None:
        """Test that multiple headers are extracted."""
        headers = MagicMock()
        headers.getlist.side_effect = lambda h: {
            "X-User-Email": ["user@example.com"],
            "X-User-Name": ["John Doe"],
        }.get(h, [])

        result = _gather_user_info(headers)

        assert result == {"email": "user@example.com", "name": "John Doe"}

    @patch_config_options({"server.trustedUserHeaders": {"X-User-Email": "email"}})
    def test_uses_first_value_when_multiple(self) -> None:
        """Test that first value is used when header has multiple values."""
        headers = MagicMock()
        headers.getlist.return_value = ["first@example.com", "second@example.com"]

        result = _gather_user_info(headers)

        assert result == {"email": "first@example.com"}


class TestValidateXsrfToken:
    """Tests for _validate_xsrf_token function."""

    def test_returns_false_when_supplied_token_none(self) -> None:
        """Test that False is returned when supplied token is None."""
        xsrf_cookie = starlette_app_utils.generate_xsrf_token_string()

        result = _validate_xsrf_token(None, xsrf_cookie)

        assert result is False

    def test_returns_false_when_cookie_none(self) -> None:
        """Test that False is returned when cookie is None."""
        xsrf_token = starlette_app_utils.generate_xsrf_token_string()

        result = _validate_xsrf_token(xsrf_token, None)

        assert result is False

    def test_returns_false_when_both_none(self) -> None:
        """Test that False is returned when both are None."""
        result = _validate_xsrf_token(None, None)

        assert result is False

    def test_returns_true_for_matching_tokens(self) -> None:
        """Test that True is returned when tokens match."""
        # Generate the same token for both (same underlying bytes)
        xsrf_token = starlette_app_utils.generate_xsrf_token_string()

        result = _validate_xsrf_token(xsrf_token, xsrf_token)

        assert result is True

    def test_returns_false_for_different_tokens(self) -> None:
        """Test that False is returned when tokens differ."""
        token1 = starlette_app_utils.generate_xsrf_token_string()
        token2 = starlette_app_utils.generate_xsrf_token_string()

        result = _validate_xsrf_token(token1, token2)

        assert result is False

    def test_returns_false_for_invalid_token_format(self) -> None:
        """Test that False is returned for invalid token format."""
        valid_token = starlette_app_utils.generate_xsrf_token_string()

        result = _validate_xsrf_token("invalid-token", valid_token)

        assert result is False


class TestParseUserCookieSigned:
    """Tests for _parse_user_cookie_signed function."""

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_returns_empty_dict_for_invalid_signature(self) -> None:
        """Test that empty dict is returned for invalid signature."""
        result = _parse_user_cookie_signed("invalid-cookie", "http://localhost")

        assert result == {}

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_returns_empty_dict_for_invalid_origin(self) -> None:
        """Test that empty dict is returned for invalid origin format."""

        cookie_payload = json.dumps(
            {
                "origin": "http://localhost",
                "is_logged_in": True,
                "email": "test@test.com",
            }
        )
        signed_cookie = starlette_app_utils.create_signed_value(
            "test-secret", "_streamlit_user", cookie_payload
        )

        # Invalid origin (missing scheme)
        result = _parse_user_cookie_signed(signed_cookie, "localhost")

        assert result == {}

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_returns_empty_dict_for_origin_mismatch(self) -> None:
        """Test that empty dict is returned when origins don't match."""

        cookie_payload = json.dumps(
            {
                "origin": "http://localhost",
                "is_logged_in": True,
                "email": "test@test.com",
            }
        )
        signed_cookie = starlette_app_utils.create_signed_value(
            "test-secret", "_streamlit_user", cookie_payload
        )

        # Different origin
        result = _parse_user_cookie_signed(signed_cookie, "http://example.com")

        assert result == {}

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_parses_valid_cookie(self) -> None:
        """Test that valid cookie is parsed correctly."""

        cookie_payload = json.dumps(
            {
                "origin": "http://localhost",
                "is_logged_in": True,
                "email": "test@test.com",
            }
        )
        signed_cookie = starlette_app_utils.create_signed_value(
            "test-secret", "_streamlit_user", cookie_payload
        )

        result = _parse_user_cookie_signed(signed_cookie, "http://localhost")

        assert result["is_logged_in"] is True
        assert result["email"] == "test@test.com"
        assert "origin" not in result  # Origin is removed

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_handles_bytes_cookie(self) -> None:
        """Test that bytes cookie is handled correctly."""

        cookie_payload = json.dumps(
            {"origin": "http://localhost", "is_logged_in": True}
        )
        signed_cookie = starlette_app_utils.create_signed_value(
            "test-secret", "_streamlit_user", cookie_payload
        )

        # Pass as bytes
        result = _parse_user_cookie_signed(signed_cookie, "http://localhost")

        assert result["is_logged_in"] is True

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_handles_string_cookie(self) -> None:
        """Test that string cookie is handled correctly."""

        cookie_payload = json.dumps(
            {"origin": "http://localhost", "is_logged_in": True}
        )
        signed_cookie = starlette_app_utils.create_signed_value(
            "test-secret", "_streamlit_user", cookie_payload
        )

        # Pass as string
        result = _parse_user_cookie_signed(
            signed_cookie.decode("utf-8"), "http://localhost"
        )

        assert result["is_logged_in"] is True
