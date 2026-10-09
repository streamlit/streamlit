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

from typing import TYPE_CHECKING, Literal

from typing_extensions import Self

from streamlit.delta_generator import DeltaGenerator
from streamlit.elements.lib.layout_utils import (
    get_align,
    get_gap_config,
    get_justify,
    is_int,
    validate_uint32_max,
)
from streamlit.errors import (
    StreamlitInvalidParameterTypeError,
    StreamlitValueError,
    StreamlitValueOutOfRangeError,
)
from streamlit.proto.Block_pb2 import Block as BlockProto

if TYPE_CHECKING:
    from streamlit.cursor import Cursor


class GridContainer(DeltaGenerator):
    """Container returned by ``st.grid``.

    Use ``with`` notation or method chaining to add cells. ``cell()`` groups
    several elements into one cell and can span columns or rows.
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

    def __enter__(self) -> Self:  # type: ignore[override]  # ty: ignore[invalid-method-override]
        super().__enter__()
        return self

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
            The number of columns the cell spans. This can be one of the
            following:

            - A positive integer (default is ``1``): The cell spans this
              many columns. If the grid wraps to fewer columns, the span
              shrinks to fit. If ``columns`` is an integer, this can't
              exceed it.
            - ``"all"``: The cell spans every column on its own row.

        row_span : int
            The number of rows the cell spans. Defaults to ``1``.
            Must be a positive integer. With ``row_height="content"``,
            the rows it covers grow to fit this cell. With a pixel
            ``row_height``, the cell covers that many row tracks plus
            the gaps between them.

        Returns
        -------
        DeltaGenerator
            A container object that supports ``with`` notation or method calls.

        Examples
        --------
        Group a metric and caption in one cell, and span a featured card.

        >>> import streamlit as st
        >>>
        >>> grid = st.grid(4, border=True)
        >>> with grid.cell():
        ...     st.metric("Revenue", "$1.2M", "+8%")
        ...     st.caption("Trailing 30 days")
        >>> with grid.cell(column_span="all"):
        ...     st.markdown("**Featured**")

        .. output::
            https://doc-grid-cell.streamlit.app/
            height: 220px

        """
        if isinstance(column_span, str) and column_span == "all":
            validated_column_span: Literal["all"] | int = "all"
        elif isinstance(column_span, str):  # type: ignore[unreachable]
            raise StreamlitValueError(
                "column_span",
                ['"all"', "a positive integer"],
                detail=f"Got {column_span!r}.",
            )
        elif not is_int(column_span):
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
            validate_uint32_max("column_span", column_span)
            declared_columns = self._declared_columns
            if declared_columns != "auto" and column_span > declared_columns:
                raise StreamlitValueOutOfRangeError(
                    "column_span",
                    column_span,
                    1,
                    declared_columns,
                )
            validated_column_span = column_span

        if not is_int(row_span):
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
        validate_uint32_max("row_span", row_span)

        block_proto = BlockProto()
        block_proto.allow_empty = True
        # Match st.container()'s vertical flex container so cells do not
        # depend on the legacy `vertical` proto.
        block_proto.flex_container.direction = (
            BlockProto.FlexContainer.Direction.VERTICAL
        )
        block_proto.flex_container.wrap = False
        block_proto.flex_container.justify = get_justify("top")
        block_proto.flex_container.align = get_align("left")
        block_proto.flex_container.gap_config.CopyFrom(get_gap_config("small"))
        block_proto.flex_container.border = False
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
