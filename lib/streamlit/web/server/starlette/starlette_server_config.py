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

"""Configuration for the Starlette server."""

from __future__ import annotations

from typing import Final

# Cookie name for storing signed user identity information.
USER_COOKIE_NAME: Final = "_streamlit_user"
# Cookie name for storing signed OAuth tokens (access_token, id_token).
TOKENS_COOKIE_NAME: Final = "_streamlit_user_tokens"
# Cookie name for Cross-Site Request Forgery (XSRF) token validation.
XSRF_COOKIE_NAME: Final = "_streamlit_xsrf"
# Cookie name for server-side session management.
SESSION_COOKIE_NAME: Final = "_streamlit_session"

# Max pending messages per client in the send queue before disconnecting.
# Each connected client has its own queue; under normal conditions the queue drains
# continuously and rarely exceeds single digits. This limit protects against slow
# clients (bad network, paused tabs) causing unbounded server memory growth.
# With N concurrent users, worst case memory is N * WEBSOCKET_MAX_SEND_QUEUE_SIZE * msg_size.
WEBSOCKET_MAX_SEND_QUEUE_SIZE: Final = 500

# Gzip middleware configuration:
# Do not GZip responses that are smaller than this minimum size in bytes:
GZIP_MINIMUM_SIZE: Final = 500
# Used during GZip compression. It is an integer ranging from 1 to 9.
# Lower value results in faster compression but larger file sizes, while higher value
# results in slower compression but smaller file sizes.
GZIP_COMPRESSLEVEL: Final = 6

# When server.port is not available it will look for the next available port
# up to this number of retries.
MAX_PORT_SEARCH_RETRIES: Final = 100

# Default address to bind to when no address is configured:
DEFAULT_SERVER_ADDRESS: Final = "0.0.0.0"  # noqa: S104

# Default WebSocket ping interval in seconds, can be configured by the user
DEFAULT_WEBSOCKET_PING_INTERVAL: Final = 30
# Default WebSocket ping timeout in seconds, can be configured by the user
DEFAULT_WEBSOCKET_PING_TIMEOUT: Final = 30
