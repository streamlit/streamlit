# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import altair as alt
import numpy as np
import pandas as pd
import streamlit as st
import time

# Test add_rows for everything that supports it.
# We test three times:
# * once with coalescing in Python
# * once with coalescing in JS.
# * once where we clear all elements at the end
# What to expect, visually:
# * 1 table
# * 1 dataframe
# * 2 line charts (one with only 1 datapoint)
# * 4 vega-lite charts
# * And then all of the above once again.
# (Also, all of the above should have 3 rows or datapoints.)
# * Then all of the above but with no data.
# * Then a 1-row dataframe and an error

num_rows = 3

df = pd.DataFrame({"a": [1, 2, 3], "b": [10, 0, 30], "c": [100, 200, -100]})

df1 = df.iloc[0:1, :]

for test_type in ["coalesce in Py", "coalesce in JS", "clear after addrows"]:

    table_el = st.table(df1)
    dataframe_el = st.dataframe(df1)
    chart_el1 = st.line_chart()
    chart_el2 = st.line_chart(df1)

    # 4 identical charts, built in different ways.
    vega_el1 = st.vega_lite_chart(
        df1,
        {
            "mark": {"type": "line", "point": True},
            "encoding": {
                "x": {"field": "a", "type": "quantitative"},
                "y": {"field": "b", "type": "quantitative"},
            },
        },
        use_container_width=True,
    )
    vega_el2 = st.vega_lite_chart(
        {
            "datasets": {"foo": df1},
            "data": {"name": "foo"},
            "mark": {"type": "line", "point": True},
            "encoding": {
                "x": {"field": "a", "type": "quantitative"},
                "y": {"field": "b", "type": "quantitative"},
            },
        },
        use_container_width=True,
    )
    vega_el3 = st.vega_lite_chart(
        {
            "datasets": {"foo": df1},
            "data": {"name": "foo"},
            "mark": {"type": "line", "point": True},
            "encoding": {
                "x": {"field": "a", "type": "quantitative"},
                "y": {"field": "b", "type": "quantitative"},
            },
        },
        use_container_width=True,
    )
    altair_el = st.altair_chart(
        alt.Chart(df).mark_line(point=True).encode(x="a", y="b").interactive(),
        use_container_width=True,
    )

    for i in range(1, num_rows):
        # Make rows get merged in JS rather than Python.
        if test_type == "coalesce in JS":
            time.sleep(0.2)

        df2 = df.iloc[i : i + 1, :]

        table_el.add_rows(df2)
        dataframe_el.add_rows(df2)
        chart_el1.add_rows(df2)
        chart_el2.add_rows(df2)
        vega_el1.add_rows(df2)
        vega_el2.add_rows(df2)
        vega_el3.add_rows(foo=df2)
        altair_el.add_rows(df2)

    if test_type == "clear after addrows":
        # Clear all elements.
        table_el.table([])
        dataframe_el.dataframe([])
        chart_el1.line_chart([])
        chart_el2.line_chart([])
        vega_el1.vega_lite_chart(
            [],
            {
                "mark": {"type": "line", "point": True},
                "encoding": {
                    "x": {"field": "a", "type": "quantitative"},
                    "y": {"field": "b", "type": "quantitative"},
                },
            },
            use_container_width=True,
        )
        vega_el2.vega_lite_chart(
            {
                "datasets": {"foo": []},
                "data": {"name": "foo"},
                "mark": {"type": "line", "point": True},
                "encoding": {
                    "x": {"field": "a", "type": "quantitative"},
                    "y": {"field": "b", "type": "quantitative"},
                },
            },
            use_container_width=True,
        )
        vega_el3.vega_lite_chart(
            {
                "datasets": {"foo": []},
                "data": {"name": "foo"},
                "mark": {"type": "line", "point": True},
                "encoding": {
                    "x": {"field": "a", "type": "quantitative"},
                    "y": {"field": "b", "type": "quantitative"},
                },
            },
            use_container_width=True,
        )
        altair_el.altair_chart(
            alt.Chart(pd.DataFrame())
            .mark_line(point=True)
            .encode(x="x:Q", y="y:Q")
            .interactive(),
            use_container_width=True,
        )

# Test that add_rows errors out when the dataframe dimensions don't
# match. Should show an error.
dataframe_el = st.dataframe(df1)
dataframe_el.add_rows(np.abs(np.random.randn(num_rows, 6)))
