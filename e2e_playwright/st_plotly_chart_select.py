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
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

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
fig_bubble.update_layout(dragmode="select")
st.header("Bubble Chart with Box Select")
st.plotly_chart(fig_bubble, on_select="rerun", key="bubble_chart")
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
# Update the configuration to enable lasso selection
fig_linechart.update_layout(dragmode="lasso")
st.plotly_chart(fig_linechart, on_select="rerun", key="line_chart")
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

st.header("Bar Chart with Click")
data_canada = px.data.gapminder().query("country == 'Canada'")
fig_bar = px.bar(data_canada, x="year", y="pop")
st.plotly_chart(
    fig_bar,
    on_select="rerun",
    key="bar_chart",
)
if len(st.session_state.bar_chart.select["points"]) > 0:
    st.write("The original df data selected:")
    points = st.session_state.bar_chart.select["points"]
    # Extract x and y values directly into lists
    x_values = [point["x"] for point in points]
    y_values = [point["y"] for point in points]

    # Use these lists to filter the DataFrame
    filtered_df = data_canada[
        data_canada["year"].isin(x_values) & data_canada["pop"].isin(y_values)
    ]
    st.dataframe(filtered_df)
else:
    st.write("Nothing is selected")


st.header("Box Selections for a Stacked Bar Chart")
wide_df = px.data.medals_wide()
fig = px.bar(
    wide_df, x="nation", y=["gold", "silver", "bronze"], title="Wide-Form Input"
)
fig.update_layout(dragmode="select")
st.plotly_chart(
    fig,
    on_select="rerun",
    key="StackedBar_chart",
)
if len(st.session_state.StackedBar_chart.select["points"]) > 0:
    st.write("Countries and their medal data that were selected:")
    points = st.session_state.StackedBar_chart.select["points"]
    # Extract x and y values directly into lists
    x_values = [point["x"] for point in points]

    # Use these lists to filter the DataFrame
    filtered_df = wide_df[wide_df["nation"].isin(x_values)]
    st.dataframe(filtered_df)
else:
    st.write("Nothing is selected")

# TODO(willhuang1997): Readd choropleth charts
# st.header("Selections on Choropleth Chart with a callback")


# @st.cache_data
# def load_json(url):
#     with urlopen(url) as response:
#         counties = json.load(response)
#         return counties


# @st.cache_data
# def load_data(url):
#     df = pd.read_csv(url, dtype={"fips": str})
#     return df


# df = load_data(
#     "https://raw.githubusercontent.com/plotly/datasets/master/fips-unemp-16.csv"
# )
# counties = load_json(
#     "https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json"
# )
# fig = px.choropleth_mapbox(
#     df,
#     geojson=counties,
#     locations="fips",
#     color="unemp",
#     color_continuous_scale="Viridis",
#     range_color=(0, 12),
#     mapbox_style="carto-positron",
#     zoom=3,
#     center={"lat": 37.0902, "lon": -95.7129},
#     opacity=0.5,
#     labels={"unemp": "unemployment rate"},
# )
# fig.update_layout(margin={"r": 0, "t": 0, "l": 0, "b": 0})
# return_value = st.plotly_chart(
#     fig,
#     on_select="rerun",
#     key="Choropleth_chart",
# )
# st.write("Data selected:")
# if return_value:
#     st.dataframe(return_value.select["points"])

st.header("Lasso selections on Histograms with a callback")
df = px.data.tips()
fig = px.histogram(df, x="total_bill")


def histogram_callback():
    try:
        lasso_select = st.session_state.histogram_chart.select["lasso"]
        st.write("Tips for selected:")
        min_x = lasso_select[0]["x"][0]
        max_x = lasso_select[0]["x"][1]
        filtered_df = df[(df["total_bill"] > min_x) & (df["total_bill"] < max_x)]
        filtered_values = filtered_df["tip"].values
        st.dataframe(filtered_values)
    except:
        st.write("You have selected nothing.")


fig.update_layout(dragmode="lasso")
st.plotly_chart(
    fig,
    on_select=histogram_callback,
    key="histogram_chart",
)
