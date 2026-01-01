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

from datetime import datetime, timedelta

import streamlit as st
from streamlit import runtime

BASE_DATETIME = datetime(2025, 11, 19, 16, 45)

v1 = st.datetime_input("Datetime input 1 (base)", BASE_DATETIME)
st.write("Value 1:", v1)

v2 = st.datetime_input(
    "Datetime input 2 (help)",
    BASE_DATETIME + timedelta(hours=2),
    help="Help text",
)
st.write("Value 2:", v2)

v3 = st.datetime_input("Datetime input 3 (disabled)", BASE_DATETIME, disabled=True)
st.write("Value 3:", v3)

v4 = st.datetime_input(
    "Datetime input 4 (hidden label)",
    BASE_DATETIME,
    label_visibility="hidden",
)
st.write("Value 4:", v4)

v5 = st.datetime_input(
    "Datetime input 5 (collapsed label)",
    BASE_DATETIME,
    label_visibility="collapsed",
)
st.write("Value 5:", v5)

if runtime.exists():

    def on_change() -> None:
        st.session_state.datetime_input_changed = True
        st.text("Datetime input callback triggered")

    st.datetime_input(
        "Datetime input 6 (with callback)",
        BASE_DATETIME,
        key="datetime_input_6",
        on_change=on_change,
    )

    st.write("Value 6:", st.session_state.datetime_input_6)
    st.write(
        "datetime input changed:",
        st.session_state.get("datetime_input_changed") is True,
    )
    st.session_state.datetime_input_changed = False

v7 = st.datetime_input("Datetime input 7 (step=60)", BASE_DATETIME, step=60)
st.write("Value 7:", v7)

v8 = st.datetime_input("Datetime input 8 (empty)", value=None)
st.write("Value 8:", v8)

# Initialize default value for datetime input 9
if "datetime_input_9_default" not in st.session_state:
    st.session_state["datetime_input_9_default"] = BASE_DATETIME + timedelta(minutes=5)

v9 = st.datetime_input(
    "Datetime input 9 (empty, from state)",
    value=st.session_state["datetime_input_9_default"],
    key="datetime_input_9",
)
st.write("Value 9:", v9)

st.datetime_input(
    "Datetime input 10 -> :material/check: :rainbow[Fancy] _**markdown** `label` _support_",
    BASE_DATETIME,
)

st.datetime_input(
    "Datetime input 11 (width=200px)", BASE_DATETIME, width=200, format="MM/DD/YYYY"
)
st.datetime_input("Datetime input 12 (width='stretch')", BASE_DATETIME, width="stretch")

with st.form("datetime_form", clear_on_submit=True):
    form_value = st.datetime_input(
        "Datetime input 13 (form)", value=None, key="datetime_form_input"
    )
    submitted = st.form_submit_button("Submit datetime form")
    if submitted:
        st.write("Form submitted value:", form_value)


@st.fragment
def datetime_fragment() -> None:
    st.datetime_input(
        "Datetime input 14 (fragment)",
        value=None,
        key="datetime_fragment_input",
    )


datetime_fragment()

st.markdown("Dynamic datetime input:")

if st.toggle("Update datetime input props"):
    dval = st.datetime_input(
        "Updated dynamic datetime input",
        value=BASE_DATETIME + timedelta(hours=3, minutes=15),
        width=250,
        help="updated help",
        key="dynamic_datetime_input_with_key",
        on_change=lambda: None,
        step=900,
    )
    st.write("Updated datetime input value:", dval)
else:
    dval = st.datetime_input(
        "Initial dynamic datetime input",
        value=BASE_DATETIME,
        width="stretch",
        help="initial help",
        key="dynamic_datetime_input_with_key",
        on_change=lambda: None,
        step=900,
    )
    st.write("Initial datetime input value:", dval)
