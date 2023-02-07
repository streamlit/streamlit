# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from unittest.mock import ANY, MagicMock, patch

import tornado.httpserver
import tornado.testing
import tornado.web
import tornado.websocket

from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import Runtime, SessionClientDisconnectedError
from streamlit.web.server.server import BrowserWebSocketHandler
from tests.isolated_asyncio_test_case import IsolatedAsyncioTestCase
from tests.streamlit.web.server.server_test_case import ServerTestCase
from tests.testutil import patch_config_options


class BrowserWebSocketHandlerTest(ServerTestCase):
    # NOTE: These tests are quite boilerplate-y and repetitive as
    # tornado.testing.AsyncHTTPTestCase doesn't have great support for being able to
    # define async setUp and tearDown functions :(

    @tornado.testing.gen_test
    async def test_connect_with_no_session_id(self):
        with self._patch_app_session(), patch.object(
            self.server._runtime, "connect_session"
        ) as patched_connect_session:
            await self.server.start()
            await self.ws_connect()

            patched_connect_session.assert_called_with(
                client=ANY,
                user_info=ANY,
                existing_session_id=None,
            )

    @tornado.testing.gen_test
    async def test_connect_with_session_id(self):
        with self._patch_app_session(), patch.object(
            self.server._runtime, "connect_session"
        ) as patched_connect_session:
            await self.server.start()
            await self.ws_connect(existing_session_id="session_id")

            patched_connect_session.assert_called_with(
                client=ANY,
                user_info=ANY,
                existing_session_id="session_id",
            )

    @tornado.testing.gen_test
    async def test_write_forward_msg_reraises_websocket_closed_error(self):
        """`write_forward_msg` should re-raise WebSocketClosedError as
        as SessionClientDisconnectedError.
        """

        with self._patch_app_session():
            await self.server.start()
            await self.ws_connect()

            # Get our connected BrowserWebSocketHandler
            session_info = self.server._runtime._session_mgr.list_active_sessions()[0]
            websocket_handler = session_info.client
            self.assertIsInstance(websocket_handler, BrowserWebSocketHandler)

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
                with self.assertRaises(SessionClientDisconnectedError):
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

            self.assertIsNotNone(websocket_handler.ws_connection)

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

            self.assertIsNone(websocket_handler.ws_connection)

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
