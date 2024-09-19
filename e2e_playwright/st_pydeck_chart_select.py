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
from __future__ import annotations

import time
from typing import Literal

import streamlit as st
from shared.pydeck_utils import get_pydeck_chart

st.header("PyDeck Chart")

if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

selection_mode: Literal["single", "multi"] = st.selectbox(
    "Map Selection Mode",
    ["single", "multi"],
)

event_data = get_pydeck_chart("managed_multiselect_map", selection_mode)

st.write(
    "session_state.managed_multiselect_map:",
    str(st.session_state.managed_multiselect_map),
)
st.write("managed_multiselect_map selection:", str(event_data))


st.divider()
st.header("PyDeck Chart with Callback")


def on_selection():
    st.write(
        "PyDeck selection callback:",
        str(st.session_state.selection_callback),
    )


selection = get_pydeck_chart(
    "selection_callback", selection_mode="single", on_select=on_selection
)


st.divider()
st.header("PyDeck Chart in Form")

with st.form(key="my_form", clear_on_submit=True):
    selection = get_pydeck_chart("selection_in_form", selection_mode="single")
    st.form_submit_button("Submit")

st.write("PyDeck-in-form selection:", str(selection))
if "selection_in_form" in st.session_state:
    st.write(
        "PyDeck-in-form selection in session state:",
        str(st.session_state.selection_in_form),
    )


st.divider()
st.header("PyDeck Chart in Fragment")


@st.fragment
def test_fragment():
    selection = get_pydeck_chart("selection_in_fragment", "single")
    st.write("PyDeck-in-fragment selection:", str(selection))


test_fragment()

if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)
