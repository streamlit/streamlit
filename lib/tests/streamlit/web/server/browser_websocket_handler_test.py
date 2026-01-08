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

from http.cookies import Morsel
from unittest.mock import ANY, MagicMock, patch

import pytest
import tornado.testing
import tornado.websocket
from tornado.httputil import HTTPHeaders

from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import Runtime, SessionClientDisconnectedError
from streamlit.web.server.browser_websocket_handler import TornadoClientContext
from streamlit.web.server.server import BrowserWebSocketHandler
from tests.streamlit.web.server.server_test_case import ServerTestCase
from tests.testutil import patch_config_options


class BrowserWebSocketHandlerTest(ServerTestCase):
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
