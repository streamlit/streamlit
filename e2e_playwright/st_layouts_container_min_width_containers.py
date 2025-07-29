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

with st.container(direction="horizontal", border=True):
    st.container(direction="horizontal", border=True)
    st.container(direction="horizontal", border=True)
    st.container(direction="horizontal", border=True)

with st.container(direction="horizontal", border=True):
    with st.container(direction="horizontal", border=True):
        st.markdown("Hello, how are you? Do you like ice cream?")
    with st.container(direction="horizontal", border=True):
        st.markdown("Hello. Goodbye. So long.")
    with st.container(direction="horizontal", border=True):
        st.markdown("Hello")

with st.container(direction="horizontal", border=True):
    col1, col2, col3 = st.columns(3)
    col1.markdown("Hello, how are you? Do you like ice cream?")
    col2.markdown("Hello. Goodbye. So long.")
    col3.markdown("Hello")

with st.container(direction="horizontal", border=True):
    with st.form("test_form"):
        pass

with st.container(direction="horizontal", border=True):
    tab1, tab2, tab3 = st.tabs(["Tab 1", "Tab 2", "Tab 3"], width="stretch")
    tab1.markdown("Hello, how are you? Do you like ice cream?")
    tab2.markdown("Hello. Goodbye. So long.")
    tab3.markdown("Hello")
    st.container(border=True, width=300)
