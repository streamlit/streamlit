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

from typing import TYPE_CHECKING, NoReturn

from typing_extensions import assert_type

if TYPE_CHECKING:
    import streamlit as st

    # =====================================================================
    # st.rerun return type tests
    # =====================================================================

    # Default scope ("app") - returns NoReturn
    assert_type(st.rerun(), NoReturn)

    # Explicit scope literals
    assert_type(st.rerun(scope="app"), NoReturn)
    assert_type(st.rerun(scope="fragment"), NoReturn)

    # Positional scope (str key)
    assert_type(st.rerun("app"), NoReturn)
    assert_type(st.rerun("fragment"), NoReturn)
    assert_type(st.rerun("charts"), NoReturn)

    # Keyed scope - single key
    assert_type(st.rerun(scope="charts"), NoReturn)
    assert_type(st.rerun(scope="sidebar-filters"), NoReturn)

    # Keyed scope - list of keys
    assert_type(st.rerun(scope=["charts", "summary"]), NoReturn)
    assert_type(st.rerun(scope=["charts"]), NoReturn)
