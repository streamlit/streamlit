# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from typing import cast

import streamlit as st


@st.cache_resource
def with_cached_widget_warning():
    st.write("Cached function that should show a widget usage warning.")
    st.selectbox("selectbox", ["foo", "bar", "baz", "qux"], index=1)


if st.button("Run cached function with widget warning"):
    with_cached_widget_warning()


@st.cache_resource
def inner_cache_function():
    st.radio("radio 2", ["foo", "bar", "baz", "qux"], index=1)


@st.cache_resource
def nested_cached_function():
    inner_cache_function()
    st.selectbox("selectbox 2", ["foo", "bar", "baz", "qux"], index=1)


if st.button("Run nested cached function with widget warning"):
    # When running nested_cached_function(), we get two warnings, one from
    # nested_cached_function() and one from inner_cache_function.
    nested_cached_function()

if "run_counter" not in st.session_state:
    st.session_state.run_counter = 0


@st.cache_resource
def replay_element() -> int:
    st.session_state.run_counter += 1
    st.markdown(f"Cache executions: {st.session_state.run_counter}")
    return cast("int", st.session_state.run_counter)


if st.button("Cached function with element replay"):
    st.write("Cache return", replay_element())
