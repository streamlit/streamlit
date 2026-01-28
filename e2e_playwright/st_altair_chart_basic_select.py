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


import time
from typing import cast

import altair as alt
import pandas as pd
from vega_datasets import data

import streamlit as st

# SCATTER CHART
st.header("Altair Chart with point and interval selection")


# taken from vega_datasets cars example
@st.cache_data  # use caching to avoid a potential issue with flakiness
def get_cars_data() -> pd.DataFrame:
    return cast("pd.DataFrame", data.cars())


cars = get_cars_data()
interval = alt.selection_interval()

point = alt.selection_point()

st.subheader("Scatter chart with selection_point")

if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

base = (
    alt.Chart(cars)
    .mark_point()
    .encode(
        x="Horsepower:Q",
        y="Miles_per_Gallon:Q",
        color=alt.condition(point, "Origin:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
)
chart_point = base.add_params(point)
st.altair_chart(
    chart_point,
    on_select="rerun",
    key="scatter_point",
)
if (
    "scatter_point" in st.session_state
    and len(st.session_state.scatter_point.selection) > 0
):
    st.write("Scatter chart with selection_point:", str(st.session_state.scatter_point))

st.subheader("Scatter chart with selection_interval")
base = (
    alt.Chart(cars)
    .mark_point()
    .encode(
        x="Horsepower:Q",
        y="Miles_per_Gallon:Q",
        color=alt.condition(interval, "Origin:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
)
chart_interval = base.add_params(interval)
# Set width="stretch" for all charts so that the width is not dependent on Vega-lib updates.
st.altair_chart(chart_interval, on_select="rerun", key="scatter_interval")
if (
    "scatter_interval" in st.session_state
    and len(st.session_state.scatter_interval.selection) > 0
):
    st.write(
        "Scatter chart with selection_interval:", str(st.session_state.scatter_interval)
    )

st.subheader("Scatter chart with selection_interval & tooltip")
base = (
    alt.Chart(cars)
    .mark_point()
    .encode(
        x="Horsepower:Q",
        y="Miles_per_Gallon:Q",
        color=alt.condition(interval, "Origin:N", alt.value("lightgray")),
        tooltip=["Horsepower", "Miles_per_Gallon"],
    )
)
chart_interval = base.add_params(interval)
# Set width="stretch" for all charts so that the width is not dependent on Vega-lib updates.
st.altair_chart(
    chart_interval,
    on_select="rerun",
    key="scatter_interval_tooltip",
    width="stretch",
)
if (
    "scatter_interval_tooltip" in st.session_state
    and len(st.session_state.scatter_interval_tooltip.selection) > 0
):
    st.write(
        "Scatter chart with selection_interval & tooltip:",
        str(st.session_state.scatter_interval_tooltip),
    )


# BAR CHART
st.subheader("Bar chart with selection_point")
source = pd.DataFrame(
    {
        "a": ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        "b": [28, 55, 43, 91, 81, 53, 19, 87, 52],
    }
)

bar_graph_point = (
    alt.Chart(source)
    .mark_bar()
    .encode(
        x="a",
        y="b",
        fillOpacity=alt.condition(point, alt.value(1), alt.value(0.3)),
        tooltip=alt.value(None),
    )
    .add_params(point)
)
st.altair_chart(bar_graph_point, on_select="rerun", key="bar_point")
if "bar_point" in st.session_state and len(st.session_state.bar_point.selection) > 0:
    st.write("Bar chart with selection_point:", str(st.session_state.bar_point))


bar_graph_interval = (
    alt.Chart(source)
    .mark_bar()
    .encode(
        x="a",
        y="b",
        fillOpacity=alt.condition(interval, alt.value(1), alt.value(0.3)),
        tooltip=alt.value(None),
    )
    .add_params(interval)
)

st.subheader("Bar chart with selection_interval")
st.altair_chart(
    bar_graph_interval, on_select="rerun", key="bar_interval", width="stretch"
)
if (
    "bar_interval" in st.session_state
    and len(st.session_state.bar_interval.selection) > 0
):
    st.write("Bar chart with selection_interval:", str(st.session_state.bar_interval))

# STACKED AREA CHART
source = data.iowa_electricity()

base = (
    alt.Chart(source)
    .mark_area()
    .encode(
        x="year:T",
        y="net_generation:Q",
        color=alt.condition(point, "source:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
)
area_chart_point = base.add_params(point)
st.subheader("Area chart with selection_point")
selection = st.altair_chart(area_chart_point, on_select="rerun", key="area_point")
if len(selection["selection"]) > 0:
    st.write("Area chart with selection_point:", str(selection["selection"]))


base = (
    alt.Chart(source)
    .mark_area()
    .encode(
        x="year:T",
        y="net_generation:Q",
        color=alt.condition(interval, "source:N", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
)
area_chart_interval = base.add_params(interval)
st.subheader("Area chart with selection_interval")
area_interval_selection = st.altair_chart(
    area_chart_interval, on_select="rerun", key="area_interval"
)
if len(area_interval_selection["selection"]) > 0:
    st.write(
        "Area chart with selection_interval:",
        str(area_interval_selection.selection),  # type: ignore
    )

# HISTOGRAM CHART
source = data.movies()

base = (
    alt.Chart(source)
    .mark_bar()
    .encode(
        alt.X("IMDB_Rating:Q", bin=True),
        y="count()",
        color=alt.condition(point, "IMDB_Rating:Q", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
)
histogram_point = base.add_params(point)
st.subheader("Histogram chart with selection_point")
st.altair_chart(
    histogram_point, on_select="rerun", key="histogram_point", width="stretch"
)
if (
    "histogram_point" in st.session_state
    and len(st.session_state.histogram_point.selection) > 0
):
    st.write(
        "Histogram chart with selection_point:", str(st.session_state.histogram_point)
    )

base = (
    alt.Chart(source)
    .mark_bar()
    .encode(
        alt.X("IMDB_Rating:Q", bin=True),
        y="count()",
        color=alt.condition(interval, "IMDB_Rating:Q", alt.value("lightgray")),
        tooltip=alt.value(None),
    )
)
histogram_interval = base.add_params(interval)
st.subheader("Histogram chart with selection_interval")
st.altair_chart(
    histogram_interval,
    on_select="rerun",
    key="histogram_interval",
    width="stretch",
)
if (
    "histogram_interval" in st.session_state
    and len(st.session_state.histogram_interval.selection) > 0
):
    st.write(
        "Histogram chart with selection_interval:",
        str(st.session_state.histogram_interval),
    )

# SELECTIONS IN FORM
st.header("Selections in form:")

with st.form(key="my_form", clear_on_submit=True):
    selection = st.altair_chart(
        histogram_point, on_select="rerun", key="histogram_point_in_form"
    )
    st.form_submit_button("Submit")

st.write("Histogram-in-form selection:", str(selection))
if "histogram_point_in_form" in st.session_state:
    st.write(
        "Histogram-in-form selection in session state:",
        str(st.session_state.histogram_point_in_form),
    )

# SELECTIONS IN CALLBACK
st.header("Selection callback:")


def on_selection():
    st.write(
        "Histogram selection callback:",
        str(st.session_state.histogram_point_in_callback),
    )


selection = st.altair_chart(
    histogram_point,
    on_select=on_selection,
    key="histogram_point_in_callback",
    width="stretch",
)


# SELECTIONS IN FRAGMENT
st.header("Selections in fragment:")


@st.fragment
def test_fragment():
    selection = st.altair_chart(
        histogram_point,
        on_select=on_selection,
        key="histogram_point_in_fragment",
    )
    st.write("Histogram-in-fragment selection:", str(selection))


test_fragment()

if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)

# SELECTION PERSISTENCE WITH DATA CHANGES (key_as_main_identity feature)
st.header("Selection persistence with data changes:")

# Initialize update counter in session state
if "chart_data_update_count" not in st.session_state:
    st.session_state.chart_data_update_count = 0


def increment_chart_data():
    st.session_state.chart_data_update_count += 1


# Create dynamic data based on update count
# Use a fixed base but add the update count to values so data clearly changes
persistent_df = pd.DataFrame(
    {
        "category": ["A", "B", "C", "D", "E"],
        "value": [
            10 + st.session_state.chart_data_update_count * 5,
            25 + st.session_state.chart_data_update_count * 5,
            15 + st.session_state.chart_data_update_count * 5,
            30 + st.session_state.chart_data_update_count * 5,
            20 + st.session_state.chart_data_update_count * 5,
        ],
    }
)

point_persistent = alt.selection_point(name="persistent_selection")
persistent_chart = (
    alt.Chart(persistent_df)
    .mark_bar()
    .encode(
        x=alt.X("category:N"),
        y=alt.Y("value:Q"),
        fillOpacity=alt.condition(point_persistent, alt.value(1), alt.value(0.3)),
        tooltip=alt.value(None),
    )
    .add_params(point_persistent)
)

# Don't use container width so the chart has a predictable size for clicking
selection = st.altair_chart(
    persistent_chart,
    on_select="rerun",
    key="persistent_selection_chart",
    width="content",
)
st.write("Persistent selection:", str(selection))
st.write("Chart data update count:", st.session_state.chart_data_update_count)

st.button(
    "Update chart data",
    key="update_chart_data_btn",
    on_click=increment_chart_data,
)
