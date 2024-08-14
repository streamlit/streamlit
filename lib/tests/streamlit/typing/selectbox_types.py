# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
    from enum import Enum

    from streamlit.elements.widgets.selectbox import SelectboxMixin

    selectbox = SelectboxMixin().selectbox

    class Alfred(Enum):
        HITCHCOCK = 1
        WALLACE = 2
        GREENE = 3

    assert_type(selectbox("foo", [1, 2, 3]), int)
    assert_type(selectbox("foo", [1, 2, 3], index=None), Union[int, None])
    assert_type(selectbox("foo", [1.0, 2.0, 3.0]), float)
    assert_type(selectbox("foo", [1.0, 2.0, 3.0], index=None), Union[float, None])
    assert_type(selectbox("foo", [1.0, 2, 3.0]), float)
    assert_type(selectbox("foo", [1.0, 2, 3.0], index=None), Union[float, None])
    assert_type(selectbox("foo", ["foo", "bar"]), str)
    assert_type(selectbox("foo", ["foo", "bar"], index=None), Union[str, None])
    assert_type(selectbox("foo", Alfred), Alfred)
    assert_type(selectbox("foo", [Alfred.HITCHCOCK, Alfred.GREENE]), Alfred)
    assert_type(selectbox("foo", Alfred, index=None), Union[Alfred, None])
    assert_type(selectbox("foo", [1, Alfred.HITCHCOCK, "five"], index=None), object)
