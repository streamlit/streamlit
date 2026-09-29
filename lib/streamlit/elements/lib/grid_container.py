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

from numbers import Integral
from typing import TYPE_CHECKING, Literal

from typing_extensions import Self

from streamlit.delta_generator import DeltaGenerator
from streamlit.errors import (
    StreamlitInvalidParameterTypeError,
    StreamlitValueError,
    StreamlitValueOutOfRangeError,
)
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.cursor import Cursor


def _is_int(value: object) -> bool:
    """Return True for real ints, excluding ``bool`` (a subclass of ``int``)."""
    return isinstance(value, Integral) and not isinstance(value, bool)


class GridContainer(DeltaGenerator):
    """A DeltaGenerator for grid containers that supports ``cell()``.

    This class extends DeltaGenerator to provide the ``cell()`` method,
    which groups elements into one cell and can span columns or rows.
    """

    def __init__(
        self,
        root_container: int | None = None,
        cursor: Cursor | None = None,
        parent: DeltaGenerator | None = None,
        block_type: str | None = None,
    ) -> None:
        super().__init__(root_container, cursor, parent, block_type)
        self._declared_columns: Literal["auto"] | int = "auto"

    def __enter__(self) -> Self:  # type: ignore[override]
        super().__enter__()
        return self

    @gather_metrics("grid.cell")
    def cell(
        self,
        *,
        column_span: int | Literal["all"] = 1,
        row_span: int = 1,
    ) -> DeltaGenerator:
        r"""Create the next auto-placed grid cell.

        With no arguments this groups multiple elements into one cell.
        ``column_span`` and ``row_span`` occupy more tracks. The returned
        object works with ``with`` notation or method chaining.

        Parameters
        ----------
        column_span : int or "all"
            Number of columns this cell should span. Defaults to 1.
            ``"all"`` occupies every column track on its own row.

        row_span : int
            Number of rows this cell should span. Defaults to 1.
            Must be a positive integer.

        Returns
        -------
        DeltaGenerator
            A container object that supports ``with`` notation or method calls.

        Examples
        --------
        Group a metric and caption in one cell, and span a featured card.

        >>> import streamlit as st
        >>>
        >>> grid = st.grid(4, border=True, row_height="equal")
        >>> with grid.cell():
        ...     st.metric("Revenue", "$1.2M", "+8%")
        ...     st.caption("Trailing 30 days")
        >>> with grid.cell(column_span="all"):
        ...     st.markdown("**Featured**")

        .. output::
            https://doc-grid-cell.streamlit.app/
            height: 220px

        """
        if column_span == "all":
            validated_column_span: Literal["all"] | int = "all"
        elif isinstance(column_span, str):
            raise StreamlitValueError(
                "column_span",
                ['"all"', "a positive integer"],
                detail=f"Got {column_span!r}.",
            )
        elif not _is_int(column_span):
            raise StreamlitInvalidParameterTypeError(
                "column_span",
                type(column_span).__name__,
                ["int", '"all"'],
            )
        elif column_span < 1:
            raise StreamlitValueError(
                "column_span",
                ['"all"', "a positive integer"],
                detail=f"Got {column_span!r}.",
            )
        else:
            declared_columns = self._declared_columns
            if declared_columns != "auto" and column_span > declared_columns:
                raise StreamlitValueOutOfRangeError(
                    "column_span",
                    column_span,
                    1,
                    declared_columns,
                )
            validated_column_span = column_span

        if not _is_int(row_span):
            raise StreamlitInvalidParameterTypeError(
                "row_span",
                type(row_span).__name__,
                ["int"],
            )
        if row_span < 1:
            raise StreamlitValueError(
                "row_span",
                ["a positive integer"],
                detail=f"Got {row_span!r}.",
            )

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.vertical.SetInParent()
        # Always set grid_cell so the frontend treats this block as a
        # column-like wrap region even for the default 1x1 span.
        block_proto.grid_cell.SetInParent()

        if validated_column_span == "all":
            block_proto.grid_cell.column_span_all = True
        elif validated_column_span > 1:
            block_proto.grid_cell.column_span = validated_column_span

        if row_span > 1:
            block_proto.grid_cell.row_span = row_span

        return self.dg._block(block_proto)
