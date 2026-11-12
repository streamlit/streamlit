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

"""Skeleton placeholder with standalone and context manager modes."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Literal, Self

from streamlit.elements.lib import agent_spec
from streamlit.elements.lib.loading_block import (
    make_loading_block_proto,
    open_loading_block,
)
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ThreadState,
    get_script_run_ctx,
)

if TYPE_CHECKING:
    from types import TracebackType

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import (
        HeightWithoutContent,
        LayoutConfig,
        WidthWithoutContent,
    )
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


class SkeletonPlaceholder(_SkeletonPlaceholderBase):
    """A placeholder that displays a skeleton loading animation.

    This class wraps a ``DeltaGenerator`` and can be used in two modes:

    **Standalone mode**: The skeleton is shown immediately when created.
    Call methods like ``.write()``, ``.dataframe()``, etc. to replace it with content.

    **Context manager mode**: The skeleton's slot becomes a container for the
    elements written inside the ``with`` block, and the skeleton stays until
    the first visible one is drawn. In both modes, the previous run's content
    stays mounted until new content replaces it. The skeleton covers it only
    if that takes longer than a short grace period.
    """

    def __init__(
        self,
        parent: DeltaGenerator,
        skeleton_proto: SkeletonProto,
        layout_config: LayoutConfig | None,
    ) -> None:
        """Enqueue the skeleton at the parent's next position."""
        # At runtime the base class is `object`, so this resolves to
        # `object.__init__()` and is a harmless no-op. We keep the explicit call
        # because, under TYPE_CHECKING, the base is `DeltaGenerator` (see
        # `_SkeletonPlaceholderBase`); the call keeps type-checkers and static
        # analysis satisfied that the superclass is initialized.
        super().__init__()
        self._skeleton_proto = skeleton_proto
        self._layout_config = layout_config

        # In context manager mode: the loading block that replaces the skeleton,
        # and the enclosing `in_skeleton_slot` value to restore on exit.
        self._block_dg: DeltaGenerator | None = None
        self._outer_in_skeleton_slot: bool | None = None

        # The parent DeltaGenerator is only needed here; we don't retain it as an
        # attribute (avoids shadowing DeltaGenerator's own `_parent` under the
        # TYPE_CHECKING base class).
        self._dg = parent._enqueue(
            "skeleton",
            self._skeleton_proto,
            layout_config=self._layout_config,
            # A placeholder for content that has not arrived, so there is
            # nothing for a client to read yet.
            agent_props=agent_spec.element("skeleton"),
        )

    def __getattr__(self, name: str) -> Any:
        # Skip internal attributes
        if name.startswith("_"):
            raise AttributeError(
                f"'{type(self).__name__}' object has no attribute '{name}'"
            )
        # Inside the `with` block, write into the loading block that fills the slot.
        target = self._block_dg if self._block_dg is not None else self._dg
        return getattr(target, name)

    def __dir__(self) -> list[str]:
        """Return DeltaGenerator methods for IDE autocompletion."""
        from streamlit.delta_generator import DeltaGenerator

        return dir(DeltaGenerator)

    def _skeleton_height(self) -> HeightWithoutContent | None:
        """The pixel or ``"stretch"`` skeleton height, or ``None`` for the default."""
        height = self._layout_config.height if self._layout_config else None
        return height if isinstance(height, int) or height == "stretch" else None

    def _skeleton_width(self) -> WidthWithoutContent:
        """The loading block's width: the pixel width, otherwise ``"stretch"``."""
        width = self._layout_config.width if self._layout_config else None
        return width if isinstance(width, int) else "stretch"

    def __enter__(self) -> Self:  # type: ignore[override]  # ty: ignore[invalid-method-override]
        """Replace the skeleton with a loading block that receives the content."""
        self._block_dg = open_loading_block(
            self._dg,
            skeleton_height=self._skeleton_height(),
            width=self._skeleton_width(),
        )
        self._block_dg.__enter__()
        if get_script_run_ctx() is not None:
            self._outer_in_skeleton_slot = ThreadState.get().in_skeleton_slot
            ThreadState.update(in_skeleton_slot=True)
        return self

    def __exit__(
        self,
        typ: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> Literal[False]:
        """Leave the loading block; clear the skeleton if it drew nothing or raised."""
        block_dg = self._block_dg
        if block_dg is None:  # pragma: no cover - defensive
            raise RuntimeError("__exit__ called without __enter__")
        self._block_dg = None
        block_dg.__exit__(typ, exc, tb)

        if self._outer_in_skeleton_slot is not None:
            ThreadState.update(in_skeleton_slot=self._outer_in_skeleton_slot)
            self._outer_in_skeleton_slot = None

        # Clear the skeleton here only when the frontend can't clear it itself:
        # - Nothing was written, or the block raised: re-send the block without
        #   `loading`. The frontend keeps the children of a re-sent block of the
        #   same type.
        # - Otherwise, the frontend clears it on the first visible element. A
        #   parallel fragment's container counts as written, so the skeleton
        #   stays until the worker draws.
        cursor = block_dg._cursor
        if cursor is not None and (cursor.index == 0 or typ is not None):
            from streamlit.delta_generator import _enqueue_add_block

            _enqueue_add_block(
                block_dg._block_delta_path,
                make_loading_block_proto(
                    skeleton_height=self._skeleton_height(),
                    width=self._skeleton_width(),
                    show_skeleton=False,
                ),
                agent_props=agent_spec.block("container"),
            )

        return False
