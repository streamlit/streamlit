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

s1 = st.sidebar.slider("Label A", 0, 12345678, 12345678)
st.sidebar.write("Value A:", s1)

r1 = st.sidebar.slider("Range A", 10000, 25000, [10000, 25000])
st.sidebar.write("Range Value A:", r1)

with st.sidebar.expander("Expander", expanded=True):
    s2 = st.slider("Label B", 10000, 25000, 10000)
    st.write("Value B:", s2)

    r2 = st.slider("Range B", 10000, 25000, [10000, 25000])
    st.write("Range Value B:", r2)

w1 = st.slider("Label 1", 0, 100, 25, 1)
st.write("Value 1:", w1)

w2 = st.slider("Label 2", 0.0, 100.0, (25.0, 75.0), 0.5)
st.write("Value 2:", w2)

w3 = st.slider(
    "Label 3 - This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long label",
    0,
    100,
    1,
    1,
)
st.write("Value 3:", w3)

w4 = st.slider("Label 4", 10000, 25000, 10000, disabled=True)
st.write("Value 4:", w4)

w5 = st.slider("Label 5", 0, 100, 25, 1, label_visibility="hidden")
st.write("Value 5:", w5)

w6 = st.slider("Label 6", 0, 100, 36, label_visibility="collapsed")
st.write("Value 6:", w6)

if runtime.exists():

    def on_change():
        st.session_state.slider_changed = True

    st.slider(
        "Label 7",
        min_value=0,
        max_value=100,
        value=25,
        step=1,
        key="slider7",
        on_change=on_change,
    )
    st.write("Value 7:", st.session_state.slider7)
    st.write("Slider changed:", "slider_changed" in st.session_state)
