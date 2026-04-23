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

from typing import Literal

import streamlit as st


def a():
    st.header("Header A")
    page_a_num = st.number_input(
        "Page A number",
        min_value=0,
        max_value=100,
        value=10,
        key="page_a_num",
        bind="query-params",
    )
    st.write("page_a_num:", page_a_num)


def b():
    st.header("Header B")
    page_b_choice = st.selectbox(
        "Page B choice",
        ["alpha", "beta", "gamma"],
        key="page_b_choice",
        bind="query-params",
    )
    st.write("page_b_choice:", page_b_choice)


entry_radio = st.radio(
    "Entry radio", ["red", "green", "blue"], key="entry_radio", bind="query-params"
)
st.write("entry_radio:", entry_radio)

position: Literal["sidebar", "top", "hidden"] = st.radio(
    "Position", ["sidebar", "top", "hidden"]
)

st.sidebar.header("Sidebar Header")

st.navigation((a, b), position=position).run()
