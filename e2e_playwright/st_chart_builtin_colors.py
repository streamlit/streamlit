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

"""Test app for built-in color name support in charts.

This app tests that all built-in color names (red, orange, yellow, green,
blue, violet, gray, primary) are correctly resolved to theme color values.
"""

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(42)

# Create sample data for multi-series charts
df = pd.DataFrame(
    {
        "x": range(10),
        "series1": np.cumsum(np.random.randn(10)),
        "series2": np.cumsum(np.random.randn(10)),
    }
)

# Layout all charts in columns so they fit on screen
col1, col2 = st.columns(2)

with col1:
    st.write('**Line: `color=["red", "orange"]`**')
    st.line_chart(df, x="x", y=["series1", "series2"], color=["red", "orange"])

    st.write('**Bar: `color=["yellow", "green"]`**')
    st.bar_chart(df, x="x", y=["series1", "series2"], color=["yellow", "green"])

with col2:
    st.write('**Area: `color=["blue", "violet"]`**')
    st.area_chart(df, x="x", y=["series1", "series2"], color=["blue", "violet"])

    st.write('**Scatter: `color=["gray", "primary"]`**')
    st.scatter_chart(df, x="x", y=["series1", "series2"], color=["gray", "primary"])
