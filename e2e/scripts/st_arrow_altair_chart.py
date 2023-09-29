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

np.random.seed(0)

data = np.random.randn(200, 3)
df = pd.DataFrame(data, columns=["a", "b", "c"])
chart = alt.Chart(df).mark_circle().encode(x="a", y="b", size="c", color="c")
st.altair_chart(chart, theme=None)

st.write("Show default vega lite theme:")
st.altair_chart(chart, theme=None)

st.write("Show streamlit theme:")
st.altair_chart(chart, theme="streamlit")

st.write("Overwrite theme config:")
chart = (
    alt.Chart(df, usermeta={"embedOptions": {"theme": None}})
    .mark_circle()
    .encode(x="a", y="b", size="c", color="c")
)
st.altair_chart(chart, theme="streamlit")

data = pd.DataFrame(
    {
        "a": ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        "b": [28, 55, 43, 91, 81, 53, 19, 87, 52],
    }
)

chart = alt.Chart(data).mark_bar().encode(x="a", y="b")

st.write("Bar chart with overwritten theme props:")
st.altair_chart(chart.configure_mark(color="black"), theme="streamlit")

# mark_arc was added in 4.2, but we have to support altair 4.0-4.1, so we
# have to skip this part of the test when testing min versions.
major, minor, patch = alt.__version__.split(".")
if not (major == "4" and minor < "2"):
    source = pd.DataFrame(
        {"category": [1, 2, 3, 4, 5, 6], "value": [4, 6, 10, 3, 7, 8]}
    )

    chart = (
        alt.Chart(source)
        .mark_arc(innerRadius=50)
        .encode(
            theta=alt.Theta(field="value", type="quantitative"),
            color=alt.Color(field="category", type="nominal"),
        )
    )

    st.write("Pie Chart with more than 4 Legend items")
    st.altair_chart(chart, theme="streamlit")

# taken from vega_datasets barley example
barley = alt.UrlData(
    "https://cdn.jsdelivr.net/npm/vega-datasets@v2.7.0/data/barley.json"
)

barley_chart = (
    alt.Chart(barley)
    .mark_bar()
    .encode(x="year:O", y="sum(yield):Q", color="year:N", column="site:N")
)

st.write("Grouped Bar Chart with default theme:")
st.altair_chart(barley_chart, theme=None)

st.write("Grouped Bar Chart with streamlit theme:")
st.altair_chart(barley_chart, theme="streamlit")
