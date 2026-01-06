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

"""WebSocket handling for the Starlette server."""

from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from typing import TYPE_CHECKING, Any, Final
from urllib.parse import urlparse

from streamlit import config
from streamlit.auth_util import get_cookie_with_chunks, get_expose_tokens_config
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.runtime.runtime_util import serialize_forward_msg
from streamlit.runtime.session_manager import (
    ClientContext,
    SessionClient,
    SessionClientDisconnectedError,
)
from streamlit.web.server.server_util import (
    get_cookie_secret,
    is_url_from_allowed_origins,
    is_xsrf_enabled,
)
from streamlit.web.server.starlette import starlette_app_utils
from streamlit.web.server.starlette.starlette_server_config import (
    TOKENS_COOKIE_NAME,
    USER_COOKIE_NAME,
    WEBSOCKET_MAX_SEND_QUEUE_SIZE,
    XSRF_COOKIE_NAME,
)

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping

    from starlette.datastructures import Headers
    from starlette.routing import BaseRoute
    from starlette.websockets import WebSocket

    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
    from streamlit.runtime import Runtime

_LOGGER: Final = get_logger(__name__)

# WebSocket stream route path (without base URL prefix).
_ROUTE_WEBSOCKET_STREAM: Final = "_stcore/stream"


def _parse_subprotocols(
    headers: Headers,
) -> tuple[str | None, str | None, str | None]:
    """Parse the Sec-WebSocket-Protocol header.

    Returns a tuple of (selected_subprotocol, xsrf_token, existing_session_id).

    The subprotocol header is repurposed to pass tokens from client to server:
    - First entry: subprotocol to select (e.g., "streamlit")
    - Second entry: XSRF token for authentication validation
    - Third entry: existing session ID for reconnection

    Positional semantics are preserved: empty/whitespace entries are treated as
    None rather than being filtered out (which would shift positions).
    """
    raw = headers.get("sec-websocket-protocol")
    if not raw:
        return None, None, None

    # Split and strip, preserving positions (empty strings become None)
    entries = [value.strip() for value in raw.split(",")]
    selected = entries[0] if entries and entries[0] else None
    xsrf_token = entries[1] if len(entries) >= 2 and entries[1] else None
    existing_session = entries[2] if len(entries) >= 3 and entries[2] else None
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


def _is_origin_allowed(origin: str | None, host: str | None) -> bool:
    """Check if the WebSocket Origin header is allowed.

    This mirrors Tornado's WebSocketHandler.check_origin behavior, which allows
    same-origin connections by default and delegates to is_url_from_allowed_origins
    for cross-origin requests.

    Parameters
    ----------
    origin: str | None
        The origin of the WebSocket connection.

    host: str | None
        The host of the WebSocket connection.

    Returns
    -------
    bool
        True if:
        - The origin is None (browser didn't send Origin header, allowed per spec)
        - The origin matches the host (same-origin request)
        - The origin is in the allowed origins list (is_url_from_allowed_origins)
    """
    # If no Origin header is present, allow the connection.
    # Per the WebSocket spec, browsers should always send Origin, but non-browser
    # clients may not. Tornado allows connections without Origin by default.
    if origin is None:
        return True

    # Check same-origin: compare origin host with request host
    parsed_origin = urlparse(origin)
    origin_host = parsed_origin.netloc

    # If origin host matches request host, it's same-origin
    if origin_host == host:
        return True

    # Delegate to the standard allowed origins check
    return is_url_from_allowed_origins(origin)


def _parse_user_cookie_signed(cookie_value: str | bytes, origin: str) -> dict[str, Any]:
    """Parse and validate a signed user cookie.

    Note: This only understands cookies signed with itsdangerous (Starlette).
    Cookies signed by Tornado's set_secure_cookie will fail to decode and
    return an empty dict, requiring users to re-authenticate after switching
    backends. This is expected behavior when switching between Tornado and Starlette backends.
    """
    secret = get_cookie_secret()
    signed_value = cookie_value
    if isinstance(signed_value, str):
        # HTTP cookies use ISO-8859-1 (latin-1) encoding per the HTTP spec.
        # To recover the original bytes from a decoded cookie string, we must
        # encode back to latin-1 (not UTF-8).
        signed_value = signed_value.encode("latin-1")

    decoded = starlette_app_utils.decode_signed_value(
        secret, USER_COOKIE_NAME, signed_value
    )
    if decoded is None:
        return {}

    return _parse_decoded_user_cookie(decoded, origin)


