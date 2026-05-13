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

"""Skeleton placeholder implementation with delayed context manager support."""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING, Final, Literal

from typing_extensions import Self

from streamlit.errors import NoSessionContext
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.runtime.scriptrunner import add_script_run_ctx, enqueue_message

if TYPE_CHECKING:
    from collections.abc import Callable
    from types import TracebackType

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import LayoutConfig
    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
    from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto

_DELAY_SECS: Final = 0.5
"""Delay before showing skeleton in context manager mode (same as spinner)."""


class SkeletonPlaceholder:
    """A placeholder that displays a skeleton loading animation.

    This class wraps a ``DeltaGenerator`` and can be used in two modes:

    **Standalone mode**: The skeleton is shown immediately when created.
    Call methods like ``.write()``, ``.dataframe()``, etc. to replace it with content.

    **Context manager mode**: Uses a 0.5s delay before showing (like ``st.spinner``).
    If the block completes within 0.5s, no skeleton is shown. Auto-clears on exit.
    """

    def __init__(
        self,
        parent: DeltaGenerator,
        skeleton_proto: SkeletonProto,
        layout_config: LayoutConfig | None,
    ) -> None:
        """Initialize the skeleton placeholder.

        In standalone mode, the skeleton is shown immediately when accessed.
        In context manager mode, we defer showing until after a 0.5s delay.
        """
        self._parent = parent
        self._skeleton_proto = skeleton_proto
        self._layout_config = layout_config

        # State tracking
        self._in_context_manager = False
        self._timer: threading.Timer | None = None
        self._display_lock = threading.Lock()
        self._should_display = True

        # Transient element functions (set in __enter__ for context manager mode)
        self._create_transient: Callable[[], ForwardMsg] | None = None
        self._clear_transient: Callable[[], ForwardMsg] | None = None

        # Lazily created DeltaGenerator for standalone mode
        self._dg: DeltaGenerator | None = None

    def _ensure_enqueued(self) -> DeltaGenerator:
        """Ensure the skeleton is enqueued for standalone mode, return DeltaGenerator."""
        if self._dg is None:
            self._dg = self._parent._enqueue(
                "skeleton",
                self._skeleton_proto,
                layout_config=self._layout_config,
            )
        return self._dg

    @staticmethod
    def _create(
        parent: DeltaGenerator,
        skeleton_proto: SkeletonProto,
        layout_config: LayoutConfig | None,
    ) -> SkeletonPlaceholder:
        """Create a skeleton placeholder (factory method for singleton compatibility)."""
        return SkeletonPlaceholder(parent, skeleton_proto, layout_config)

    def __getattr__(self, name: str) -> object:
        # Skip internal attributes
        if name.startswith("_"):
            raise AttributeError(
                f"'{type(self).__name__}' object has no attribute '{name}'"
            )
        # Standalone mode: ensure skeleton is enqueued, then delegate to DeltaGenerator
        # This lazy enqueue avoids flashing the skeleton when used as context manager
        return getattr(self._ensure_enqueued(), name)

    def __dir__(self) -> list[str]:
        """Return DeltaGenerator methods for IDE autocompletion."""
        from streamlit.delta_generator import DeltaGenerator

        return dir(DeltaGenerator)

    def __enter__(self) -> Self:
        """Enter context manager mode with 0.5s delay before showing skeleton.

        In context manager mode, we don't show the skeleton immediately.
        Instead, we use transient elements with a delay (like st.spinner).

        Raises
        ------
        RuntimeError
            If the placeholder was already used in standalone mode (via method calls
            like `placeholder.write()`) before entering context manager mode.
        """
        from streamlit.proto.Empty_pb2 import Empty as EmptyProto

        # Disallow mixing standalone and context-manager modes.
        # If _dg is set, the placeholder was already used in standalone mode.
        if self._dg is not None:
            raise RuntimeError(
                "Cannot use st.skeleton() as a context manager after calling methods "
                "on it (like .write(), .dataframe(), etc.). Use either standalone mode "
                "OR context manager mode, not both."
            )

        with self._display_lock:
            self._in_context_manager = True

        # Reserve a slot by enqueuing an empty element (no flash).
        # The skeleton will be shown via transient after the delay.
        empty_proto = EmptyProto()
        self._dg = self._parent._enqueue(
            "empty", empty_proto, layout_config=self._layout_config
        )

        # Build the element proto for transient use
        element_proto = ElementProto()
        element_proto.skeleton.CopyFrom(self._skeleton_proto)

        # Set up transient element with delay (like st.spinner)
        # Use self._dg (not self._parent) to anchor the transient at the skeleton's slot.
        # _enqueue already advanced the parent's cursor past the skeleton's position,
        # so calling _transient on self._dg ensures the delayed skeleton renders correctly.
        try:
            self._create_transient, self._clear_transient = self._dg._transient(
                element_proto,
                layout_config=self._layout_config,
            )
        except NoSessionContext:
            # Not in a script thread - just return without showing anything
            return self

        def show_skeleton() -> None:
            with self._display_lock:
                if self._should_display and self._create_transient is not None:
                    enqueue_message(self._create_transient())

        # Start timer to show skeleton after delay
        self._timer = threading.Timer(_DELAY_SECS, show_skeleton)
        add_script_run_ctx(self._timer)
        self._timer.start()

        return self

    def __exit__(
        self,
        typ: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> Literal[False]:
        """Exit context manager, clearing the skeleton."""
        # __exit__ is only called when used as a context manager,
        # and __enter__ always sets _in_context_manager = True.
        # This check guards against programming errors.
        if not self._in_context_manager:  # pragma: no cover - defensive
            raise RuntimeError("__exit__ called without __enter__")

        # Cancel timer if still pending
        if self._timer is not None:
            self._timer.cancel()

        with self._display_lock:
            self._should_display = False

        # Clear the transient element
        if self._clear_transient is not None:
            enqueue_message(self._clear_transient())

        return False
