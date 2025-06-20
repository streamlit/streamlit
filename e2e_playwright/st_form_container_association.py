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

# Element created in a form located in the sidebar.
form_0_key = "form_0"
with st.sidebar.form(form_0_key):
    value = st.checkbox(f"in {form_0_key}")
    st.form_submit_button(f"{form_0_key} submit")
st.sidebar.write(f"{form_0_key} value:", value)

# Element created in the sidebar, outside the form.
form_1_key = "form_1"
with st.form(form_1_key):
    "Empty Form 1"
    value = st.sidebar.checkbox(f"NOT in {form_1_key}")
    st.form_submit_button(f"{form_1_key} submit")
st.write(f"{form_1_key} value:", value)

# Parent block created outside a form; element created inside a form.
form_2_key = "form_2"
cols = st.columns(2)
with st.form(form_2_key):
    "Empty Form 2"
    value = cols[0].checkbox(f"NOT in {form_2_key}")
    st.form_submit_button(f"{form_2_key} submit")
st.write(f"{form_2_key} value:", value)

# Parent block and element created inside a form.
form_3_key = "form_3"
with st.form(form_3_key):
    cols = st.columns(2)
    with cols[0]:
        value = st.checkbox(f"in {form_3_key}")
    st.form_submit_button(f"{form_3_key} submit")
st.write(f"{form_3_key} value:", value)

# Parent block created inside a form; element created outside a form.
form_4_key = "form_4"
with st.form(form_4_key):
    cols = st.columns(2)
    st.form_submit_button(f"{form_4_key} submit")
value = cols[0].checkbox(f"in {form_4_key}")
st.write(f"{form_4_key} value:", value)

# DG created outside a form; element created inside a form.
form_5_key = "form_5"
empty = st.empty()
with st.form(form_5_key):
    "Empty Form 5"
    value = empty.checkbox(f"NOT in {form_5_key}")
    st.form_submit_button(f"{form_5_key} submit")
st.write(f"{form_5_key} value:", value)

# DG created inside a form; element created outside a form.
form_6_key = "form_6"
with st.form(form_6_key):
    empty = st.empty()
    st.form_submit_button(f"{form_6_key} submit")
value = empty.checkbox(f"in {form_6_key}")
st.write(f"{form_6_key} value:", value)

# Element created directly on a form block.
form_7_key = "form_7"
form = st.form(form_7_key)
value = form.checkbox(f"in {form_7_key}")
form.form_submit_button(f"{form_7_key} submit")
st.write(f"{form_7_key} value:", value)

# Forms inside columns.
cols = st.columns(2)
with cols[0]:
    form_8_key = "form_8"
    with st.form(form_8_key):
        value = st.checkbox(f"in {form_8_key}")
        st.form_submit_button(f"{form_8_key} submit")
    st.write(f"{form_8_key} value:", value)
with cols[1]:
    form_9_key = "form_9"
    with st.form(form_9_key):
        value = st.checkbox(f"in {form_9_key}")
        st.form_submit_button(f"{form_9_key} submit")
    st.write(f"{form_9_key} value:", value)
