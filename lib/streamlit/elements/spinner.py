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
from typing import TYPE_CHECKING, Any, Final, cast

from streamlit.elements.lib.layout_utils import create_layout_config
from streamlit.errors import NoSessionContext
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.proto.Spinner_pb2 import Spinner as SpinnerProto
from streamlit.runtime.scriptrunner import add_script_run_ctx, enqueue_message
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    from collections.abc import Iterator
    from types import TracebackType

    from typing_extensions import Self

    from streamlit.delta_generator import DeltaGenerator, ForwardMsgCreator
    from streamlit.elements.lib.layout_utils import Width

# Set the message 0.5 seconds in the future to avoid annoying
# flickering if this spinner runs too quickly.
DELAY_SECS: Final = 0.5


def _create_spinner_transients(
    dg: DeltaGenerator,
    text: str,
    *,
    show_time: bool,
    cache: bool,
    width: Width,
) -> tuple[ForwardMsgCreator, ForwardMsgCreator]:
    """Create the (create, clear) transient factories for a spinner element.

    Raises ``NoSessionContext`` when called outside of a script thread.
    """
    spinner_proto = SpinnerProto()
    spinner_proto.text = clean_text(text)
    spinner_proto.cache = cache
    spinner_proto.show_time = show_time

    element_proto = ElementProto()
    element_proto.spinner.CopyFrom(spinner_proto)

    layout_config = create_layout_config(width=width, allow_content_width=True)
    return dg._transient(element_proto, layout_config=layout_config)


class SpinnerPlaceholder:
    """A placeholder for a loading spinner returned by ``st.spinner``.

    A ``SpinnerPlaceholder`` can be used in two ways:

    - **Standalone placeholder** (like ``st.empty``): The spinner is displayed
      immediately and remains visible until it is replaced. Call any ``st.*``
      method on the placeholder (e.g. ``placeholder.success(...)``) to replace
      the spinner with that content, or call ``placeholder.empty()`` to clear
      it.
    - **Context manager** (the classic ``st.spinner`` behavior): Use the
      returned object in a ``with`` block. The spinner is shown (after a short
      delay) while the block runs and is automatically cleared on exit.

    You typically don't instantiate this class directly; it is returned by
    ``st.spinner``.
    """

    def __init__(
        self,
        *,
        parent_dg: DeltaGenerator,
        create_transient: ForwardMsgCreator | None,
        clear_transient: ForwardMsgCreator | None,
    ) -> None:
        self._parent_dg = parent_dg
        self._create_transient = create_transient
        self._clear_transient = clear_transient
        # Guards the spinner's display state so the delay timer and the main
        # thread don't enqueue conflicting messages.
        self._lock = threading.Lock()
        # Whether the (timer-driven) spinner should still be (re)displayed.
        self._show_spinner = True
        # Whether the spinner transient is currently enqueued/displayed.
        self._displayed = create_transient is not None
        self._timer: threading.Timer | None = None
        # The single-element container that replaces the spinner in standalone
        # mode. Created lazily on the first replacement.
        self._content_dg: DeltaGenerator | None = None

    def _clear(self) -> None:
        """Clear the displayed spinner transient (idempotent and thread-safe)."""
        with self._lock:
            self._show_spinner = False
            if self._displayed and self._clear_transient is not None:
                enqueue_message(self._clear_transient())
                self._displayed = False

    def __getattr__(self, name: str) -> Any:
        # Delegate display methods (e.g. .success, .write, .markdown, .empty) to
        # a single-element container, enabling the standalone-placeholder usage:
        # ``placeholder.dataframe(...)`` replaces the spinner with content.
        from streamlit.delta_generator import DeltaGenerator

        # Only treat real DeltaGenerator attributes as replacements. This avoids
        # accidentally clearing the spinner on incidental access (e.g. ``hasattr``
        # checks, debuggers, or typos), which would otherwise silently destroy it.
        if name.startswith("_") or not hasattr(DeltaGenerator, name):
            raise AttributeError(name)
        if self._content_dg is None:
            # Replacing the spinner: clear it and reserve a single-element
            # container at the spinner's position to hold the new content.
            self._clear()
            self._content_dg = self._parent_dg.empty()
        return getattr(self._content_dg, name)

    def __enter__(self) -> Self:
        # When used as a context manager, hide the immediately-displayed
        # standalone spinner and re-show it after a short delay. This restores
        # the classic ``st.spinner`` anti-flicker behavior (no spinner is shown
        # for blocks that finish within ``DELAY_SECS``).
        if self._create_transient is None or self._clear_transient is None:
            # We are not in a script thread; behave as a no-op context manager.
            return self

        # Hide the immediately-shown standalone spinner; the timer below re-shows
        # it after the delay.
        self._clear()
        with self._lock:
            self._show_spinner = True

        def set_message() -> None:
            with self._lock:
                if self._show_spinner and self._create_transient is not None:
                    enqueue_message(self._create_transient())
                    self._displayed = True

        self._timer = threading.Timer(DELAY_SECS, set_message)
        add_script_run_ctx(self._timer)
        self._timer.start()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        if self._timer is not None:
            self._timer.cancel()
        self._clear()


