# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import base64
import binascii
import json
from typing import Final

import starlette.websockets
from starlette.endpoints import WebSocketEndpoint
from starlette.websockets import WebSocket

from streamlit import config
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import Runtime, SessionClient, SessionClientDisconnectedError
from streamlit.runtime.runtime_util import serialize_forward_msg
from streamlit.web.server.server_util import is_url_from_allowed_origins

_LOGGER: Final = get_logger(__name__)


# TODO [kajarenc]: Move this class to a separate file
class ASGISessionClient(SessionClient):
    """An ASGI session client that can send messages to the browser."""

    def __init__(self, websocket: WebSocket) -> None:
        self.websocket = websocket

    async def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Send a ForwardMsg to the browser."""
        try:
            await self.websocket.send_bytes(serialize_forward_msg(msg))
        except (
            starlette.websockets.WebSocketDisconnect,
            RuntimeError,
        ) as e:
            raise SessionClientDisconnectedError from e


class ASGIBrowserWebSocketHandler(WebSocketEndpoint):
    """Handles a WebSocket connection from the browser"""

    encoding = "bytes"

    def select_subprotocol(self, subprotocols: list[str]) -> str | None:
        """Return the first subprotocol in the given list.

        This method is used by Tornado to select a protocol when the
        Sec-WebSocket-Protocol header is set in an HTTP Upgrade request.

        NOTE: We repurpose the Sec-WebSocket-Protocol header here in a slightly
        unfortunate (but necessary) way. The browser WebSocket API doesn't allow us to
        set arbitrary HTTP headers, and this header is the only one where we have the
        ability to set it to arbitrary values, so we use it to pass tokens (in this
        case, the previous session ID to allow us to reconnect to it) from client to
        server as the *third* value in the list.

        The reason why the auth token is set as the third value is that:
          * when Sec-WebSocket-Protocol is set, many clients expect the server to
            respond with a selected subprotocol to use. We don't want that reply to be
            the session token, so we by convention have the client always set the first
            protocol to "streamlit" and select that.
          * the second protocol in the list is reserved in some deployment environments
            for an auth token that we currently don't use
        """
        if subprotocols:
            return subprotocols[0]

        return None

    async def on_connect(self, websocket: WebSocket) -> None:
        is_public_cloud_app = False
        try:
            header_content = websocket.headers["X-Streamlit-User"]
            payload = base64.b64decode(header_content)
            user_obj = json.loads(payload)
            email = user_obj["email"]
            is_public_cloud_app = user_obj["isPublicCloudApp"]
        except (KeyError, binascii.Error, json.decoder.JSONDecodeError):
            email = "test@example.com"

        user_info: dict[str, str | None] = dict()

        if is_public_cloud_app:
            user_info["email"] = None
        else:
            user_info["email"] = email

        existing_session_id = None
        ws_protocols = []
        try:
            ws_protocols = [
                p.strip()
                for p in websocket.headers["Sec-Websocket-Protocol"].split(",")
            ]

            if len(ws_protocols) >= 3:
                # See the NOTE in the docstring of the `select_subprotocol` method above
                # for a detailed explanation of why this is done.
                existing_session_id = ws_protocols[2]
        except KeyError:
            # Just let existing_session_id=None if we run into any error while trying to
            # extract it from the Sec-Websocket-Protocol header.
            pass

        await websocket.accept(subprotocol=self.select_subprotocol(ws_protocols))

        client = ASGISessionClient(websocket)

        _session_id = websocket.state.runtime.connect_session(
            client=client,
            user_info=user_info,
            existing_session_id=existing_session_id,
        )
        websocket.state._session_id = _session_id

    async def on_disconnect(self, websocket: WebSocket, close_code: int) -> None:
        try:
            websocket.state.runtime.disconnect_session(websocket.state._session_id)
        except AttributeError:
            pass

    # def get_compression_options(self) -> dict[Any, Any] | None:
    #     """Enable WebSocket compression.
    #
    #     Returning an empty dict enables websocket compression. Returning
    #     None disables it.
    #
    #     (See the docstring in the parent class.)
    #     """
    #     if config.get_option("server.enableWebsocketCompression"):
    #         return {}
    #     return None

    async def on_receive(self, websocket: WebSocket, data: bytes) -> None:

        if not websocket.state._session_id:
            return
        try:
            msg = BackMsg()
            msg.ParseFromString(data)
            _LOGGER.debug("Received the following back message:\n%s", msg)
        except Exception as ex:
            _LOGGER.error(ex)
            websocket.state.runtime.handle_backmsg_deserialization_exception(
                websocket.state._session_id, ex
            )
            return

        if msg.WhichOneof("type") == "debug_disconnect_websocket":
            if config.get_option("global.developmentMode"):
                await websocket.close()
            else:
                _LOGGER.warning(
                    "Client tried to disconnect websocket when not in development mode."
                )
        elif msg.WhichOneof("type") == "debug_shutdown_runtime":
            if config.get_option("global.developmentMode"):
                websocket.state.runtime.stop()
            else:
                _LOGGER.warning(
                    "Client tried to shut down runtime when not in development mode."
                )
        else:
            # AppSession handles all other BackMsg types.
            websocket.state.runtime.handle_backmsg(websocket.state._session_id, msg)
