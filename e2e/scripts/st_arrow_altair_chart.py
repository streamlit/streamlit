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
st._arrow_altair_chart(chart, theme=None)

st.write("Show default vega lite theme:")
st._arrow_altair_chart(chart, theme=None)

st.write("Show streamlit theme:")
st._arrow_altair_chart(chart, theme="streamlit")

st.write("Overwrite theme config:")
chart = (
    alt.Chart(df, usermeta={"embedOptions": {"theme": None}})
    .mark_circle()
    .encode(x="a", y="b", size="c", color="c")
)
st._arrow_altair_chart(chart, theme="streamlit")

data = pd.DataFrame(
    {
        "a": ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        "b": [28, 55, 43, 91, 81, 53, 19, 87, 52],
    }
)

chart = alt.Chart(data).mark_bar().encode(x="a", y="b")

st.write("Bar chart with default theme:")
st._arrow_altair_chart(chart)

st.write("Bar chart with streamlit theme:")
st._arrow_altair_chart(chart, theme="streamlit")

st.write("Bar chart with overwritten theme props:")
st._arrow_altair_chart(chart.configure_mark(color="black"), theme="streamlit")

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
    st._arrow_altair_chart(chart, theme="streamlit")

# taken from vega_datasets barley example
barley = pd.DataFrame(
    [
        {"yield": 27, "variety": "Manchuria", "year": 1931, "site": "University Farm"},
        {"yield": 48.86667, "variety": "Manchuria", "year": 1931, "site": "Waseca"},
        {"yield": 27.43334, "variety": "Manchuria", "year": 1931, "site": "Morris"},
        {"yield": 39.93333, "variety": "Manchuria", "year": 1931, "site": "Crookston"},
        {
            "yield": 32.96667,
            "variety": "Manchuria",
            "year": 1931,
            "site": "Grand Rapids",
        },
        {"yield": 28.96667, "variety": "Manchuria", "year": 1931, "site": "Duluth"},
        {
            "yield": 43.06666,
            "variety": "Glabron",
            "year": 1931,
            "site": "University Farm",
        },
        {"yield": 55.2, "variety": "Glabron", "year": 1931, "site": "Waseca"},
        {"yield": 28.76667, "variety": "Glabron", "year": 1931, "site": "Morris"},
        {"yield": 38.13333, "variety": "Glabron", "year": 1931, "site": "Crookston"},
        {"yield": 29.13333, "variety": "Glabron", "year": 1931, "site": "Grand Rapids"},
        {"yield": 29.66667, "variety": "Glabron", "year": 1931, "site": "Duluth"},
        {
            "yield": 35.13333,
            "variety": "Svansota",
            "year": 1931,
            "site": "University Farm",
        },
        {"yield": 47.33333, "variety": "Svansota", "year": 1931, "site": "Waseca"},
        {"yield": 25.76667, "variety": "Svansota", "year": 1931, "site": "Morris"},
        {"yield": 40.46667, "variety": "Svansota", "year": 1931, "site": "Crookston"},
        {
            "yield": 29.66667,
            "variety": "Svansota",
            "year": 1931,
            "site": "Grand Rapids",
        },
        {"yield": 25.7, "variety": "Svansota", "year": 1931, "site": "Duluth"},
        {"yield": 39.9, "variety": "Velvet", "year": 1931, "site": "University Farm"},
        {"yield": 50.23333, "variety": "Velvet", "year": 1931, "site": "Waseca"},
        {"yield": 26.13333, "variety": "Velvet", "year": 1931, "site": "Morris"},
        {"yield": 41.33333, "variety": "Velvet", "year": 1931, "site": "Crookston"},
        {"yield": 23.03333, "variety": "Velvet", "year": 1931, "site": "Grand Rapids"},
        {"yield": 26.3, "variety": "Velvet", "year": 1931, "site": "Duluth"},
        {
            "yield": 36.56666,
            "variety": "Trebi",
            "year": 1931,
            "site": "University Farm",
        },
        {"yield": 63.8333, "variety": "Trebi", "year": 1931, "site": "Waseca"},
        {"yield": 43.76667, "variety": "Trebi", "year": 1931, "site": "Morris"},
        {"yield": 46.93333, "variety": "Trebi", "year": 1931, "site": "Crookston"},
        {"yield": 29.76667, "variety": "Trebi", "year": 1931, "site": "Grand Rapids"},
        {"yield": 33.93333, "variety": "Trebi", "year": 1931, "site": "Duluth"},
        {
            "yield": 43.26667,
            "variety": "No. 457",
            "year": 1931,
            "site": "University Farm",
        },
        {"yield": 58.1, "variety": "No. 457", "year": 1931, "site": "Waseca"},
        {"yield": 28.7, "variety": "No. 457", "year": 1931, "site": "Morris"},
        {"yield": 45.66667, "variety": "No. 457", "year": 1931, "site": "Crookston"},
        {"yield": 32.16667, "variety": "No. 457", "year": 1931, "site": "Grand Rapids"},
        {"yield": 33.6, "variety": "No. 457", "year": 1931, "site": "Duluth"},
        {"yield": 36.6, "variety": "No. 462", "year": 1931, "site": "University Farm"},
        {"yield": 65.7667, "variety": "No. 462", "year": 1931, "site": "Waseca"},
        {"yield": 30.36667, "variety": "No. 462", "year": 1931, "site": "Morris"},
        {"yield": 48.56666, "variety": "No. 462", "year": 1931, "site": "Crookston"},
        {"yield": 24.93334, "variety": "No. 462", "year": 1931, "site": "Grand Rapids"},
        {"yield": 28.1, "variety": "No. 462", "year": 1931, "site": "Duluth"},
        {
            "yield": 32.76667,
            "variety": "Peatland",
            "year": 1931,
            "site": "University Farm",
        },
        {"yield": 48.56666, "variety": "Peatland", "year": 1931, "site": "Waseca"},
        {"yield": 29.86667, "variety": "Peatland", "year": 1931, "site": "Morris"},
        {"yield": 41.6, "variety": "Peatland", "year": 1931, "site": "Crookston"},
        {"yield": 34.7, "variety": "Peatland", "year": 1931, "site": "Grand Rapids"},
        {"yield": 32, "variety": "Peatland", "year": 1931, "site": "Duluth"},
        {
            "yield": 24.66667,
            "variety": "No. 475",
            "year": 1931,
            "site": "University Farm",
        },
        {"yield": 46.76667, "variety": "No. 475", "year": 1931, "site": "Waseca"},
        {"yield": 22.6, "variety": "No. 475", "year": 1931, "site": "Morris"},
        {"yield": 44.1, "variety": "No. 475", "year": 1931, "site": "Crookston"},
        {"yield": 19.7, "variety": "No. 475", "year": 1931, "site": "Grand Rapids"},
        {"yield": 33.06666, "variety": "No. 475", "year": 1931, "site": "Duluth"},
        {
            "yield": 39.3,
            "variety": "Wisconsin No. 38",
            "year": 1931,
            "site": "University Farm",
        },
        {"yield": 58.8, "variety": "Wisconsin No. 38", "year": 1931, "site": "Waseca"},
        {
            "yield": 29.46667,
            "variety": "Wisconsin No. 38",
            "year": 1931,
            "site": "Morris",
        },
        {
            "yield": 49.86667,
            "variety": "Wisconsin No. 38",
            "year": 1931,
            "site": "Crookston",
        },
        {
            "yield": 34.46667,
            "variety": "Wisconsin No. 38",
            "year": 1931,
            "site": "Grand Rapids",
        },
        {"yield": 31.6, "variety": "Wisconsin No. 38", "year": 1931, "site": "Duluth"},
        {
            "yield": 26.9,
            "variety": "Manchuria",
            "year": 1932,
            "site": "University Farm",
        },
        {"yield": 33.46667, "variety": "Manchuria", "year": 1932, "site": "Waseca"},
        {"yield": 34.36666, "variety": "Manchuria", "year": 1932, "site": "Morris"},
        {"yield": 32.96667, "variety": "Manchuria", "year": 1932, "site": "Crookston"},
        {
            "yield": 22.13333,
            "variety": "Manchuria",
            "year": 1932,
            "site": "Grand Rapids",
        },
        {"yield": 22.56667, "variety": "Manchuria", "year": 1932, "site": "Duluth"},
        {"yield": 36.8, "variety": "Glabron", "year": 1932, "site": "University Farm"},
        {"yield": 37.73333, "variety": "Glabron", "year": 1932, "site": "Waseca"},
        {"yield": 35.13333, "variety": "Glabron", "year": 1932, "site": "Morris"},
        {"yield": 26.16667, "variety": "Glabron", "year": 1932, "site": "Crookston"},
        {"yield": 14.43333, "variety": "Glabron", "year": 1932, "site": "Grand Rapids"},
        {"yield": 25.86667, "variety": "Glabron", "year": 1932, "site": "Duluth"},
        {
            "yield": 27.43334,
            "variety": "Svansota",
            "year": 1932,
            "site": "University Farm",
        },
        {"yield": 38.5, "variety": "Svansota", "year": 1932, "site": "Waseca"},
        {"yield": 35.03333, "variety": "Svansota", "year": 1932, "site": "Morris"},
        {"yield": 20.63333, "variety": "Svansota", "year": 1932, "site": "Crookston"},
        {
            "yield": 16.63333,
            "variety": "Svansota",
            "year": 1932,
            "site": "Grand Rapids",
        },
        {"yield": 22.23333, "variety": "Svansota", "year": 1932, "site": "Duluth"},
        {"yield": 26.8, "variety": "Velvet", "year": 1932, "site": "University Farm"},
        {"yield": 37.4, "variety": "Velvet", "year": 1932, "site": "Waseca"},
        {"yield": 38.83333, "variety": "Velvet", "year": 1932, "site": "Morris"},
        {"yield": 32.06666, "variety": "Velvet", "year": 1932, "site": "Crookston"},
        {"yield": 32.23333, "variety": "Velvet", "year": 1932, "site": "Grand Rapids"},
        {"yield": 22.46667, "variety": "Velvet", "year": 1932, "site": "Duluth"},
        {
            "yield": 29.06667,
            "variety": "Trebi",
            "year": 1932,
            "site": "University Farm",
        },
        {"yield": 49.2333, "variety": "Trebi", "year": 1932, "site": "Waseca"},
        {"yield": 46.63333, "variety": "Trebi", "year": 1932, "site": "Morris"},
        {"yield": 41.83333, "variety": "Trebi", "year": 1932, "site": "Crookston"},
        {"yield": 20.63333, "variety": "Trebi", "year": 1932, "site": "Grand Rapids"},
        {"yield": 30.6, "variety": "Trebi", "year": 1932, "site": "Duluth"},
        {
            "yield": 26.43334,
            "variety": "No. 457",
            "year": 1932,
            "site": "University Farm",
        },
        {"yield": 42.2, "variety": "No. 457", "year": 1932, "site": "Waseca"},
        {"yield": 43.53334, "variety": "No. 457", "year": 1932, "site": "Morris"},
        {"yield": 34.33333, "variety": "No. 457", "year": 1932, "site": "Crookston"},
        {"yield": 19.46667, "variety": "No. 457", "year": 1932, "site": "Grand Rapids"},
        {"yield": 22.7, "variety": "No. 457", "year": 1932, "site": "Duluth"},
        {
            "yield": 25.56667,
            "variety": "No. 462",
            "year": 1932,
            "site": "University Farm",
        },
        {"yield": 44.7, "variety": "No. 462", "year": 1932, "site": "Waseca"},
        {"yield": 47, "variety": "No. 462", "year": 1932, "site": "Morris"},
        {"yield": 30.53333, "variety": "No. 462", "year": 1932, "site": "Crookston"},
        {"yield": 19.9, "variety": "No. 462", "year": 1932, "site": "Grand Rapids"},
        {"yield": 22.5, "variety": "No. 462", "year": 1932, "site": "Duluth"},
        {
            "yield": 28.06667,
            "variety": "Peatland",
            "year": 1932,
            "site": "University Farm",
        },
        {"yield": 36.03333, "variety": "Peatland", "year": 1932, "site": "Waseca"},
        {"yield": 43.2, "variety": "Peatland", "year": 1932, "site": "Morris"},
        {"yield": 25.23333, "variety": "Peatland", "year": 1932, "site": "Crookston"},
        {
            "yield": 26.76667,
            "variety": "Peatland",
            "year": 1932,
            "site": "Grand Rapids",
        },
        {"yield": 31.36667, "variety": "Peatland", "year": 1932, "site": "Duluth"},
        {"yield": 30, "variety": "No. 475", "year": 1932, "site": "University Farm"},
        {"yield": 41.26667, "variety": "No. 475", "year": 1932, "site": "Waseca"},
        {"yield": 44.23333, "variety": "No. 475", "year": 1932, "site": "Morris"},
        {"yield": 32.13333, "variety": "No. 475", "year": 1932, "site": "Crookston"},
        {"yield": 15.23333, "variety": "No. 475", "year": 1932, "site": "Grand Rapids"},
        {"yield": 27.36667, "variety": "No. 475", "year": 1932, "site": "Duluth"},
        {
            "yield": 38,
            "variety": "Wisconsin No. 38",
            "year": 1932,
            "site": "University Farm",
        },
        {
            "yield": 58.16667,
            "variety": "Wisconsin No. 38",
            "year": 1932,
            "site": "Waseca",
        },
        {
            "yield": 47.16667,
            "variety": "Wisconsin No. 38",
            "year": 1932,
            "site": "Morris",
        },
        {
            "yield": 35.9,
            "variety": "Wisconsin No. 38",
            "year": 1932,
            "site": "Crookston",
        },
        {
            "yield": 20.66667,
            "variety": "Wisconsin No. 38",
            "year": 1932,
            "site": "Grand Rapids",
        },
        {
            "yield": 29.33333,
            "variety": "Wisconsin No. 38",
            "year": 1932,
            "site": "Duluth",
        },
    ]
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
