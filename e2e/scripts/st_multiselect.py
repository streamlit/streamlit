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

from typing import Any, List

import streamlit as st
from streamlit import runtime
from tests.streamlit import pyspark_mocks


def set_multiselect_9_to_have_bad_state():
    if "multiselect 9" in st.session_state:
        st.session_state["multiselect 9"] = ["male", "female"]


options = ("male", "female")

i1 = st.multiselect("multiselect 1", options)
st.text(f"value 1: {i1}")

i2 = st.multiselect("multiselect 2", options, format_func=lambda x: x.capitalize())
st.text(f"value 2: {i2}")

i3: List[Any] = st.multiselect("multiselect 3", [])
st.text(f"value 3: {i3}")

i4 = st.multiselect("multiselect 4", ["coffee", "tea", "water"], ["tea", "water"])
st.text(f"value 4: {i4}")

i5 = st.multiselect(
    "multiselect 5",
    list(
        map(
            lambda x: f"{x} I am a ridiculously long string to have in a multiselect, so perhaps I should just not wrap and go to the next line.",
            range(5),
        )
    ),
)
st.text(f"value 5: {i5}")

i6 = st.multiselect("multiselect 6", options, disabled=True)
st.text(f"value 6: {i6}")

i7 = st.multiselect("Hidden label", options, label_visibility="hidden")
st.text(f"value 7: {i7}")

i8 = st.multiselect("Collapsed label", options, label_visibility="collapsed")
st.text(f"value 8: {i8}")

set_multiselect_9 = st.checkbox(
    "set_multiselect_9", on_change=set_multiselect_9_to_have_bad_state
)

i9 = st.multiselect("multiselect 9", options, max_selections=1, key="multiselect 9")
st.text(f"value 9: {i9}")

with st.form("my_max_selections_ms_in_form"):
    i10 = st.multiselect(
        "multiselect 10", options, max_selections=1, key="multiselect 10"
    )
    st.text(f"value 10: {i10}")
    submitted = st.form_submit_button("Submit")

if runtime.exists():

    def on_change():
        st.session_state.multiselect_changed = True

    st.multiselect("multiselect 11", options, key="multiselect11", on_change=on_change)
    st.text(f"value 11: {st.session_state.multiselect11}")
    st.text(f"multiselect changed: {'multiselect_changed' in st.session_state}")

st.multiselect("PySpark DataFrame", options=pyspark_mocks.DataFrame())  # type: ignore
