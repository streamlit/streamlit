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

from typing import TYPE_CHECKING, cast

from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements.lib.layout_utils import (
    HeightWithoutContent,
    WidthWithoutContent,
    create_layout_config,
)
from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.skeleton_placeholder import SkeletonPlaceholder


class SkeletonMixin:
    @gather_metrics("_skeleton")
    def _skeleton(self, *, height: int | None = None) -> DeltaGenerator:
        """Insert a single-element container displaying a skeleton placeholder.

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
        block exits, whether normally or due to an exception. Like
        ``st.spinner``, any ``st.*`` calls made inside the ``with`` block
        are written to the parent container and remain visible after the
        skeleton clears.

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
        # Set pixel height on the proto if an integer is provided.
        # Exclude bool since isinstance(True, int) is True in Python.
        # Note: For the public API, this proto field is not used visually.
        # The frontend reads height from layout_config instead. This assignment
        # is kept for parity with the legacy internal _skeleton() method and
        # potential future use cases (e.g., server-side height validation).
        if isinstance(height, int) and not isinstance(height, bool):
            skeleton_proto.height = height

        return get_dg_singleton_instance().skeleton_placeholder_cls(
            parent=self.dg,
            skeleton_proto=skeleton_proto,
            layout_config=layout_config,
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
