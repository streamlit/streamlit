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

import numpy as np
import pandas as pd

import streamlit as st

# Sample data for testing
small_data = pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6], "C": [7, 8, 9]})

medium_data = pd.DataFrame(
    {
        "Name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
        "Age": [25, 30, 35, 28, 32],
        "City": ["New York", "London", "Tokyo", "Paris", "Sydney"],
        "Salary": [50000, 60000, 70000, 55000, 65000],
        "Department": ["Engineering", "Marketing", "Sales", "HR", "Finance"],
    }
)

large_data = pd.DataFrame({f"Column_{i}": np.random.randn(20) for i in range(8)})

# JSON data samples
simple_json = {"name": "John", "age": 30, "city": "New York"}

complex_json = {
    "user": {
        "id": 123,
        "profile": {
            "name": "Alice Smith",
            "email": "alice@example.com",
            "preferences": {"theme": "dark", "notifications": True, "language": "en"},
        },
        "activity": {"last_login": "2024-01-15T10:30:00Z", "login_count": 42},
    },
    "settings": ["setting1", "setting2", "setting3"],
}

st.title("Data Elements in Horizontal Containers")

st.subheader("Multiple dataframes side by side")

with st.container(direction="horizontal", border=True):
    st.dataframe(small_data, use_container_width=True)
    st.dataframe(small_data, use_container_width=True)

with st.container(direction="horizontal", border=True):
    st.dataframe(small_data, use_container_width=True)
    st.dataframe(medium_data, use_container_width=False)
    st.dataframe(small_data, use_container_width=True)

st.subheader("Multiple tables side by side")

with st.container(direction="horizontal", border=True):
    st.table(small_data)
    st.table(small_data)

st.subheader("Multiple JSON displays side by side")

with st.container(direction="horizontal", border=True):
    st.json(simple_json)
    st.json(simple_json)


st.subheader("Mixed data elements")

with st.container(direction="horizontal", border=True):
    st.dataframe(medium_data, use_container_width=False)
    st.json(simple_json)


st.subheader("Data elements with labels")

with st.container(direction="horizontal", border=True):
    st.markdown("**Data Overview**", width="content")
    st.dataframe(medium_data, use_container_width=True)

with st.container(direction="horizontal", border=True):
    st.markdown("**Summary**", width="content")
    st.table(small_data)
    st.markdown("**Config**", width="content")
    st.json(simple_json)

st.subheader("Large data handling")

with st.container(direction="horizontal", border=True):
    st.info("Very important information")
    st.dataframe(large_data, use_container_width=True)

st.subheader("Different sizing configurations")

with st.container(direction="horizontal", border=True):
    st.dataframe(small_data, use_container_width=False, width=200)
    st.dataframe(small_data, use_container_width=True)
