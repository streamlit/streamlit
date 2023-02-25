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

i1 = st.number_input("number input 1")
st.write('value 1: "', i1, '"')

i2 = st.number_input("number input 2", value=1)
st.write('value 2: "', i2, '"')

i3 = st.number_input("number input 3", 1, 10)
st.write('value 3: "', i3, '"')

i4 = st.number_input("number input 4", step=2)
st.write('value 4: "', i4, '"')

i5 = st.number_input("number input 5", max_value=10)
st.write('value 5: "', i5, '"')

i6 = st.number_input("number input 6", disabled=True)
st.write('value 6: "', i6, '"')

i7 = st.number_input("number input 7", label_visibility="hidden")
st.write('value 7: "', i7, '"')

i8 = st.number_input("number input 8", label_visibility="collapsed")
st.write('value 8: "', i8, '"')

if runtime.exists():

    def on_change():
        st.session_state.number_input_changed = True

    st.number_input("number input 9", key="number_input9", on_change=on_change)
    st.write('value 9: "', st.session_state.number_input9, '"')
    st.write("number input changed:", "number_input_changed" in st.session_state)

i10 = st.number_input("formatted 1", value=2, format="%+u")
st.write('value 10: "', i10, '"')

i11 = st.number_input("formatted 2", value=-10.23456, format="%8.3f")
st.write('value 11: "', i11, '"')

i12 = st.number_input("formatted 3", value=33, format="%+010d")
st.write('value 12: "', i12, '"')

i13 = st.number_input("formatted 4", value=0, format="$%dk")
st.write('value 13: "', i13, '"')
