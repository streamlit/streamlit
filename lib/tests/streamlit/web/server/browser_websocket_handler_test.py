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

from __future__ import annotations

import json
from http.cookies import Morsel
from unittest.mock import ANY, MagicMock, patch

import pytest
import tornado.testing
import tornado.websocket
from tornado.httputil import HTTPHeaders

from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import Runtime, SessionClientDisconnectedError
from streamlit.web.server.browser_websocket_handler import (
    BrowserWebSocketHandler,
    TornadoClientContext,
)
from tests.streamlit.web.server.server_test_case import ServerTestCase
from tests.testutil import patch_config_options


class BrowserWebSocketHandlerTest(ServerTestCase):
    __test__ = True

    # NOTE: These tests are quite boilerplate-y and repetitive as
    # tornado.testing.AsyncHTTPTestCase doesn't have great support for being able to
    # define async setUp and tearDown functions :(

    @tornado.testing.gen_test
    async def test_connect_with_no_session_id(self):
        with (
            self._patch_app_session(),
            patch.object(
                self.server._runtime, "connect_session"
            ) as patched_connect_session,
        ):
            await self.server.start()
            await self.ws_connect()

            patched_connect_session.assert_called_with(
                client=ANY,
                user_info=ANY,
                existing_session_id=None,
            )

    @tornado.testing.gen_test
    async def test_connect_with_session_id(self):
        with (
            self._patch_app_session(),
            patch.object(
                self.server._runtime, "connect_session"
            ) as patched_connect_session,
        ):
            await self.server.start()
            await self.ws_connect(existing_session_id="session_id")

            patched_connect_session.assert_called_with(
                client=ANY,
                user_info=ANY,
                existing_session_id="session_id",
            )

    @tornado.testing.gen_test
    async def test_write_forward_msg_reraises_websocket_closed_error(self):
        """`write_forward_msg` should re-raise WebSocketClosedError
        as SessionClientDisconnectedError.
        """

        with self._patch_app_session():
            await self.server.start()
            await self.ws_connect()

            # Get our connected BrowserWebSocketHandler
            session_info = self.server._runtime._session_mgr.list_active_sessions()[0]
            websocket_handler = session_info.client
            assert isinstance(websocket_handler, BrowserWebSocketHandler)

            # Patch _BrowserWebSocketHandler.write_message to raise an error
            with patch.object(websocket_handler, "write_message") as write_message_mock:
                write_message_mock.side_effect = tornado.websocket.WebSocketClosedError

                msg = ForwardMsg()
                msg.script_finished = (
                    ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
                )

                # Send a ForwardMsg. write_message will raise a
                # WebSocketClosedError, and write_forward_msg should re-raise
                # it as a SessionClientDisconnectedError.
                with pytest.raises(SessionClientDisconnectedError):
                    websocket_handler.write_forward_msg(msg)

                write_message_mock.assert_called_once()

    @tornado.testing.gen_test
    async def test_backmsg_deserialization_exception(self):
        """If BackMsg deserialization raises an Exception, we should call the Runtime's
        handler.
        """
        with self._patch_app_session():
            await self.server.start()
            await self.ws_connect()

            # Get our connected BrowserWebSocketHandler
            session_info = self.server._runtime._session_mgr.list_active_sessions()[0]
            websocket_handler: BrowserWebSocketHandler = session_info.client

            mock_runtime = MagicMock(spec=Runtime)
            websocket_handler._runtime = mock_runtime

            # Send a malformed BackMsg
            websocket_handler.on_message(b"NotABackMsg")

            mock_runtime.handle_backmsg_deserialization_exception.assert_called_once()
            mock_runtime.handle_backmsg.assert_not_called()

    @patch_config_options({"global.developmentMode": False})
    @tornado.testing.gen_test
    async def test_ignores_debug_disconnect_websocket_when_not_dev_mode(self):
        with self._patch_app_session():
            await self.server.start()
            await self.ws_connect()

            # Get our BrowserWebSocketHandler
            session_info = self.server._runtime._session_mgr.list_active_sessions()[0]
            websocket_handler: BrowserWebSocketHandler = session_info.client

            websocket_handler.on_message(
                BackMsg(debug_disconnect_websocket=True).SerializeToString()
            )

            assert websocket_handler.ws_connection is not None

    @patch_config_options({"global.developmentMode": True})
    @tornado.testing.gen_test
    async def test_follows_debug_disconnect_websocket_when_in_dev_mode(self):
        with self._patch_app_session():
            await self.server.start()
            await self.ws_connect()

            # Get our BrowserWebSocketHandler
            session_info = self.server._runtime._session_mgr.list_active_sessions()[0]
            websocket_handler: BrowserWebSocketHandler = session_info.client

            websocket_handler.on_message(
                BackMsg(debug_disconnect_websocket=True).SerializeToString()
            )

            assert websocket_handler.ws_connection is None

    @patch_config_options({"global.developmentMode": False})
    @tornado.testing.gen_test
    async def test_ignores_debug_shutdown_runtime_when_not_dev_mode(self):
        with self._patch_app_session():
            await self.server.start()
            await self.ws_connect()

            # Get our BrowserWebSocketHandler
            session_info = self.server._runtime._session_mgr.list_active_sessions()[0]
            websocket_handler: BrowserWebSocketHandler = session_info.client

            with patch.object(
                websocket_handler._runtime, "stop"
            ) as patched_stop_runtime:
                websocket_handler.on_message(
                    BackMsg(debug_shutdown_runtime=True).SerializeToString()
                )

                patched_stop_runtime.assert_not_called()

    @patch_config_options({"global.developmentMode": True})
    @tornado.testing.gen_test
    async def test_follows_debug_shutdown_runtime_when_in_dev_mode(self):
        with self._patch_app_session():
            await self.server.start()
            await self.ws_connect()

            # Get our BrowserWebSocketHandler
            session_info = self.server._runtime._session_mgr.list_active_sessions()[0]
            websocket_handler: BrowserWebSocketHandler = session_info.client

            with patch.object(
                websocket_handler._runtime, "stop"
            ) as patched_stop_runtime:
                websocket_handler.on_message(
                    BackMsg(debug_shutdown_runtime=True).SerializeToString()
                )

                patched_stop_runtime.assert_called_once()

    @tornado.testing.gen_test
    async def test_client_context_returns_tornado_client_context(self):
        """Test that client_context property returns a TornadoClientContext instance."""
        with self._patch_app_session():
            await self.server.start()
            await self.ws_connect()

            # Get our BrowserWebSocketHandler
            session_info = self.server._runtime._session_mgr.list_active_sessions()[0]
            websocket_handler: BrowserWebSocketHandler = session_info.client

            client_context = websocket_handler.client_context

            assert isinstance(client_context, TornadoClientContext)

    @tornado.testing.gen_test
    async def test_client_context_is_cached(self):
        """Test that client_context property returns the same instance on repeated access."""
        with self._patch_app_session():
            await self.server.start()
            await self.ws_connect()

            # Get our BrowserWebSocketHandler
            session_info = self.server._runtime._session_mgr.list_active_sessions()[0]
            websocket_handler: BrowserWebSocketHandler = session_info.client

            context1 = websocket_handler.client_context
            context2 = websocket_handler.client_context

            assert context1 is context2

    @patch_config_options({"server.enableXsrfProtection": True})
    @tornado.testing.gen_test
    async def test_malformed_cookie_json_is_handled_gracefully(self):
        """Test that malformed JSON in auth cookie doesn't crash the connection."""
        with self._patch_app_session():
            await self.server.start()

            with (
                patch.object(
                    BrowserWebSocketHandler,
                    "get_signed_cookie",
                    return_value=b"not valid json {{{",
                ),
                patch.object(
                    BrowserWebSocketHandler,
                    "_validate_xsrf_token",
                    return_value=True,
                ),
                patch.object(
                    self.server._runtime, "connect_session"
                ) as patched_connect_session,
            ):
                await self.ws_connect()

                # Connection should succeed with empty user_info
                patched_connect_session.assert_called_once()
                call_kwargs = patched_connect_session.call_args.kwargs
                # user_info should be empty since cookie parsing failed
                assert call_kwargs["user_info"] == {}


