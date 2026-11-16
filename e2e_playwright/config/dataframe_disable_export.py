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
        "name": ["Alice", "Bob", "Charlie"],
        "value": [100, 200, 300],
    }
)

column_config = {
    "name": st.column_config.TextColumn(width="small"),
    "value": st.column_config.NumberColumn(width="small"),
}

with st.container(key="read-only-dataframe"):
    st.subheader("Read-only dataframe")
    st.dataframe(
        df,
        hide_index=True,
        column_config=column_config,
        width=350,
    )

with st.container(key="editable-data-editor"):
    st.subheader("Editable data editor")
    st.data_editor(
        df,
        hide_index=True,
        column_config=column_config,
        width=350,
    )

with st.container(key="chart-table-view"):
    st.subheader("Chart")
    st.line_chart(df.set_index("name"), width=350)

with st.container(key="download-button"):
    st.subheader("Download button")
    st.download_button(
        "Download file",
        data="hello",
        file_name="hello.txt",
        mime="text/plain",
    )

with st.container(key="code-block"):
    st.subheader("Code block")
    st.code("print('hello')", language="python")

with st.container(key="json"):
    st.subheader("JSON")
    st.json({"name": "Alice", "value": 100})
