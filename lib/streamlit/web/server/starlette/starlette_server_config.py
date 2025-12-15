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

"""Configuration for the Starlette server."""

from __future__ import annotations

from typing import Final

USER_COOKIE_NAME: Final = "_streamlit_user"
XSRF_COOKIE_NAME: Final = "_streamlit_xsrf"
SESSION_COOKIE_NAME: Final = "_streamlit_session"

# Max pending messages per client in the send queue before disconnecting.
# Each connected client has its own queue; under normal conditions the queue drains
# continuously and rarely exceeds single digits. This limit protects against slow
# clients (bad network, paused tabs) causing unbounded server memory growth.
# With N concurrent users, worst case memory is N * _MAX_SEND_QUEUE_SIZE * msg_size.
WEBSOCKET_MAX_SEND_QUEUE_SIZE: Final = 500

# Gzip middleware configuration:
# Do not GZip responses that are smaller than this minimum size in bytes:
GZIP_MINIMUM_SIZE: Final = 500
# Used during GZip compression. It is an integer ranging from 1 to 9.
# Lower value results in faster compression but larger file sizes, while higher value
# results in slower compression but smaller file sizes.
GZIP_COMPRESSLEVEL: Final = 6
