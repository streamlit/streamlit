# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Test app for st.table summary feature."""

import pandas as pd

import streamlit as st

# Table 1: Basic summary with sum and count
st.subheader("Table with sum and count summary")
df1 = pd.DataFrame(
    {
        "Product": ["Widget A", "Widget B", "Widget C"],
        "Units": [150, 280, 95],
        "Revenue": [4500.0, 8400.0, 2850.0],
    }
)
st.table(df1, summary={"Units": "sum", "Revenue": "sum", "Product": "count"})

# Table 2: Summary with all types
st.subheader("Table with all summary types")
df2 = pd.DataFrame(
    {
        "Name": ["Alice", "Bob", "Charlie", "Diana"],
        "Score": [85, 92, 78, 95],
    }
)
st.table(
    df2,
    summary={
        "Name": "count",
        "Score": "average",
    },
)

# Table 3: No summary
st.subheader("Table without summary")
df3 = pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6]})
st.table(df3)


# Table 4: Truncated data with summary (using generator)
# This will show the info icon because generators get truncated
def large_data_generator():
    """Generate rows that will be truncated."""
    for i in range(150):  # More than 100 rows
        yield {"ID": i, "Value": i * 10}


st.subheader("Table with truncated data (generator, 150 rows)")
st.table(large_data_generator(), summary={"ID": "count", "Value": "sum"})
