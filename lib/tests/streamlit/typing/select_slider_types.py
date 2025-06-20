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

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are incorrect.
if TYPE_CHECKING:
    from enum import Enum

    from streamlit.elements.widgets.select_slider import SelectSliderMixin

    select_slider = SelectSliderMixin().select_slider

    class Alfred(Enum):
        HITCHCOCK = 1
        WALLACE = 2
        GREENE = 3

    assert_type(select_slider("foo", [1, 2, 3]), int)
    assert_type(select_slider("foo", [1, 2, 3], value=2), int)
    assert_type(select_slider("foo", [1, 2, 3], value=(1, 3)), tuple[int, int])
    assert_type(select_slider("foo", [1.0, 2.0, 3.0]), float)
    assert_type(select_slider("foo", [1.0, 2.0, 3.0], value=3.0), float)
    assert_type(
        select_slider("foo", [1.0, 2.0, 3.0], value=(2.0, 3.0)), tuple[float, float]
    )
    assert_type(select_slider("foo", ["foo", "bar"]), str)
    assert_type(select_slider("foo", Alfred), Alfred)
    assert_type(select_slider("foo", [Alfred.HITCHCOCK, Alfred.GREENE]), Alfred)
    assert_type(
        select_slider("foo", [1, Alfred.HITCHCOCK, "five"], value="five"), object
    )
    assert_type(
        select_slider("foo", [1, Alfred.HITCHCOCK, "five"], value=[1, "five"]),
        tuple[object, object],
    )
    assert_type(
        select_slider("foo", ([1], [2], [3]), value=[[1], [2]]),
        tuple[list[int], list[int]],
    )
    opt: list[object] = [1, 2, "4"]
    assert_type(select_slider("foo", options=opt, value=[1, 2]), object)
    # See note in select_slider.py; we can't really tell mypy that this will return a
    # tuple[object, object] since value: Sequence[int] is a subtype of object.
    # Technically this return type isn't wrong (tuple[object, object] is a subtype
    # of object), it's just not as specific as we'd like.
