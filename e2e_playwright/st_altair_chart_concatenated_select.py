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

import streamlit as st

st.header("Altair Chart with point and interval selection")

# REPEAT CHEAT
iris = alt.UrlData("https://cdn.jsdelivr.net/npm/vega-datasets@v1.29.0/data/iris.json")

point = alt.selection_point()
interval = alt.selection_interval()

base = (
    alt.Chart()
    .mark_point()
    .encode(
        color="species:N",
        tooltip=alt.value(None),
    )
    .properties(width=200, height=200)
)

chart = alt.vconcat(data=iris)
for y_encoding in ["petalLength:Q", "petalWidth:Q"]:
    row = alt.hconcat()
    for x_encoding in ["sepalLength:Q", "sepalWidth:Q"]:
        row |= base.encode(x=x_encoding, y=y_encoding)
    chart &= row
chart = chart.add_params(point)
chart = chart.add_params(interval)
st.altair_chart(chart, on_select=True, key="repeat_chart")
st.dataframe(st.session_state.repeat_chart)

# LAYERED CHART
stocks = alt.UrlData(
    "https://cdn.jsdelivr.net/npm/vega-datasets@v1.29.0/data/stocks.csv"
)
base = (
    alt.Chart(stocks)
    .encode(
        x="date:T",
        y="price:Q",
        color=alt.condition(point, "symbol:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
    .transform_filter(alt.datum.symbol == "GOOG")
)

# This layering must be in an exact order, otherwise this code will not work
chart = base.mark_line() + base.mark_point()
chart = chart.add_params(point)
st.altair_chart(chart, on_select=True, key="layered_chart")
st.dataframe(st.session_state.layered_chart)

# FACET CHART
base = (
    alt.Chart(iris)
    .mark_point()
    .encode(
        x="petalLength:Q",
        y="petalWidth:Q",
        color="species:N",
        tooltip=alt.value(None),
    )
    .properties(width=220, height=220)
    .facet(column="species:N")
)

chart = alt.hconcat()
for species in ["setosa", "versicolor", "virginica"]:
    chart |= base.transform_filter(alt.datum.species == species)
chart = chart.add_params(point)
facet_selection = st.altair_chart(chart, on_select=True, key="facet_chart")
if len(facet_selection) > 0:
    st.dataframe(facet_selection)

# VCONCAT CHART
source = alt.UrlData(
    "https://cdn.jsdelivr.net/npm/vega-datasets@v1.29.0/data/sp500.csv"
)

brush = alt.selection_interval(encodings=["x"])

base = (
    alt.Chart(source)
    .mark_area()
    .encode(
        x="date:T",
        y="price:Q",
        tooltip=alt.value(None),
    )
    .properties(width=600, height=200)
)

upper = base.encode(alt.X("date:T").scale(domain=brush))

lower = base.properties(height=60).add_params(brush)

chart = alt.vconcat(upper, lower)
st.altair_chart(chart, on_select=True, key="vconcat_chart")
st.dataframe(st.session_state.vconcat_chart)

# HCONCAT CHART
def callback():
    st.write("Hello world")


chart1 = (
    alt.Chart(iris)
    .mark_point()
    .encode(
        x="petalLength:Q",
        y="petalWidth:Q",
        color="species:N",
        tooltip=alt.value(None),
    )
    .properties(height=300, width=300)
    .add_params(interval)
)

chart2 = (
    alt.Chart(iris)
    .mark_bar()
    .encode(
        x="count()",
        y=alt.Y("petalWidth:Q").bin(maxbins=30),
        color="species:N",
        tooltip=alt.value(None),
    )
    .properties(height=300, width=100)
    .add_params(interval)
)

chart = chart1 | chart2
st.altair_chart(chart, on_select=callback, key="hconcat_chart")
st.dataframe(st.session_state.hconcat_chart)
