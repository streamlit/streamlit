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
from streamlit.elements.lib.layout_utils import create_layout_config
from streamlit.elements.lib.pandas_styler_utils import marshall_styler
from streamlit.errors import StreamlitAPIException, StreamlitValueError
from streamlit.proto.Table_pb2 import Table as TableProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.dataframe_util import Data
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import Height, Width
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


# Data formats that should auto-hide column headers (formats without user-defined column names)
_HIDE_HEADER_DATA_FORMATS = {
    dataframe_util.DataFormat.KEY_VALUE_DICT,
    dataframe_util.DataFormat.LIST_OF_ROWS,
    dataframe_util.DataFormat.LIST_OF_VALUES,
    dataframe_util.DataFormat.NUMPY_LIST,
    dataframe_util.DataFormat.NUMPY_MATRIX,
    dataframe_util.DataFormat.SET_OF_VALUES,
    dataframe_util.DataFormat.TUPLE_OF_VALUES,
    dataframe_util.DataFormat.PANDAS_ARRAY,
    dataframe_util.DataFormat.PYARROW_ARRAY,
}


def _compute_hide_index(
    data: Data,
    hide_index: bool | None,
) -> bool:
    """Compute whether the index column should be hidden.

    Parameters
    ----------
    data : Data
        The original input data.
    hide_index : bool | None
        The user-provided hide_index value.

    Returns
    -------
    bool
        True if the index should be hidden, False otherwise.
    """
    import pandas as pd

    if hide_index is not None:
        return hide_index

    # Auto-hide logic: hide if data has a default RangeIndex
    # For Styler objects, check the underlying data
    if dataframe_util.is_pandas_styler(data):
        # Styler.data is the underlying DataFrame
        return dataframe_util.has_range_index(data.data)  # type: ignore[attr-defined]

    # If data is already a pandas DataFrame, check directly without conversion
    if isinstance(data, pd.DataFrame):
        return dataframe_util.has_range_index(data)

    # For non-pandas data, convert and check
    df = dataframe_util.convert_anything_to_pandas_df(data, ensure_copy=False)
    return dataframe_util.has_range_index(df)


def _compute_hide_header(
    data_format: dataframe_util.DataFormat, hide_header: bool | None
) -> bool:
    """Compute whether the column headers should be hidden.

    Parameters
    ----------
    data_format : DataFormat
        The format of the input data.
    hide_header : bool | None
        The user-provided hide_header value.

    Returns
    -------
    bool
        True if headers should be hidden, False otherwise.
    """
    if hide_header is not None:
        return hide_header

    # Auto-hide logic: hide headers for data formats without user-defined column names
    return data_format in _HIDE_HEADER_DATA_FORMATS


