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

"""Type tests for TabContainer."""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from collections.abc import Sequence

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.layouts import LayoutsMixin
    from streamlit.elements.lib.mutable_tab_container import TabContainer

    tabs = LayoutsMixin().tabs

    # st.tabs returns Sequence[TabContainer]
    assert_type(tabs(["A", "B", "C"]), Sequence[TabContainer])

    # Tab unpacking works correctly
    tab1, tab2, tab3 = tabs(["A", "B", "C"])
    assert_type(tab1, TabContainer)
    assert_type(tab2, TabContainer)
    assert_type(tab3, TabContainer)

    # TabContainer is a DeltaGenerator (Liskov substitution)
    tab_list: Sequence[DeltaGenerator] = tabs(["A", "B"])
    assert_type(tab_list, Sequence[DeltaGenerator])

    # Context manager returns Self
    with tabs(["A", "B"])[0] as ctx:
        assert_type(ctx, TabContainer)

    # .open property returns bool | None
    assert_type(tabs(["A", "B"])[0].open, bool | None)

    # --- Callback support ---

    def valid_callback() -> None:
        pass

    def callback_with_args(arg1: str, arg2: int) -> None:
        pass

    # Valid usages — should type check
    assert_type(tabs(["A", "B"], on_change="rerun"), Sequence[TabContainer])
    assert_type(
        tabs(["A", "B"], on_change=valid_callback, key="t1"), Sequence[TabContainer]
    )
    assert_type(
        tabs(
            ["A", "B"],
            on_change=callback_with_args,
            args=("test", 1),
            key="t2",
        ),
        Sequence[TabContainer],
    )
    assert_type(
        tabs(
            ["A", "B"],
            on_change=callback_with_args,
            kwargs={"arg1": "test", "arg2": 1},
            key="t3",
        ),
        Sequence[TabContainer],
    )

    # Invalid usages — should NOT type check
    tabs(["A", "B"], on_change=123)  # type: ignore[arg-type]
