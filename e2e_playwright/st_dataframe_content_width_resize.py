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

import pandas as pd

import streamlit as st

df = pd.DataFrame(
    {
        "Name": ["Alice", "Bob", "Charlie"],
        "Value": [10, 20, 30],
    }
)

st.subheader("Normal layout")
st.dataframe(df, width="content", key="normal_content_width")

st.subheader("Horizontal layout")
col1, col2 = st.columns(2)
with col1:
    st.dataframe(df, width="content", key="horizontal_content_width")

st.subheader("Centered container")
with st.container(horizontal_alignment="center", key="centered_container", border=True):
    st.dataframe(df, width="content", key="centered_content_width")

st.subheader("Sidebar")
st.sidebar.dataframe(df, width="content", key="sidebar_content_width")

st.subheader("Tabs")
tab1, tab2 = st.tabs(["Data", "Info"])
with tab1:
    st.dataframe(df, width="content", key="tab_content_width")
