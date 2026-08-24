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

if TYPE_CHECKING:
    import streamlit as st

    # =====================================================================
    # @st.fragment decorator type tests
    # =====================================================================

    # Bare decorator - preserves function signature
    @st.fragment
    def bare_fragment() -> None:
        pass

    assert_type(bare_fragment(), None)

    # With run_every parameter
    @st.fragment(run_every=5.0)
    def timed_fragment() -> int:
        return 42

    assert_type(timed_fragment(), int)

    # With run_every as string
    @st.fragment(run_every="1m")
    def timed_fragment_str() -> str:
        return "result"

    assert_type(timed_fragment_str(), str)

    # With key parameter
    @st.fragment(key="charts")
    def keyed_fragment() -> None:
        pass

    assert_type(keyed_fragment(), None)

    # With key=None (default)
    @st.fragment(key=None)
    def fragment_no_key() -> None:
        pass

    assert_type(fragment_no_key(), None)

    # With parallel parameter
    @st.fragment(parallel=True)
    def parallel_fragment() -> list[int]:
        return [1, 2, 3]

    assert_type(parallel_fragment(), list[int])

    # With all parameters
    @st.fragment(run_every=10, parallel=False, key="dashboard")
    def full_fragment() -> bool:
        return True

    assert_type(full_fragment(), bool)

    # Fragment with arguments - preserves callable signature
    @st.fragment(key="parameterized")
    def fragment_with_args(x: int, y: str) -> float:
        return float(x)

    assert_type(fragment_with_args(1, "a"), float)
