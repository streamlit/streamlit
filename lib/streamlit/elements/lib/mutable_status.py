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

from contextlib import contextmanager
from typing import Any, Generator, List, cast

from typing_extensions import Literal, TypeAlias

from streamlit.cursor import Cursor
from streamlit.delta_generator import DeltaGenerator, _enqueue_message
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

States: TypeAlias = Literal["running", "complete", "error"]


class MutableStatus(DeltaGenerator):
    @staticmethod
    @contextmanager
    def _create(
        parent: DeltaGenerator,
        label: str,
        expanded: bool = False,
        state: States = "running",
    ) -> Generator[MutableStatus, None, MutableStatus]:
        expandable_proto = BlockProto.Expandable()
        expandable_proto.expanded = expanded
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

        delta_path: List[int] = parent._cursor.delta_path if parent._cursor else []

        status_container = cast(
            MutableStatus,
            parent._block(block_proto=block_proto, dg_type=MutableStatus),
        )

        status_container._delta_path = delta_path
        status_container._last_proto = block_proto
        status_container._last_state = state

        with status_container:
            try:
                yield status_container
            except Exception as ex:
                status_container.update(state="error")
                raise ex
        return status_container

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ):
        super().__init__(root_container, cursor, parent, block_type)

        # Initialized in `create()`:
        self._last_proto: BlockProto | None = None
        self._last_state: States | None = None
        self._delta_path: List[int] | None = None

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
        msg.delta.add_block.expandable.ClearField("expanded")

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
        self._last_proto = msg.delta.add_block
        _enqueue_message(msg)

    def __enter__(self) -> MutableStatus:  # type: ignore[override]
        # This is a little dubious: we're returning a different type than
        # our superclass' `__enter__` function. Maybe DeltaGenerator.__enter__
        # should always return `self`?
        super().__enter__()
        if self._last_state != "running":
            self.update(state="running")
        return self

    def __exit__(self, type: Any, value: Any, traceback: Any) -> Literal[False]:
        # If last state is error, we don't want to auto-update to complete
        if self._last_state != "error":
            self.update(state="complete")
        return super().__exit__(type, value, traceback)
