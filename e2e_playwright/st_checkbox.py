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
from streamlit import runtime

i1 = st.checkbox("checkbox 1 (True)", True)
st.write("checkbox 1 - value:", i1)

i2 = st.checkbox("checkbox 2 (False)", False)
st.write("checkbox 2 - value:", i2)

i3 = st.checkbox(
    "checkbox 3: This is a really really really really long label that should wrap eventually if we keep addding more text to it"
)
st.write("checkbox 3 - value:", i3)

if runtime.exists():

    def on_change():
        st.session_state.checkbox_clicked = True

    st.checkbox("checkbox 4 (with callback)", key="checkbox4", on_change=on_change)
    st.write("checkbox 4 - value:", st.session_state.checkbox4)
    st.write("checkbox 4 - clicked:", "checkbox_clicked" in st.session_state)

i5 = st.checkbox("checkbox 5 (False, disabled)", disabled=True)
st.write("checkbox 5 - value:", i5)

i6 = st.checkbox("checkbox 6 (True, disabled)", value=True, disabled=True)
st.write("checkbox 6 - value:", i6)

i7 = st.checkbox("checkbox 7 (label hidden)", label_visibility="hidden")
st.write("checkbox 7 - value:", i7)

i8 = st.checkbox("checkbox 8 (label collapsed)", label_visibility="collapsed")
st.write("checkbox 8 - value:", i8)