def _parse_decoded_user_cookie(decoded_cookie: bytes, origin: str) -> dict[str, Any]:
    """Parse an already-decoded user cookie and validate the origin.

    This is used when the cookie has already been decoded (e.g., from chunked cookie
    retrieval). Validates the origin against the request origin for security.
    """
    try:
        payload = json.loads(decoded_cookie.decode("utf-8"))
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
    user_info: dict[str, Any] = {"is_logged_in": payload.get("is_logged_in", False)}
    payload.pop("origin", None)
    payload.pop("is_logged_in", None)
    user_info.update(payload)
    return user_info


def _get_signed_cookie_with_chunks(
    cookies: dict[str, str], cookie_name: str
) -> bytes | None:
    """Get a signed cookie value, reconstructing from chunks if necessary.

    Large cookies may be split into multiple chunks (e.g., `_streamlit_user`,
    `_streamlit_user__1`, `_streamlit_user__2`) due to browser cookie size limits.
    This function handles both single and chunked cookies transparently.

    Parameters
    ----------
    cookies
        Dictionary of cookie names to their string values.
    cookie_name
        The base name of the cookie to retrieve.

    Returns
    -------
    bytes | None
        The decoded (unsigned) cookie value, or None if the cookie doesn't exist
        or has an invalid signature.

    Notes
    -----
    Uses itsdangerous signing which is NOT compatible with Tornado's format.
    Cookies signed by Tornado will fail to decode.
    """
    secret = get_cookie_secret()

    def get_single_cookie(name: str) -> bytes | None:
        raw_value = cookies.get(name)
        if raw_value is None:
            return None
        # HTTP cookies use ISO-8859-1 (latin-1) encoding per the HTTP spec
        signed_value = raw_value.encode("latin-1")
        return starlette_app_utils.decode_signed_value(secret, name, signed_value)

    return get_cookie_with_chunks(get_single_cookie, cookie_name)


class StarletteClientContext(ClientContext):
    """Starlette-specific implementation of ClientContext.

    Captures headers, cookies, and client info from the initial WebSocket handshake.
    Values are cached at construction time since they represent the initial request
    context and should not change during the connection lifetime.
    """

    def __init__(self, websocket: WebSocket) -> None:
        self._headers: list[tuple[str, str]] = list(websocket.headers.items())
        self._cookies: dict[str, str] = dict(websocket.cookies)
        client = websocket.client
        self._remote_ip: str | None = client.host if client else None

    @property
    def headers(self) -> Iterable[tuple[str, str]]:
        """All headers as (name, value) tuples."""
        return self._headers

    @property
    def cookies(self) -> Mapping[str, str]:
        """Cookies as a name-to-value mapping."""
        return self._cookies

    @property
    def remote_ip(self) -> str | None:
        """The client's remote IP address."""
        return self._remote_ip


class StarletteSessionClient(SessionClient):
    """WebSocket client for Starlette that implements the SessionClient interface.

    This class bridges the synchronous `write_forward_msg` calls from the Streamlit
    runtime to the asynchronous WebSocket send operations. It uses an internal
    queue and a background sender task to avoid blocking the calling thread.

    Parameters
    ----------
    websocket
        The Starlette WebSocket connection to send messages through.
    """

    def __init__(self, websocket: WebSocket) -> None:
        self._websocket = websocket
        self._client_context = StarletteClientContext(websocket)
        # The queue bridges sync write_forward_msg calls to async WebSocket sends.
        # Overwhelmed clients get disconnected via SessionClientDisconnectedError.
        self._send_queue: asyncio.Queue[bytes] = asyncio.Queue(
            maxsize=WEBSOCKET_MAX_SEND_QUEUE_SIZE
        )
        self._sender_task = asyncio.create_task(
            self._sender(), name="starlette-ws-send"
        )
        self._closed = asyncio.Event()

    async def _sender(self) -> None:
        """Background task that drains the send queue and writes to the WebSocket.

        This task runs continuously, waiting for messages on the queue and sending
        them to the WebSocket. It decouples message generation (sync) from network
        I/O (async), allowing non-blocking sends from the runtime thread.

        The task terminates when the WebSocket disconnects or an error occurs,
        at which point it sets the closed flag to signal the client is no longer
        usable.
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
        """Send a ForwardMsg to the browser via the WebSocket.

        This method is called synchronously from the Streamlit runtime. The message
        is serialized and queued for asynchronous sending by the background sender task.

        Parameters
        ----------
        msg
            The ForwardMsg protobuf to send to the client.

        Raises
        ------
        SessionClientDisconnectedError
            If the client is already closed or the send queue is full (client
            is overwhelmed and not consuming messages fast enough).
        """
        if self._closed.is_set():
            raise SessionClientDisconnectedError

        payload = serialize_forward_msg(msg)
        try:
            self._send_queue.put_nowait(payload)
        except asyncio.QueueFull as exc:  # pragma: no cover - defensive
            self._closed.set()
            raise SessionClientDisconnectedError from exc

    @property
    def client_context(self) -> ClientContext:
        """Return the client's connection context."""
        return self._client_context

    async def aclose(self) -> None:
        """Close the client and release resources.

        Sets the closed flag to prevent further message sends, cancels the
        background sender task, and waits for it to complete cleanup.
        """
        self._closed.set()
        self._sender_task.cancel()
        with suppress(asyncio.CancelledError):
            await self._sender_task


