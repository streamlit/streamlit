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

from datetime import date, datetime

import streamlit as st
from streamlit import runtime

v1 = st.date_input("Single date", date(1970, 1, 1), min_value=date(1970, 1, 1))
st.write("Value 1:", v1)

v2 = st.date_input("Single datetime", datetime(2019, 7, 6, 21, 15), help="Help text")
st.write("Value 2:", v2)

v3 = st.date_input("Range, no date", [])
st.write("Value 3:", v3)

v4 = st.date_input("Range, one date", [date(2019, 7, 6)])
st.write("Value 4:", v4)

v5 = st.date_input("Range, two dates", [date(2019, 7, 6), date(2019, 7, 8)])
st.write("Value 5:", v5)

v6 = st.date_input("Disabled, no date", [], disabled=True)
st.write("Value 6:", v6)

v7 = st.date_input(
    "Label hidden", datetime(2019, 7, 6, 21, 15), label_visibility="hidden"
)
st.write("Value 7:", v7)

v8 = st.date_input(
    "Label collapsed", datetime(2019, 7, 6, 21, 15), label_visibility="collapsed"
)
st.write("Value 8:", v8)

v9 = st.date_input("Single date with format", date(1970, 1, 1), format="MM-DD-YYYY")
st.write("Value 9:", v9)

v10 = st.date_input(
    "Range, two dates with format",
    [date(2019, 7, 6), date(2019, 7, 8)],
    format="MM/DD/YYYY",
)
st.write("Value 10:", v10)

v11 = st.date_input("Range, no date with format", [], format="DD.MM.YYYY")
st.write("Value 11:", v11)


if runtime.exists():

    def on_change():
        st.session_state.date_input_changed = True
        st.text("Date input changed callback")

    st.date_input(
        "Single date with callback",
        date(1970, 1, 1),
        min_value=date(1970, 1, 1),
        key="date_input_12",
        on_change=on_change,
    )
    st.write("Value 12:", st.session_state.date_input_12)
    st.write("Date Input Changed:", st.session_state.get("date_input_changed") is True)
    # Reset to False:
    st.session_state.date_input_changed = False

v13 = st.date_input("Empty value", value=None)
st.write("Value 13:", v13)

if "date_input_14" not in st.session_state:
    st.session_state["date_input_14"] = date(1970, 2, 3)

v14 = st.date_input(
    "Value from state",
    value=None,
    key="date_input_14",
)
st.write("Value 14:", v14)
