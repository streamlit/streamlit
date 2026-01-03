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

from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    SpaceSize,
    validate_space_size,
)
from streamlit.proto.Space_pb2 import Space as SpaceProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class SpaceMixin:
    @gather_metrics("space")
    def space(
        self,
        size: SpaceSize = "small",
    ) -> DeltaGenerator:
        """Add vertical or horizontal space.

        This command adds space in the direction of its parent container. In
        a vertical layout, it adds vertical space. In a horizontal layout, it
        adds horizontal space.

        Parameters
        ----------
        size : "xxsmall", "xsmall", "small", "medium", "large", "xlarge", "xxlarge", "stretch", or int
            The size of the space. This can be one of the following values:

            - ``"xxsmall"``: 0.25rem, matching the ``"xxsmall"`` gap in
              ``st.container`` and ``st.columns``.
            - ``"xsmall"``: 0.5rem, matching the ``"xsmall"`` gap in
              ``st.container`` and ``st.columns``.
            - ``"small"`` (default): 0.75rem, which is the height of a widget
              label. This is useful for aligning buttons with labeled widgets.
            - ``"medium"``: 2.5rem, which is the height of a button or
              (unlabeled) input field.
            - ``"large"``: 4.25rem, which is the height of a labeled input
              field or unlabeled media widget, like ``st.file_uploader``.
            - ``"xlarge"``: 6rem, matching the ``"xlarge"`` gap in
              ``st.container`` and ``st.columns``.
            - ``"xxlarge"``: 8rem, matching the ``"xxlarge"`` gap in
              ``st.container`` and ``st.columns``.
            - ``"stretch"``: Expands to fill remaining space in the container.
            - An integer: Fixed size in pixels.

        Examples
        --------
        **Example 1: Use vertical space to align elements**

        Use small spaces to replace label heights. Use medium spaces to replace
        two label heights or a button.

        >>> import streamlit as st
        >>>
        >>> left, middle, right = st.columns(3)
        >>>
        >>> left.space("medium")
        >>> left.button("Left button", width="stretch")
        >>>
        >>> middle.space("small")
        >>> middle.text_input("Middle input")
        >>>
        >>> right.audio_input("Right uploader")

        .. output::
            https://doc-space-vertical.streamlit.app/
            height: 260px

        **Example 2: Add horizontal space in a container**

        Use stretch space to float elements left and right.

        >>> import streamlit as st
        >>>
        >>> with st.container(horizontal=True):
        ...     st.button("Left")
        ...     st.space("stretch")
        ...     st.button("Right")

        .. output::
            https://doc-space-horizontal.streamlit.app/
            height: 200px

        """
        space_proto = SpaceProto()

        validate_space_size(size)

        # In vertical layouts, size controls height.
        # In horizontal layouts, size controls width.
        # We set both width and height configs to the same size value.
        # The frontend uses FlexContext to determine container direction and
        # applies ONLY the relevant dimension (width for horizontal, height for vertical)
        # to avoid unintended cross-axis spacing.
        layout_config = LayoutConfig(width=size, height=size)

        return self.dg._enqueue("space", space_proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
