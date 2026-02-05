# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
import threading
from typing import TYPE_CHECKING, Final, cast

from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    Width,
    validate_width,
)
from streamlit.errors import NoSessionContext
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.proto.Spinner_pb2 import Spinner as SpinnerProto
from streamlit.runtime.scriptrunner import add_script_run_ctx, enqueue_message
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    from collections.abc import Iterator

    from streamlit.delta_generator import DeltaGenerator

# Set the message 0.5 seconds in the future to avoid annoying
# flickering if this spinner runs too quickly.
DELAY_SECS: Final = 0.5


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

        .. output::
            https://doc-spinner.streamlit.app/
            height: 210px

        """
        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)

        spinner_proto = SpinnerProto()
        spinner_proto.text = clean_text(text)
        spinner_proto.cache = _cache
        spinner_proto.show_time = show_time
        element_proto = ElementProto()
        element_proto.spinner.CopyFrom(spinner_proto)

        # Ensure we are targeting the correct DeltaGenerator
        # even though we will wait to enqueue the message
        try:
            create_transient, clear_transient = self.dg._transient(
                element_proto,
                layout_config=layout_config,
            )
        except NoSessionContext:
            # Means we are not in a script thread, so we will just yield and return
            yield
            return

        display_message = True
        display_message_lock = threading.Lock()
        timer: threading.Timer | None = None
        try:

            def set_message() -> None:
                with display_message_lock:
                    if display_message:
                        # Ignore the DeltaGenerator conveniences because Transients are special
                        enqueue_message(create_transient())

            timer = threading.Timer(DELAY_SECS, set_message)
            add_script_run_ctx(timer)
            timer.start()
            # Yield control back to the context.
            yield
        finally:
            if timer:
                timer.cancel()
            with display_message_lock:
                display_message = False

                enqueue_message(clear_transient())

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
