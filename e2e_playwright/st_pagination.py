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

if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)

with st.container(key="basic_pagination"):
    page = st.pagination(10, key="basic_page")
    st.write("basic-page:", page)

with st.container(key="compact_pagination"):
    compact_page = st.pagination(10, key="compact_page", default=5, max_visible_pages=1)
    st.write("compact-page:", compact_page)

with st.container(key="disabled_pagination"):
    if "disabled_page" not in st.session_state:
        st.session_state.disabled_page = 3
    disabled_page = st.pagination(10, key="disabled_page", disabled=True)
    st.write("disabled-page:", disabled_page)

with st.form(key="pagination_form"):
    form_page = st.pagination(5, key="form_page")
    st.form_submit_button("Submit")
st.write("form-page:", form_page)


@st.fragment
def pagination_fragment():
    fragment_page = st.pagination(5, key="fragment_page")
    st.write("fragment-page:", fragment_page)


pagination_fragment()

st.pagination(10, key="stretch_page", width="stretch")
st.pagination(10, key="fixed_page", width=300)
