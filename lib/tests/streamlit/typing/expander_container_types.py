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

"""Type tests for ExpanderContainer."""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.layouts import LayoutsMixin
    from streamlit.elements.lib.mutable_expander_container import ExpanderContainer

    expander = LayoutsMixin().expander

    # st.expander returns ExpanderContainer
    assert_type(expander("Test"), ExpanderContainer)

    # ExpanderContainer is a DeltaGenerator (Liskov substitution)
    exp: DeltaGenerator = expander("Test")
    assert_type(exp, DeltaGenerator)

    # Context manager returns Self
    with expander("Test") as ctx:
        assert_type(ctx, ExpanderContainer)

    # .open property returns bool | None
    assert_type(expander("Test").open, bool | None)