class TornadoClientContextTest(tornado.testing.AsyncTestCase):
    """Tests for TornadoClientContext class."""

    def test_headers_returns_all_headers(self) -> None:
        """Test that headers property returns all headers including duplicates."""
        mock_request = MagicMock()
        headers = HTTPHeaders()
        headers.add("Content-Type", "text/html")
        headers.add("Accept", "application/json")
        headers.add("Accept", "text/plain")
        mock_request.headers = headers

        ctx = TornadoClientContext(mock_request)
        result_headers = list(ctx.headers)

        assert len(result_headers) == 3
        # Tornado normalizes header names to title case
        assert ("Content-Type", "text/html") in result_headers
        assert ("Accept", "application/json") in result_headers
        assert ("Accept", "text/plain") in result_headers

    def test_cookies_returns_all_cookies(self) -> None:
        """Test that cookies property returns all cookies as a mapping."""
        mock_request = MagicMock()

        morsel1 = Morsel()
        morsel1.set("session", "abc123", "abc123")
        morsel2 = Morsel()
        morsel2.set("user", "test_user", "test_user")
        mock_request.cookies = {"session": morsel1, "user": morsel2}

        ctx = TornadoClientContext(mock_request)

        assert ctx.cookies == {"session": "abc123", "user": "test_user"}

    def test_remote_ip_returns_ip(self) -> None:
        """Test that remote_ip property returns the client's IP address."""
        mock_request = MagicMock()
        mock_request.remote_ip = "192.168.1.100"

        ctx = TornadoClientContext(mock_request)

        assert ctx.remote_ip == "192.168.1.100"

    def test_remote_ip_returns_none_when_no_ip(self) -> None:
        """Test that remote_ip property returns None when remote_ip is None."""
        mock_request = MagicMock()
        mock_request.remote_ip = None

        ctx = TornadoClientContext(mock_request)

        assert ctx.remote_ip is None


