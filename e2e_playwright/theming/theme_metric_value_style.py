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

st.set_page_config(initial_sidebar_state="collapsed")

st.header("Metric Value Style Test")

col1, col2, col3 = st.columns(3)

with col1:
    st.metric("Revenue", "$1,234,567", "+12.3%")

with col2:
    st.metric("Users", "45,678", "-5.2%", delta_color="inverse")

with col3:
    st.metric("Performance", "98.5%", "+2.1%")
