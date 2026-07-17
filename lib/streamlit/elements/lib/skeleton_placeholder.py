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
    from collections.abc import Callable
    from types import TracebackType

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import LayoutConfig
    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
    from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto

    # Element methods (e.g. `.dataframe()`, `.markdown()`) are delegated to an
    # internal DeltaGenerator at runtime via `__getattr__`. We can't subclass
    # DeltaGenerator at runtime (this class is registered lazily via the DG
    # singleton to avoid a circular import), so we expose its interface to
    # type-checkers and IDEs by using it as the base class only under
    # TYPE_CHECKING. At runtime the base is `object` and delegation is dynamic.
    _SkeletonPlaceholderBase = DeltaGenerator
else:
    _SkeletonPlaceholderBase = object

# Delay before showing the skeleton in context manager mode (same as st.spinner).
_DELAY_SECS: Final = 0.5


class SkeletonPlaceholder(_SkeletonPlaceholderBase):
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

        In standalone mode, the skeleton is shown immediately.
        In context manager mode, the immediate skeleton is cleared and replaced
        with a delayed transient skeleton (like st.spinner).
        """
        # At runtime the base class is `object`, so this resolves to
        # `object.__init__()` and is a harmless no-op. We keep the explicit call
        # because, under TYPE_CHECKING, the base is `DeltaGenerator` (see
        # `_SkeletonPlaceholderBase`); the call keeps type-checkers and static
        # analysis satisfied that the superclass is initialized.
        super().__init__()
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

        # Immediately enqueue the skeleton in standalone mode.
        # If used as context manager, __enter__ will clear this and switch to transient.
        # The parent DeltaGenerator is only needed here; we don't retain it as an
        # attribute (avoids shadowing DeltaGenerator's own `_parent` under the
        # TYPE_CHECKING base class).
        self._dg = parent._enqueue(
            "skeleton",
            self._skeleton_proto,
            layout_config=self._layout_config,
        )

    def __getattr__(self, name: str) -> Any:
        # Skip internal attributes
        if name.startswith("_"):
            raise AttributeError(
                f"'{type(self).__name__}' object has no attribute '{name}'"
            )
        # Delegate to the internal DeltaGenerator
        return getattr(self._dg, name)

    def __dir__(self) -> list[str]:
        """Return DeltaGenerator methods for IDE autocompletion."""
        from streamlit.delta_generator import DeltaGenerator

        return dir(DeltaGenerator)

    def __enter__(self) -> Self:  # type: ignore[override]
        """Enter context manager mode with 0.5s delay before showing skeleton.

        In context manager mode, we clear the immediately-shown skeleton and switch
        to transient elements with a delay (like st.spinner). If the placeholder was
        already used in standalone mode, the context manager simply takes over the
        placeholder's slot (any standalone content there is cleared).
        """
        with self._display_lock:
            self._in_context_manager = True
            # Reset the display flag so re-entering the context manager on the
            # same placeholder shows the delayed skeleton again (a prior
            # __exit__ sets it to False).
            self._should_display = True

        # Clear the immediately-shown skeleton and switch to transient mode.
        # Use empty() to clear without flashing any content.
        self._dg.empty()

        # Build the element proto for transient use
        element_proto = ElementProto()
        element_proto.skeleton.CopyFrom(self._skeleton_proto)

        # Set up transient element with delay (like st.spinner)
        # Use self._dg (not the parent) to anchor the transient at the skeleton's slot.
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

        # Clear the transient element inside the lock to match st.spinner's pattern.
        # This removes a class of subtle reordering concerns where an in-flight
        # show_skeleton could see _should_display=False after the clear is enqueued.
        with self._display_lock:
            self._should_display = False
            # Reset so the placeholder is back in a clean (non-context-manager)
            # state. Re-entering the context manager works because __enter__ sets
            # this back to True, but resetting here keeps the state machine
            # explicit.
            self._in_context_manager = False
            if self._clear_transient is not None:
                enqueue_message(self._clear_transient())

        return False
