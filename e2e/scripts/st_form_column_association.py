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

import streamlit as st

# Element created in a form located in the sidebar.
with st.sidebar.form("form_0"):
    value = st.checkbox("in form 0")
    st.form_submit_button()
st.sidebar.write(value)

# Element created in the sidebar, outside the form.
with st.form("form_1"):
    "Empty Form 1"
    value = st.sidebar.checkbox("NOT in form 1")
    st.form_submit_button()
value

# Parent block created outside a form; element created inside a form.
cols = st.columns(2)
with st.form("form_2"):
    "Empty Form 2"
    value = cols[0].checkbox("NOT in form 2")
    st.form_submit_button()
value

# Parent block and element created inside a form.
with st.form("form_3"):
    cols = st.columns(2)
    with cols[0]:
        value = st.checkbox("in form 3")
    st.form_submit_button()
value

# Parent block created inside a form; element created outside a form.
with st.form("form_4"):
    cols = st.columns(2)
    st.form_submit_button()
value = cols[0].checkbox("in form 4")
value

# DG created outside a form; element created inside a form.
empty = st.empty()
with st.form("form_5"):
    "Empty Form 5"
    value = empty.checkbox("NOT in form 5")
    st.form_submit_button()
value

# DG created inside a form; element created outside a form.
with st.form("form_6"):
    empty = st.empty()
    st.form_submit_button()
value = empty.checkbox("in form 6")
value

# Element created directly on a form block.
form = st.form("form_7")
value = form.checkbox("in form 7")
form.form_submit_button()
value

# Forms inside columns.
cols = st.columns(2)
with cols[0]:
    with st.form("form_8"):
        value = st.checkbox("in form 8")
        st.form_submit_button()
    value
with cols[1]:
    with st.form("form_9"):
        value = st.checkbox("in form 9")
        st.form_submit_button()
    value
