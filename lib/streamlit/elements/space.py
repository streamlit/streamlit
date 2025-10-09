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

        `st.space` adds space in the direction of its parent container. In
        a vertical layout, it adds vertical space.
        In a horizontal layout, it adds horizontal space.

        Parameters
        ----------
        size : "small", "medium", "large", "stretch", or int
            The size of the space. Can be:

            - ``"small"`` (default): 0.75rem - Height of a widget label minus gap.
              Useful for aligning buttons with labeled widgets.
            - ``"medium"``: 2.5rem - Height of a button or input field.
            - ``"large"``: 4.25rem - Height of a large widget without a label.
            - ``"stretch"``: Expands to fill remaining space in the container.
            - An integer: Fixed size in pixels.

        Examples
        --------
        Add small vertical space between elements:

        >>> import streamlit as st
        >>>
        >>> st.write("First element")
        >>> st.space()  # Adds small vertical space
        >>> st.write("Second element")

        Add horizontal space in a container:

        >>> with st.container(horizontal=True):
        ...     st.button("Left")
        ...     st.space("stretch")  # Pushes button to left, next to right
        ...     st.button("Right")

        Use different space sizes:

        >>> st.write("Content")
        >>> st.space("medium")  # 2.5rem vertical space
        >>> st.write("More content")
        >>> st.space(100)  # 100px vertical space
        >>> st.write("Final content")

        Align buttons with labeled widgets:

        >>> with st.container(horizontal=True):
        ...     st.text_input("Name")
        ...     st.space("small")  # Aligns with input field
        ...     st.button("Submit")
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
