# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import altair as alt
import numpy as np
import pandas as pd

import streamlit as st

df = pd.DataFrame({"a": [10, 11], "b": [20, 21], "c": [30, 31]})
df_add_rows = pd.DataFrame({"a": [12, 13], "b": [22, 23], "c": [32, 33]})

df2 = pd.DataFrame({"a": [10, 11], "b": [1, 3], "c": [2, 4]})
df2_add_rows = pd.DataFrame({"a": [12, 13], "b": [2, 4], "c": [3, 5]})


"""
# Tabular tests

Should show index=[0, 1, 2, 3], a=[10, 11, 12, 13], b=[20, 21, 22, 23],
c=[30, 31, 32, 33].
"""
table_element = st._arrow_table(df)
dataframe_element = st._arrow_dataframe(df)

"""
# Empty chart test

Should show 3 lines going up. One line should be quite far from the others.
"""
chart_element_1 = st._arrow_line_chart()

"""
# Non-empty chart test

Should show 2 lines zig-zagging, and a farther one just going up.
"""
chart_element_2 = st._arrow_line_chart(df2)

"""
# Chart encoding tests

These are 4 identical charts, built in different ways using Altair and Vega-Lite directly.

Each should show 1 line zig-zagging.
"""
vega_element_1 = st._arrow_vega_lite_chart(
    df2,
    {
        "mark": {"type": "line", "point": True},
        "encoding": {
            "x": {"field": "a", "type": "quantitative"},
            "y": {"field": "b", "type": "quantitative"},
        },
    },
    use_container_width=True,
)
vega_element_2 = st._arrow_vega_lite_chart(
    {
        "datasets": {"foo": df2},
        "data": {"name": "foo"},
        "mark": {"type": "line", "point": True},
        "encoding": {
            "x": {"field": "a", "type": "quantitative"},
            "y": {"field": "b", "type": "quantitative"},
        },
    },
    use_container_width=True,
)
vega_element_3 = st._arrow_vega_lite_chart(
    {
        "datasets": {"foo": df2},
        "data": {"name": "foo"},
        "mark": {"type": "line", "point": True},
        "encoding": {
            "x": {"field": "a", "type": "quantitative"},
            "y": {"field": "b", "type": "quantitative"},
        },
    },
    use_container_width=True,
)
altair_element = st._arrow_altair_chart(
    alt.Chart(df2).mark_line(point=True).encode(x="a", y="b").interactive(),
    use_container_width=True,
)

table_element._arrow_add_rows(df_add_rows)
dataframe_element._arrow_add_rows(df_add_rows)
chart_element_1._arrow_add_rows(df2_add_rows)
chart_element_2._arrow_add_rows(df2_add_rows)
vega_element_1._arrow_add_rows(df2_add_rows)
vega_element_2._arrow_add_rows(df2_add_rows)
vega_element_3._arrow_add_rows(foo=df2_add_rows)
altair_element._arrow_add_rows(df2_add_rows)

"""
# Mismatched dimensions

Test that `_arrow_add_rows` errors out when the dataframe dimensions don't
match.

This should show an error.
"""
dataframe_element = st._arrow_dataframe(df)
dataframe_element._arrow_add_rows(np.abs(np.random.randn(1, 6)))