class TableMixin:
    @gather_metrics("table")
    def table(
        self,
        data: Data = None,
        *,
        border: bool | Literal["horizontal"] = True,
        width: Width = "stretch",
        height: Height = "content",
        hide_index: bool | None = None,
        hide_header: bool | None = None,
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

        hide_index : bool or None
            Whether to hide the index column. This can be one of the following
            values:

            - ``None`` (default): Hide the index column if it's a default
              ``RangeIndex``. Show custom indices.
            - ``True``: Always hide the index column.
            - ``False``: Always show the index column.

        hide_header : bool or None
            Whether to hide the column header row. This can be one of the
            following values:

            - ``None`` (default): Auto-hide headers for data formats without
              user-defined column names, like ``dict``, ``list``, and
              ``numpy.ndarray``. Show headers for data with explicit column
              names, like ``pandas.DataFrame``.
            - ``True``: Always hide the column header row, including all levels
              of ``MultiIndex`` headers.
            - ``False``: Always show the column header row.

        Examples
        --------
        **Example 1: Display a confusion matrix as a static table**

        .. code-block:: python
            :filename: streamlit_app.py

            import pandas as pd
            import streamlit as st

            confusion_matrix = pd.DataFrame(
                {
                    "Predicted Cat": [85, 3, 2, 1],
                    "Predicted Dog": [2, 78, 4, 0],
                    "Predicted Bird": [1, 5, 72, 3],
                    "Predicted Fish": [0, 2, 1, 89],
                },
                index=["Actual Cat", "Actual Dog", "Actual Bird", "Actual Fish"],
            )
            st.table(confusion_matrix)

        .. output::
           https://doc-table-confusion.streamlit.app/
           height: 250px

        **Example 2: Display a product leaderboard with Markdown and horizontal borders**

        .. code-block:: python
            :filename: streamlit_app.py

            import streamlit as st

            product_data = {
                "Product": [
                    ":material/devices: Widget Pro",
                    ":material/smart_toy: Smart Device",
                    ":material/inventory: Premium Kit",
                ],
                "Category": [":blue[Electronics]", ":green[IoT]", ":violet[Bundle]"],
                "Stock": ["🟢 Full", "🟡 Low", "🔴 Empty"],
                "Units sold": [1247, 892, 654],
                "Revenue": [125000, 89000, 98000],
            }
            st.table(product_data, border="horizontal")

        .. output::
           https://doc-table-horizontal-border.streamlit.app/
           height: 200px

        **Example 3: Display a scrollable table with fixed height**

        .. code-block:: python
            :filename: streamlit_app.py

            import pandas as pd
            import streamlit as st
            from numpy.random import default_rng as rng

            df = pd.DataFrame(
                rng(0).standard_normal((50, 5)), columns=["A", "B", "C", "D", "E"]
            )
            st.table(df, height=300)

        **Example 4: Display key-value data**

        .. code-block:: python
            :filename: streamlit_app.py

            import streamlit as st

            st.table(
                {
                    ":material/folder: Project": "**Streamlit** - The fastest way to build data apps",
                    ":material/code: Repository": "[github.com/streamlit/streamlit](https://github.com/streamlit/streamlit)",
                    ":material/new_releases: Version": ":gray-badge[1.45.0]",
                    ":material/license: License": ":green-badge[Apache 2.0]",
                    ":material/group: Maintainers": ":blue-badge[Core Team] :violet-badge[Community]",
                },
                border="horizontal",
                width="content",
            )

        .. output::
           https://doc-table-auto-header.streamlit.app/
           height: 250px

        **Example 5: Display a minimal table without index and headers**

        .. code-block:: python
            :filename: streamlit_app.py

            import pandas as pd
            import streamlit as st

            df = pd.DataFrame({"Name": ["Alice", "Bob"], "Age": [25, 30]})
            st.table(df, hide_index=True, hide_header=True)

        .. output::
           https://doc-table-hide-header-and-index.streamlit.app/
           height: 200px

        """
        layout_config = create_layout_config(
            width=width,
            height=height,
            allow_content_width=True,
            allow_content_height=True,
        )

        # Parse border parameter to enum value
        border_mode = parse_border_mode(border)

        # Determine the input data format for auto-hide logic
        data_format = dataframe_util.determine_data_format(data)

        # Check if data is uncollected, and collect it but with 100 rows max, instead of
        # 10k rows, which is done in all other cases.
        # We use 100 rows in st.table, because large tables render slowly,
        # take too much screen space, and can crush the app.
        if dataframe_util.is_unevaluated_data_object(data):
            data = dataframe_util.convert_anything_to_pandas_df(
                data, max_unevaluated_rows=100
            )
            # Unevaluated data objects always produce a default RangeIndex,
            # so auto-hide the index unless explicitly set by the user.
            should_hide_index = hide_index if hide_index is not None else True
        else:
            # For other data types, compute hide_index based on the actual index
            should_hide_index = _compute_hide_index(data, hide_index)

        # Determine if header should be hidden
        should_hide_header = _compute_hide_header(data_format, hide_header)

        # If pandas.Styler uuid is not provided, a hash of the position
        # of the element will be used. This will cause a rerender of the table
        # when the position of the element is changed.
        delta_path = self.dg._get_delta_path_str()
        default_uuid = str(hash(delta_path))

        proto = TableProto()
        marshall_table(proto.arrow_data, data, default_uuid)
        proto.border_mode = border_mode
        proto.hide_index = should_hide_index
        proto.hide_header = should_hide_header
        return self.dg._enqueue("table", proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
