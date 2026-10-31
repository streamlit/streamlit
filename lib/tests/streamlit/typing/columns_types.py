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
    from typing import Literal

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.layouts import LayoutsMixin
    from streamlit.elements.lib.layout_utils import Gap, WidthWithoutContent

    columns = LayoutsMixin().columns
    container = LayoutsMixin().container

    # Integer literals 1-6 are fixed-length tuples.
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

    # Unpacking succeeds when the tuple length matches, and fails otherwise.
    _left, _right = columns(2)
    _wrong_left, _wrong_right = columns(3)  # type: ignore[misc]  # ty: ignore[invalid-assignment]

    # Keyword spec matches the same overloads.
    assert_type(columns(spec=2), tuple[DeltaGenerator, DeltaGenerator])

    # A non-literal int and a count outside 1-6 stay lists.
    # `count: int = 2` is still Literal[2] for ty, so index a list[int] to
    # get a plain int.
    column_counts: list[int] = [2]
    column_count = column_counts[0]
    assert_type(columns(column_count), list[DeltaGenerator])
    assert_type(columns(7), list[DeltaGenerator])

    # Width tuples of length 1-6 are fixed-length tuples.
    assert_type(columns((1,)), tuple[DeltaGenerator])
    assert_type(columns((1, 2)), tuple[DeltaGenerator, DeltaGenerator])
    assert_type(columns((0.7, 0.3)), tuple[DeltaGenerator, DeltaGenerator])
    assert_type(columns((1, 0.5)), tuple[DeltaGenerator, DeltaGenerator])
    assert_type(
        columns((1, 2, 3)), tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator]
    )
    assert_type(
        columns((1, 2, 3, 4)),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns((1, 2, 3, 4, 5)),
        tuple[
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
        ],
    )
    assert_type(
        columns((1, 2, 3, 4, 5, 6)),
        tuple[
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
        ],
    )
    assert_type(columns(spec=(1, 2)), tuple[DeltaGenerator, DeltaGenerator])
    _width_left, _width_right = columns((1, 2))
    _bad_left, _bad_right = columns((1, 2, 3))  # type: ignore[misc]  # ty: ignore[invalid-assignment]

    two_widths: tuple[int, int] = (1, 2)
    assert_type(columns(two_widths), tuple[DeltaGenerator, DeltaGenerator])
    float_widths: tuple[float, float] = (0.7, 0.3)
    assert_type(columns(float_widths), tuple[DeltaGenerator, DeltaGenerator])

    # A list of widths has no known length, so it stays a list. Tuples longer
    # than 6, and tuples of unknown length, stay lists too.
    assert_type(columns([0.7, 0.3]), list[DeltaGenerator])
    assert_type(columns([3, 1]), list[DeltaGenerator])
    assert_type(columns((1, 2, 3, 4, 5, 6, 7)), list[DeltaGenerator])
    # `many: tuple[int, ...] = (1, 2, 3)` stays a 3-tuple for ty. Index a
    # list so the length is unknown to both checkers.
    width_groups: list[tuple[int, ...]] = [(1, 2, 3)]
    many_widths = width_groups[0]
    assert_type(columns(many_widths), list[DeltaGenerator])
    widths: Sequence[int | float] = [1, 2]
    assert_type(columns(widths), list[DeltaGenerator])

    # Sequence accepts both a width tuple and a list.
    _from_tuple: Sequence[DeltaGenerator] = columns((1, 2))
    _from_list: Sequence[DeltaGenerator] = columns([1, 2])

    # A literal count or a known-length width tuple is not typed as a list.
    _as_list: list[DeltaGenerator] = columns(2)  # type: ignore[assignment]  # ty: ignore[invalid-assignment]
    _tuple_as_list: list[DeltaGenerator] = columns((1, 2))  # type: ignore[assignment]  # ty: ignore[invalid-assignment]

    # One name cannot hold specs that infer different types. ty rebinds the
    # name to the second assignment instead of reporting an error.
    shared_columns = columns(2)
    shared_columns = columns([3, 1])  # type: ignore[assignment]
    shared_lengths = columns(2)
    shared_lengths = columns(3)  # type: ignore[assignment]

    # Widen gap, alignment, and width the same way as the count. An
    # annotated literal such as `gap: Gap | None = "medium"` stays
    # Literal["medium"] for ty.
    gaps: list[Gap | None] = ["medium"]
    gap = gaps[0]
    alignments: list[Literal["top", "center", "bottom"]] = ["bottom"]
    vertical_alignment = alignments[0]
    column_widths: list[WidthWithoutContent] = ["stretch"]
    width = column_widths[0]
    # Every literal overload must accept these keywords. If one drops a
    # parameter, the call falls through to the list overload.
    assert_type(
        columns(
            1,
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[DeltaGenerator],
    )
    assert_type(
        columns(
            2,
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(
            3,
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(
            4,
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(
            5,
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
        ],
    )
    assert_type(
        columns(
            6,
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
        ],
    )
    assert_type(
        columns(
            column_count,
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        list[DeltaGenerator],
    )
    # Width-tuple overloads accept the same keywords as the count overloads.
    # If one drops a parameter, the call falls through to the list overload.
    assert_type(
        columns(
            (1,),
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[DeltaGenerator],
    )
    assert_type(
        columns(
            (1, 2),
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(
            (1, 2, 3),
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(
            (1, 2, 3, 4),
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[DeltaGenerator, DeltaGenerator, DeltaGenerator, DeltaGenerator],
    )
    assert_type(
        columns(
            (1, 2, 3, 4, 5),
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
        ],
    )
    assert_type(
        columns(
            (1, 2, 3, 4, 5, 6),
            gap=gap,
            vertical_alignment=vertical_alignment,
            border=True,
            width=width,
            wrap=False,
        ),
        tuple[
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
            DeltaGenerator,
        ],
    )

    # st.container accepts gap size strings, None, and pixel integers.
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
