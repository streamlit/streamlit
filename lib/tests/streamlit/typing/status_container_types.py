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

"""Type tests for StatusContainer."""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.layouts import LayoutsMixin
    from streamlit.elements.lib.mutable_status_container import StatusContainer

    status = LayoutsMixin().status

    # st.status returns StatusContainer
    assert_type(status("Test"), StatusContainer)

    # StatusContainer is a DeltaGenerator (Liskov substitution)
    s: DeltaGenerator = status("Test")
    assert_type(s, DeltaGenerator)

    # Context manager returns Self
    with status("Test") as ctx:
        assert_type(ctx, StatusContainer)

    # state parameter accepts string literals
    assert_type(status("Test", state="running"), StatusContainer)
    assert_type(status("Test", state="complete"), StatusContainer)
    assert_type(status("Test", state="error"), StatusContainer)

    # type parameter accepts "default" or "compact"
    assert_type(status("Test", type="default"), StatusContainer)
    assert_type(status("Test", type="compact"), StatusContainer)
