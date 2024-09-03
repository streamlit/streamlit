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

import streamlit as st


def callback():
    st.write("Hello world")


c1 = st.color_picker("Default Color", on_change=callback, key="color_picker_1")
st.write("Color 1", c1)

c2 = st.color_picker("New Color", "#EB144C", help="help string")
st.write("Color 2", c2)

c3 = st.color_picker("Disabled", disabled=True)
st.write("Color 3", c3)

c4 = st.color_picker("Hidden Label", label_visibility="hidden")
st.write("Color 4", c4)

c5 = st.color_picker("Collapsed Label", label_visibility="collapsed")
st.write("Color 5", c5)

with st.form(key="my_form", clear_on_submit=True):
    selection = st.color_picker("Form Color Picker", key="color_picker_form")
    st.form_submit_button("Submit")

st.write("color_picker-in-form selection:", str(selection))
if "color_picker_form" in st.session_state:
    st.write(
        "color_picker-in-form selection in session state:",
        str(st.session_state.color_picker_form),
    )


@st.fragment
def test_fragment():
    selection = st.color_picker("Fragment Color Picker")
    st.write("color_picker-in-fragment selection:", str(selection))


test_fragment()

if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)
