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

"""
Test app for Vega-based chart performance testing.
Tests resize performance, initial render, and data updates using
a mix of chart types: altair, line_chart, bar_chart, and vega_lite_chart.
"""

import altair as alt
import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(layout="wide")

# Generate test data with different sizes
np.random.seed(42)


@st.cache_data
def generate_data(n_points: int) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "x": range(n_points),
            "y": np.random.randn(n_points).cumsum(),
            "category": np.random.choice(["A", "B", "C", "D"], n_points),
            "size": np.random.uniform(10, 100, n_points),
        }
    )


# Small dataset (200 points) - typical use case
small_data = generate_data(200)

# Large dataset (5000 points) - stress test
large_data = generate_data(5000)

st.header("Vega Chart Performance Test")

# Test 1: st.line_chart (built-in chart)
st.subheader("1. st.line_chart - resize test")
st.line_chart(
    small_data.set_index("x")["y"],
    use_container_width=True,
)

# Test 2: Multiple chart types in columns (parallel resize)
st.subheader("2. Multiple chart types - parallel resize test")
cols = st.columns(3)

# Column 1: st.bar_chart
with cols[0]:
    st.caption("st.bar_chart")
    bar_data = small_data.groupby("category")["y"].mean()
    st.bar_chart(bar_data, use_container_width=True)

# Column 2: st.line_chart
with cols[1]:
    st.caption("st.line_chart")
    st.line_chart(
        small_data.set_index("x")["y"].head(50),
        use_container_width=True,
    )

# Column 3: Altair chart
with cols[2]:
    st.caption("Altair chart")
    altair_chart = (
        alt.Chart(small_data.head(50))
        .mark_line()
        .encode(
            x="x:Q",
            y="y:Q",
        )
    )
    st.altair_chart(altair_chart, use_container_width=True)

# Test 3: Altair with large dataset
st.subheader("3. Altair - large dataset (5000 points)")
scatter_chart = (
    alt.Chart(large_data)
    .mark_circle()
    .encode(
        x="x:Q",
        y="y:Q",
        color="category:N",
        size="size:Q",
    )
)
st.altair_chart(scatter_chart, use_container_width=True)

# Test 4: st.vega_lite_chart
st.subheader("4. st.vega_lite_chart")
st.vega_lite_chart(
    small_data,
    {
        "mark": "area",
        "encoding": {
            "x": {"field": "x", "type": "quantitative"},
            "y": {"field": "y", "type": "quantitative"},
        },
    },
    use_container_width=True,
)

# Test 5: Data update test with Altair
st.subheader("5. Data update test")
if "data_version" not in st.session_state:
    st.session_state.data_version = 0

if st.button("Update data", key="update_data_btn"):
    st.session_state.data_version += 1

# Generate slightly different data based on version
update_data = pd.DataFrame(
    {
        "x": range(100),
        "y": np.random.RandomState(st.session_state.data_version).randn(100).cumsum(),
    }
)

update_chart = (
    alt.Chart(update_data)
    .mark_line()
    .encode(
        x="x:Q",
        y="y:Q",
    )
)
st.altair_chart(update_chart, use_container_width=True)

st.write(f"Data version: {st.session_state.data_version}")
