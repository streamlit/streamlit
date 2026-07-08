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

"""Type tests for st.columns and st.container gap parameter."""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.layouts import LayoutsMixin

    columns = LayoutsMixin().columns
    container = LayoutsMixin().container

    # st.columns accepts the size string literals for gap.
    assert_type(columns(3, gap="xxsmall"), list[DeltaGenerator])
    assert_type(columns(3, gap="xsmall"), list[DeltaGenerator])
    assert_type(columns(3, gap="small"), list[DeltaGenerator])
    assert_type(columns(3, gap="medium"), list[DeltaGenerator])
    assert_type(columns(3, gap="large"), list[DeltaGenerator])
    assert_type(columns(3, gap="xlarge"), list[DeltaGenerator])
    assert_type(columns(3, gap="xxlarge"), list[DeltaGenerator])
    assert_type(columns(3, gap=None), list[DeltaGenerator])

    # st.columns accepts int for the gap parameter (pixel gap).
    assert_type(columns(3, gap=0), list[DeltaGenerator])
    assert_type(columns(3, gap=20), list[DeltaGenerator])
    assert_type(columns(3, gap=100), list[DeltaGenerator])

    # st.container accepts the same range of gap values.
    assert_type(container(gap="small"), DeltaGenerator)
    assert_type(container(gap="medium"), DeltaGenerator)
    assert_type(container(gap=None), DeltaGenerator)
    assert_type(container(gap=0), DeltaGenerator)
    assert_type(container(gap=20), DeltaGenerator)
