# Copyright 2018-2021 Streamlit Inc.
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

col1, col2, col3 = st.columns(3)

with col1:
    st.metric("User growth", 123, 123, "normal")
with col2:
    st.metric("S&P 500", -4.56, -50)
with col3:
    st.metric("Apples I've eaten", "23k", " -20", "off")

" "

col1, col2, col3 = st.columns(3)

with col1:
    st.selectbox("Pick one", [])
with col2:
    st.metric("Test 2", -4.56, 1.23, "inverse")
with col3:
    st.slider("Pick another")
