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

from unittest import mock
from unittest.mock import MagicMock

import tornado.httpserver
import tornado.testing
import tornado.web
import tornado.websocket

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import SessionClientDisconnectedError, Runtime
from streamlit.web.server.server import BrowserWebSocketHandler
from .server_test_case import ServerTestCase


class BrowserWebSocketHandlerTest(ServerTestCase):
    @tornado.testing.gen_test
    async def test_write_forward_msg_reraises_websocket_closed_error(self):
        """`write_forward_msg` should re-raise WebSocketClosedError as
        as SessionClientDisconnectedError.
        """

        with self._patch_app_session():
            await self.server.start()
            await self.ws_connect()

            # Get our connected BrowserWebSocketHandler
            session_info = list(self.server._runtime._session_info_by_id.values())[0]
            websocket_handler = session_info.client
            self.assertIsInstance(websocket_handler, BrowserWebSocketHandler)

            # Patch _BrowserWebSocketHandler.write_message to raise an error
            with mock.patch.object(
                websocket_handler, "write_message"
            ) as write_message_mock:
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

            # Get our BrowserWebSocketHandler
            session_info = list(self.server._runtime._session_info_by_id.values())[0]
            websocket_handler: BrowserWebSocketHandler = session_info.client

            mock_runtime = MagicMock(spec=Runtime)
            websocket_handler._runtime = mock_runtime

            # Send a malformed BackMsg
            websocket_handler.on_message(b"NotABackMsg")

            mock_runtime.handle_backmsg_deserialization_exception.assert_called_once()
            mock_runtime.handle_backmsg.assert_not_called()
