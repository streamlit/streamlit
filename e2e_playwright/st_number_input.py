# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import streamlit as st
from streamlit import runtime

v1 = st.number_input("number input 1 (default)")
st.write("number input 1 (default) - value: ", v1)

v2 = st.number_input("number input 2 (value=1)", value=1)
st.write("number input 2 (value=1) - value: ", v2)

v3 = st.number_input("number input 3 (min & max)", 1, 10)
st.write("number input 3 (min & max) - value: ", v3)

v4 = st.number_input("number input 4 (step=2)", step=2)
st.write("number input 4 (step=2) - value: ", v4)

v5 = st.number_input("number input 5 (max=10)", max_value=10)
st.write("number input 5 (max=10) - value: ", v5)

v6 = st.number_input("number input 6 (disabled=True)", disabled=True)
st.write("number input 6 (disabled=True) - value: ", v6)

v7 = st.number_input("number input 7 (label=hidden)", label_visibility="hidden")
st.write("number input 7 (label=hidden) - value: ", v7)

v8 = st.number_input("number input 8 (label=collapsed)", label_visibility="collapsed")
st.write("number input 8 (label=collapsed) - value: ", v8)

if runtime.exists():

    def on_change():
        st.session_state.number_input_changed = True

    st.number_input(
        "number input 9 (on_change)", key="number_input_9", on_change=on_change
    )
    st.write("number input 9 (on_change) - value: ", st.session_state.number_input_9)
    st.write(
        "number input 9 (on_change) - changed:",
        st.session_state.get("number_input_changed") is True,
    )

[col1, col2, col3, col4, col5, col6] = st.columns(6)

with col1:
    v10 = st.number_input("number input 10 (small width)", max_value=10)
    st.write("number input 10 (small width) - value: ", v10)

v11 = st.number_input(
    "number input 11 (value=None)", value=None, placeholder="Type a number..."
)
st.write("number input 11 (value=None) - value: ", v11)

if "number_input_12" not in st.session_state:
    st.session_state["number_input_12"] = 10

v12 = st.number_input(
    "number input 12 (value from state & min=1)",
    value=None,
    min_value=1,
    key="number_input_12",
)
st.write("number input 12 (value from state & min=1) - value: ", v12)
