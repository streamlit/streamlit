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

from typing import TYPE_CHECKING, Literal

from streamlit import dataframe_util
from streamlit.proto.PivotTable_pb2 import PivotTable as PivotTableProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.dataframe_util import Data
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import Height, Width


class PivotTableMixin:
    @gather_metrics("pivot_table")
    def pivot_table(
        self,
        data: Data,
        *,
        _width: Width = "stretch",
        _height: Height = "auto",
        border_mode: Literal["none", "horizontal", "vertical", "all"] = "all",
    ) -> DeltaGenerator:
        """Display a configurable pivot table.

        Users can configure rows, columns, values, and filters through
        an interactive dialog accessed via the toolbar.

        Parameters
        ----------
        data : dataframe-like
            The data to display in the pivot table. Accepts the same data types
            as ``st.dataframe``, including pandas DataFrames, lists, dicts, and
            other collection types.

        width : "stretch", "content", or int
            The width configuration for the pivot table. This can be one of the
            following:

            - ``"stretch"`` (default): The width matches the parent container.
            - ``"content"``: The width matches the content width, but doesn't
              exceed the parent container width.
            - An integer specifying the width in pixels.

        height : "auto", "content", "stretch", or int
            The height configuration for the pivot table. This can be one of the
            following:

            - ``"auto"`` (default): Streamlit sets the height to show at most
              ten rows.
            - ``"content"``: The height matches the content height.
            - ``"stretch"``: The height expands to fill available vertical space.
            - An integer specifying the height in pixels.

        border_mode : "none", "horizontal", "vertical", or "all"
            The border display mode. This controls which borders are shown:

            - ``"all"`` (default): Show all borders.
            - ``"none"``: Show no borders.
            - ``"horizontal"``: Show only horizontal borders between rows.
            - ``"vertical"``: Show only vertical borders between columns.

        Returns
        -------
        DeltaGenerator
            An internal placeholder for the pivot table element.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>>
        >>> df = pd.DataFrame(
        ...     {
        ...         "Category": ["Electronics", "Clothing", "Electronics"],
        ...         "Country": ["USA", "USA", "UK"],
        ...         "Sales": [1000, 200, 1500],
        ...         "Quantity": [10, 20, 8],
        ...     }
        ... )
        >>>
        >>> st.pivot_table(df)

        """
        pivot_table_proto = PivotTableProto()

        # Convert data to Arrow format
        pivot_table_proto.data = dataframe_util.convert_anything_to_arrow_bytes(data)

        # Set border mode
        border_mode_map = {
            "none": PivotTableProto.BorderMode.NONE,
            "horizontal": PivotTableProto.BorderMode.HORIZONTAL,
            "vertical": PivotTableProto.BorderMode.VERTICAL,
            "all": PivotTableProto.BorderMode.ALL,
        }
        pivot_table_proto.border_mode = border_mode_map[border_mode]

        # Initial config is empty (user will configure via UI)
        pivot_table_proto.pivot_config = ""

        return self.dg._enqueue("pivot_table", pivot_table_proto)
