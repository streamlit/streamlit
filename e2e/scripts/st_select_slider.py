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

import numpy as np
import pandas as pd

import streamlit as st

w1 = st.select_slider(
    "Label 1",
    value=("orange", "blue"),
    options=["red", "orange", "yellow", "green", "blue", "indigo", "violet"],
)
st.write("Value 1:", w1)

w2 = st.select_slider(
    "Label 2",
    options=np.array([1, 2, 3, 4, 5]),
)
st.write("Value 2:", w2)

w3 = st.select_slider(
    "Label 3",
    value=[2, 5],
    options=pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9]),
)
st.write("Value 3:", w3)

w4 = st.select_slider(
    "Label 4",
    value=5,
    options=pd.DataFrame(
        {
            "first column": [1, 2, 3, 4, 5],
            "second column": [10, 20, 30, 40, 50],
        }
    ),
)
st.write("Value 4:", w4)

w5 = st.select_slider(
    "Label 5",
    value=("orange", "blue"),
    options=["red", "orange", "yellow", "green", "blue", "indigo", "violet"],
    disabled=True,
)
st.write("Value 5:", w5)

w6 = st.select_slider(
    "Label 6",
    options=["red", "orange", "yellow", "green", "blue", "indigo", "violet"],
    label_visibility="hidden",
)

st.write("Value 6:", w6)


w7 = st.select_slider(
    "Label 7",
    options=["red", "orange", "yellow", "green", "blue", "indigo", "violet"],
    label_visibility="collapsed",
)

st.write("Value 7:", w7)

if st._is_running_with_streamlit:

    def on_change():
        st.session_state.select_slider_changed = True

    st.select_slider(
        "Label 8",
        options=np.array([1, 2, 3, 4, 5]),
        key="select_slider8",
        on_change=on_change,
    )
    st.write("Value 8:", st.session_state.select_slider8)
    st.write("Select slider changed:", "select_slider_changed" in st.session_state)
