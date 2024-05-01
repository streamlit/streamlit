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


import numpy as np
import plotly.express as px

import streamlit as st

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

df_bubble = px.data.gapminder()
fig_bubble = px.scatter(
    df_bubble.query("year==2007"),
    x="gdpPercap",
    y="lifeExp",
    size="pop",
    color="continent",
    hover_name="country",
    log_x=True,
    size_max=60,
)
st.header("Bubble Chart with Box Select")
st.plotly_chart(fig_bubble, on_select="rerun", key="bubble_chart", selection_mode="box")
if len(st.session_state.bubble_chart.select["points"]) > 0:
    st.write("The original df data selected:")
    points = st.session_state.bubble_chart.select["points"]
    # Extract x and y values directly into lists
    x_values = [point["x"] for point in points]
    y_values = [point["y"] for point in points]

    # Use these lists to filter the DataFrame
    filtered_df = df_bubble[
        df_bubble["gdpPercap"].isin(x_values) & df_bubble["lifeExp"].isin(y_values)
    ]
    st.dataframe(filtered_df)
else:
    st.write("Nothing is selected")

st.header("Line Chart with Lasso select")
df = px.data.gapminder().query("continent=='Oceania'")
fig_linechart = px.line(df, x="year", y="lifeExp", color="country", markers=True)
st.plotly_chart(
    fig_linechart, on_select="rerun", key="line_chart", selection_mode=["lasso"]
)
if len(st.session_state.line_chart.select["points"]) > 0:
    st.write("The original df data selected:")
    points = st.session_state.line_chart.select["points"]
    # Extract x and y values directly into lists
    x_values = [point["x"] for point in points]
    y_values = [point["y"] for point in points]

    # Use these lists to filter the DataFrame
    filtered_df = df[df["year"].isin(x_values) & df["lifeExp"].isin(y_values)]
    st.dataframe(filtered_df)
else:
    st.write("Nothing is selected")

st.header("Bar Chart with Points Selection")
data_canada = px.data.gapminder().query("country == 'Canada'")
fig_bar = px.bar(data_canada, x="year", y="pop")
event_data = st.plotly_chart(
    fig_bar, on_select="rerun", key="bar_chart", selection_mode=["points"]
)
if len(event_data.select["points"]) > 0:
    st.write("The original df data selected:")
    points = st.session_state.bar_chart.select["points"]
    # Extract x and y values directly into lists
    x_values = [point["x"] for point in points]
    y_values = [point["y"] for point in points]

    # Use these lists to filter the DataFrame
    filtered_df = data_canada[
        data_canada["year"].isin(x_values) & data_canada["pop"].isin(y_values)
    ]
    st.write(f"Selected points: {len(filtered_df)}")
else:
    st.write("Nothing is selected")


st.header("Box Selections for a Stacked Bar Chart")
wide_df = px.data.medals_wide()
fig = px.bar(
    wide_df, x="nation", y=["gold", "silver", "bronze"], title="Wide-Form Input"
)
event_data = st.plotly_chart(
    fig, on_select="rerun", key="StackedBar_chart", selection_mode=["box", "lasso"]
)
if len(event_data.select["points"]) > 0:
    st.write("Countries and their medal data that were selected:")
    points = st.session_state.StackedBar_chart.select["points"]
    # Extract x and y values directly into lists
    x_values = [point["x"] for point in points]

    # Use these lists to filter the DataFrame
    filtered_df = wide_df[wide_df["nation"].isin(x_values)]
    st.dataframe(filtered_df)
else:
    st.write("Nothing is selected")

st.header("Lasso selections on Histograms with a callback")
df = px.data.tips()
fig = px.histogram(df, x="total_bill")


def histogram_callback():
    if len(st.session_state.histogram_chart.select["points"]) > 0:
        st.write("Callback triggered")
        points = list(
            point for point in st.session_state.histogram_chart.select["points"]
        )
        st.dataframe(points)


st.plotly_chart(
    fig, on_select=histogram_callback, key="histogram_chart", selection_mode="lasso"
)

import time

if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

df = px.data.iris()  # iris is a pandas DataFrame
fig = px.scatter(df, x="sepal_width", y="sepal_length")
event_data = st.plotly_chart(
    fig, on_select="rerun", key="bubble_chart_2", selection_mode=("box", "lasso")
)

if len(event_data.select["points"]) > 0:
    st.dataframe(event_data.select["points"])

st.header("Bubble Chart with Points & Box Select")
event_data = st.plotly_chart(
    fig_bubble, on_select="rerun", selection_mode=("points", "box")
)
if len(event_data.select.points) > 0:
    points = event_data.select.points
    # Extract x and y values directly into lists
    x_values = [point["x"] for point in points]
    y_values = [point["y"] for point in points]

    # Use these lists to filter the DataFrame
    filtered_df = df_bubble[
        df_bubble["gdpPercap"].isin(x_values) & df_bubble["lifeExp"].isin(y_values)
    ]
    st.write(f"Selected points: {len(filtered_df)}")
else:
    st.write("Nothing is selected")
