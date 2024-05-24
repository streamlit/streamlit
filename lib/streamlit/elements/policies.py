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

from typing import TYPE_CHECKING

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.scriptrunner import get_script_run_ctx

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


_fragment_writes_widget_to_outside_error = (
    "Fragments cannot write to elements outside of their container."
)


def check_fragment_path_policy(dg: DeltaGenerator):
    ctx = get_script_run_ctx()
    # Check is only relevant for fragments
    if ctx is None or ctx.current_fragment_id is None:
        return

    current_fragment_delta_path = ctx.current_fragment_delta_path
    current_cursor = dg._active_dg._cursor
    if current_cursor is None:
        return

    current_cursor_delta_path = current_cursor.delta_path

    # the elements delta path cannot be smaller than the fragment's delta path if it is inside of the fragment
    if len(current_cursor_delta_path) < len(current_fragment_delta_path):
        raise StreamlitAPIException(_fragment_writes_widget_to_outside_error)

    # all path indices of the fragment-path must occur in the inner-elements delta path, otherwise it is outside of the fragment container
    for index, path_index in enumerate(current_fragment_delta_path):
        if current_cursor_delta_path[index] != path_index:
            raise StreamlitAPIException(_fragment_writes_widget_to_outside_error)
