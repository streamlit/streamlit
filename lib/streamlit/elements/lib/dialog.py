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

from __future__ import annotations

from typing import TYPE_CHECKING, Literal, TypeAlias, cast

from typing_extensions import Self

from streamlit.delta_generator import DeltaGenerator
from streamlit.elements.lib.utils import compute_and_register_element_id
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    enqueue_message,
    get_script_run_ctx,
)
from streamlit.runtime.state import register_widget

if TYPE_CHECKING:
    from types import TracebackType

    from streamlit.cursor import Cursor
    from streamlit.runtime.state import WidgetCallback

DialogWidth: TypeAlias = Literal["small", "large", "medium"]


def _process_dialog_width_input(
    width: DialogWidth,
) -> BlockProto.Dialog.DialogWidth.ValueType:
    """Maps the user-provided literal to a value of the DialogWidth proto enum.

    Returns the mapped enum field for "small" by default and otherwise the mapped type.
    """
    if width == "large":
        return BlockProto.Dialog.DialogWidth.LARGE
    if width == "medium":
        return BlockProto.Dialog.DialogWidth.MEDIUM

    return BlockProto.Dialog.DialogWidth.SMALL


def _assert_first_dialog_to_be_opened(should_open: bool) -> None:
    """Check whether a dialog has already been opened in the same script run.

    Only one dialog is supposed to be opened. The check is implemented in a way
    that for a script run, the open function can only be called once.
    One dialog at a time is a product decision and not a technical one.

    Raises
    ------
    StreamlitAPIException
        Raised when a dialog has already been opened in the current script run.
    """
    script_run_ctx = get_script_run_ctx()
    # We don't reset the ctx.has_dialog_opened when the flag is False because
    # it is reset in a new scriptrun anyways. If the execution model ever changes,
    # this might need to change.
    if should_open and script_run_ctx:
        if script_run_ctx.has_dialog_opened:
            raise StreamlitAPIException(
                "Only one dialog is allowed to be opened at the same time. "
                "Please make sure to not call a dialog-decorated function more than once in a script run."
            )
        script_run_ctx.has_dialog_opened = True


class Dialog(DeltaGenerator):
    @staticmethod
    def _create(
        parent: DeltaGenerator,
        title: str,
        *,
        dismissible: bool = True,
        width: DialogWidth = "small",
        on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
    ) -> Dialog:
        # Validation for on_dismiss parameter
        if on_dismiss not in ["ignore", "rerun"] and not callable(on_dismiss):
            raise StreamlitAPIException(
                f"You have passed {on_dismiss} to `on_dismiss`. But only 'ignore', "
                "'rerun', or a callable is supported."
            )

        block_proto = BlockProto()
        block_proto.dialog.title = title
        block_proto.dialog.dismissible = dismissible
        block_proto.dialog.width = _process_dialog_width_input(width)

        # Handle on_dismiss functionality
        is_dismiss_activated = on_dismiss != "ignore"
        element_id = None

        if is_dismiss_activated:
            # Register as widget when on_dismiss is activated

            ctx = get_script_run_ctx()

            element_id = compute_and_register_element_id(
                "dialog",
                user_key=None,
                key_as_main_identity=False,
                dg=parent,
                title=title,
                dismissible=dismissible,
                width=width,
                on_dismiss=str(on_dismiss) if not callable(on_dismiss) else "callback",
            )
            block_proto.dialog.id = element_id

            register_widget(
                element_id,
                on_change_handler=on_dismiss if callable(on_dismiss) else None,
                deserializer=lambda x: x,  # Simple passthrough for trigger values
                serializer=lambda x: x,  # Simple passthrough for trigger values
                ctx=ctx,
                value_type="trigger_value",
            )

        # We store the delta path here, because in _update we enqueue a new proto
        # message to update the open status. Without this, the dialog content is gone
        # when the _update message is sent
        delta_path: list[int] = (
            parent._active_dg._cursor.delta_path if parent._active_dg._cursor else []
        )
        dialog = cast("Dialog", parent._block(block_proto=block_proto, dg_type=Dialog))

        dialog._delta_path = delta_path
        dialog._current_proto = block_proto

        return dialog

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ) -> None:
        super().__init__(root_container, cursor, parent, block_type)

        # Initialized in `_create()`:
        self._current_proto: BlockProto | None = None
        self._delta_path: list[int] | None = None

    def _update(self, should_open: bool) -> None:
        """Send an updated proto message to indicate the open-status for the dialog."""

        if self._current_proto is None or self._delta_path is None:
            raise RuntimeError(
                "Dialog not correctly initialized. This should never happen."
            )

        _assert_first_dialog_to_be_opened(should_open)
        msg = ForwardMsg()
        msg.metadata.delta_path[:] = self._delta_path
        msg.delta.add_block.CopyFrom(self._current_proto)
        msg.delta.add_block.dialog.is_open = should_open
        self._current_proto = msg.delta.add_block

        enqueue_message(msg)

    def open(self) -> None:
        self._update(True)

    def close(self) -> None:
        self._update(False)

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
        return super().__exit__(exc_type, exc_val, exc_tb)
