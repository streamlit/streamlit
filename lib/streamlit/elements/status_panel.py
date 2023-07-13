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

from typing import Any, Literal, cast

from streamlit import runtime
from streamlit.cursor import Cursor, LockedCursor
from streamlit.delta_generator import DeltaGenerator, _enqueue_message
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

StatusPanelBehavior = Literal["autocollapse", "stay_open"]


class StatusPanel(DeltaGenerator):
    """A block DeltaGenerator with a special "stage" function."""

    @staticmethod
    def create(parent: DeltaGenerator, behavior: StatusPanelBehavior) -> StatusPanel:
        # This `create()` method is an ugly pattern we'll want to correct.
        # We can't just instantiate a new StatusPanel directly, because a bunch
        # of its creation logic lives inside the `DeltaGenerator._block()` function.
        # So StatusPanel gets instantiated by `_block()`, and then we
        # finish initializing its members below. (The same is true of StatusPanelStage,
        # below.)
        status_panel = cast(StatusPanel, parent._block(dg_type=StatusPanel))
        status_panel._behavior = behavior
        return status_panel

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ):
        super().__init__(root_container, cursor, parent, block_type)

        # Initialized in `create()`
        self._behavior: StatusPanelBehavior = "autocollapse"

    def stage(self, label: str) -> StatusPanelStage:
        return StatusPanelStage.create(self, label, self._behavior)


class StatusPanelStage(DeltaGenerator):
    """An expander DeltaGenerator with a mutable label and ExpandableState."""

    @staticmethod
    def create(
        parent: DeltaGenerator, label: str, behavior: StatusPanelBehavior
    ) -> StatusPanelStage:
        expandable_proto = BlockProto.Expandable()
        expandable_proto.state = BlockProto.Expandable.ExpandableState.EXPANDED
        expandable_proto.label = label

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.expandable.CopyFrom(expandable_proto)

        stage = cast(
            StatusPanelStage,
            parent._block(block_proto=block_proto, dg_type=StatusPanelStage),
        )
        stage._label = label
        stage._behavior = behavior
        return stage

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ):
        super().__init__(root_container, cursor, parent, block_type)

        # Determine our cursor position so that we can mutate it later.
        # The cursor in the dg returned by `self._cursor` points to the insert loc
        # of the first *child* of the expander, rather than the expander itself,
        # so we compute a new cursor with the expander's actual location.
        cursor = self._cursor
        if cursor is not None:
            self._locked_cursor = LockedCursor(
                root_container=cursor.root_container,
                parent_path=cursor.parent_path[:-1],
                index=cursor.parent_path[-1],
            )
        else:
            # Cursor should only be none if Streamlit is running in "raw" mode.
            assert not runtime.exists()
            self._locked_cursor = LockedCursor(0)

        self._expandable_state = BlockProto.Expandable.EXPANDED

        # These members are initialized with their proper values after
        # instantiation, in `create()`.
        self._label: str = ""
        self._behavior: StatusPanelBehavior = "autocollapse"

    def set_label(self, label: str) -> None:
        """Update our expander's label."""
        if self._label == label:
            return

        self._label = label
        self._send_new_expander_proto()

    def set_expandable_state(
        self, state: BlockProto.Expandable.ExpandableState.ValueType
    ) -> None:
        if self._expandable_state == state:
            return

        self._expandable_state = state
        self._send_new_expander_proto()

    def _send_new_expander_proto(self) -> None:
        """Deliver an updated expander protobuf message to the frontend."""
        msg = ForwardMsg()
        msg.metadata.delta_path[:] = self._locked_cursor.delta_path
        msg.delta.add_block.allow_empty = True
        msg.delta.add_block.expandable.state = self._expandable_state
        msg.delta.add_block.expandable.label = self._label
        _enqueue_message(msg)

    def __enter__(self) -> StatusPanelStage:  # type: ignore[override]
        # This is a little dubious: we're returning a different type than
        # our superclass' `__enter__` function. Maybe DeltaGenerator.__enter__
        # should always return `self`?
        super().__enter__()
        return self

    def __exit__(self, type: Any, value: Any, traceback: Any) -> Literal[False]:
        if self._behavior == "autocollapse":
            self.set_expandable_state(BlockProto.Expandable.AUTO_COLLAPSED)
        return super().__exit__(type, value, traceback)