class SpinnerMixin:
    def spinner(
        self,
        text: str = "In progress...",
        *,
        show_time: bool = False,
        _cache: bool = False,
        width: Width = "content",
    ) -> SpinnerPlaceholder:
        """Display a loading spinner.

        ``st.spinner`` can be used in two ways:

        1. **As a context manager** (``with st.spinner(...):``): The spinner is
           shown while the code block executes and is automatically cleared when
           the block finishes. To avoid flickering for fast operations, the
           spinner only appears after a short delay.

        2. **As a standalone placeholder** (similar to ``st.empty``): The spinner
           is displayed immediately and remains visible until you replace it. Call
           any ``st.*`` method on the returned object (e.g.
           ``placeholder.success(...)``) to replace the spinner with content, or
           call ``placeholder.empty()`` to clear it.

           .. note::
              Replace the spinner before adding other elements after it. Unlike
              ``st.empty``, a standalone spinner does not reserve a layout slot,
              so the replacement content is inserted at the position where you
              call the replacement method.

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

        Returns
        -------
        SpinnerPlaceholder
            A placeholder for the spinner. Use it in a ``with`` block to show the
            spinner while the block runs, or call display methods on it (e.g.
            ``placeholder.success(...)``) to replace the spinner with content.

        Examples
        --------
        Use ``st.spinner`` as a context manager to show a spinner while a block
        of code runs:

        >>> import streamlit as st
        >>> import time
        >>>
        >>> with st.spinner("Wait for it...", show_time=True):
        >>>     time.sleep(5)
        >>> st.success("Done!")
        >>> st.button("Rerun")

        Use ``st.spinner`` as a standalone placeholder that you replace once your
        data is ready:

        >>> import streamlit as st
        >>> import time
        >>>
        >>> placeholder = st.spinner("Loading data...")
        >>> time.sleep(5)  # Simulate a slow computation.
        >>> placeholder.success("Data loaded!")

        .. output::
            https://doc-spinner.streamlit.app/
            height: 210px

        """
        # Set up the transient spinner. We intentionally do not enqueue a normal
        # (persistent) element: that would reserve a layout slot and leave a
        # leftover placeholder when used as a context manager, breaking element
        # identity for elements rendered after the spinner.
        try:
            create_transient, clear_transient = _create_spinner_transients(
                self.dg, text, show_time=show_time, cache=_cache, width=width
            )
        except NoSessionContext:
            # Not in a script thread; return a no-op placeholder.
            return SpinnerPlaceholder(
                parent_dg=self.dg,
                create_transient=None,
                clear_transient=None,
            )

        # Display the spinner immediately. This powers the standalone-placeholder
        # usage (the spinner must be visible during the work that follows the
        # call). Because Python evaluates ``st.spinner(...)`` before it knows
        # whether a ``with`` block follows, we always show it eagerly; when used
        # as a context manager, ``__enter__`` immediately hides it (synchronously,
        # before the block body runs) and re-shows it after the usual short delay,
        # preserving the anti-flicker behavior for fast blocks.
        enqueue_message(create_transient())

        return SpinnerPlaceholder(
            parent_dg=self.dg,
            create_transient=create_transient,
            clear_transient=clear_transient,
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


@contextlib.contextmanager
def show_spinner(
    dg: DeltaGenerator,
    text: str = "In progress...",
    *,
    show_time: bool = False,
    cache: bool = False,
    width: Width = "content",
) -> Iterator[None]:
    """Show a transient spinner while a block of code runs (internal helper).

    This implements the classic ``st.spinner`` context-manager behavior: the
    spinner appears after a short delay (to avoid flickering for fast operations)
    and is automatically cleared on exit. It never displays a persistent,
    replaceable element. It is used internally where the dual-mode placeholder
    behavior of ``st.spinner`` is undesirable (e.g. the spinner shown during
    cache misses).
    """
    try:
        create_transient, clear_transient = _create_spinner_transients(
            dg, text, show_time=show_time, cache=cache, width=width
        )
    except NoSessionContext:
        # Not in a script thread, so just yield and return.
        yield
        return

    display_message = True
    display_message_lock = threading.Lock()
    timer: threading.Timer | None = None
    try:

        def set_message() -> None:
            with display_message_lock:
                if display_message:
                    enqueue_message(create_transient())

        timer = threading.Timer(DELAY_SECS, set_message)
        add_script_run_ctx(timer)
        timer.start()
        yield
    finally:
        if timer:
            timer.cancel()
        with display_message_lock:
            display_message = False
            enqueue_message(clear_transient())
