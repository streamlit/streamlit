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

from typing import TYPE_CHECKING, Any, Literal, cast

from typing_extensions import Self

from streamlit.elements.lib.layout_utils import (
    HeightWithoutContent,
    WidthWithoutContent,
    create_layout_config,
)
from streamlit.proto.Empty_pb2 import Empty as EmptyProto
from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from types import TracebackType

    from streamlit.delta_generator import DeltaGenerator


class SkeletonPlaceholder:
    """A placeholder that displays a skeleton loading animation.

    This class wraps a ``DeltaGenerator`` and can be used as a context manager.
    When used as a context manager, the skeleton is automatically cleared when
    the block exits.

    This class has all the same methods as ``DeltaGenerator`` through delegation.
    """

    def __init__(self, dg: DeltaGenerator) -> None:
        self._dg = dg

    def __getattr__(self, name: str) -> Any:
        # Delegate all attribute access to the underlying DeltaGenerator
        return getattr(self._dg, name)

    def __enter__(self) -> Self:
        self._dg.__enter__()
        return self

    def __exit__(
        self,
        typ: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> Literal[False]:
        try:
            self._dg.empty()
        finally:
            self._dg.__exit__(typ, exc, tb)
        return False


class EmptyMixin:
    @gather_metrics("empty")
    def empty(self) -> DeltaGenerator:
        """Insert a single-element container.

        Inserts a container into your app that can be used to hold a single element.
        This allows you to, for example, remove elements at any point, or replace
        several elements at once (using a child multi-element container).

        To insert/replace/clear an element on the returned container, you can
        use ``with`` notation or just call methods directly on the returned object.
        See examples below.

        Examples
        --------
        Inside a ``with st.empty():`` block, each displayed element will
        replace the previous one.

        >>> import streamlit as st
        >>> import time
        >>>
        >>> with st.empty():
        ...     for seconds in range(10):
        ...         st.write(f"⏳ {seconds} seconds have passed")
        ...         time.sleep(1)
        ...     st.write(":material/check: 10 seconds over!")
        ... st.button("Rerun")

        .. output::
           https://doc-empty.streamlit.app/
           height: 220px

        You can use an ``st.empty`` to replace multiple elements in
        succession. Use ``st.container`` inside ``st.empty`` to display (and
        later replace) a group of elements.

        >>> import streamlit as st
        >>> import time
        >>>
        >>> st.button("Start over")
        >>>
        >>> placeholder = st.empty()
        >>> placeholder.markdown("Hello")
        >>> time.sleep(1)
        >>>
        >>> placeholder.progress(0, "Wait for it...")
        >>> time.sleep(1)
        >>> placeholder.progress(50, "Wait for it...")
        >>> time.sleep(1)
        >>> placeholder.progress(100, "Wait for it...")
        >>> time.sleep(1)
        >>>
        >>> with placeholder.container():
        ...     st.line_chart({"data": [1, 5, 2, 6]})
        ...     time.sleep(1)
        ...     st.markdown("3...")
        ...     time.sleep(1)
        ...     st.markdown("2...")
        ...     time.sleep(1)
        ...     st.markdown("1...")
        ...     time.sleep(1)
        >>>
        >>> placeholder.markdown("Poof!")
        >>> time.sleep(1)
        >>>
        >>> placeholder.empty()

        .. output::
           https://doc-empty-placeholder.streamlit.app/
           height: 600px

        """
        empty_proto = EmptyProto()
        return self.dg._enqueue("empty", empty_proto)

    @gather_metrics("_skeleton")
    def _skeleton(self, *, height: int | None = None) -> DeltaGenerator:
        """Insert a single-element container which displays a "skeleton" placeholder.

        Inserts a container into your app that can be used to hold a single element.
        This allows you to, for example, remove elements at any point, or replace
        several elements at once (using a child multi-element container).

        To insert/replace/clear an element on the returned container, you can
        use ``with`` notation or just call methods directly on the returned object.
        See some of the examples below.

        This is an internal method and should not be used directly.

        Parameters
        ----------
        height: int or None
            Desired height of the skeleton expressed in pixels. If None, a
            default height is used.
        """
        skeleton_proto = SkeletonProto()
        if height:
            skeleton_proto.height = height
        return self.dg._enqueue("skeleton", skeleton_proto)

    @gather_metrics("skeleton")
    def skeleton(
        self,
        height: HeightWithoutContent = 100,
        *,
        width: WidthWithoutContent = "stretch",
    ) -> SkeletonPlaceholder:
        r"""Display a skeleton loading placeholder.

        A skeleton is a visual placeholder that indicates content is loading.
        It can be used in two ways:

        **Standalone mode**: Returns a placeholder that can be replaced with
        content later, similar to ``st.empty()``.

        **Context manager mode**: The skeleton automatically clears when the
        block exits, whether normally or due to an exception.

        Parameters
        ----------
        height : int or "stretch"
            The height of the skeleton. This can be one of the following:

            - An integer specifying the height in pixels (default: 100).
            - ``"stretch"``: The height of the skeleton matches the height of
              the parent container.

        width : int or "stretch"
            The width of the skeleton. This can be one of the following:

            - ``"stretch"`` (default): The width of the skeleton matches the
              width of the parent container.
            - An integer specifying the width in pixels.

        Returns
        -------
        SkeletonPlaceholder
            A placeholder object that can be used to replace the skeleton with
            other content, or as a context manager.

        Examples
        --------
        **Standalone mode** - replace skeleton with content:

        >>> import streamlit as st
        >>> import time
        >>>
        >>> placeholder = st.skeleton(height=200)
        >>> time.sleep(2)
        >>> placeholder.dataframe({"col1": [1, 2, 3], "col2": [4, 5, 6]})

        .. output::
           https://doc-skeleton-standalone.streamlit.app/
           height: 300px

        **Context manager mode** - skeleton auto-clears when block exits:

        >>> import streamlit as st
        >>> import time
        >>>
        >>> with st.skeleton(height=100):
        ...     # Expensive computation runs here
        ...     time.sleep(2)
        >>> # Skeleton clears, show results below
        >>> st.success("Data loaded!")

        .. output::
           https://doc-skeleton-context.streamlit.app/
           height: 200px

        """
        layout_config = create_layout_config(
            width=width,
            height=height,
            allow_stretch_height=True,
        )

        skeleton_proto = SkeletonProto()
        # Set pixel height on the proto if an integer is provided
        if isinstance(height, int):
            skeleton_proto.height = height

        dg = self.dg._enqueue(
            "skeleton",
            skeleton_proto,
            layout_config=layout_config,
        )

        return SkeletonPlaceholder(dg)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
