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

st.title("Advanced Data Grid Example")

# Create a more complex dataset
data = pd.DataFrame(
    {
        "Name": ["Alice", "Bob", "Charlie"],
        "Age": [25, 30, 35],
        "Join Date": pd.to_datetime(["2022-01-15", "2021-06-01", "2023-03-12"]),
        "Score": [88.5, 92.0, 79.5],
        "Active": [True, False, True],
        "Category": pd.Categorical(["A", "B", "A"]),
    }
)

# Show the editable data grid
edited_data = st.data_editor(
    data,
    hide_index=False,
    use_container_width=True,
    column_config={
        "Name": st.column_config.TextColumn("Employee Name"),
        "Age": st.column_config.NumberColumn("Age (years)", min_value=18, max_value=65),
        "Join Date": st.column_config.DateColumn("Start Date"),
        "Score": st.column_config.NumberColumn("Score", step=0.1, format="%.1f"),
        "Active": st.column_config.CheckboxColumn("Active Employee"),
        "Category": st.column_config.SelectboxColumn("Group", options=["A", "B", "C"]),
    },
    key="advanced_grid",
)

st.write("Edited Data:")
st.dataframe(edited_data, key="result_dataframe")
