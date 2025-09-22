# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from typing import Any

import streamlit as st
from streamlit import runtime


def set_multiselect_9_to_have_bad_state():
    if "multiselect 9" in st.session_state:
        st.session_state["multiselect 9"] = ["male", "female"]


options = ("male", "female")

i1 = st.multiselect(
    "multiselect 1", options, placeholder="Please select", help="Help text"
)
st.text(f"value 1: {i1}")

i2 = st.multiselect("multiselect 2", options, format_func=lambda x: x.capitalize())
st.text(f"value 2: {i2}")

i3: list[Any] = st.multiselect("multiselect 3", [])
st.text(f"value 3: {i3}")

i4 = st.multiselect("multiselect 4", ["coffee", "tea", "water"], ["tea", "water"])
st.text(f"value 4: {i4}")

i5 = st.multiselect(
    "multiselect 5",
    [
        f"{x} I am a ridiculously long string to have in a multiselect, "
        "so perhaps I should just not wrap and go to the next line."
        for x in range(5)
    ],
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

multiple_cols = st.columns(5)
i12 = multiple_cols[0].multiselect(
    "multiselect 12", ["A long option"], default="A long option"
)
st.text(f"value 12: {i12}")

st.multiselect(
    "multiselect 13 -> :material/check: :rainbow[Fancy] _**markdown** `label` _support_",
    options=options,
)

# Add new multiselect with accept_new_options=True and verify that the format_func
# is applied to the original options but not to the new options
i14 = st.multiselect(
    "multiselect 14 - accept new options",
    options=["apple", "banana", "orange", "kiwi"],
    accept_new_options=True,
    max_selections=3,
    format_func=lambda x: x.upper(),
)
st.text(f"value 14: {i14}")

# Add a multiselect with session_state pre-set value
if "multiselect15" not in st.session_state:
    st.session_state.multiselect15 = ["apple", "orange"]

i15 = st.multiselect(
    "multiselect 15 - session_state values",
    options=["apple", "banana", "orange", "kiwi"],
    key="multiselect15",
)
st.text(f"value 15: {i15}")

# Add a multiselect with empty options but accept_new_options=True
i16 = st.multiselect(
    "multiselect 16 - empty options with accept_new_options",
    options=[],
    accept_new_options=True,
)
st.text(f"value 16: {i16}")

many_options = (
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
    "twenty-one",
    "twenty-two",
    "twenty-three",
    "twenty-four",
    "twenty-five",
    "twenty-six",
    "twenty-seven",
    "twenty-eight",
    "twenty-nine",
    "thirty",
)

st.multiselect(
    "multiselect 17 - show maxHeight",
    options=many_options,
    default=many_options[0:28],
)

st.multiselect(
    "multiselect 18 (width=300px)", many_options, default=many_options[0:28], width=300
)
st.multiselect(
    "multiselect 19 (width='stretch')",
    many_options,
    default=many_options[0:28],
    width="stretch",
)

if st.toggle("Update multiselect props"):
    ms_value = st.multiselect(
        "Updated dynamic multiselect",
        default=[],
        width=300,
        help="updated help",
        key="dynamic_multiselect_with_key",
        on_change=lambda a, param: print(
            f"Updated multiselect - callback triggered: {a} {param}"
        ),
        args=("Updated ms arg",),
        kwargs={"param": "updated kwarg param"},
        placeholder="updated placeholder",
        # options, max_selections, format_func & accept_new_options are not yet supported for dynamic changes
        # keeping it at the same value for now:
        options=["apple", "banana", "orange", "kiwi"],
        max_selections=3,
        accept_new_options=True,
        format_func=lambda x: x.capitalize(),
    )
    st.write("Updated multiselect value:", str(ms_value))
else:
    sms_value = st.multiselect(
        "Initial dynamic multiselect",
        default=["apple"],
        width="stretch",
        help="initial help",
        key="dynamic_multiselect_with_key",
        on_change=lambda a, param: print(
            f"Initial multiselect - callback triggered: {a} {param}"
        ),
        args=("Initial ms arg",),
        kwargs={"param": "initial kwarg param"},
        placeholder="initial placeholder",
        options=["apple", "banana", "orange", "kiwi"],
        max_selections=3,
        accept_new_options=True,
        format_func=lambda x: x.capitalize(),
    )
    st.write("Initial multiselect value:", str(sms_value))
