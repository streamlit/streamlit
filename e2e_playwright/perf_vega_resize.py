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

"""Test app for Vega chart resize performance."""

import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(layout="wide")
st.title("Vega Resize Performance Test")

# Create sample data
np.random.seed(42)
df = pd.DataFrame(
    {"x": range(100), "y": np.random.randn(100).cumsum(), "category": ["A", "B"] * 50}
)

# Multiple Vega-Lite charts in columns
col1, col2, col3 = st.columns(3)

with col1:
    st.subheader("Line Chart")
    st.line_chart(df.set_index("x")["y"])

with col2:
    st.subheader("Area Chart")
    st.area_chart(df.set_index("x")["y"])

with col3:
    st.subheader("Bar Chart")
    st.bar_chart(df.set_index("x")["y"].head(20))

# Another row of charts
col4, col5 = st.columns(2)

with col4:
    st.subheader("Scatter Plot")
    st.scatter_chart(df, x="x", y="y", color="category")

with col5:
    st.subheader("Line Chart 2")
    st.line_chart(df.set_index("x")["y"] * 2)
