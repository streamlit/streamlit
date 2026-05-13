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
from typing import TYPE_CHECKING, Any, Final, Literal

from typing_extensions import Self

from streamlit.errors import NoSessionContext
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.runtime.scriptrunner import add_script_run_ctx, enqueue_message

if TYPE_CHECKING:
    from types import TracebackType

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import LayoutConfig
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
        """Initialize the skeleton placeholder and show it immediately."""
        self._parent = parent
        self._skeleton_proto = skeleton_proto
        self._layout_config = layout_config

        # State tracking
        self._in_context_manager = False
        self._timer: threading.Timer | None = None
        self._display_lock = threading.Lock()
        self._should_display = True

        # Transient element functions (set in __enter__ for context manager mode)
        self._create_transient: Any = None
        self._clear_transient: Any = None

        # Show skeleton immediately (standalone mode)
        # This will be cleared and replaced with transient mode if used as context manager
        self._dg: DeltaGenerator = self._parent._enqueue(
            "skeleton",
            self._skeleton_proto,
            layout_config=self._layout_config,
        )

    @staticmethod
    def _create(
        parent: DeltaGenerator,
        skeleton_proto: SkeletonProto,
        layout_config: LayoutConfig | None,
    ) -> SkeletonPlaceholder:
        """Create a skeleton placeholder (factory method for singleton compatibility)."""
        return SkeletonPlaceholder(parent, skeleton_proto, layout_config)

    def __getattr__(self, name: str) -> Any:
        # Skip internal attributes
        if name.startswith("_"):
            raise AttributeError(
                f"'{type(self).__name__}' object has no attribute '{name}'"
            )
        # Delegate to the underlying DeltaGenerator
        return getattr(self._dg, name)

    def __dir__(self) -> list[str]:
        """Return DeltaGenerator methods for IDE autocompletion."""
        from streamlit.delta_generator import DeltaGenerator

        return dir(DeltaGenerator)

    def __enter__(self) -> Self:
        """Enter context manager mode with 0.5s delay before showing skeleton.

        The skeleton was shown immediately on creation (standalone mode).
        In context manager mode, we clear it and switch to transient mode
        with a 0.5s delay before showing.
        """
        with self._display_lock:
            self._in_context_manager = True

        # Clear the immediately-shown skeleton and switch to transient mode
        self._dg.empty()

        # Build the element proto for transient use
        element_proto = ElementProto()
        element_proto.skeleton.CopyFrom(self._skeleton_proto)

        # Set up transient element with delay (like st.spinner)
        try:
            self._create_transient, self._clear_transient = self._parent._transient(
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
        if self._in_context_manager:
            # Cancel timer if still pending
            if self._timer is not None:
                self._timer.cancel()

            with self._display_lock:
                self._should_display = False

            # Clear the transient element
            if self._clear_transient is not None:
                enqueue_message(self._clear_transient())

            return False

        # Standalone mode - clear with empty() and exit DG context
        if self._dg is not None:
            try:
                self._dg.empty()
            finally:
                self._dg.__exit__(typ, exc, tb)
        return False
