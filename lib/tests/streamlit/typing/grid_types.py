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

    # Check that the container is usable anywhere a DeltaGenerator is expected.
    # The annotated assignment is the subtype check: assert_type here would only
    # see the DeltaGenerator annotation, so it could never fail.
    _grid_as_delta_generator: DeltaGenerator = grid()

    # Context manager returns Self
    with grid() as ctx:
        assert_type(ctx, GridContainer)

    # columns parameter accepts "auto" or int
    assert_type(grid("auto"), GridContainer)
    assert_type(grid(4), GridContainer)

    # min_column_width accepts "auto" or int
    assert_type(grid(4, min_column_width="auto"), GridContainer)
    assert_type(grid(4, min_column_width=200), GridContainer)

    # wrap accepts bool
    assert_type(grid(4, wrap=True), GridContainer)
    assert_type(grid(4, wrap=False), GridContainer)

    # gap accepts single value, tuple, or list
    assert_type(grid(gap="small"), GridContainer)
    assert_type(grid(gap=("medium", "small")), GridContainer)
    assert_type(grid(gap=["medium", "small"]), GridContainer)
    assert_type(grid(gap=(None, "small")), GridContainer)

    # vertical_alignment accepts literals
    assert_type(grid(vertical_alignment="top"), GridContainer)
    assert_type(grid(vertical_alignment="center"), GridContainer)
    assert_type(grid(vertical_alignment="bottom"), GridContainer)

    # border accepts bool
    assert_type(grid(border=True), GridContainer)
    assert_type(grid(border=False), GridContainer)

    # row_height accepts "content" or int
    assert_type(grid(row_height="content"), GridContainer)
    assert_type(grid(row_height=200), GridContainer)

    # width accepts "stretch" or int
    assert_type(grid(width="stretch"), GridContainer)
    assert_type(grid(width=400), GridContainer)

    # height accepts "content", "stretch", or int
    assert_type(grid(height="content"), GridContainer)
    assert_type(grid(height="stretch"), GridContainer)
    assert_type(grid(height=720), GridContainer)

    # key accepts str or int
    assert_type(grid(key="my_grid"), GridContainer)
    assert_type(grid(key=1), GridContainer)

    # dense accepts bool
    assert_type(grid(dense=True), GridContainer)
    assert_type(grid(dense=False), GridContainer)

    # cell method returns DeltaGenerator
    cell = grid().cell
    assert_type(cell(), DeltaGenerator)
    assert_type(cell(column_span=2), DeltaGenerator)
    assert_type(cell(column_span="all"), DeltaGenerator)
    assert_type(cell(row_span=2), DeltaGenerator)
    assert_type(cell(column_span=2, row_span=3), DeltaGenerator)
