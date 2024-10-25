# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from datetime import date, time

import streamlit as st
from streamlit import runtime

# Slider 0
s1 = st.sidebar.slider("Label A", 0, 12345678, 12345678)
st.sidebar.write("Value A:", s1)

# Slider 1
r1 = st.sidebar.slider("Range A", 10000, 25000, [10000, 25000])
st.sidebar.write("Range Value A:", r1)

with st.sidebar.expander("Expander", expanded=True):
    # Slider 2
    s2 = st.slider("Label B", 10000, 25000, 10000)
    st.write("Value B:", s2)

    # Slider 3
    r2 = st.slider("Range B", 10000, 25000, [10000, 25000])
    st.write("Range Value B:", r2)

# Slider 4
w1 = st.slider(
    "Label 1",
    min_value=date(2019, 8, 1),
    max_value=date(2021, 6, 4),
    value=(date(2019, 8, 1), date(2019, 9, 1)),
    format="ddd, hA",
    help="This is some help tooltip!",
)
st.write("Value 1:", w1)

# Slider 5
w2 = st.slider("Label 2", 0.0, 100.0, (25.0, 75.0), 0.5)
st.write("Value 2:", w2)

# Slider 6
w3 = st.slider(
    "Label 3 - This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long label",
    0,
    100,
    1,
    1,
)
st.write("Value 3:", w3)

# Slider 7
w4 = st.slider("Label 4", 10000, 25000, 10000, disabled=True)
st.write("Value 4:", w4)

# Slider 8
w5 = st.slider("Label 5", 0, 100, 25, 1, label_visibility="hidden")
st.write("Value 5:", w5)

# Slider 9
w6 = st.slider("Label 6", 0, 100, 36, label_visibility="collapsed")
st.write("Value 6:", w6)

# Slider 10
dates = st.slider(
    "Label 7",
    min_value=date(2019, 8, 1),
    max_value=date(2021, 6, 4),
    value=(date(2019, 8, 1), date(2019, 9, 1)),
)
st.write("Value 7:", dates[0], dates[1])

if runtime.exists():

    def on_change():
        st.session_state.slider_changed = True

    # Slider 11
    st.slider(
        "Label 8",
        min_value=0,
        max_value=100,
        value=25,
        step=1,
        key="slider8",
        on_change=on_change,
    )
    st.write("Value 8:", st.session_state.slider8)
    st.write("Slider changed:", "slider_changed" in st.session_state)

with st.form(key="my_form", clear_on_submit=True):
    # Slider 12
    selection = st.slider(
        "Label 9",
        min_value=0,
        max_value=100,
        value=25,
        step=1,
        key="slider9",
    )
    st.form_submit_button("Submit")

st.write("slider-in-form selection:", str(selection))


@st.fragment
def test_fragment():
    # Slider 13
    selection = st.slider(
        "Label 10",
        min_value=0,
        max_value=100,
        value=25,
        step=1,
        key="slider10",
        on_change=on_change,
    )
    st.write("slider-in-fragment selection:", str(selection))


test_fragment()

if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)

# Slider 14
slider_11_value = st.slider(
    "Slider 11 (formatted float)", value=0.05, step=0.2, format="%f%%"
)
st.write("Slider 11:", slider_11_value)

# Slider 15
slider_12_value = st.slider("Slider 12 (time-value)", value=time(12, 0))
st.write("Slider 12:", slider_12_value)

# Slider 16
st.slider(
    "Label 13 - Overlapping on the left",
    min_value=1e6 + 0,
    max_value=1e6 + 100,
    value=(1e6 + 0, 1e6 + 4),
)

# Slider 17
st.slider(
    "Label 14 - Overlapping near the left",
    min_value=1e6 + 0,
    max_value=1e6 + 100,
    value=(1e6 + 10, 1e6 + 14),
)

# Slider 18
st.slider(
    "Label 15 - Overlapping on the right",
    min_value=1e6 + 0,
    max_value=1e6 + 100,
    value=(1e6 + 96, 1e6 + 100),
)

# Slider 19
st.slider(
    "Label 16 - Overlapping near the right",
    min_value=1e6 + 0,
    max_value=1e6 + 100,
    value=(1e6 + 86, 1e6 + 90),
)

# Slider 20
st.slider(
    "Label 17 - Overlapping near the center",
    min_value=1e6 + 0,
    max_value=1e6 + 100,
    value=(1e6 + 48, 1e6 + 52),
)
