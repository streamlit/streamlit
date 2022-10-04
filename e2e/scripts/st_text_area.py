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
from streamlit import runtime

i1 = st.text_area("text area 1")
st.write('value 1: "', i1, '"')

i2 = st.text_area("text area 2", "default text")
st.write('value 2: "', i2, '"')

i3 = st.text_area("text area 3", 1234)
st.write('value 3: "', i3, '"')

i4 = st.text_area("text area 4", None)
st.write('value 4: "', i4, '"')

i5 = st.text_area("text area 5", max_chars=10)
st.write('value 5: "', i5, '"')

i6 = st.text_area("text area 6", placeholder="Placeholder")
st.write('value 6: "', i6, '"')

i7 = st.text_area("text area 7", "default text", disabled=True)
st.write('value 7: "', i7, '"')

i8 = st.text_area("text area 8", "default text", label_visibility="hidden")
st.write('value 8: "', i8, '"')

i9 = st.text_area("text area 9", "default text", label_visibility="collapsed")
st.write('value 9: "', i9, '"')

if runtime.is_running():

    def on_change():
        st.session_state.text_area_changed = True

    st.text_area("text area 10", key="text_area10", on_change=on_change)
    st.write('value 10: "', st.session_state.text_area10, '"')
    st.write("text area changed:", "text_area_changed" in st.session_state)
