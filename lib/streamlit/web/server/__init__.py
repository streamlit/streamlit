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

from streamlit.web.server.server import Server, server_address_is_unix_socket
from streamlit.web.server.server_util import (
    allow_all_cross_origin_requests,
    is_allowed_origin,
)

__all__ = [
    "Server",
    "allow_all_cross_origin_requests",
    "is_allowed_origin",
    "server_address_is_unix_socket",
]
