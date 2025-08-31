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

from __future__ import annotations

import hmac
import json
from typing import TYPE_CHECKING, Any, Final
from urllib.parse import urlparse

import tornado.concurrent
import tornado.locks
import tornado.netutil
import tornado.web
import tornado.websocket
from tornado.escape import utf8
from tornado.websocket import WebSocketHandler

from streamlit import config
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.runtime import Runtime, SessionClient, SessionClientDisconnectedError
from streamlit.runtime.runtime_util import serialize_forward_msg
from streamlit.web.server.server_util import (
    AUTH_COOKIE_NAME,
    is_url_from_allowed_origins,
    is_xsrf_enabled,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable

    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

_LOGGER: Final = get_logger(__name__)


class BrowserWebSocketHandler(WebSocketHandler, SessionClient):
    """Handles a WebSocket connection from the browser."""

    def initialize(self, runtime: Runtime) -> None:
        self._runtime = runtime
        self._session_id: str | None = None
        # The XSRF cookie is normally set when xsrf_form_html is used, but in a
        # pure-Javascript application that does not use any regular forms we just
        # need to read the self.xsrf_token manually to set the cookie as a side
        # effect. See https://www.tornadoweb.org/en/stable/guide/security.html#cross-site-request-forgery-protection
        # for more details.
        if is_xsrf_enabled():
            _ = self.xsrf_token

    def get_signed_cookie(
        self,
        name: str,
        value: str | None = None,
        max_age_days: float = 31,
        min_version: int | None = None,
    ) -> bytes | None:
        """Get a signed cookie from the request. Added for compatibility with
        Tornado < 6.3.0.

        See release notes: https://www.tornadoweb.org/en/stable/releases/v6.3.0.html#deprecation-notices
        """
        try:
            return super().get_signed_cookie(name, value, max_age_days, min_version)
        except AttributeError:
            return super().get_secure_cookie(name, value, max_age_days, min_version)

    def check_origin(self, origin: str) -> bool:
        """Set up CORS."""
        return super().check_origin(origin) or is_url_from_allowed_origins(origin)

    def _validate_xsrf_token(self, supplied_token: str) -> bool:
        """Inspired by tornado.web.RequestHandler.check_xsrf_cookie method,
        to check the XSRF token passed in Websocket connection header.
        """
        _, token, _ = self._decode_xsrf_token(supplied_token)
        _, expected_token, _ = self._get_raw_xsrf_token()

        decoded_token = utf8(token)
        decoded_expected_token = utf8(expected_token)

        if not decoded_token or not decoded_expected_token:
            return False
        return hmac.compare_digest(decoded_token, decoded_expected_token)

    def _parse_user_cookie(self, raw_cookie_value: bytes) -> dict[str, Any]:
        """Process the user cookie and extract the user info after
        validating the origin. Origin is validated for security reasons.
        """
        cookie_value = json.loads(raw_cookie_value)
        user_info = {}

        cookie_value_origin = cookie_value.get("origin", None)
        parsed_origin_from_header = urlparse(self.request.headers["Origin"])
        expected_origin_value = (
            parsed_origin_from_header.scheme + "://" + parsed_origin_from_header.netloc
        )
        if cookie_value_origin == expected_origin_value:
            user_info["is_logged_in"] = cookie_value.get("is_logged_in", False)
            del cookie_value["origin"]
            del cookie_value["is_logged_in"]
            user_info.update(cookie_value)

        else:
            _LOGGER.error(
                "Origin mismatch, the origin of websocket request is not the "
                "same origin of redirect_uri in secrets.toml",
            )

        return user_info

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Send a ForwardMsg to the browser."""
        try:
            self.write_message(serialize_forward_msg(msg), binary=True)
        except tornado.websocket.WebSocketClosedError as e:
            raise SessionClientDisconnectedError from e

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
          - when Sec-WebSocket-Protocol is set, many clients expect the server to
            respond with a selected subprotocol to use. We don't want that reply to be
            the session token, so we by convention have the client always set the first
            protocol to "streamlit" and select that.
          - the second protocol in the list is reserved in some deployment environments
            for an auth token that we currently don't use
        """
        if subprotocols:
            return subprotocols[0]

        return None

    def open(self, *args: Any, **kwargs: Any) -> Awaitable[None] | None:
        user_info: dict[str, str | bool | None] = {}

        existing_session_id = None
        try:
            ws_protocols = [
                p.strip()
                for p in self.request.headers["Sec-Websocket-Protocol"].split(",")
            ]

            raw_cookie_value = self.get_signed_cookie(AUTH_COOKIE_NAME)
            if is_xsrf_enabled() and raw_cookie_value:
                csrf_protocol_value = ws_protocols[1]

                if self._validate_xsrf_token(csrf_protocol_value):
                    user_info.update(self._parse_user_cookie(raw_cookie_value))

            if len(ws_protocols) >= 3:
                # See the NOTE in the docstring of the `select_subprotocol` method above
                # for a detailed explanation of why this is done.
                existing_session_id = ws_protocols[2]
        except KeyError:
            # Just let existing_session_id=None if we run into any error while trying to
            # extract it from the Sec-Websocket-Protocol header.
            pass

        # Map in any user-configured headers. Note that these override anything coming
        # from the auth cookie.
        mapping_config = config.get_option("server.trustedUserHeaders")
        for header_name, user_info_key in mapping_config.items():
            header_values = self.request.headers.get_list(header_name)
            if header_values:
                # If there's at least one value, use the first value.
                # NOTE: Tornado doesn't document the order of these values, so it's
                # possible this won't be the first value that was received by the
                # server.
                user_info[user_info_key] = header_values[0]
            else:
                # Default to explicit None.
                user_info[user_info_key] = None

        self._session_id = self._runtime.connect_session(
            client=self,
            user_info=user_info,
            existing_session_id=existing_session_id,
        )
        return None

    def on_close(self) -> None:
        if not self._session_id:
            return
        self._runtime.disconnect_session(self._session_id)
        self._session_id = None

    def get_compression_options(self) -> dict[Any, Any] | None:
        """Enable WebSocket compression.

        Returning an empty dict enables websocket compression. Returning
        None disables it.

        (See the docstring in the parent class.)
        """
        if config.get_option("server.enableWebsocketCompression"):
            return {}
        return None

    def on_message(self, payload: str | bytes) -> None:
        if not self._session_id:
            return

        try:
            if isinstance(payload, str):
                # Sanity check. (The frontend should only be sending us bytes;
                # Protobuf.ParseFromString does not accept str input.)
                raise TypeError(  # noqa: TRY301
                    "WebSocket received an unexpected `str` message. "
                    "(We expect `bytes` only.)"
                )

            msg = BackMsg()
            msg.ParseFromString(payload)
            _LOGGER.debug("Received the following back message:\n%s", msg)

        except Exception as ex:
            _LOGGER.exception("Error deserializing back message")
            self._runtime.handle_backmsg_deserialization_exception(self._session_id, ex)
            return

        # "debug_disconnect_websocket" and "debug_shutdown_runtime" are special
        # developmentMode-only messages used in e2e tests to test reconnect handling and
        # disabling widgets.
        if msg.WhichOneof("type") == "debug_disconnect_websocket":
            if config.get_option("global.developmentMode") or config.get_option(
                "global.e2eTest"
            ):
                self.close()
            else:
                _LOGGER.warning(
                    "Client tried to disconnect websocket when not in development mode or e2e testing."
                )
        elif msg.WhichOneof("type") == "debug_shutdown_runtime":
            if config.get_option("global.developmentMode") or config.get_option(
                "global.e2eTest"
            ):
                self._runtime.stop()
            else:
                _LOGGER.warning(
                    "Client tried to shut down runtime when not in development mode or e2e testing."
                )
        else:
            # AppSession handles all other BackMsg types.
            self._runtime.handle_backmsg(self._session_id, msg)
