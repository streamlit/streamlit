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

import pandas as pd

import streamlit as st
from streamlit import runtime

options = ("female", "male")
markdown_options = (
    "**bold text**",
    "*italics text*",
    "~strikethrough text~",
    "shortcode: :blush:",
    # link should not work in radio options
    "[link text](www.example.com)",
    "`code text`",
    ":red[red] :blue[blue] :green[green] :violet[violet] :orange[orange]",
)

i1 = st.radio("radio 1 (default)", options)
st.write("value 1:", i1)

i2 = st.radio(
    "radio 2 (Formatted options)",
    options,
    1,
    format_func=lambda x: x.capitalize(),
)
st.write("value 2:", i2)

i3 = st.radio("radio 3 (no options)", [])
st.write("value 3:", i3)

i4 = st.radio("radio 4 (disabled)", options, disabled=True)
st.write("value 4:", i4)

i5 = st.radio("radio 5 (horizontal)", options, horizontal=True)
st.write("value 5:", i5)

i6 = st.radio("radio 6 (options from dataframe)", pd.DataFrame({"foo": list(options)}))
st.write("value 6:", i6)

i7 = st.radio("radio 7 (hidden label)", options, label_visibility="hidden")
st.write("value 7:", i7)

i8 = st.radio("radio 8 (collapsed label)", options, label_visibility="collapsed")
st.write("value 8:", i8)

i9 = st.radio("radio 9 (markdown options)", options=markdown_options)
st.write("value 9:", i9)

i10 = st.radio(
    "radio 10 (with captions)",
    ["A", "B", "C", "D", "E", "F", "G"],
    captions=markdown_options,
)
st.write("value 10:", i10)

i11 = st.radio(
    "radio 11 (horizontal, captions)",
    ["yes", "maybe", "no"],
    captions=["Opt in", "", "Opt out"],
    horizontal=True,
)
st.write("value 11:", i11)

if runtime.exists():

    def on_change():
        st.session_state.radio_changed = True
        st.text("Radio widget callback triggered")

    st.radio(
        "radio 12 (with callback, help)",
        options,
        1,
        key="radio12",
        on_change=on_change,
        help="help text",
    )
    st.write("value 12:", st.session_state.radio12)
    st.write("radio changed:", "radio_changed" in st.session_state)

i13 = st.radio("radio 13 (empty selection)", options, index=None)
st.write("value 13:", i13)
