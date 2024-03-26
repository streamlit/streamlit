# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import pandas as pd
from altair.expr import datum
from vega_datasets import data

import streamlit as st

# SCATTER CHART
st.header("Altair Chart with point and interval selection")
cars = data.cars()

interval = alt.selection_interval()

point = alt.selection_point()

base = (
    alt.Chart(cars)
    .mark_point()
    .encode(
        x="Horsepower:Q",
        y="Miles_per_Gallon:Q",
        color=alt.condition(point, "Origin:N", alt.value("lightgray")),
        tooltip=["Name", "Origin", "Horsepower", "Miles_per_Gallon"],
    )
)

chart_point = base.add_params(point)
st.subheader("Scatter chart with selection_point")
st.altair_chart(chart_point, on_select=True, key="scatter_point")
if st.session_state.scatter_point:
    st.dataframe(st.session_state.scatter_point)

base = (
    alt.Chart(cars)
    .mark_point()
    .encode(
        x="Horsepower:Q",
        y="Miles_per_Gallon:Q",
        color=alt.condition(interval, "Origin:N", alt.value("lightgray")),
        tooltip=["Name", "Origin", "Horsepower", "Miles_per_Gallon"],
    )
)
chart_interval = base.add_params(interval)

st.subheader("Scatter chart with selection_interval")
st.altair_chart(chart_interval, on_select="rerun", key="scatter_interval")
if st.session_state.scatter_interval:
    st.dataframe(st.session_state.scatter_interval)

# BAR CHART
source = pd.DataFrame(
    {
        "a": ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        "b": [28, 55, 43, 91, 81, 53, 19, 87, 52],
    }
)

bar_graph = alt.Chart(source).mark_bar().encode(x="a", y="b")
bar_graph_point = bar_graph.add_params(point)

st.subheader("Bar chart with selection_point")
st.altair_chart(bar_graph_point, on_select="rerun", key="bar_point")
if st.session_state.bar_point:
    st.dataframe(st.session_state.bar_point)

bar_graph_interval = bar_graph.add_params(interval)
st.subheader("Bar chart with selection_interval")
st.altair_chart(bar_graph_interval, on_select="rerun", key="bar_interval")
if st.session_state.bar_interval:
    st.dataframe(st.session_state.bar_interval)

# STACKED AREA CHART
source = data.iowa_electricity()

base = (
    alt.Chart(source)
    .mark_area()
    .encode(
        x="year:T",
        y="net_generation:Q",
        color=alt.condition(point, "source:N", alt.value("lightgray")),
    )
)
area_chart_point = base.add_params(point)
st.subheader("Area chart with selection_point")
selection = st.altair_chart(area_chart_point, on_select="rerun", key="area_point")
if len(selection) > 0:
    st.dataframe(selection)

base = (
    alt.Chart(source)
    .mark_area()
    .encode(
        x="year:T",
        y="net_generation:Q",
        color=alt.condition(interval, "source:N", alt.value("lightgray")),
    )
)
area_chart_interval = base.add_params(interval)
st.subheader("Area chart with selection_interval")
area_interval_selection = st.altair_chart(
    area_chart_interval, on_select="rerun", key="area_interval"
)
if len(area_interval_selection) > 0:
    st.dataframe(area_interval_selection)

# HISTOGRAM CHART
source = data.movies.url

base = (
    alt.Chart(source)
    .mark_bar()
    .encode(
        alt.X("IMDB_Rating:Q", bin=True),
        y="count()",
        color=alt.condition(point, "IMDB_Rating:Q", alt.value("lightgray")),
    )
)
histogram_point = base.add_params(point)
st.subheader("Histogram chart with selection_point")
st.altair_chart(histogram_point, on_select="rerun", key="histogram_point")
if st.session_state.histogram_point:
    st.dataframe(st.session_state.histogram_point)

base = (
    alt.Chart(source)
    .mark_bar()
    .encode(
        alt.X("IMDB_Rating:Q", bin=True),
        y="count()",
        color=alt.condition(interval, "IMDB_Rating:Q", alt.value("lightgray")),
    )
)
histogram_interval = base.add_params(interval)
st.subheader("Histogram chart with selection_interval")
st.altair_chart(histogram_interval, on_select="rerun", key="histogram_interval")
if st.session_state.histogram_interval:
    st.dataframe(st.session_state.histogram_interval)
