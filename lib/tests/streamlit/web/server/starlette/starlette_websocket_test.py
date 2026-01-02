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

"""Unit tests for starlette_websocket module."""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from streamlit.web.server.starlette import starlette_app_utils
from streamlit.web.server.starlette.starlette_websocket import (
    StarletteSessionClient,
    _gather_user_info,
    _get_signed_cookie_with_chunks,
    _is_origin_allowed,
    _parse_decoded_user_cookie,
    _parse_subprotocols,
    _parse_user_cookie_signed,
    create_websocket_handler,
    create_websocket_routes,
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

    def test_empty_entries_preserve_positions(self) -> None:
        """Test that empty entries are treated as None, preserving positions."""
        headers = MagicMock()
        headers.get.return_value = "streamlit, , , session"

        selected, xsrf, session = _parse_subprotocols(headers)

        assert selected == "streamlit"
        assert xsrf is None  # Position 1 is empty, not shifted
        assert session is None  # Position 2 is empty, "session" is at position 3


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


class TestParseDecodedUserCookie:
    """Tests for _parse_decoded_user_cookie function."""

    def test_returns_empty_dict_for_invalid_json(self) -> None:
        """Test that empty dict is returned for invalid JSON."""
        result = _parse_decoded_user_cookie(b"not-valid-json", "http://localhost")

        assert result == {}

    def test_returns_empty_dict_for_invalid_utf8(self) -> None:
        """Test that empty dict is returned for invalid UTF-8."""
        result = _parse_decoded_user_cookie(b"\xff\xfe", "http://localhost")

        assert result == {}

    def test_returns_empty_dict_for_missing_scheme(self) -> None:
        """Test that empty dict is returned when origin has no scheme."""
        cookie_data = json.dumps({"origin": "http://localhost", "is_logged_in": True})

        result = _parse_decoded_user_cookie(cookie_data.encode(), "localhost")

        assert result == {}

    def test_returns_empty_dict_for_origin_mismatch(self) -> None:
        """Test that empty dict is returned when origins don't match."""
        cookie_data = json.dumps({"origin": "http://localhost", "is_logged_in": True})

        result = _parse_decoded_user_cookie(cookie_data.encode(), "http://other.com")

        assert result == {}

    def test_parses_valid_cookie(self) -> None:
        """Test that valid cookie data is parsed correctly."""
        cookie_data = json.dumps(
            {
                "origin": "http://localhost",
                "is_logged_in": True,
                "email": "user@test.com",
                "name": "Test User",
            }
        )

        result = _parse_decoded_user_cookie(cookie_data.encode(), "http://localhost")

        assert result["is_logged_in"] is True
        assert result["email"] == "user@test.com"
        assert result["name"] == "Test User"
        assert "origin" not in result

    def test_handles_port_in_origin(self) -> None:
        """Test that origin with port is handled correctly."""
        cookie_data = json.dumps(
            {"origin": "http://localhost:8501", "is_logged_in": True}
        )

        result = _parse_decoded_user_cookie(
            cookie_data.encode(), "http://localhost:8501/some/path"
        )

        assert result["is_logged_in"] is True


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


class TestIsOriginAllowed:
    """Tests for _is_origin_allowed function (Origin validation for WebSocket)."""

    @pytest.mark.parametrize(
        ("origin", "host", "expected"),
        [
            # None origin allowed (non-browser clients)
            (None, "localhost:8501", True),
            # Same-origin requests allowed
            ("http://localhost:8501", "localhost:8501", True),
            # Localhost origins allowed by default
            ("http://localhost:3000", "somehost:8501", True),
            # 127.0.0.1 origins allowed by default
            ("http://127.0.0.1:3000", "somehost:8501", True),
            # Disallowed cross-origin requests rejected
            ("http://evil.com", "localhost:8501", False),
            # Different host origins rejected when not in allowlist
            ("http://attacker.example.com", "myapp.com:8501", False),
        ],
        ids=[
            "none_origin",
            "same_origin",
            "localhost",
            "127.0.0.1",
            "disallowed_origin",
            "different_host",
        ],
    )
    @patch_config_options({"server.enableCORS": True})
    def test_origin_validation_with_cors_enabled(
        self, origin: str | None, host: str, expected: bool
    ) -> None:
        """Test origin validation when CORS is enabled."""
        assert _is_origin_allowed(origin, host) is expected

    @patch_config_options({"server.enableCORS": False})
    def test_allows_all_origins_when_cors_disabled(self) -> None:
        """Test that all origins are allowed when CORS is disabled."""
        assert _is_origin_allowed("http://evil.com", "localhost:8501") is True

    @pytest.mark.parametrize(
        ("origin", "expected"),
        [
            ("http://trusted.com", True),
            ("http://untrusted.com", False),
        ],
        ids=["allowed_origins", "not_in_allowlist"],
    )
    @patch_config_options(
        {"server.enableCORS": True, "server.corsAllowedOrigins": ["http://trusted.com"]}
    )
    def test_origin_validation_with_allowlist(
        self, origin: str, expected: bool
    ) -> None:
        """Test origin validation against explicit allowlist."""
        assert _is_origin_allowed(origin, "localhost:8501") is expected


class TestWebsocketHandlerUserInfoPrecedence:
    """Tests for user_info precedence in websocket handler."""

    @patch_config_options(
        {
            "server.enableXsrfProtection": True,
            "server.cookieSecret": "test-secret",
            "server.trustedUserHeaders": {"X-User-Email": "email"},
            "server.enableCORS": False,
        }
    )
    def test_headers_override_cookie_values(self) -> None:
        """Test that trusted headers override auth cookie values.

        When both an auth cookie and trusted headers provide the same user info
        key (e.g., 'email'), the header value should take precedence. This matches
        Tornado's behavior where headers override auth cookie values.
        """
        from starlette.websockets import WebSocketDisconnect

        # Create a valid signed cookie with email from auth provider
        cookie_payload = json.dumps(
            {
                "origin": "http://localhost",
                "is_logged_in": True,
                "email": "cookie@example.com",
            }
        )
        signed_cookie = starlette_app_utils.create_signed_value(
            "test-secret", "_streamlit_user", cookie_payload
        )
        xsrf_token = starlette_app_utils.generate_xsrf_token_string()

        # Mock websocket with both cookie and header providing different emails
        mock_websocket = MagicMock()
        mock_websocket.headers = MagicMock()
        mock_websocket.headers.get.side_effect = lambda key: {
            "Origin": "http://localhost",
            "Host": "localhost:8501",
            "sec-websocket-protocol": f"streamlit, {xsrf_token}",
        }.get(key)
        mock_websocket.headers.getlist.return_value = ["header@example.com"]
        mock_websocket.cookies = {
            "_streamlit_user": signed_cookie.decode("utf-8"),
            "_streamlit_xsrf": xsrf_token,
        }
        mock_websocket.accept = AsyncMock()
        mock_websocket.close = AsyncMock()
        # Simulate immediate disconnect after connect_session
        mock_websocket.receive_bytes = AsyncMock(side_effect=WebSocketDisconnect())

        # Mock runtime
        mock_runtime = MagicMock()
        mock_runtime.connect_session = MagicMock(return_value="test-session-id")
        mock_runtime.disconnect_session = MagicMock()

        # Create handler and patch the client class
        handler = create_websocket_handler(mock_runtime)
        with patch(
            "streamlit.web.server.starlette.starlette_websocket.StarletteSessionClient"
        ) as mock_client_class:
            mock_client = MagicMock()
            mock_client.aclose = AsyncMock()
            mock_client_class.return_value = mock_client

            # Also patch validate_xsrf_token to ensure cookie parsing succeeds
            with patch(
                "streamlit.web.server.starlette.starlette_app_utils.validate_xsrf_token",
                return_value=True,
            ):
                asyncio.run(handler(mock_websocket))

        # Verify connect_session was called
        mock_runtime.connect_session.assert_called_once()

        # Get the user_info that was passed to connect_session
        call_kwargs = mock_runtime.connect_session.call_args
        user_info = call_kwargs.kwargs.get("user_info") or call_kwargs[1].get(
            "user_info"
        )

        # Headers should override cookie values - this is the key assertion
        assert user_info["email"] == "header@example.com"
        # Cookie values that aren't overridden should still be present
        assert user_info["is_logged_in"] is True


class TestGetSignedCookieWithChunks:
    """Tests for _get_signed_cookie_with_chunks function."""

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_returns_none_for_missing_cookie(self) -> None:
        """Test that None is returned when cookie is not present."""
        cookies: dict[str, str] = {}

        result = _get_signed_cookie_with_chunks(cookies, "_streamlit_user")

        assert result is None

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_returns_decoded_value_for_valid_cookie(self) -> None:
        """Test that signed cookie is decoded correctly."""
        payload = "test-payload"
        signed_cookie = starlette_app_utils.create_signed_value(
            "test-secret", "_streamlit_user", payload
        )
        cookies = {"_streamlit_user": signed_cookie.decode("utf-8")}

        result = _get_signed_cookie_with_chunks(cookies, "_streamlit_user")

        assert result == payload.encode("utf-8")

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_returns_none_for_invalid_signature(self) -> None:
        """Test that None is returned for invalid signature."""
        cookies = {"_streamlit_user": "invalid-signed-value"}

        result = _get_signed_cookie_with_chunks(cookies, "_streamlit_user")

        assert result is None


class TestStarletteSessionClient:
    """Tests for StarletteSessionClient class."""

    @pytest.mark.anyio
    async def test_write_forward_msg_raises_when_closed(self) -> None:
        """Test that write_forward_msg raises when client is closed."""
        from streamlit.runtime.session_manager import SessionClientDisconnectedError

        mock_websocket = MagicMock()
        client = StarletteSessionClient(mock_websocket)

        # Mark as closed
        client._closed.set()

        mock_msg = MagicMock()
        with pytest.raises(SessionClientDisconnectedError):
            client.write_forward_msg(mock_msg)

        # Cleanup
        await client.aclose()

    @pytest.mark.anyio
    async def test_write_forward_msg_queues_message(self) -> None:
        """Test that write_forward_msg adds message to queue."""
        mock_websocket = MagicMock()
        client = StarletteSessionClient(mock_websocket)

        mock_msg = MagicMock()

        with patch(
            "streamlit.web.server.starlette.starlette_websocket.serialize_forward_msg"
        ) as mock_serialize:
            mock_serialize.return_value = b"serialized"
            client.write_forward_msg(mock_msg)

        assert client._send_queue.qsize() == 1

        # Cleanup
        await client.aclose()

    @pytest.mark.anyio
    async def test_aclose_sets_closed_and_cancels_task(self) -> None:
        """Test that aclose sets closed flag and cancels sender task."""
        mock_websocket = MagicMock()
        client = StarletteSessionClient(mock_websocket)

        await client.aclose()

        assert client._closed.is_set()
        assert client._sender_task.cancelled()


class TestCreateWebsocketRoutes:
    """Tests for create_websocket_routes function."""

    def test_creates_websocket_route(self) -> None:
        """Test that WebSocket route is created with correct path."""
        mock_runtime = MagicMock()

        routes = create_websocket_routes(mock_runtime, base_url=None)

        assert len(routes) == 1
        assert routes[0].path == "/_stcore/stream"

    def test_creates_route_with_base_url(self) -> None:
        """Test that WebSocket route is created with base URL prefix."""
        mock_runtime = MagicMock()

        routes = create_websocket_routes(mock_runtime, base_url="myapp")

        assert len(routes) == 1
        assert routes[0].path == "/myapp/_stcore/stream"

    def test_creates_route_with_slashed_base_url(self) -> None:
        """Test that slashes are handled correctly in base URL."""
        mock_runtime = MagicMock()

        routes = create_websocket_routes(mock_runtime, base_url="/myapp/")

        assert len(routes) == 1
        assert routes[0].path == "/myapp/_stcore/stream"
