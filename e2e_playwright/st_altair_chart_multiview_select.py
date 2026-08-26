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

"""Multi-view Altair charts with selections.

This script tests selection functionality for multi-view charts including:
- Layer charts (overlapping views)
- HConcat charts (horizontally concatenated views)
- VConcat charts (vertically concatenated views)
- Charts with multiple independent selections
"""

from typing import cast

import altair as alt
import pandas as pd
from vega_datasets import data

import streamlit as st


@st.cache_data
def get_cars_data() -> pd.DataFrame:
    return cast("pd.DataFrame", data.cars())


cars = get_cars_data()

st.header("Multi-view charts with selections")

# Layer chart with selection
st.subheader("Layer chart with selection_point")
layer_point = alt.selection_point(
    name="layer_selection", fields=["Origin", "Horsepower", "Miles_per_Gallon"]
)
layer_chart = alt.layer(
    alt.Chart(cars).mark_line().encode(x="Horsepower:Q", y="Miles_per_Gallon:Q"),
    alt.Chart(cars)
    .mark_circle(size=60)
    .encode(
        x="Horsepower:Q",
        y="Miles_per_Gallon:Q",
        color=alt.condition(layer_point, "Origin:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
    .add_params(layer_point),
)
layer_selection = st.altair_chart(
    layer_chart, on_select="rerun", key="layer_chart", width="stretch"
)
# Check if any selection parameter has actual data (non-empty dict/list)
if any(layer_selection["selection"].get(k) for k in layer_selection["selection"]):
    st.write("Layer chart selection:", str(layer_selection["selection"]))

# HConcat chart with shared selection
st.subheader("HConcat chart with shared selection_interval")
hconcat_interval = alt.selection_interval(name="hconcat_selection")
hconcat_chart = alt.hconcat(
    alt.Chart(cars)
    .mark_circle()
    .encode(
        x="Horsepower:Q",
        y="Miles_per_Gallon:Q",
        color=alt.condition(hconcat_interval, "Origin:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
    .add_params(hconcat_interval)
    .properties(width=250, height=200),
    alt.Chart(cars)
    .mark_bar()
    .encode(
        x="Origin:N",
        y="count():Q",
        color=alt.condition(hconcat_interval, "Origin:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
    .properties(width=150, height=200),
)
hconcat_selection = st.altair_chart(
    hconcat_chart, on_select="rerun", key="hconcat_chart"
)
# Check if any selection parameter has actual data (non-empty dict/list)
if any(hconcat_selection["selection"].get(k) for k in hconcat_selection["selection"]):
    st.write("HConcat chart selection:", str(hconcat_selection["selection"]))

# VConcat chart with selection
st.subheader("VConcat chart with selection_point")
vconcat_point = alt.selection_point(name="vconcat_selection", fields=["Origin"])
vconcat_chart = alt.vconcat(
    alt.Chart(cars)
    .mark_circle()
    .encode(
        x="Horsepower:Q",
        y="Miles_per_Gallon:Q",
        color=alt.condition(vconcat_point, "Origin:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
    .add_params(vconcat_point)
    .properties(width=400, height=150),
    alt.Chart(cars)
    .mark_bar()
    .encode(
        x="Origin:N",
        y="count():Q",
        color=alt.condition(vconcat_point, "Origin:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
    .properties(width=400, height=100),
)
vconcat_selection = st.altair_chart(
    vconcat_chart, on_select="rerun", key="vconcat_chart"
)
# Check if any selection parameter has actual data (non-empty dict/list)
if any(vconcat_selection["selection"].get(k) for k in vconcat_selection["selection"]):
    st.write("VConcat chart selection:", str(vconcat_selection["selection"]))

# HConcat chart with MULTIPLE selections (one per view)
st.subheader("HConcat chart with multiple selections")
hconcat_left_sel = alt.selection_point(
    name="left_point", fields=["Origin", "Horsepower", "Miles_per_Gallon"]
)
hconcat_right_sel = alt.selection_interval(name="right_interval")
hconcat_multi_chart = alt.hconcat(
    alt.Chart(cars)
    .mark_circle()
    .encode(
        x="Horsepower:Q",
        y="Miles_per_Gallon:Q",
        color=alt.condition(hconcat_left_sel, "Origin:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
    .add_params(hconcat_left_sel)
    .properties(width=250, height=200),
    alt.Chart(cars)
    .mark_circle()
    .encode(
        x="Acceleration:Q",
        y="Displacement:Q",
        color=alt.condition(hconcat_right_sel, "Origin:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
    .add_params(hconcat_right_sel)
    .properties(width=250, height=200),
)
hconcat_multi_selection = st.altair_chart(
    hconcat_multi_chart, on_select="rerun", key="hconcat_multi_chart"
)
# Check if any selection parameter has actual data (non-empty dict/list)
if any(
    hconcat_multi_selection["selection"].get(k)
    for k in hconcat_multi_selection["selection"]
):
    st.write("HConcat multi selection:", str(hconcat_multi_selection["selection"]))
