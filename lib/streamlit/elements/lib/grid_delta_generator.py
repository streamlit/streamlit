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

from typing import TYPE_CHECKING

from typing_extensions import Self

from streamlit.delta_generator import DeltaGenerator
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.cursor import Cursor


class GridDeltaGenerator(DeltaGenerator):
    """A DeltaGenerator for grid containers that supports cell spanning.

    This class extends DeltaGenerator to provide the span() method,
    which allows creating grid cells that span multiple columns and/or rows.
    """

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ) -> None:
        super().__init__(root_container, cursor, parent, block_type)

    def __enter__(self) -> Self:  # type: ignore[override]
        super().__enter__()
        return self

    @gather_metrics("span")
    def span(
        self,
        columns: int = 1,
        rows: int = 1,
    ) -> DeltaGenerator:
        r"""Create a grid cell that spans multiple columns and/or rows.

        This method creates a container within the grid that can span multiple
        columns or rows. Each call creates a new grid cell with the specified
        span configuration.

        Parameters
        ----------
        columns : int
            Number of columns this cell should span. Defaults to 1.
            Must be a positive integer.

        rows : int
            Number of rows this cell should span. Defaults to 1.
            Must be a positive integer.

        Returns
        -------
        DeltaGenerator
            A container object that supports ``with`` notation or method calls.

        Examples
        --------
        Create a grid where one cell spans 2 columns.

        >>> import streamlit as st
        >>>
        >>> grid = st.grid(4, min_column_width=200, border=True)
        >>>
        >>> with grid.span(columns=2):
        ...     st.markdown("This spans 2 columns")
        >>> with grid.container():
        ...     st.markdown("Cell 2")
        >>> with grid.container():
        ...     st.markdown("Cell 3")

        """
        # Validate columns
        if not isinstance(columns, int) or columns < 1:
            raise StreamlitAPIException(
                f"`columns` must be a positive integer. Got: {columns!r}"
            )

        # Validate rows
        if not isinstance(rows, int) or rows < 1:
            raise StreamlitAPIException(
                f"`rows` must be a positive integer. Got: {rows!r}"
            )

        # Build the proto
        block_proto = BlockProto()
        block_proto.allow_empty = True

        # Set vertical container (acts as a regular container within the grid cell)
        block_proto.vertical.SetInParent()

        # Set grid cell span information
        if columns > 1:
            block_proto.grid_cell.column_span = columns
        if rows > 1:
            block_proto.grid_cell.row_span = rows

        return self.dg._block(block_proto)
