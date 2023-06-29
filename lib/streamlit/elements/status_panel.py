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

from __future__ import annotations

from typing import Any

import streamlit as st
from streamlit.cursor import LockedCursor
from streamlit.delta_generator import _enqueue_message
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


class StatusPanelStage:
    def __init__(self, label: str, expanded: bool = False):
        self._label = label
        self._expanded = expanded

        # Create our expander
        self._expander_dg = st.expander(label, expanded)

        # Determine our expander's cursor position so that we can mutate it later.
        # The cursor in the dg returned by `self._expander` points to the insert loc
        # of the first *child* of the expander, rather than the expander itself,
        # so we compute a new cursor with the expander's actual location.
        cursor = self._expander_dg._cursor
        self._expander_cursor = LockedCursor(
            root_container=cursor.root_container,
            parent_path=cursor.parent_path[:-1],
            index=cursor.parent_path[-1],
        )

    def update_label(self, label: str) -> None:
        """Update our expander's label."""
        if self._label == label:
            return

        self._label = label
        self._send_new_expander_proto()

    def _send_new_expander_proto(self) -> None:
        """Deliver an updated expander protobuf message to the frontend."""
        msg = ForwardMsg()
        msg.metadata.delta_path[:] = self._expander_cursor.delta_path
        msg.delta.add_block.allow_empty = True
        msg.delta.add_block.expandable.expanded = self._expanded
        msg.delta.add_block.expandable.label = self._label
        _enqueue_message(msg)

    def __enter__(self) -> StatusPanelStage:
        self._expander_dg.__enter__()
        return self

    def __exit__(self, type: Any, value: Any, traceback: Any) -> None:
        self._expander_dg.__exit__(type, value, traceback)
