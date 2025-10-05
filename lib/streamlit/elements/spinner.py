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

import contextlib
import itertools
import threading
import uuid
from typing import TYPE_CHECKING, Final, cast

from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    Width,
    validate_width,
)
from streamlit.runtime.scriptrunner import add_script_run_ctx, enqueue_message

if TYPE_CHECKING:
    from collections.abc import Iterator

    from streamlit.cursor import LockedCursor
    from streamlit.delta_generator import DeltaGenerator

# Set the message 0.5 seconds in the future to avoid annoying
# flickering if this spinner runs too quickly.
DELAY_SECS: Final = 0.5


class OrderGate:
    def __init__(self, dg_cursor: LockedCursor):
        self._cond = threading.Condition()
        self._next_to_run = 0
        self._counter = itertools.count()
        self._dg_cursor = dg_cursor

    def ticket(self) -> int:
        return next(self._counter)

    def wait_turn_and_advance(self, my_seq: int) -> None:
        with self._cond:
            while my_seq != self._next_to_run:
                self._cond.wait()
            self._next_to_run += 1
            self._cond.notify_all()

    @property
    def dg_cursor(self) -> LockedCursor:
        return self._dg_cursor


# --- per-dg registry ---
_gate_registry_lock = threading.Lock()
_dg_gates: dict[tuple[int, ...], OrderGate] = {}


def get_gate_for_dg(dg_cursor: LockedCursor) -> OrderGate:
    # If your dg objects aren't weakref-able, fall back to a dict keyed by id(dg_obj),
    # plus a separate WeakValueDictionary to avoid leaks.
    with _gate_registry_lock:
        delta_path = tuple(dg_cursor.delta_path)
        gate = _dg_gates.get(delta_path)
        if gate is None:
            gate = OrderGate(dg_cursor)
            _dg_gates[delta_path] = gate
        return gate


class SpinnerMixin:
    @contextlib.contextmanager
    def spinner(
        self,
        text: str = "In progress...",
        *,
        show_time: bool = False,
        _cache: bool = False,
        width: Width = "content",
    ) -> Iterator[None]:
        """Display a loading spinner while executing a block of code.

        Parameters
        ----------
        text : str
            The text to display next to the spinner. This defaults to
            ``"In progress..."``.

            The text can optionally contain GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional, supported
            Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        show_time : bool
            Whether to show the elapsed time next to the spinner text. If this is
            ``False`` (default), no time is displayed. If this is ``True``,
            elapsed time is displayed with a precision of 0.1 seconds. The time
            format is not configurable.

        width : "content", "stretch", or int
            The width of the spinner element. This can be one of the following:

            - ``"content"`` (default): The width of the element matches the
            width of its content, but doesn't exceed the width of the parent
            container.
            - ``"stretch"``: The width of the element matches the width of the
            parent container.
            - An integer specifying the width in pixels: The element has a
            fixed width. If the specified width is greater than the width of
            the parent container, the width of the element matches the width
            of the parent container.

        Example
        -------
        >>> import streamlit as st
        >>> import time
        >>>
        >>> with st.spinner("Wait for it...", show_time=True):
        >>>     time.sleep(5)
        >>> st.success("Done!")
        >>> st.button("Rerun")

        .. output ::
            https://doc-spinner.streamlit.app/
            height: 210px

        """
        from streamlit.proto.Element_pb2 import Element as ElementProto
        from streamlit.proto.Spinner_pb2 import Spinner as SpinnerProto
        from streamlit.string_util import clean_text

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)

        transient_id = str(uuid.uuid4())
        spinner_proto = SpinnerProto()
        spinner_proto.text = clean_text(text)
        spinner_proto.cache = _cache
        spinner_proto.show_time = show_time
        element_proto = ElementProto()
        element_proto.spinner.CopyFrom(spinner_proto)

        active_dg = cast("DeltaGenerator", self._active_dg)
        transient_cursor = active_dg._cursor.get_transient_locked_cursor()
        gate = get_gate_for_dg(transient_cursor)
        my_seq = gate.ticket()

        # Ensure we are targeting the correct DeltaGenerator
        # even though we will wait to enqueue the message
        spinner_msg = self._transient(
            gate.dg_cursor,
            element_proto,
            layout_config=layout_config,
            add_transient_id=transient_id,
        )
        display_message = True
        display_message_lock = threading.Lock()

        try:

            def set_message() -> None:
                nonlocal spinner_msg, my_seq, gate
                # enforce FIFO among *only* the same current_dg
                gate.wait_turn_and_advance(my_seq)

                with display_message_lock:
                    if display_message:
                        # Ignore the DeltaGenerator conveniences because Transients are special
                        enqueue_message(spinner_msg)

            add_script_run_ctx(threading.Timer(DELAY_SECS, set_message)).start()

            # Yield control back to the context.
            yield
        finally:
            if display_message_lock:
                with display_message_lock:
                    display_message = False

                complete_msg = self._transient(
                    gate.dg_cursor,
                    element_proto,
                    layout_config=layout_config,
                    clear_transient_id=transient_id,
                )

                enqueue_message(complete_msg)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
