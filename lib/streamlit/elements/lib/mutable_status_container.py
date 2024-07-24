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

import time
from typing import TYPE_CHECKING, Literal, cast

from typing_extensions import Self, TypeAlias

from streamlit.delta_generator import DeltaGenerator, _enqueue_message
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

if TYPE_CHECKING:
    from types import TracebackType

    from streamlit.cursor import Cursor

States: TypeAlias = Literal["running", "complete", "error"]


class StatusContainer(DeltaGenerator):
    @staticmethod
    def _create(
        parent: DeltaGenerator,
        label: str,
        expanded: bool = False,
        state: States = "running",
    ) -> StatusContainer:
        expandable_proto = BlockProto.Expandable()
        expandable_proto.expanded = expanded
        expandable_proto.label = label or ""

        if state == "running":
            expandable_proto.icon = "spinner"
        elif state == "complete":
            expandable_proto.icon = ":material/check:"
        elif state == "error":
            expandable_proto.icon = ":material/error:"
        else:
            raise StreamlitAPIException(
                f"Unknown state ({state}). Must be one of 'running', 'complete', or 'error'."
            )

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.expandable.CopyFrom(expandable_proto)

        delta_path: list[int] = (
            parent._active_dg._cursor.delta_path if parent._active_dg._cursor else []
        )

        status_container = cast(
            StatusContainer,
            parent._block(block_proto=block_proto, dg_type=StatusContainer),
        )

        # Apply initial configuration
        status_container._delta_path = delta_path
        status_container._current_proto = block_proto
        status_container._current_state = state

        # We need to sleep here for a very short time to prevent issues when
        # the status is updated too quickly. If an .update() directly follows the
        # the initialization, sometimes only the latest update is applied.
        # Adding a short timeout here allows the frontend to render the update before.
        time.sleep(0.05)

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
        self._current_proto: BlockProto | None = None
        self._current_state: States | None = None
        self._delta_path: list[int] | None = None

    def update(
        self,
        *,
        label: str | None = None,
        expanded: bool | None = None,
        state: States | None = None,
    ) -> None:
        """Update the status container.

        Only specified arguments are updated. Container contents and unspecified
        arguments remain unchanged.

        Parameters
        ----------
        label : str or None
            A new label of the status container. If None, the label is not
            changed.

        expanded : bool or None
            The new expanded state of the status container. If None,
            the expanded state is not changed.

        state : "running", "complete", "error", or None
            The new state of the status container. This mainly changes the
            icon. If None, the state is not changed.
        """
        assert self._current_proto is not None, "Status not correctly initialized!"
        assert self._delta_path is not None, "Status not correctly initialized!"

        msg = ForwardMsg()
        msg.metadata.delta_path[:] = self._delta_path
        msg.delta.add_block.CopyFrom(self._current_proto)

        if expanded is not None:
            msg.delta.add_block.expandable.expanded = expanded
        else:
            msg.delta.add_block.expandable.ClearField("expanded")

        if label is not None:
            msg.delta.add_block.expandable.label = label

        if state is not None:
            if state == "running":
                msg.delta.add_block.expandable.icon = "spinner"
            elif state == "complete":
                msg.delta.add_block.expandable.icon = ":material/check:"
            elif state == "error":
                msg.delta.add_block.expandable.icon = ":material/error:"
            else:
                raise StreamlitAPIException(
                    f"Unknown state ({state}). Must be one of 'running', 'complete', or 'error'."
                )
            self._current_state = state

        self._current_proto = msg.delta.add_block
        _enqueue_message(msg)

    def __enter__(self) -> Self:  # type: ignore[override]
        # This is a little dubious: we're returning a different type than
        # our superclass' `__enter__` function. Maybe DeltaGenerator.__enter__
        # should always return `self`?
        super().__enter__()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> Literal[False]:
        # Only update if the current state is running
        if self._current_state == "running":
            # We need to sleep here for a very short time to prevent issues when
            # the status is updated too quickly. If an .update() is directly followed
            # by the exit of the context manager, sometimes only the last update
            # (to complete) is applied. Adding a short timeout here allows the frontend
            # to render the update before.
            time.sleep(0.05)
            if exc_type is not None:
                # If an exception was raised in the context,
                # we want to update the status to error.
                self.update(state="error")
            else:
                self.update(state="complete")
        return super().__exit__(exc_type, exc_val, exc_tb)
