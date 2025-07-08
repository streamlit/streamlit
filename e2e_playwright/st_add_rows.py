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

import time

import altair as alt
import numpy as np
import pandas as pd

import streamlit as st

df = pd.DataFrame({"a": [1, 2], "b": [3, 4], "c": [5, 6]})

table_element = st.table(df)
dataframe_element = st.dataframe(df)
chart_element_1 = st.line_chart()
chart_element_2 = st.line_chart(df)

# 4 identical charts, built in different ways.
vega_element_1 = st.vega_lite_chart(
    df,
    {
        "mark": {"type": "line", "point": True},
        "encoding": {
            "x": {"field": "a", "type": "quantitative"},
            "y": {"field": "b", "type": "quantitative"},
        },
    },
    use_container_width=True,
)
vega_element_2 = st.vega_lite_chart(
    {
        "datasets": {"foo": df},
        "data": {"name": "foo"},
        "mark": {"type": "line", "point": True},
        "encoding": {
            "x": {"field": "a", "type": "quantitative"},
            "y": {"field": "b", "type": "quantitative"},
        },
    },
    use_container_width=True,
)
vega_element_3 = st.vega_lite_chart(
    {
        "datasets": {"foo": df},
        "data": {"name": "foo"},
        "mark": {"type": "line", "point": True},
        "encoding": {
            "x": {"field": "a", "type": "quantitative"},
            "y": {"field": "b", "type": "quantitative"},
        },
    },
    use_container_width=True,
)
altair_element = st.altair_chart(
    alt.Chart(df).mark_line(point=True).encode(x="a", y="b").interactive(),
    use_container_width=True,
)

table_element.add_rows(df)
dataframe_element.add_rows(df)
chart_element_1.add_rows(df)
chart_element_2.add_rows(df)
vega_element_1.add_rows(df)
vega_element_2.add_rows(df)
vega_element_3.add_rows(foo=df)
altair_element.add_rows(df)

# The following example was failing due to an issue (#3653) in st.add_rows.
# In the previous implementation of Quiver, we were mutating the Quiver element
# in the addRows function, which prevented re-rendering of the line chart.
# This example reproduces the issue, so that we don't repeat the same mistake
# in the future.

current_time = pd.to_datetime("08:00:00 2021-01-01", utc=True)
simulation_step = pd.Timedelta(seconds=10)

df1 = pd.DataFrame(data=[[current_time, 1]], columns=["t", "y"]).set_index("t")
line_chart = st.line_chart(df1, use_container_width=True)

for count in range(5):
    current_time += simulation_step
    df2 = pd.DataFrame(data=[[current_time, count]], columns=["t", "y"]).set_index("t")
    line_chart.add_rows(df2)
    time.sleep(0.25)

# Test that `add_rows` errors out when the dataframe dimensions don't match.
# This should show an error!
dataframe_element = st.dataframe(df)
dataframe_element.add_rows(np.abs(np.random.randn(1, 6)))