class ValidateXsrfTokenTest(tornado.testing.AsyncTestCase):
    """Tests for _validate_xsrf_token method."""

    def _create_handler_with_xsrf(
        self, supplied_token: str, expected_token: str
    ) -> BrowserWebSocketHandler:
        """Create a handler with mocked XSRF token methods."""
        handler = MagicMock(spec=BrowserWebSocketHandler)
        # Mock _decode_xsrf_token to return (version, token, timestamp)
        handler._decode_xsrf_token = MagicMock(return_value=(2, supplied_token, 12345))
        # Mock _get_raw_xsrf_token to return (mask, token, timestamp)
        handler._get_raw_xsrf_token = MagicMock(
            return_value=(b"mask", expected_token, 12345)
        )
        return handler

    def test_validate_xsrf_token_returns_true_for_matching_tokens(self) -> None:
        """Test that matching tokens return True."""
        handler = self._create_handler_with_xsrf("valid_token", "valid_token")

        # Call the actual method
        result = BrowserWebSocketHandler._validate_xsrf_token(handler, "valid_token")

        assert result is True

    def test_validate_xsrf_token_returns_false_for_mismatched_tokens(self) -> None:
        """Test that mismatched tokens return False."""
        handler = self._create_handler_with_xsrf("wrong_token", "expected_token")

        result = BrowserWebSocketHandler._validate_xsrf_token(handler, "wrong_token")

        assert result is False

    def test_validate_xsrf_token_returns_false_for_empty_supplied_token(self) -> None:
        """Test that empty supplied token returns False."""
        handler = self._create_handler_with_xsrf("", "expected_token")

        result = BrowserWebSocketHandler._validate_xsrf_token(handler, "")

        assert result is False

    def test_validate_xsrf_token_returns_false_for_empty_expected_token(self) -> None:
        """Test that empty expected token returns False."""
        handler = self._create_handler_with_xsrf("supplied_token", "")

        result = BrowserWebSocketHandler._validate_xsrf_token(handler, "supplied_token")

        assert result is False


class ParseUserCookieTest(tornado.testing.AsyncTestCase):
    """Tests for _parse_user_cookie method."""

    def _create_handler_with_request(self, origin: str) -> BrowserWebSocketHandler:
        """Create a handler with mocked request headers."""
        handler = MagicMock(spec=BrowserWebSocketHandler)
        handler.request = MagicMock()
        handler.request.headers = {"Origin": origin}
        return handler

    def test_parse_user_cookie_extracts_user_info_on_origin_match(self) -> None:
        """Test that user info is extracted when origins match."""
        handler = self._create_handler_with_request("http://localhost:8501")
        cookie_value = json.dumps(
            {
                "origin": "http://localhost:8501",
                "is_logged_in": True,
                "email": "test@example.com",
                "name": "Test User",
            }
        ).encode()

        result = BrowserWebSocketHandler._parse_user_cookie(handler, cookie_value)

        assert result["is_logged_in"] is True
        assert result["email"] == "test@example.com"
        assert result["name"] == "Test User"
        assert "origin" not in result

    def test_parse_user_cookie_returns_empty_on_origin_mismatch(self) -> None:
        """Test that empty dict is returned when origins don't match."""
        handler = self._create_handler_with_request("http://localhost:8501")
        cookie_value = json.dumps(
            {
                "origin": "http://different-origin.com",
                "is_logged_in": True,
                "email": "test@example.com",
            }
        ).encode()

        result = BrowserWebSocketHandler._parse_user_cookie(handler, cookie_value)

        # Should return empty dict due to origin mismatch
        assert len(result) == 0

    def test_parse_user_cookie_handles_https_origin(self) -> None:
        """Test that HTTPS origins are handled correctly."""
        handler = self._create_handler_with_request("https://app.example.com")
        cookie_value = json.dumps(
            {
                "origin": "https://app.example.com",
                "is_logged_in": True,
                "email": "test@example.com",
            }
        ).encode()

        result = BrowserWebSocketHandler._parse_user_cookie(handler, cookie_value)

        assert result["is_logged_in"] is True
        assert result["email"] == "test@example.com"

    def test_parse_user_cookie_handles_origin_with_port(self) -> None:
        """Test that origins with ports are handled correctly."""
        handler = self._create_handler_with_request("http://localhost:3000")
        cookie_value = json.dumps(
            {
                "origin": "http://localhost:3000",
                "is_logged_in": True,
            }
        ).encode()

        result = BrowserWebSocketHandler._parse_user_cookie(handler, cookie_value)

        assert result["is_logged_in"] is True
