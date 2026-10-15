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

"""Type tests for st.columns and st.container."""

from __future__ import annotations

from typing import TYPE_CHECKING, assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from collections.abc import Sequence

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.layouts import LayoutsMixin

    columns = LayoutsMixin().columns
    container = LayoutsMixin().container

    # Integer literals 1-6 are fixed-length tuples so unpacking is checked.
    assert_type(columns(1), tuple[DeltaGenerator])
    assert_type(columns(2), tuple[DeltaGenerator, DeltaGenerator])
    assert_type(columns(3), tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator])
    assert_type(
        columns(4),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(5),
        tuple[
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
        ],
    )
    assert_type(
        columns(6),
        tuple[
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
        ],
    )

    (only,) = columns(1)
    assert_type(only, DeltaGenerator)

    left, right = columns(2)
    assert_type(left, DeltaGenerator)
    assert_type(right, DeltaGenerator)

    first, _middle, _last = columns(3)
    assert_type(first, DeltaGenerator)

    _c1, _c2, _c3, _c4, _c5, _c6 = columns(6)
    assert_type(_c1, DeltaGenerator)

    # Keyword spec matches the same overloads.
    assert_type(columns(spec=2), tuple[DeltaGenerator, DeltaGenerator])

    # A non-literal int, a count outside 1-6, and width specs stay lists.
    # Indexing list[int] stays a plain int. Annotating `count: int = 2` is
    # still Literal[2] for ty, which would select the tuple overload.
    column_counts: list[int] = [2]
    column_count = column_counts[0]
    assert_type(columns(column_count), list[DeltaGenerator])
    assert_type(columns(7), list[DeltaGenerator])
    assert_type(columns([0.7, 0.3]), list[DeltaGenerator])
    assert_type(columns([3, 1]), list[DeltaGenerator])
    assert_type(columns((1, 2, 3)), list[DeltaGenerator])
    widths: Sequence[int | float] = [1, 2]
    assert_type(columns(widths), list[DeltaGenerator])

    # Unpacking a different length is a type error.
    _bad_left, _bad_right = columns(3)  # type: ignore[misc]  # ty: ignore[invalid-assignment]

    # A literal count is not a list.
    _as_list: list[DeltaGenerator] = columns(2)  # type: ignore[assignment]  # ty: ignore[invalid-assignment]

    # Other parameters keep the literal return type.
    assert_type(
        columns(3, gap="xxsmall"),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(3, gap="xsmall"),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(3, gap="small"),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(3, gap="medium"),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(3, gap="large"),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(3, gap="xlarge"),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(3, gap="xxlarge"),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(3, gap=None),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(3, gap=0),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(3, gap=20),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(3, gap=100),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(2, vertical_alignment="top"),
        tuple[DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(2, vertical_alignment="center"),
        tuple[DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(2, vertical_alignment="bottom"),
        tuple[DeltaGenerator, DeltaGenerator],
    )
    assert_type(columns(2, border=True), tuple[DeltaGenerator, DeltaGenerator])
    assert_type(columns(2, border=False), tuple[DeltaGenerator, DeltaGenerator])
    assert_type(columns(2, width="stretch"), tuple[DeltaGenerator, DeltaGenerator])
    assert_type(columns(2, width=300), tuple[DeltaGenerator, DeltaGenerator])
    assert_type(
        columns(3, wrap=True), tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator]
    )
    assert_type(
        columns(3, wrap=False),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(
            2,
            gap="medium",
            vertical_alignment="bottom",
            border=True,
            width=400,
            wrap=False,
        ),
        tuple[DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(
            column_count,
            gap=None,
            vertical_alignment="top",
            border=False,
            width="stretch",
            wrap=True,
        ),
        list[DeltaGenerator],
    )

    # st.container accepts the same range of gap values.
    assert_type(container(gap="small"), DeltaGenerator)
    assert_type(container(gap="medium"), DeltaGenerator)
    assert_type(container(gap=None), DeltaGenerator)
    assert_type(container(gap=0), DeltaGenerator)
    assert_type(container(gap=20), DeltaGenerator)

    # st.container accepts layout parameters together.
    assert_type(
        container(
            border=True,
            key="scrolling-row",
            width=640,
            height=320,
            horizontal=True,
            wrap=False,
            horizontal_alignment="center",
            vertical_alignment="bottom",
            autoscroll=True,
        ),
        DeltaGenerator,
    )
