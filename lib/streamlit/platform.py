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

"""Platform module."""


from typing import Mapping, Optional

from streamlit import runtime
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx


@gather_metrics("platform.post_parent_message")
def post_parent_message(message: str) -> None:
    """
    Sends a string message to the parent window (when host configuration allows).
    """
    ctx = get_script_run_ctx()
    if ctx is None:
        return

    fwd_msg = ForwardMsg()
    fwd_msg.parent_message.message = message
    ctx.enqueue(fwd_msg)


@gather_metrics("platform.get_websocket_headers")
def get_websocket_headers() -> Optional[Mapping[str, str]]:
    """Return a copy of the HTTP request headers for the current session's
    WebSocket connection. If there's no active session, return None instead.

    Raise an error if the server is not running.
    """
    ctx = get_script_run_ctx()
    if ctx is None:
        return None

    session_client = runtime.get_instance().get_client(ctx.session_id)
    if session_client is None:
        return None

    from streamlit.web.server.browser_websocket_handler import BrowserWebSocketHandler

    if not isinstance(session_client, BrowserWebSocketHandler):
        raise RuntimeError(
            f"SessionClient is not a BrowserWebSocketHandler! ({session_client})"
        )

    return dict(session_client.request.headers)


@gather_metrics("platform.get_websocket_cookies")
def get_websocket_cookies() -> Optional[Mapping[str, str]]:
    """Return a copy of the HTTP request cookies for the current session's
    WebSocket connection. If there's no active session, return None instead.

    Raise an error if the server is not running.
    """
    ctx = get_script_run_ctx()
    if ctx is None:
        return None

    session_client = runtime.get_instance().get_client(ctx.session_id)
    if session_client is None:
        return None

    from streamlit.web.server.browser_websocket_handler import BrowserWebSocketHandler

    if not isinstance(session_client, BrowserWebSocketHandler):
        raise RuntimeError(
            f"SessionClient is not a BrowserWebSocketHandler! ({session_client})"
        )

    return {key: value.value for key, value in session_client.request.cookies.items()}
