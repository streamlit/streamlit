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

from streamlit.deprecation_util import deprecate_func_name
from streamlit.platform import get_websocket_headers
from streamlit.runtime.metrics_util import gather_metrics

_get_websocket_headers = deprecate_func_name(
    gather_metrics("_get_websocket_headers", get_websocket_headers),
    "_get_websocket_headers",
    "2024-06-01",
    name_override="platform.get_websocket_headers",
)
