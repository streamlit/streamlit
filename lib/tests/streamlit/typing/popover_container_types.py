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

"""Type tests for PopoverContainer."""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.layouts import LayoutsMixin
    from streamlit.elements.lib.mutable_popover_container import PopoverContainer

    popover = LayoutsMixin().popover

    # st.popover returns PopoverContainer
    assert_type(popover("Test"), PopoverContainer)

    # PopoverContainer is a DeltaGenerator (Liskov substitution)
    pop: DeltaGenerator = popover("Test")
    assert_type(pop, DeltaGenerator)

    # Context manager returns Self
    with popover("Test") as ctx:
        assert_type(ctx, PopoverContainer)

    # .open property returns bool | None
    assert_type(popover("Test").open, bool | None)

    # on_change accepts "ignore", "rerun", or a callable
    popover("Test", on_change="ignore")
    popover("Test", on_change="rerun")
    popover("Test", on_change=lambda: None)

    # Callback with args and kwargs
    def my_callback(prefix: str, suffix: str = "") -> None: ...

    popover("Test", on_change=my_callback, args=("hello",), kwargs={"suffix": "world"})

    # Callback without key is valid
    popover("Test", on_change=lambda: None)

    # Callback with key is also valid
    popover("Test", key="my_pop", on_change=lambda: None)
