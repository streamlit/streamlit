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

"""Platform module."""

from __future__ import annotations

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx


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
