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

import streamlit as st

# Basic pagination
st.subheader("Basic Pagination")
with st.container(key="basic_container"):
    page = st.pagination(10, key="basic")
    st.write(f"Current page: {page}")

# Pagination with custom default
st.subheader("With Default Page")
with st.container(key="default_container"):
    page = st.pagination(10, default=5, key="with_default")
    st.write(f"Default page: {page}")

# Pagination with truncation (large page count)
st.subheader("Large Page Count")
with st.container(key="large_container"):
    page = st.pagination(100, key="large")
    st.write(f"Large page: {page}")

# Disabled pagination
st.subheader("Disabled")
with st.container(key="disabled_container"):
    st.pagination(10, disabled=True, key="disabled")

# Single page
st.subheader("Single Page")
with st.container(key="single_container"):
    page = st.pagination(1, key="single")
    st.write(f"Single page: {page}")

# Max visible pages variations
st.subheader("Max Visible Pages")
with st.container(key="max_visible_container"):
    st.write("max_visible_pages=0 (arrows only):")
    st.pagination(10, max_visible_pages=0, default=5, key="arrows_only")

    st.write("max_visible_pages=1 (current page only):")
    st.pagination(10, max_visible_pages=1, default=5, key="current_only")

    st.write("max_visible_pages=3:")
    st.pagination(10, max_visible_pages=3, default=5, key="max_3")

# Width variations
st.subheader("Width")
with st.container(key="width_container"):
    st.write("width='content' (default):")
    st.pagination(5, key="width_content")

    st.write("width='stretch':")
    st.pagination(5, width="stretch", key="width_stretch")

# In a form
st.subheader("In Form")
with st.form(key="my_form"):
    form_page = st.pagination(10, key="form_pagination")
    submitted = st.form_submit_button("Submit")
    if submitted:
        st.write(f"Form submitted with page: {form_page}")

st.write(f"form-page: {form_page}")


# In a fragment
st.subheader("In Fragment")


@st.fragment
def pagination_fragment():
    fragment_page = st.pagination(10, key="fragment_pagination")
    st.write(f"fragment-page: {fragment_page}")


pagination_fragment()

# Callback test
st.subheader("With Callback")


def on_change():
    st.write(f"callback-page: {st.session_state.callback_pagination}")


st.pagination(10, key="callback_pagination", on_change=on_change)

# Session state control
st.subheader("Session State Control")
col1, col2, col3 = st.columns(3)
with col1:
    if st.button("Go to page 1", key="goto_1"):
        st.session_state.controlled = 1
with col2:
    if st.button("Go to page 5", key="goto_5"):
        st.session_state.controlled = 5
with col3:
    if st.button("Go to page 10", key="goto_10"):
        st.session_state.controlled = 10

controlled_page = st.pagination(10, key="controlled")
st.write(f"controlled-page: {controlled_page}")
