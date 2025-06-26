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

with st.form("form_4"):
    st.write("Inside form 4 - emoji icon")
    text_input = st.text_input("Form 4 - Text Input")
    st.form_submit_button(
        "Form 4 - Submit with emoji icon",
        use_container_width=True,
        icon="🔍",
    )

with st.form("form_5"):
    st.write("Inside form 5 - material icon")
    text_input = st.text_input("Form 5 - Text Input")
    st.form_submit_button(
        "Form 5 - Submit with material icon",
        use_container_width=True,
        icon=":material/key:",
    )

with st.form("form_6"):
    st.write("Inside form 6 - Submit on Enter")
    text_input = st.text_input("Form 6 - Text Input")
    submitted_6 = st.form_submit_button(
        "Form 6 - First Submit",
        use_container_width=True,
    )
    submitted_6b = st.form_submit_button(
        "Form 6 - Second Submit",
        disabled=True,
        use_container_width=True,
    )
    if submitted_6 or submitted_6b:
        st.write("Form submitted")

with st.form("form_7"):
    st.write("Inside form 7")
    text_input = st.text_input("Form 7 - Text Input")
    submitted_7 = st.form_submit_button(
        "Form 7 - Disables Submit on Enter",
        use_container_width=True,
        disabled=True,
    )
    submitted_7b = st.form_submit_button(
        "Form 7 - Second Submit",
        use_container_width=True,
    )
    if submitted_7 or submitted_7b:
        st.write("Form submitted")

with st.form("form_8", enter_to_submit=False):
    st.write("Inside form 8")
    number_input = st.number_input("Form 8 - Number Input", 0, 100, step=1)
    submitted_8 = st.form_submit_button(
        "Form 8 - Submit",
        use_container_width=True,
    )
    if submitted_8:
        st.write("Form submitted")

with st.form("form_9", enter_to_submit=False):
    st.write("Inside form 9")
    number_input = st.number_input("Form 9 - Number Input", 0, 100, step=1)
    submitted_9 = st.form_submit_button(
        "Form 9 - Submit",
        type="primary",
        use_container_width=True,
    )
    if submitted_9:
        st.write("Form submitted")

with st.form("form_10"):
    st.write("Inside form 10")
    number_input = st.number_input("Form 10 - Number Input", 0, 100, step=1)
    submitted_10 = st.form_submit_button(
        "Form 10 - Submit",
        type="tertiary",
        use_container_width=True,
    )
    if submitted_10:
        st.write("Form submitted")

with st.form("form_11"):
    st.write("Inside form 11")
    text_input = st.text_input("Form 11 - Text Input")
    submitted_11 = st.form_submit_button(
        "Form 11 - Submit",
        help="Submit by clicking",
    )
    if submitted_11:
        st.write("Form submitted")

with st.form("form_12", width=300):
    st.write("Inside form 12")
    st.write("Form width: 300px")
    text_input = st.text_input("Form 12 - Text Input")
    submitted_12 = st.form_submit_button(
        "Form 12 - Submit",
        help="Submit by clicking",
    )
    if submitted_12:
        st.write("Form submitted")

with st.form("form_13", width="content"):
    st.write("Inside form 13")
    st.write("Form width: content")
    text_input = st.text_input("Form 13 - Text Input")
    submitted_13 = st.form_submit_button(
        "Form 13 - Submit",
        help="Submit by clicking",
    )
    if submitted_13:
        st.write("Form submitted")

with st.form("form_14", width="stretch"):
    st.write("Inside form 14")
    st.write("Form width: stretch")
    text_input = st.text_input("Form 14 - Text Input")
    submitted_14 = st.form_submit_button(
        "Form 14 - Submit",
        help="Submit by clicking",
    )
    if submitted_14:
        st.write("Form submitted")

with st.form("form_15", height=100):
    st.write("Inside form 15")
    st.write("Form height: 100px")
    text_input = st.text_input("Form 15 - Text Input")
    submitted_15 = st.form_submit_button(
        "Form 15 - Submit",
        help="Submit by clicking",
    )
    if submitted_15:
        st.write("Form submitted")

with st.form("form_16", height="content"):
    st.write("Inside form 16")
    st.write("Form height: content")
    text_input = st.text_input("Form 16 - Text Input")
    submitted_16 = st.form_submit_button(
        "Form 16 - Submit",
        help="Submit by clicking",
    )
    if submitted_16:
        st.write("Form submitted")


col1, col2 = st.columns(2)
with col1:
    with st.form("form_17", height=400):
        st.write("Form height: 400px")
        text_input = st.text_input("Form 17 - Text Input")
        st.form_submit_button(
            help="Submit by clicking",
        )

    with st.form("form_18", height="stretch"):
        st.write("Form height: stretch")
        text_input = st.text_input("Form 18 - Text Input")
        st.form_submit_button(
            help="Submit by clicking",
        )

with col2:
    with st.form("form_19", height="stretch"):
        st.write("Form height: stretch")
        text_input = st.text_input("Form 19 - Text Input")
        st.form_submit_button(
            help="Submit by clicking",
        )

with st.container(height=600, border=True):
    with st.form("form_20", height="stretch"):
        st.write("Form height: stretch")
        text_input = st.text_input("Form 20 - Text Input")
        st.form_submit_button(
            help="Submit by clicking",
        )

    with st.form("form_21", height="content"):
        st.write("Form height: content")
        text_input = st.text_input("Form 21 - Text Input")
        st.form_submit_button(
            help="Submit by clicking",
        )

with st.form("my_form"):
    st.dataframe([1, 2, 3])
    st.form_submit_button("Submit")
