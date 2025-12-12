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

"""WebSocket handling for the Starlette server."""

from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from typing import TYPE_CHECKING, Any, Final
from urllib.parse import urlparse

from streamlit import config
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.runtime.runtime_util import serialize_forward_msg
from streamlit.runtime.session_manager import (
    SessionClient,
    SessionClientDisconnectedError,
)
from streamlit.web.server.server_util import get_cookie_secret, is_xsrf_enabled
from streamlit.web.server.starlette import starlette_app_utils

if TYPE_CHECKING:
    from starlette.datastructures import Headers
    from starlette.websockets import WebSocket

    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
    from streamlit.runtime import Runtime

_LOGGER = get_logger(__name__)

# Max pending messages per client in the send queue before disconnecting.
# Each connected client has its own queue; under normal conditions the queue drains
# continuously and rarely exceeds single digits. This limit protects against slow
# clients (bad network, paused tabs) causing unbounded server memory growth.
# With N concurrent users, worst case memory is N * _MAX_SEND_QUEUE_SIZE * msg_size.
_MAX_SEND_QUEUE_SIZE: Final = 500


def _parse_subprotocols(
    headers: Headers,
) -> tuple[str | None, str | None, str | None]:
    """Parse the Sec-WebSocket-Protocol header.

    Returns a tuple of (selected_subprotocol, xsrf_token, existing_session_id).

    The subprotocol header is repurposed to pass tokens from client to server:
    - First entry: subprotocol to select (e.g., "streamlit")
    - Second entry: XSRF token for authentication validation
    - Third entry: existing session ID for reconnection
    """
    raw = headers.get("sec-websocket-protocol")
    if not raw:
        return None, None, None

    entries = [value.strip() for value in raw.split(",") if value.strip()]
    selected = entries[0] if entries else None
    xsrf_token = entries[1] if len(entries) >= 2 else None
    existing_session = entries[2] if len(entries) >= 3 else None
    return selected, xsrf_token, existing_session


def _gather_user_info(headers: Headers) -> dict[str, str | bool | None]:
    """Extract user info from trusted headers."""
    user_info: dict[str, str | bool | None] = {}
    mapping = config.get_option("server.trustedUserHeaders")
    if not isinstance(mapping, dict):
        return user_info

    for header_name, user_key in mapping.items():
        values = headers.getlist(header_name)
        user_info[user_key] = values[0] if values else None
    return user_info


def _validate_xsrf_token(supplied_token: str | None, xsrf_cookie: str | None) -> bool:
    """Validate the XSRF token from the WebSocket subprotocol against the cookie.

    This mirrors Tornado's XSRF validation logic to ensure the frontend can share
    XSRF logic between WebSocket handshake and HTTP uploads regardless of backend.
    """
    import hmac

    if not supplied_token or not xsrf_cookie:
        return False

    # Decode the supplied token from the subprotocol
    supplied_token_bytes, _ = starlette_app_utils.decode_xsrf_token_string(
        supplied_token
    )
    # Decode the expected token from the cookie
    expected_token_bytes, _ = starlette_app_utils.decode_xsrf_token_string(xsrf_cookie)

    if not supplied_token_bytes or not expected_token_bytes:
        return False

    return hmac.compare_digest(supplied_token_bytes, expected_token_bytes)


