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
    from streamlit.elements.empty import EmptyMixin

    empty = EmptyMixin().empty

    # =====================================================================
    # st.empty return type tests
    # =====================================================================

    # Basic usage - returns a single-element container
    assert_type(empty(), DeltaGenerator)

    # Returned container can be written to directly
    placeholder = empty()
    assert_type(placeholder.markdown("Hello"), DeltaGenerator)
    assert_type(placeholder.write("Hello"), None)

    # Calling empty() on the placeholder clears it and still returns DeltaGenerator
    assert_type(placeholder.empty(), DeltaGenerator)

    # Documented ``with st.empty():`` form. DeltaGenerator.__enter__ returns None
    # (and does so at runtime), so the with-target is None rather than the container.
    with empty():
        pass

    with empty() as ctx:
        assert_type(ctx, None)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # empty() takes no arguments
    empty("content")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
    empty(key="placeholder")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    empty(width="stretch")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
