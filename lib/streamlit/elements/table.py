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

from typing import TYPE_CHECKING, Literal, cast

from streamlit import dataframe_util
from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    Width,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.pandas_styler_utils import marshall_styler
from streamlit.errors import StreamlitAPIException, StreamlitValueError
from streamlit.proto.Table_pb2 import Table as TableProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.dataframe_util import Data
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.proto.ArrowData_pb2 import ArrowData as ArrowDataProto


def parse_border_mode(
    border: bool | Literal["horizontal"],
) -> TableProto.BorderMode.ValueType:
    """Parse and check the user provided border mode."""
    if isinstance(border, bool):
        return TableProto.BorderMode.ALL if border else TableProto.BorderMode.NONE
    if border == "horizontal":
        return TableProto.BorderMode.HORIZONTAL
    raise StreamlitValueError("border", ["True", "False", "'horizontal'"])


def marshall_table(
    proto: ArrowDataProto, data: Data, default_uuid: str | None = None
) -> None:
    """Marshall data into an ArrowData proto for Table element.

    Parameters
    ----------
    proto : proto.ArrowData
        Output. The protobuf for Streamlit ArrowData proto.

    data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, Iterable, dict, or None
        Something that is or can be converted to a dataframe.

    default_uuid : str | None
        If pandas.Styler UUID is not provided, this value will be used.
        This attribute is optional and only used for pandas.Styler, other elements
        can ignore it.

    """  # noqa: E501

    if dataframe_util.is_pandas_styler(data):
        # default_uuid is a string only if the data is a `Styler`,
        # and `None` otherwise.
        if not isinstance(default_uuid, str):
            raise StreamlitAPIException(
                "Default UUID must be a string for Styler data."
            )
        marshall_styler(proto, data, default_uuid)

    proto.data = dataframe_util.convert_anything_to_arrow_bytes(data)


class TableMixin:
    @gather_metrics("table")
    def table(
        self,
        data: Data = None,
        *,
        border: bool | Literal["horizontal"] = True,
        width: Width = "stretch",
        height: Height = "content",
    ) -> DeltaGenerator:
        """Display a static table.

        While ``st.dataframe`` is geared towards large datasets and interactive
        data exploration, ``st.table`` is useful for displaying small, styled
        tables without sorting or scrolling. For example, ``st.table`` may be
        the preferred way to display a confusion matrix or leaderboard.
        Additionally, ``st.table`` supports Markdown.

        Parameters
        ----------
        data : Anything supported by st.dataframe
            The table data.

            All cells including the index and column headers can optionally
            contain GitHub-flavored Markdown. Syntax information can be found
            at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        border : bool or "horizontal"
            Whether to show borders around the table and between cells. This can be one
            of the following:

            - ``True`` (default): Show borders around the table and between cells.
            - ``False``: Don't show any borders.
            - ``"horizontal"``: Show only horizontal borders between rows.

        width : "stretch", "content", or int
            The width of the table element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

            Row index columns are sticky only when the content overflows a
            specified integer width. Otherwise, they aren't sticky.

        height : "stretch", "content", or int
            The height of the table element. This can be one of the following:

            - ``"content"`` (default): The height of the element matches the
              height of its content, showing all rows.
            - ``"stretch"``: The height of the element expands to fill the
              available vertical space in its parent container. When multiple
              elements with stretch height are in the same container, they
              share the available vertical space evenly.
            - An integer specifying the height in pixels: The element has a
              fixed height. If the table content exceeds this height,
              scrolling is enabled with sticky headers.

        Examples
        --------
        **Example 1: Display a confusion matrix as a static table**

        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> confusion_matrix = pd.DataFrame(
        ...     {
        ...         "Predicted Cat": [85, 3, 2, 1],
        ...         "Predicted Dog": [2, 78, 4, 0],
        ...         "Predicted Bird": [1, 5, 72, 3],
        ...         "Predicted Fish": [0, 2, 1, 89],
        ...     },
        ...     index=["Actual Cat", "Actual Dog", "Actual Bird", "Actual Fish"],
        ... )
        >>> st.table(confusion_matrix)

        .. output::
           https://doc-table-confusion.streamlit.app/
           height: 250px

        **Example 2: Display a product leaderboard with Markdown and horizontal borders**

        >>> import streamlit as st
        >>>
        >>> product_data = {
        ...     "Product": [
        ...         ":material/devices: Widget Pro",
        ...         ":material/smart_toy: Smart Device",
        ...         ":material/inventory: Premium Kit",
        ...     ],
        ...     "Category": [":blue[Electronics]", ":green[IoT]", ":violet[Bundle]"],
        ...     "Stock": ["🟢 Full", "🟡 Low", "🔴 Empty"],
        ...     "Units sold": [1247, 892, 654],
        ...     "Revenue": [125000, 89000, 98000],
        ... }
        >>> st.table(product_data, border="horizontal")

        .. output::
           https://doc-table-horizontal-border.streamlit.app/
           height: 200px

        **Example 3: Display a scrollable table with fixed height**

        >>> import pandas as pd
        >>> import streamlit as st
        >>> from numpy.random import default_rng as rng
        >>>
        >>> df = pd.DataFrame(
        ...     rng(0).standard_normal((50, 5)), columns=["A", "B", "C", "D", "E"]
        ... )
        >>> st.table(df, height=300)

        """
        # Validate width and height parameters
        validate_width(width, allow_content=True)
        validate_height(height, allow_content=True)

        # Parse border parameter to enum value
        border_mode = parse_border_mode(border)

        # Check if data is uncollected, and collect it but with 100 rows max, instead of
        # 10k rows, which is done in all other cases.
        # We use 100 rows in st.table, because large tables render slowly,
        # take too much screen space, and can crush the app.
        if dataframe_util.is_unevaluated_data_object(data):
            data = dataframe_util.convert_anything_to_pandas_df(
                data, max_unevaluated_rows=100
            )

        # If pandas.Styler uuid is not provided, a hash of the position
        # of the element will be used. This will cause a rerender of the table
        # when the position of the element is changed.
        delta_path = self.dg._get_delta_path_str()
        default_uuid = str(hash(delta_path))

        # Create layout configuration for width and height
        layout_config = LayoutConfig(
            width=width,
            height=height,
        )

        proto = TableProto()
        marshall_table(proto.arrow_data, data, default_uuid)
        proto.border_mode = border_mode
        return self.dg._enqueue("table", proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
