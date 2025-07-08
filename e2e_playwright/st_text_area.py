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

import streamlit as st
from streamlit import runtime

v1 = st.text_area("text area 1 (default)")
st.write("value 1:", v1)

v2 = st.text_area("text area 2 (value='some text')", "some text")
st.write("value 2:", v2)

v3 = st.text_area("text area 3 (value=1234)", 1234)
st.write("value 3:", v3)

v4 = st.text_area("text area 4 (value=None)", None)
st.write("value 4:", v4)

v5 = st.text_area("text area 5 (placeholder)", placeholder="Placeholder")
st.write("value 5:", v5)

v6 = st.text_area("text area 6 (disabled)", "default text", disabled=True)
st.write("value 6:", v6)

v7 = st.text_area(
    "text area 7 (hidden label)", "default text", label_visibility="hidden"
)
st.write("value 7:", v7)

v8 = st.text_area(
    "text area 8 (collapsed label)", "default text", label_visibility="collapsed"
)
st.write("value 8:", v8)

if runtime.exists():

    def on_change():
        st.session_state.text_area_changed = True
        st.text("text area changed callback")

    st.text_area(
        "text area 9 (callback, help)",
        key="text_area9",
        on_change=on_change,
        help="Help text",
    )
    st.write("value 9:", st.session_state.text_area9)
    st.write("text area changed:", st.session_state.get("text_area_changed") is True)
    # Reset to False:
    st.session_state.text_area_changed = False

v10 = st.text_area("text area 10 (max_chars=5)", "1234", max_chars=5)
st.write("value 10:", v10)

v11 = st.text_area("text area 11 (height=250)", "default text", height=250)
st.write("value 11:", v11)

v12 = st.text_area("text area 12 (height=75)", "default text", height=75)
st.write("value 12:", v12)

# Expect this to default to the minimum height of 68px
v13 = st.text_area("text area 13 (height=60)", "default text", height=60)
st.write("value 13:", v13)

if "text_area_14" not in st.session_state:
    st.session_state["text_area_14"] = "xyz"

v14 = st.text_area(
    "text area 14 (value from state)",
    value=None,
    key="text_area_14",
)
st.write("text area 14 (value from state) - value: ", v14)

with st.form("form"):
    st.text_area("text area 15 (value from form)", key="text_area_15")
    st.form_submit_button("submit")

form_value = st.session_state.get("text_area_15", None)
st.write("text area 15 (value from form) - value: ", form_value)

st.text_area(
    "text area 16 -> :material/check: :rainbow[Fancy] **markdown** `label` _support_"
)

st.text_area("text area 17 (width=200px)", "width test", width=200)
st.text_area("text area 18 (width='stretch')", "width test", width="stretch")

with st.form("form2", height=500):
    st.text_area(
        "text area 19 (height='content') - Height adjusts to content.",
        """Line 1\nLine 2\nLine 3""",
        height="content",
    )
    st.form_submit_button("submit")

with st.form("form3", height=500):
    st.text_area(
        "text area 20 (height='stretch)",
        "Height stretches to fill space in fixed height form.",
        height="stretch",
    )
    st.form_submit_button("submit")

col1, col2 = st.columns(2)
with col1:
    st.text_area(
        "text area 21 (height='500')",
        """Fixed height of 500px""",
        height=500,
    )
with col2:
    st.text_area(
        "text area 22 (height='stretch')",
        """Height matches partner column""",
        height="stretch",
    )
