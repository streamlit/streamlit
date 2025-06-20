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

from typing import TYPE_CHECKING, Union

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are incorrect.
if TYPE_CHECKING:
    from streamlit.elements.widgets.button_group import ButtonGroupMixin

    segmented_control = ButtonGroupMixin().segmented_control

    options: list[int] = [1, 2, 3]
    assert_type(
        segmented_control("foo", options),
        Union[int, None],
    )
    assert_type(
        segmented_control("foo", options, default=1),
        Union[int, None],
    )
    assert_type(
        segmented_control("foo", options, selection_mode="single"),
        Union[int, None],
    )
    assert_type(
        segmented_control("foo", options, selection_mode="single", default=1),
        Union[int, None],
    )
    assert_type(
        segmented_control("foo", options, selection_mode="multi"),
        list[int],
    )
    assert_type(
        segmented_control("foo", options, selection_mode="multi", default=1),
        list[int],
    )
    assert_type(
        segmented_control("foo", options, selection_mode="multi", default=[1]),
        list[int],
    )
