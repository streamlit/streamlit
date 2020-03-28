# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import streamlit as st


i1 = st.number_input("number input 1")
st.write('value 1: "', i1, '"')

i2 = st.number_input("number input 2", value=1)
st.write('value 2: "', i2, '"')

i3 = st.number_input("number input 3", 1, 10)
st.write('value 3: "', i3, '"')
