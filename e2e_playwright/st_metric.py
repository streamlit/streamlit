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

col1, col2, col3 = st.columns(3)

with col1:
    st.metric("User growth", 123, 123, "normal")
with col2:
    st.metric("S&P 500", -4.56, -50)
with col3:
    st.metric("Apples I've eaten", "23k", " -20", "off")

with col1:
    st.metric("Test 3", -4.56, 1.23, label_visibility="visible")
with col2:
    st.metric("Test 4", -4.56, 1.23, label_visibility="hidden")
with col3:
    st.metric("Test 5", -4.56, 1.23, label_visibility="collapsed")

st.metric(
    "User growth and a relatively long title", 123, help="testing help without a column"
)

st.metric("label title", None, None, help="testing help without a column")

col1, col2, col3, col4, col5, col6, col7, col8 = st.columns(8)

with col1:
    st.metric(
        label="Example metric",
        help="Something should feel right",
        value=150.59,
        delta="Very high",
    )