def _parse_user_cookie_signed(cookie_value: str | bytes, origin: str) -> dict[str, Any]:
    """Parse and validate a signed user cookie."""
    secret = get_cookie_secret()
    signed_value = cookie_value
    if isinstance(signed_value, str):
        signed_value = signed_value.encode("latin-1")

    decoded = starlette_app_utils.decode_signed_value(
        secret, "_streamlit_user", signed_value
    )
    if decoded is None:
        return {}

    try:
        payload = json.loads(decoded.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        _LOGGER.exception("Error decoding auth cookie payload")
        return {}

    parsed_origin = urlparse(origin)
    if not parsed_origin.scheme or not parsed_origin.netloc:
        return {}
    expected_origin = f"{parsed_origin.scheme}://{parsed_origin.netloc}"
    cookie_origin = payload.get("origin")
    if cookie_origin != expected_origin:
        _LOGGER.error(
            "Origin mismatch, the origin of websocket request is not the "
            "same origin of redirect_uri in secrets.toml",
        )
        return {}
    user_info = {"is_logged_in": payload.get("is_logged_in", False)}
    payload.pop("origin", None)
    payload.pop("is_logged_in", None)
    user_info.update(payload)
    return user_info


class StarletteSessionClient(SessionClient):
    """WebSocket client for Starlette that implements SessionClient interface."""

    def __init__(self, websocket: WebSocket) -> None:
        self._websocket = websocket
        # The queue bridges sync write_forward_msg calls to async WebSocket sends.
        # Overwhelmed clients get disconnected via SessionClientDisconnectedError.
        self._send_queue: asyncio.Queue[bytes] = asyncio.Queue(
            maxsize=_MAX_SEND_QUEUE_SIZE
        )
        self._sender_task = asyncio.create_task(
            self._sender(), name="starlette-ws-send"
        )
        self._closed = asyncio.Event()

    async def _sender(self) -> None:
        """Background task to drain the send_queue and write to the WebSocket.

        This decouples the message generation (which puts into the queue) from the
        actual network I/O, allowing for non-blocking sends from the main thread.
        """
        from starlette.websockets import WebSocketDisconnect

        try:
            while True:
                payload = await self._send_queue.get()
                await self._websocket.send_bytes(payload)
        except WebSocketDisconnect:
            pass
        except Exception:
            _LOGGER.exception("Error sending websocket payload")
        finally:
            self._closed.set()

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Send a ForwardMsg to the browser."""
        if self._closed.is_set():
            raise SessionClientDisconnectedError

        payload = serialize_forward_msg(msg)
        try:
            self._send_queue.put_nowait(payload)
        except asyncio.QueueFull as exc:  # pragma: no cover - defensive
            self._closed.set()
            raise SessionClientDisconnectedError from exc

    async def aclose(self) -> None:
        """Close the client and cancel the sender task."""
        self._closed.set()
        self._sender_task.cancel()
        with suppress(asyncio.CancelledError):
            await self._sender_task


def create_websocket_handler(runtime: Runtime) -> Any:
    """Create the WebSocket endpoint handler.

    This factory function creates the websocket handler with access to the runtime.
    """
    from starlette.websockets import WebSocketDisconnect

    async def _websocket_endpoint(websocket: WebSocket) -> None:
        subprotocol, xsrf_token, existing_session_id = _parse_subprotocols(
            websocket.headers
        )
        await websocket.accept(subprotocol=subprotocol)

        client = StarletteSessionClient(websocket)
        session_id: str | None = None
        user_info = _gather_user_info(websocket.headers)
        if is_xsrf_enabled():
            auth_cookie = websocket.cookies.get("_streamlit_user")
            xsrf_cookie = websocket.cookies.get("_streamlit_xsrf")
            origin_header = websocket.headers.get("Origin")

            # Validate XSRF token before parsing auth cookie (matches Tornado behavior)
            if (
                auth_cookie
                and origin_header
                and _validate_xsrf_token(xsrf_token, xsrf_cookie)
            ):
                try:
                    user_info.update(
                        _parse_user_cookie_signed(auth_cookie, origin_header)
                    )
                except Exception:  # pragma: no cover - defensive
                    _LOGGER.exception("Error parsing auth cookie for websocket")

        try:
            session_id = runtime.connect_session(
                client=client,
                user_info=user_info,
                existing_session_id=existing_session_id,
            )

            while True:
                try:
                    data = await websocket.receive_bytes()
                except WebSocketDisconnect:
                    break
                except RuntimeError:
                    # Starlette raises RuntimeError when a text frame is received
                    # by receive_bytes. Streamlit strictly uses binary protobufs
                    # for communication. We reject text frames to enforce the
                    # protocol and prevent ambiguity.
                    await websocket.close()
                    raise TypeError(
                        "WebSocket text frames are not supported; "
                        "expected binary protobufs."
                    )

                back_msg = BackMsg()
                try:
                    back_msg.ParseFromString(data)
                except Exception as exc:
                    _LOGGER.exception("Error deserializing back message")
                    if session_id is not None:
                        runtime.handle_backmsg_deserialization_exception(
                            session_id, exc
                        )
                    continue

                msg_type = back_msg.WhichOneof("type")

                # "debug_disconnect_websocket" and "debug_shutdown_runtime" are
                # special developmentMode-only messages used in e2e tests to test
                # reconnect handling and disabling widgets.
                if msg_type == "debug_disconnect_websocket":
                    if config.get_option("global.developmentMode") or config.get_option(
                        "global.e2eTest"
                    ):
                        await websocket.close()
                        break
                    _LOGGER.warning(
                        "Client tried to disconnect websocket when not in "
                        "development mode or e2e testing."
                    )
                    continue
                if msg_type == "debug_shutdown_runtime":
                    if config.get_option("global.developmentMode") or config.get_option(
                        "global.e2eTest"
                    ):
                        runtime.stop()
                        break
                    _LOGGER.warning(
                        "Client tried to shut down runtime when not in "
                        "development mode or e2e testing."
                    )
                    continue

                runtime.handle_backmsg(session_id, back_msg)

        except WebSocketDisconnect:
            # The websocket was closed by the client,
            # we are handling it in the finally block.
            pass
        finally:
            if session_id is not None:
                runtime.disconnect_session(session_id)
            await client.aclose()

    return _websocket_endpoint
