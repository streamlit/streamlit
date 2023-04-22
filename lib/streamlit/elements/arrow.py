# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from collections.abc import Iterable
from typing import TYPE_CHECKING, Any, Dict, List, Literal, Optional, Union, cast

import pyarrow as pa
from numpy import ndarray
from pandas import DataFrame

from streamlit import type_util
from streamlit.elements.lib.column_config_utils import (
    INDEX_IDENTIFIER,
    ColumnConfigMapping,
    ColumnConfigMappingInput,
    ColumnType,
    ColumnWidth,
    marshall_column_config,
)
from streamlit.elements.lib.column_types_v2 import BaseColumn, process_config_options
from streamlit.elements.lib.pandas_styler_utils import marshall_styler
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from pandas.io.formats.style import Styler

    from streamlit.delta_generator import DeltaGenerator

Data = Union[
    DataFrame, "Styler", pa.Table, ndarray, Iterable, Dict[str, List[Any]], None
]


class ArrowMixin:
    # TODO: @gather_metrics("_arrow_dataframe")
    def _arrow_dataframe(
        self,
        data: Data = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        *,
        use_container_width: bool = False,
        hide_index: bool | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        titles: List[str | None] | Dict[str, str] | None = None,
        types: List[ColumnType | BaseColumn | None]
        | Dict[str, ColumnType | BaseColumn]
        | None = None,
        hidden: Literal["index"] | str | Iterable[str] | None = None,
        widths: List[ColumnWidth | None] | Dict[str, ColumnWidth] | None = None,
        help: List[str | None] | Dict[str, str] | None = None,
        column_order: Iterable[str] | None = None,
    ) -> "DeltaGenerator":
        """Display a dataframe as an interactive table.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, Iterable, dict, or None
            The data to display.

            If 'data' is a pandas.Styler, it will be used to style its
            underlying DataFrame.

        width : int or None
            Desired width of the dataframe element expressed in pixels. If None, the
            width will be automatically determined.

        height : int or None
            Desired height of the dataframe element expressed in pixels. If None, the
            height will be automatically determined.

        use_container_width : bool
            If True, set the dataframe width to the width of the parent container.
            This takes precedence over the width argument.
            This argument can only be supplied by keyword.

        column_order : iterable of str or None
            Defines the display order of all non-index columns. This will also influence
            which columns are visible to the user. For example: (“col2”, ”col1”) will
            show col2 in the first place followed by col1 and all other non-index
            columns in the data will be hidden. If None, the order is inherited from the
            original data structure.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st._arrow_dataframe(df)

        >>> st._arrow_dataframe(df, 200, 100)

        You can also pass a Pandas Styler object to change the style of
        the rendered DataFrame:

        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st._arrow_dataframe(df.style.highlight_max(axis=0))

        """

        column_config_mapping: ColumnConfigMapping = column_config or {}

        data = type_util.convert_anything_to_df(data)

        if hide_index is not None:
            if INDEX_IDENTIFIER not in column_config_mapping:
                column_config_mapping[INDEX_IDENTIFIER] = {}
            column_config_mapping[INDEX_IDENTIFIER]["hidden"] = hide_index

        process_config_options(
            column_config_mapping,
            data,
            titles=titles,
            types=types,
            hidden=hidden,
            widths=widths,
            help=help,
        )

        # If pandas.Styler uuid is not provided, a hash of the position
        # of the element will be used. This will cause a rerender of the table
        # when the position of the element is changed.
        delta_path = self.dg._get_delta_path_str()
        default_uuid = str(hash(delta_path))

        proto = ArrowProto()
        proto.use_container_width = use_container_width
        if width:
            proto.width = width
        if height:
            proto.height = height

        if column_order:
            proto.column_order[:] = column_order

        proto.editing_mode = ArrowProto.EditingMode.READ_ONLY

        marshall(proto, data, default_uuid)
        marshall_column_config(proto, column_config_mapping)

        return self.dg._enqueue("arrow_data_frame", proto)

    @gather_metrics("_arrow_table")
    def _arrow_table(self, data: Data = None) -> "DeltaGenerator":
        """Display a static table.

        This differs from `st._arrow_dataframe` in that the table in this case is
        static: its entire contents are laid out directly on the page.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, Iterable, dict, or None
            The table data.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 5),
        ...    columns=("col %d" % i for i in range(5)))
        ...
        >>> st._arrow_table(df)

        """

        # Check if data is uncollected, and collect it but with 100 rows max, instead of 10k rows, which is done in all other cases.
        # Avoid this and use 100 rows in st.table, because large tables render slowly, take too much screen space, and can crush the app.
        if type_util.is_snowpark_data_object(data) or type_util.is_type(
            data, type_util._PYSPARK_DF_TYPE_STR
        ):
            data = type_util.convert_anything_to_df(data, max_unevaluated_rows=100)

        # If pandas.Styler uuid is not provided, a hash of the position
        # of the element will be used. This will cause a rerender of the table
        # when the position of the element is changed.
        delta_path = self.dg._get_delta_path_str()
        default_uuid = str(hash(delta_path))

        proto = ArrowProto()
        marshall(proto, data, default_uuid)
        return self.dg._enqueue("arrow_table", proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall(proto: ArrowProto, data: Data, default_uuid: Optional[str] = None) -> None:
    """Marshall pandas.DataFrame into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, Iterable, dict, or None
        Something that is or can be converted to a dataframe.

    default_uuid : Optional[str]
        If pandas.Styler UUID is not provided, this value will be used.
        This attribute is optional and only used for pandas.Styler, other elements
        (e.g. charts) can ignore it.

    """
    if type_util.is_pandas_styler(data):
        # default_uuid is a string only if the data is a `Styler`,
        # and `None` otherwise.
        assert isinstance(
            default_uuid, str
        ), "Default UUID must be a string for Styler data."
        marshall_styler(proto, data, default_uuid)

    if isinstance(data, pa.Table):
        proto.data = type_util.pyarrow_table_to_bytes(data)
    else:
        df = type_util.convert_anything_to_df(data)
        proto.data = type_util.data_frame_to_bytes(df)
