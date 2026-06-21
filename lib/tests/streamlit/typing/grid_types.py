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

"""Type tests for st.grid."""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.layouts import LayoutsMixin
    from streamlit.elements.lib.grid_container import GridContainer

    grid = LayoutsMixin().grid

    # st.grid returns GridContainer
    assert_type(grid(), GridContainer)

    # GridContainer is a DeltaGenerator (Liskov substitution)
    g: DeltaGenerator = grid()
    assert_type(g, DeltaGenerator)

    # Context manager returns Self
    with grid() as ctx:
        assert_type(ctx, GridContainer)

    # columns parameter accepts "auto" or int
    assert_type(grid("auto"), GridContainer)
    assert_type(grid(4), GridContainer)

    # min_column_width accepts int or None
    assert_type(grid(4, min_column_width=200), GridContainer)
    assert_type(grid(4, min_column_width=None), GridContainer)

    # gap accepts single value or tuple
    assert_type(grid(gap="small"), GridContainer)
    assert_type(grid(gap=("medium", "small")), GridContainer)
    assert_type(grid(gap=(None, "small")), GridContainer)

    # vertical_alignment accepts literals
    assert_type(grid(vertical_alignment="top"), GridContainer)
    assert_type(grid(vertical_alignment="center"), GridContainer)
    assert_type(grid(vertical_alignment="bottom"), GridContainer)

    # border accepts bool
    assert_type(grid(border=True), GridContainer)
    assert_type(grid(border=False), GridContainer)

    # cell_height accepts literals or int
    assert_type(grid(cell_height="content"), GridContainer)
    assert_type(grid(cell_height="equal"), GridContainer)
    assert_type(grid(cell_height=200), GridContainer)

    # width accepts "stretch" or int
    assert_type(grid(width="stretch"), GridContainer)
    assert_type(grid(width=400), GridContainer)

    # dense accepts bool
    assert_type(grid(dense=True), GridContainer)
    assert_type(grid(dense=False), GridContainer)

    # span method returns DeltaGenerator
    span = grid().span
    assert_type(span(), DeltaGenerator)
    assert_type(span(columns=2), DeltaGenerator)
    assert_type(span(rows=2), DeltaGenerator)
    assert_type(span(columns=2, rows=3), DeltaGenerator)
