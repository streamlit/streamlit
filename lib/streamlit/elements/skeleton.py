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
from streamlit.deprecation_util import show_deprecation_warning
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
    def _skeleton(self, *, height: int | None = None) -> DeltaGenerator:  # noqa: ARG002
        """Insert a single-element container displaying a skeleton placeholder.

        .. deprecated::
            The internal ``_skeleton()`` method is deprecated. Use the public
            ``st.skeleton()`` instead. It is kept only for backwards
            compatibility and may be removed in a future release.

        This is an internal method and should not be used directly.

        Parameters
        ----------
        height: int or None
            Deprecated and ignored. The skeleton always renders at the default
            element height. Kept only for backwards compatibility with the old
            signature.
        """
        # Kept only for backwards compatibility with external callers (e.g.
        # streamlit-extras). New code should use the public `skeleton()` method.
        # `height` is intentionally ignored: the proto height field is deprecated
        # and this path always renders at the default element height.
        show_deprecation_warning(
            "`_skeleton` is deprecated and will be removed in a future release. "
            "Please use `st.skeleton` instead.",
            show_once=True,
        )
        return self.dg._enqueue("skeleton", SkeletonProto())

    @gather_metrics("skeleton")
    def skeleton(
        self,
        height: HeightWithoutContent | None = None,
        *,
        width: WidthWithoutContent = "stretch",
    ) -> SkeletonPlaceholder:
        r"""Display a skeleton loading placeholder.

        A skeleton is an animated placeholder that indicates content is
        loading. Use it to reserve layout space and provide visual feedback
        while content loads. It can be used in two ways:

        **Standalone mode** (like ``st.empty()``): Returns a placeholder that
        is shown immediately and can be replaced with content later by calling
        an ``st.*`` method on it (for example, ``placeholder.dataframe(...)``).

        **Context manager mode** (like ``st.spinner()``, recommended): The
        skeleton is shown while the ``with`` block runs (after a short delay)
        and automatically clears when the block exits, whether normally or due
        to an exception. Like ``st.spinner``, any ``st.*`` calls made inside the
        ``with`` block are written to the parent container and remain visible
        after the skeleton clears.

        .. note::
            Context manager mode is recommended. Use standalone mode only when
            you need to reserve a slot and fill it later (like ``st.empty()``).

        Parameters
        ----------
        height : int, "stretch", or None
            The height of the skeleton. This can be one of the following:

            - ``None`` (default): The skeleton uses the standard element
              height (the same height as most input widgets).
            - An integer specifying the height in pixels.
            - ``"stretch"``: The height of the skeleton matches the height of
              the parent container. This requires a parent container with a
              bounded height.

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

        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st
           import time

           placeholder = st.skeleton(height=200)
           time.sleep(2)
           placeholder.dataframe({"col1": [1, 2, 3], "col2": [4, 5, 6]})

        .. output::
           https://doc-skeleton-standalone.streamlit.app/
           height: 300px

        **Context manager mode** - skeleton auto-clears when block exits:

        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st
           import time

           with st.skeleton(height=100):
               # Expensive computation runs here
               time.sleep(2)

           # Skeleton clears, show results below
           st.success("Data loaded!")

        .. output::
           https://doc-skeleton-context.streamlit.app/
           height: 200px

        """
        # When height is None, omit it from the layout config so no
        # HeightConfig is sent. The frontend then resolves the height to the
        # standard element height (theme.sizes.minElementHeight). Passing None
        # to create_layout_config() would fail height validation.
        if height is None:
            layout_config = create_layout_config(width=width)
        else:
            layout_config = create_layout_config(
                width=width,
                height=height,
                allow_stretch_height=True,
            )

        # The visual height is derived entirely from the layout config; the
        # proto height field is deprecated and no longer set.
        skeleton_proto = SkeletonProto()

        return get_dg_singleton_instance().skeleton_placeholder_cls(
            parent=self.dg,
            skeleton_proto=skeleton_proto,
            layout_config=layout_config,
        )

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)
