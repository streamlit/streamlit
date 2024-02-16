# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import TYPE_CHECKING, cast

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto
from streamlit.proto.Skeleton_pb2 import SkeletonStyle
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class SkeletonMixin:
    @gather_metrics("skeleton")
    def skeleton(self, *, height: int = 0, width: int = 0) -> "DeltaGenerator":
        """Insert a single-element container which displays a "skeleton" animation.

        Inserts a container into your app that can be used to hold a single element.
        This allows you to, for example, remove elements at any point, or replace
        several elements at once (using a child multi-element container).

        To insert/replace/clear an element on the returned container, you can
        use "with" notation or just call methods directly on the returned object.
        See some of the examples below.

        Parameters
        ----------
        height: int
            Desired height of the skeleton expressed in pixels. If 0, the skeleton will
            be the height of a single-row text element, such as st.text_input.

        width: float
            Desired height of the skeleton expressed in pixels. If 0, the width will
            be automatically determined.

        Examples
        --------
        st.skeleton is an st.empty with a future promise of additional content (typically one piece).
        The primary use case is to enable users to build Streamlit applications which
        render UI first and content second.

        This means you can replace

        >>> import streamlit as st
        >>>
        >>> # Draw UI
        >>> st.write("Census Data")
        >>> census_data_placeholder = st.empty()  # The empty is a collapsed element
        >>> # ^ The empty is a 0-size placeholder
        >>> year = st.selectbox("Select Year", options=[2022, 2023, 2024])
        >>>
        >>> # Get data from source, assume this takes a long time
        >>> census_dataframe = get_census_data_from_database(year)
        >>>
        >>> # Draw the data, causing it to "pop" in above the year selectbox.
        >>> census_data_placeholder.dataframe(census_dataframe)

        with

        >>> import streamlit as st
        >>>
        >>> # Draw UI
        >>> st.write("Census Data")
        >>> census_data_placeholder = st.skeleton(200)
        >>> # ^ The skeleton holds "200pt" of space for future content
        >>> year = st.selectbox("Select Year", options=[2022, 2023, 2024])
        >>>
        >>> # Get data from source, assume this takes a long time
        >>> census_dataframe = get_census_data_from_database(year)
        >>>
        >>> # Draw the data, replacing the skeleton animation that was previously there
        >>> census_data_placeholder.dataframe(census_dataframe)

        Overwriting elements in-place using "with" notation:

        >>> import streamlit as st
        >>> import time
        >>>
        >>> with st.skeleton():
        ...     for seconds in range(60):
        ...         st.write(f"⏳ {seconds} seconds have passed")
        ...         time.sleep(1)
        ...     st.write("✔️ 1 minute over!")

        Replacing several elements, then clearing them:

        >>> import streamlit as st
        >>>
        >>> placeholder = st.skeleton()
        >>>
        >>> # Replace the placeholder with some text:
        >>> placeholder.text("Hello")
        >>>
        >>> # Replace the text with a chart:
        >>> placeholder.line_chart({"data": [1, 5, 2, 6]})
        >>>
        >>> # Replace the chart with several elements:
        >>> with placeholder.container():
        ...     st.write("This is one element")
        ...     st.write("This is another")
        ...
        >>> # Clear all those elements and put the animation back:
        >>> placeholder.skeleton()

        Replacing a skeleton with several elements:

        >>> import streamlit as st
        >>>
        >>> placeholder = st.skeleton()
        >>>
        >>> # Keep in mind the animation will be replaced
        >>> # as soon as placeholder.container() is called.
        >>> with placeholder.container():
        ...     placeholder.write("Hello")
        ...     placeholder.write("Streamlit")

        """

        skeleton_proto = SkeletonProto()
        # TODO: in the future we might also allow the developer to create
        # a SkeletonStyle.APP block.
        skeleton_proto.style = SkeletonStyle.PLAIN

        # Validate Inputs
        if height != 0:
            if height <= 0:
                raise StreamlitAPIException(
                    "Skeleton height must be a positive integer."
                )
            skeleton_proto.height = height
        if width != 0:
            if width <= 0:
                raise StreamlitAPIException(
                    "Skeleton width must be a positive integer."
                )
            skeleton_proto.width = width

        return self.dg._enqueue("skeleton", skeleton_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
