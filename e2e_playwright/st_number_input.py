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

i1 = st.number_input("number input 1 (default)")
st.write("number input 1 (default) - value: ", i1)

i2 = st.number_input("number input 2 (value=1)", value=1)
st.write("number input 2 (value=1) - value: ", i2)

i3 = st.number_input("number input 3 (min & max)", 1, 10)
st.write("number input 3 (min & max) - value: ", i3)

i4 = st.number_input("number input 4 (step=2)", step=2)
st.write("number input 4 (step=2) - value: ", i4)

i5 = st.number_input("number input 5 (max=10)", max_value=10)
st.write("number input 5 (max=10) - value: ", i5)

i6 = st.number_input("number input 6 (disabled=True)", disabled=True)
st.write("number input 6 (disabled=True) - value: ", i6)

i7 = st.number_input("number input 7 (label=hidden)", label_visibility="hidden")
st.write("number input 7 (label=hidden) - value: ", i7)

i8 = st.number_input("number input 8 (label=collapsed)", label_visibility="collapsed")
st.write("number input 8 (label=collapsed) - value: ", i8)

if runtime.exists():

    def on_change():
        st.session_state.number_input_changed = True

    st.number_input(
        "number input 9 (on_change)", key="number_input9", on_change=on_change
    )
    st.write("number input 9 (on_change) - value: ", st.session_state.number_input9)
    st.write(
        "number input 9 (on_change) - changed:",
        "number_input_changed" in st.session_state,
    )

[col1, col2, col3, col4, col5, col6] = st.columns(6)

with col1:
    i10 = st.number_input("number input 10 (small width)", max_value=10)
    st.write("number input 10 (small width) - value: ", i10)

i11 = st.number_input("number input 11 (value=None)", value=None)
st.write("number input 11 (value=None) - value: ", i11)

if "number_input12" not in st.session_state:
    st.session_state["number_input12"] = 10

i12 = st.number_input(
    "number input 12 (value from state & min=1)",
    value=None,
    min_value=1,
    key="number_input12",
)
st.write("number input 12 (value from state & min=1) - value: ", i12)
