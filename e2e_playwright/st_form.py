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

# Tests all widgets, sans file_uploader, color picker, camera input and data editor,
# inside a form. These widgets are a lot more complicated to test, and
# are tested separately within the e2e tests for those components.
with st.form("form_1"):
    checkbox = st.checkbox("Checkbox", False)
    date_input = st.date_input("Date Input", date(2019, 7, 6))
    multiselect = st.multiselect("Multiselect", ["foo", "bar"], default=["foo"])
    number_input = st.number_input("Number Input")
    radio = st.radio("Radio", ["foo", "bar", "baz"])
    selectbox = st.selectbox("Selectbox", ["foo", "bar", "baz"])
    select_slider = st.select_slider("Select Slider", ["foo", "bar", "baz"])
    slider = st.slider("Slider")
    text_area = st.text_area("Text Area", value="foo")
    text_input = st.text_input("Text Input", value="foo")
    time_input = st.time_input("Time Input", time(8, 45))
    toggle_input = st.toggle("Toggle Input", value=False)
    st.form_submit_button("Submit")

st.write("Checkbox:", checkbox)
st.write("Date Input:", date_input)
st.write("Multiselect:", ", ".join(multiselect))
st.write("Number Input:", number_input)
st.write("Radio:", radio)
st.write("Selectbox:", selectbox)
st.write("Select Slider:", select_slider)
st.write("Slider:", slider)
st.write("Text Area:", text_area)
st.write("Text Input:", text_input)
st.write("Time Input:", time_input)
st.write("Toggle Input:", toggle_input)

with st.form("form_2"):
    st.write("Inside form 2")
    text_input = st.text_input("Form 2 - Text Input")
    col1, col2 = st.columns(2)
    col1.form_submit_button(
        "Form 2 - Submit (use_container_width, help)",
        use_container_width=True,
        help="Submit by clicking",
    )
    col2.form_submit_button(
        "Form 2 - Submit 2 (use_container_width)", use_container_width=True
    )


with st.form("form_3", border=False):
    st.write("Inside form 3 (border=False)")
    text_input = st.text_input("Form 3 - Text Input")
    st.form_submit_button(
        "Form 3 - Submit (use_container_width)",
        use_container_width=True,
    )
