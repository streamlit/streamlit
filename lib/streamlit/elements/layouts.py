# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import cast, Sequence, Union

from streamlit.beta_util import function_beta_warning
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto

import streamlit

SpecType = Union[int, Sequence[Union[int, float]]]


class LayoutsMixin:
    def container(self):
        """Insert a multi-element container.

        Inserts an invisible container into your app that can be used to hold
        multiple elements. This allows you to, for example, insert multiple
        elements into your app out of order.

        To add elements to the returned container, you can use "with" notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        Examples
        --------

        Inserting elements using "with" notation:

        >>> with st.container():
        ...    st.write("This is inside the container")
        ...
        ...    # You can call any Streamlit command, including custom components:
        ...    st.bar_chart(np.random.randn(50, 3))
        ...
        >>> st.write("This is outside the container")

        .. output ::
            https://static.streamlit.io/0.66.0-Wnid/index.html?id=Qj8PY3v3L8dgVjjQCreHux
            height: 420px

        Inserting elements out of order:

        >>> container = st.container()
        >>> container.write("This is inside the container")
        >>> st.write("This is outside the container")
        >>>
        >>> # Now insert some more in the container
        >>> container.write("This is inside too")

        .. output ::
            https://static.streamlit.io/0.66.0-Wnid/index.html?id=GsFVF5QYT3Ljr6jQjErPqL
        """
        return self.dg._block()

    # TODO: Enforce that columns are not nested or in Sidebar
    def columns(self, spec: SpecType):
        """Insert containers laid out as side-by-side columns.

        Inserts a number of multi-element containers laid out side-by-side and
        returns a list of container objects.

        To add elements to the returned containers, you can use "with" notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        .. warning::
            Currently, you may not put columns inside another column.

        Parameters
        ----------
        spec : int or list of numbers
            If an int
                Specifies the number of columns to insert, and all columns
                have equal width.

            If a list of numbers
                Creates a column for each number, and each
                column's width is proportional to the number provided. Numbers can
                be ints or floats, but they must be positive.

                For example, `st.columns([3, 1, 2])` creates 3 columns where
                the first column is 3 times the width of the second, and the last
                column is 2 times that width.

        Returns
        -------
        list of containers
            A list of container objects.

        Examples
        --------

        You can use `with` notation to insert any element into a column:

        >>> col1, col2, col3 = st.columns(3)
        >>>
        >>> with col1:
        ...    st.header("A cat")
        ...    st.image("https://static.streamlit.io/examples/cat.jpg")
        ...
        >>> with col2:
        ...    st.header("A dog")
        ...    st.image("https://static.streamlit.io/examples/dog.jpg")
        ...
        >>> with col3:
        ...    st.header("An owl")
        ...    st.image("https://static.streamlit.io/examples/owl.jpg")

        .. output ::
            https://static.streamlit.io/0.66.0-Wnid/index.html?id=VW45Va5XmSKed2ayzf7vYa
            height: 550px

        Or you can just call methods directly in the returned objects:

        >>> col1, col2 = st.columns([3, 1])
        >>> data = np.random.randn(10, 1)
        >>>
        >>> col1.subheader("A wide column with a chart")
        >>> col1.line_chart(data)
        >>>
        >>> col2.subheader("A narrow column with the data")
        >>> col2.write(data)

        .. output ::
            https://static.streamlit.io/0.66.0-Wnid/index.html?id=XSQ6VkonfGcT2AyNYMZN83
            height: 400px

        """
        weights = spec
        weights_exception = StreamlitAPIException(
            "The input argument to st.columns must be either a "
            + "positive integer or a list of positive numeric weights. "
            + "See [documentation](https://docs.streamlit.io/en/stable/api.html#streamlit.columns) "
            + "for more information."
        )

        if isinstance(weights, int):
            # If the user provided a single number, expand into equal weights.
            # E.g. (1,) * 3 => (1, 1, 1)
            # NOTE: A negative/zero spec will expand into an empty tuple.
            weights = (1,) * weights

        if len(weights) == 0 or any(weight <= 0 for weight in weights):
            raise weights_exception

        def column_proto(weight):
            col_proto = BlockProto()
            col_proto.column.weight = weight
            col_proto.allow_empty = True
            return col_proto

        horiz_proto = BlockProto()
        horiz_proto.horizontal.total_weight = sum(weights)
        row = self.dg._block(horiz_proto)
        return [row._block(column_proto(w)) for w in weights]

    def expander(self, label: str, expanded: bool = False):
        """Insert a multi-element container that can be expanded/collapsed.

        Inserts a container into your app that can be used to hold multiple elements
        and can be expanded or collapsed by the user. When collapsed, all that is
        visible is the provided label.

        To add elements to the returned container, you can use "with" notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        .. warning::
            Currently, you may not put expanders inside another expander.

        Parameters
        ----------
        label : str
            A string to use as the header for the expander.
        expanded : bool
            If True, initializes the expander in "expanded" state. Defaults to
            False (collapsed).

        Examples
        --------
        >>> st.line_chart({"data": [1, 5, 2, 6, 2, 1]})
        >>>
        >>> with st.expander("See explanation"):
        ...     st.write(\"\"\"
        ...         The chart above shows some numbers I picked for you.
        ...         I rolled actual dice for these, so they're *guaranteed* to
        ...         be random.
        ...     \"\"\")
        ...     st.image("https://static.streamlit.io/examples/dice.jpg")

        .. output ::
            https://static.streamlit.io/0.66.0-2BLtg/index.html?id=7v2tgefVbW278gemvYrRny
            height: 750px

        """
        if label is None:
            raise StreamlitAPIException("A label is required for an expander")

        expandable_proto = BlockProto.Expandable()
        expandable_proto.expanded = expanded
        expandable_proto.label = label

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.expandable.CopyFrom(expandable_proto)

        return self.dg._block(block_proto=block_proto)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)

    # Deprecated beta_ functions
    beta_container = function_beta_warning(container, "2021-11-02")
    beta_expander = function_beta_warning(expander, "2021-11-02")
    beta_columns = function_beta_warning(columns, "2021-11-02")