def create_websocket_handler(runtime: Runtime) -> Any:
    """Create the WebSocket endpoint handler for client-server communication.

    This factory function creates a Starlette WebSocket handler that manages the
    bidirectional communication between the browser and the Streamlit runtime.
    The handler performs:
    - Origin validation (CORS/XSRF protection)
    - Subprotocol negotiation
    - Session management (connect/disconnect)
    - User authentication via cookies and trusted headers
    - BackMsg processing from the client
    - ForwardMsg sending to the client (via StarletteSessionClient)

    Parameters
    ----------
    runtime
        The Streamlit runtime instance that manages sessions and script execution.

    Returns
    -------
    Callable
        An async function that handles WebSocket connections.
    """
    from starlette.websockets import WebSocketDisconnect

    expose_tokens = get_expose_tokens_config()

    async def _websocket_endpoint(websocket: WebSocket) -> None:
        # Validate origin before accepting the connection to prevent
        # cross-site WebSocket hijacking (mirrors Tornado's check_origin).
        origin = websocket.headers.get("Origin")
        host = websocket.headers.get("Host")
        if not _is_origin_allowed(origin, host):
            _LOGGER.warning(
                "Rejecting WebSocket connection from disallowed origin: %s", origin
            )
            await websocket.close(code=1008)  # 1008 = Policy Violation
            return

        subprotocol, xsrf_token, existing_session_id = _parse_subprotocols(
            websocket.headers
        )
        await websocket.accept(subprotocol=subprotocol)

        client = StarletteSessionClient(websocket)
        session_id: str | None = None

        try:
            user_info: dict[str, Any] = {}
            if is_xsrf_enabled():
                xsrf_cookie = websocket.cookies.get(XSRF_COOKIE_NAME)
                origin_header = websocket.headers.get("Origin")

                # Validate XSRF token before parsing auth cookie:
                if origin_header and starlette_app_utils.validate_xsrf_token(
                    xsrf_token, xsrf_cookie
                ):
                    try:
                        raw_auth_cookie = _get_signed_cookie_with_chunks(
                            websocket.cookies, USER_COOKIE_NAME
                        )
                        if raw_auth_cookie:
                            user_info.update(
                                _parse_decoded_user_cookie(
                                    raw_auth_cookie, origin_header
                                )
                            )

                            raw_token_cookie = _get_signed_cookie_with_chunks(
                                websocket.cookies, TOKENS_COOKIE_NAME
                            )
                            if raw_token_cookie:
                                all_tokens = json.loads(raw_token_cookie)

                                filtered_tokens: dict[str, str] = {}
                                for token_type in expose_tokens:
                                    token_key = f"{token_type}_token"
                                    if token_key in all_tokens:
                                        filtered_tokens[token_type] = all_tokens[
                                            token_key
                                        ]

                                user_info["tokens"] = filtered_tokens
                    except Exception:  # pragma: no cover - defensive
                        _LOGGER.exception("Error parsing auth cookie for websocket")

            # Map in any user-configured headers. Note that these override anything
            # coming from the auth cookie.
            user_info.update(_gather_user_info(websocket.headers))

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
                        "WebSocket text frames are not supported; connection closed. "
                        "Expected binary protobufs."
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
            try:
                if session_id is not None:
                    runtime.disconnect_session(session_id)
            finally:
                # Ensure client cleanup happens even if disconnect_session raises.
                await client.aclose()

    return _websocket_endpoint


def create_websocket_routes(runtime: Runtime, base_url: str | None) -> list[BaseRoute]:
    """Create the WebSocket route for client-server communication.

    Creates a route at `/_stcore/stream` (with optional base URL prefix) that handles
    the bidirectional WebSocket connection between the browser and Streamlit runtime.

    Parameters
    ----------
    runtime
        The Streamlit runtime instance that manages sessions and script execution.
    base_url
        Optional base URL path prefix for the route (e.g., "myapp" results in
        "/myapp/_stcore/stream").

    Returns
    -------
    list[BaseRoute]
        A list containing the single WebSocketRoute for the stream endpoint.
    """
    from starlette.routing import WebSocketRoute

    from streamlit.url_util import make_url_path

    return [
        WebSocketRoute(
            make_url_path(base_url or "", _ROUTE_WEBSOCKET_STREAM),
            create_websocket_handler(runtime),
        )
    ]
