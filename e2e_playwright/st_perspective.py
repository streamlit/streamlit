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

"""E2E test app for st.perspective."""

import pandas as pd

import streamlit as st

st.header("st.perspective E2E Tests")

# Create test data
data = pd.DataFrame(
    {
        "Category": ["A", "B", "C", "D", "E"],
        "Region": ["North", "South", "East", "West", "Central"],
        "Sales": [100, 150, 200, 175, 125],
        "Profit": [10, 25, 40, 30, 15],
        "Quantity": [5, 10, 15, 12, 8],
    }
)

# Basic perspective viewer
st.subheader("Basic Perspective")
st.perspective(data, key="basic_perspective")

# Perspective with custom height
st.subheader("Custom Height (300px)")
st.perspective(data, height=300, key="custom_height")

# Perspective with default config
st.subheader("With Default Config")
st.perspective(
    data,
    key="with_config",
    default_config={
        "columns": ["Sales", "Profit"],
        "group_by": ["Category"],
    },
)

# Perspective that fills container width
st.subheader("Stretch Width")
st.perspective(data, width="stretch", key="stretch_width")

# Perspective with fixed width
st.subheader("Fixed Width (400px)")
st.perspective(data, width=400, key="fixed_width")
