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

from datetime import date, datetime, time, timedelta

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
    "Label 3 - This is a very very very very very very very very very very very very very "
    "very very very very very very very very very very very very very very very very very "
    "very very very very very very very very very very very very very very very long label",
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
w5 = st.slider("Label 5", 0, 100, 25, 1, label_visibility="hidden", key="slider_5")
st.write("Value 5:", w5)

# Slider 9
w6 = st.slider("Label 6", 0, 100, 36, label_visibility="collapsed", key="slider_6")
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
    value=(1e6 + 6, 1e6 + 10),
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
    value=(1e6 + 88, 1e6 + 92),
)

# Slider 20
st.slider(
    "Label 17 - Overlapping near the center",
    min_value=1e6 + 0,
    max_value=1e6 + 100,
    value=(1e6 + 48, 1e6 + 52),
)

st.slider(
    "Label 18 -> :material/check: :rainbow[Fancy] _**markdown** `label` _support_"
)


st.slider("Label 19 - Width 300px", min_value=0, max_value=100, width=300)
st.slider("Label 20 - Width Stretch", min_value=0, max_value=100, width="stretch")

# Slider with predefined number format
st.slider(
    "Slider with compact format",
    min_value=0,
    max_value=1000000,
    value=500000,
    format="compact",
)

# Slider with predefined datetime format
st.slider(
    "Slider with localized date format",
    min_value=datetime(2020, 1, 1),
    max_value=datetime(2025, 12, 31),
    value=datetime(2023, 6, 15),
    format="localized",
)

if st.toggle("Update slider props"):
    dyn_value = st.slider(
        "Updated dynamic slider",
        value=42,
        width=300,
        help="updated help",
        format="%d€",
        key="dynamic_slider_with_key",
        on_change=lambda a, param: print(
            f"Updated slider - callback triggered: {a} {param}"
        ),
        args=("Updated slider arg",),
        kwargs={"param": "updated kwarg param"},
        # min_value, max_value, and step are not yet supported for dynamic changes
        # keeping it at the same value:
        min_value=0,
        max_value=100,
        step=1,
    )
    st.write("Updated slider value:", dyn_value)
else:
    dyn_value = st.slider(
        "Initial dynamic slider",
        value=25,
        width="stretch",
        help="initial help",
        format="%0.2f",
        key="dynamic_slider_with_key",
        on_change=lambda a, param: print(
            f"Initial slider - callback triggered: {a} {param}"
        ),
        args=("Initial slider arg",),
        kwargs={"param": "initial kwarg param"},
        min_value=0,
        max_value=100,
        step=1,
    )
    st.write("Initial slider value:", dyn_value)

# --- Query Param Binding Sliders ---

# Slider 27 - Integer slider with bind
bound_int = st.slider(
    "Bound int slider",
    min_value=0,
    max_value=100,
    value=50,
    key="bound_int",
    bind="query-params",
)
st.write("Bound int value:", bound_int)

# Slider 28 - Float slider with bind
bound_float = st.slider(
    "Bound float slider",
    min_value=0.0,
    max_value=1.0,
    value=0.5,
    step=0.1,
    key="bound_float",
    bind="query-params",
)
st.write("Bound float value:", bound_float)

# Slider 29 - Range slider with bind
bound_range = st.slider(
    "Bound range slider",
    min_value=0,
    max_value=100,
    value=(25, 75),
    key="bound_range",
    bind="query-params",
)
st.write("Bound range value:", bound_range)

# Slider 30 - Date slider with bind
bound_date = st.slider(
    "Bound date slider",
    min_value=date(2020, 1, 1),
    max_value=date(2025, 12, 31),
    value=date(2023, 6, 15),
    key="bound_date",
    bind="query-params",
)
st.write("Bound date value:", bound_date)

# Slider 31 - Time slider with bind
bound_time = st.slider(
    "Bound time slider",
    min_value=time(0, 0),
    max_value=time(23, 59),
    value=time(12, 0),
    key="bound_time",
    bind="query-params",
)
st.write("Bound time value:", bound_time)

# Slider 32 - Datetime slider with bind
bound_datetime = st.slider(
    "Bound datetime slider",
    min_value=datetime(2020, 1, 1, 0, 0),
    max_value=datetime(2025, 12, 31, 23, 59),
    value=datetime(2023, 6, 15, 14, 30),
    key="bound_datetime",
    bind="query-params",
)
st.write("Bound datetime value:", bound_datetime)

# Slider 33 - Date range slider with bind
bound_date_range = st.slider(
    "Bound date range slider",
    min_value=date(2020, 1, 1),
    max_value=date(2025, 12, 31),
    value=(date(2022, 1, 1), date(2024, 1, 1)),
    key="bound_date_range",
    bind="query-params",
)
st.write("Bound date range value:", bound_date_range)

# Slider 34 - Time slider with second-resolution step and bind
bound_time_secs = st.slider(
    "Bound time seconds slider",
    min_value=time(0, 0),
    max_value=time(23, 59, 59),
    value=time(12, 0, 0),
    step=timedelta(seconds=30),
    key="bound_time_secs",
    bind="query-params",
)
st.write("Bound time secs value:", bound_time_secs)

# Slider 35 - Datetime slider with second-resolution step and bind
bound_datetime_secs = st.slider(
    "Bound datetime seconds slider",
    min_value=datetime(2024, 1, 1, 0, 0, 0),
    max_value=datetime(2024, 12, 31, 23, 59, 59),
    value=datetime(2024, 6, 15, 14, 30, 0),
    step=timedelta(seconds=30),
    key="bound_datetime_secs",
    bind="query-params",
)
st.write("Bound datetime secs value:", bound_datetime_secs)
