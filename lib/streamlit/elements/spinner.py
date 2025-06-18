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
import threading
from typing import TYPE_CHECKING, Final

import streamlit as st
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    Width,
    validate_width,
)
from streamlit.runtime.scriptrunner import add_script_run_ctx

if TYPE_CHECKING:
    from collections.abc import Iterator

# Set the message 0.5 seconds in the future to avoid annoying
# flickering if this spinner runs too quickly.
DELAY_SECS: Final = 0.5


@contextlib.contextmanager
def spinner(
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
    from streamlit.proto.Spinner_pb2 import Spinner as SpinnerProto
    from streamlit.string_util import clean_text

    validate_width(width, allow_content=True)
    layout_config = LayoutConfig(width=width)

    message = st.empty()

    display_message = True
    display_message_lock = threading.Lock()

    try:

        def set_message() -> None:
            with display_message_lock:
                if display_message:
                    spinner_proto = SpinnerProto()
                    spinner_proto.text = clean_text(text)
                    spinner_proto.cache = _cache
                    spinner_proto.show_time = show_time
                    message._enqueue(
                        "spinner", spinner_proto, layout_config=layout_config
                    )

        add_script_run_ctx(threading.Timer(DELAY_SECS, set_message)).start()

        # Yield control back to the context.
        yield
    finally:
        if display_message_lock:
            with display_message_lock:
                display_message = False
            if "chat_message" in set(message._active_dg._ancestor_block_types):
                # Temporary stale element fix:
                # For chat messages, we are resetting the spinner placeholder to an
                # empty container instead of an empty placeholder (st.empty) to have
                # it removed from the delta path. Empty containers are ignored in the
                # frontend since they are configured with allow_empty=False. This
                # prevents issues with stale elements caused by the spinner being
                # rendered only in some situations (e.g. for caching).
                message.container()
            else:
                message.empty()
