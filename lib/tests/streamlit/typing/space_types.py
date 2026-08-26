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

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.space import SpaceMixin

    space = SpaceMixin().space

    # =====================================================================
    # st.space return type tests
    # =====================================================================

    # Default size - returns DeltaGenerator
    assert_type(space(), DeltaGenerator)

    # Size literals
    assert_type(space("xxsmall"), DeltaGenerator)
    assert_type(space("xsmall"), DeltaGenerator)
    assert_type(space("small"), DeltaGenerator)
    assert_type(space("medium"), DeltaGenerator)
    assert_type(space("large"), DeltaGenerator)
    assert_type(space("xlarge"), DeltaGenerator)
    assert_type(space("xxlarge"), DeltaGenerator)
    assert_type(space("stretch"), DeltaGenerator)

    # Size as keyword argument
    assert_type(space(size="small"), DeltaGenerator)
    assert_type(space(size="medium"), DeltaGenerator)
    assert_type(space(size="stretch"), DeltaGenerator)

    # Size as int (pixels)
    assert_type(space(100), DeltaGenerator)
    assert_type(space(size=50), DeltaGenerator)
    assert_type(space(size=200), DeltaGenerator)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid size literal
    space("tiny")  # type: ignore[arg-type]
    space(size="full")  # type: ignore[arg-type]

    # Invalid size type
    space(1.5)  # type: ignore[arg-type]
    space(size=None)  # type: ignore[arg-type]
