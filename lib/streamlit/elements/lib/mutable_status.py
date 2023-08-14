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

import time
from types import TracebackType
from typing import Any, List, Optional, Type, cast

from typing_extensions import Literal, TypeAlias

from streamlit.cursor import Cursor
from streamlit.delta_generator import DeltaGenerator, _enqueue_message
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

States: TypeAlias = Literal["running", "complete", "error"]


class MutableStatus(DeltaGenerator):
    # @contextmanager
    @staticmethod
    def _create(
        parent: DeltaGenerator,
        label: str,
        expanded: bool | Literal["auto"] = False,
        state: States = "running",
    ) -> MutableStatus:
        # -> Generator[MutableStatus, None, MutableStatus]:
        expandable_proto = BlockProto.Expandable()
        expandable_proto.expanded = True if expanded == "auto" else expanded
        expandable_proto.label = label or ""

        if state == "running":
            expandable_proto.icon = "spinner"
        elif state == "complete":
            expandable_proto.icon = "check"
        elif state == "error":
            expandable_proto.icon = "error"

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.expandable.CopyFrom(expandable_proto)

        # TODO(lukasmasuch): Check if this is the correct delta path even when it's nested.
        delta_path: List[int] = (
            parent._active_dg._cursor.delta_path if parent._active_dg._cursor else []
        )

        status_container = cast(
            MutableStatus,
            parent._block(block_proto=block_proto, dg_type=MutableStatus),
        )

        status_container._delta_path = delta_path
        status_container._last_proto = block_proto
        status_container._last_state = state
        if expanded == "auto":
            status_container._auto_collapse = True

        # TODO: We cannot use this since it won't support the usage without context manager:
        # with status_container:
        #     try:
        #         yield status_container
        #     except Exception as ex:
        #         status_container.update(state="error")
        #         raise ex
        return status_container

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ):
        super().__init__(root_container, cursor, parent, block_type)

        # Initialized in `_create()`:
        self._last_proto: BlockProto | None = None
        self._last_state: States | None = None
        self._delta_path: List[int] | None = None
        self._auto_collapse: bool = False

    def update(
        self,
        *,
        label: str | None = None,
        state: States | None = None,
        expanded: bool | None = None,
    ) -> None:
        assert self._last_proto is not None, "Status not correctly initialized!"
        assert self._delta_path is not None, "Status not correctly initialized!"

        msg = ForwardMsg()
        msg.metadata.delta_path[:] = self._delta_path
        msg.delta.add_block.CopyFrom(self._last_proto)

        if expanded is not None:
            msg.delta.add_block.expandable.expanded = expanded

        if label is not None:
            msg.delta.add_block.expandable.label = label

        if state is not None:
            if state == "running":
                msg.delta.add_block.expandable.icon = "spinner"
            elif state == "complete":
                msg.delta.add_block.expandable.icon = "check"
            elif state == "error":
                msg.delta.add_block.expandable.icon = "error"
            self._last_state = state

        self._last_proto = ForwardMsg().delta.add_block
        self._last_proto.CopyFrom(msg.delta.add_block)

        if expanded is None:
            msg.delta.add_block.expandable.ClearField("expanded")

        _enqueue_message(msg)

    def __enter__(self) -> MutableStatus:  # type: ignore[override]
        # This is a little dubious: we're returning a different type than
        # our superclass' `__enter__` function. Maybe DeltaGenerator.__enter__
        # should always return `self`?
        super().__enter__()
        if self._last_state != "running":
            self.update(state="running")
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> Literal[False]:
        # If last state is error, we don't want to auto-update to complete
        if self._last_state not in ["error", "complete"]:
            # We need to sleep here for a very short time to prevent issues when
            # the status is updated too quickly. If an .update() is directly followed
            # by the exit of the context manager, sometimes only the last update
            # (to complete) is applied. Adding a short timeout here allows the frontend
            # to render the update before.
            time.sleep(0.1)
            if exc_type is not None:
                # If an exception was raised in the context,
                # we want to update the status to error.
                self.update(state="error")
            else:
                self.update(
                    state="complete", expanded=False if self._auto_collapse else None
                )
        return super().__exit__(exc_type, exc_val, exc_tb)
