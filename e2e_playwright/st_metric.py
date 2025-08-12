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

import streamlit as st

np.random.seed(0)


# Create random sparkline data:
def generate_sparkline_data(
    length: int = 30, drift: float = 0.1, volatility: float = 10
) -> list[float]:
    random_changes = np.random.normal(loc=drift, scale=volatility, size=length)
    initial_value = np.random.normal(loc=50, scale=5)
    data = initial_value + np.cumsum(random_changes)
    return data.tolist()  # type: ignore


col1, col2, col3 = st.columns(3)

with col1:
    st.metric(
        "User growth",
        123,
        123,
        delta_color="normal",
        chart_data=generate_sparkline_data(),
        border=True,
    )
with col2:
    st.metric(
        "S&P 500",
        -4.56,
        -50,
        chart_data=generate_sparkline_data(),
        chart_type="area",
        border=True,
    )
with col3:
    st.metric(
        "Apples I've eaten",
        "23k",
        " -20",
        delta_color="off",
        chart_data=generate_sparkline_data(),
        chart_type="bar",
        border=True,
    )


with col1:
    st.metric("Test 3", -4.56, 1.23, label_visibility="visible")
with col2:
    st.metric("Test 4", -4.56, 1.23, label_visibility="hidden")
with col3:
    st.metric("Test 5", -4.56, 1.23, label_visibility="collapsed")

st.metric("Relatively long title with help", 123, help="testing help without a column")

st.metric("label title", None, None, help="testing help without a column")

col1, col2, col3, col4, col5, col6, col7, col8 = st.columns(8)

with col1:
    st.metric(
        label="Example metric",
        help="Something should feel right",
        value=150.59,
        delta="Very high",
    )

st.metric("Test 9", -4.56, 1.23, help="Test help with code `select * from table`")

st.metric("Test 10", -4.56, 1.23, border=True, help="Test help text")

st.metric(
    "Test 11 -> :material/check: :rainbow[Fancy] _**markdown** `label` _support_",
    123,
    123,
)

st.metric("Stretch width", 123, 123, width="stretch")

st.metric("Pixel width (300px)", 123, 123, width=300)

st.metric("Content width", 123, 123, width="content")

st.metric("Pixel height (200px)", 123, 123, border=True, height=200)

with st.container(height=400, key="height_test"):
    st.metric("Stretch height", 123, 123, height="stretch")
    st.metric("Content height", 123, 123, height="content")
