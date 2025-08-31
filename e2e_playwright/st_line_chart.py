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
from datetime import date

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)


data = np.random.randn(20, 3)
df = pd.DataFrame(data, columns=["a", "b", "c"])

# st.area/bar/line_chart all use Altair/Vega-Lite under the hood.
# By default, Vega-Lite displays time values in the browser's local
# time zone, but data is sent down to the browser as UTC. This means
# Times need to be set correctly to the users timezone.
utc_df = pd.DataFrame(
    {
        "index": [
            date(2019, 8, 9),
            date(2019, 8, 10),
            date(2019, 8, 11),
            date(2019, 8, 12),
        ],
        "numbers": [10, 50, 30, 40],
    }
)

utc_df.set_index("index", inplace=True)

# Dataframe to test the color parameter support:
N = 100

color_df = pd.DataFrame(
    {
        # Using a negative range so certain kinds of bugs are more visible.
        "a": -np.arange(N),
        "b": np.random.rand(N) * 10,
        "c": np.random.rand(N) * 10,
        "d": np.random.randn(N) * 30,
        "e": ["bird" if x % 2 else "airplane" for x in range(N)],
    }
)

st.header("Line Chart")

st.line_chart()
st.line_chart(df)
st.line_chart(df, x="a")
st.line_chart(df, y="a")
st.line_chart(df, y=["a", "b"])
st.line_chart(df, x="a", y="b", height=500, width=300)
st.line_chart(df, x="b", y="a")
st.line_chart(df, x="a", y=["b", "c"])
st.line_chart(utc_df)
st.line_chart(color_df, x="a", y="b", color="e")
st.line_chart(df, x_label="X Axis Label", y_label="Y Axis Label")

# Test column ordering with explicit y and color parameters (Issue #12071)
st.header("Column Order Test")
# Create data with non-alphabetical column names
column_order_data = {"c_one": [1, 1, 1], "b_two": [2, 2, 2], "a_three": [3, 3, 3]}
st.line_chart(
    column_order_data,
    y=["c_one", "b_two", "a_three"],
    color=[(255, 0, 0), (0, 255, 0), (0, 0, 255)],
)
st.write("width=content")
st.line_chart(df, width="content")

st.write("height=stretch")
with st.container(border=True, key="test_height_stretch", height=500):
    st.line_chart(df, height="stretch")

with st.container(
    border=True, horizontal=True, key="test_fixed_width_in_horizontal_container"
):
    st.line_chart(df, width=300)


# Test that add_rows maintains original styling params:
# color, width, height
line_data = pd.DataFrame({"Line 1": [], "Line 2": []})

empty_line = st.line_chart(
    line_data,
    y=["Line 1", "Line 2"],
    color=["#800080", "#0000FF"],  # Purple and Blue
    width=600,
    height=300,
)

if st.button("Add data to Line Chart"):
    new_data = pd.DataFrame(
        {"Line 1": np.random.randn(10).cumsum(), "Line 2": np.random.randn(10).cumsum()}
    )

    empty_line.add_rows(new_data)
