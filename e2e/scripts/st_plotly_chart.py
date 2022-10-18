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

from datetime import datetime

import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly import figure_factory

import streamlit as st

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

# Add histogram data
x1: "np.typing.NDArray[np.float_]" = np.random.randn(200) - 2
x2: "np.typing.NDArray[np.float_]" = np.random.randn(200)
x3: "np.typing.NDArray[np.float_]" = np.random.randn(200) + 2

# Group data together
hist_data = [x1, x2, x3]
group_labels = ["Group 1", "Group 2", "Group 3"]
bin_size = [0.1, 0.25, 0.5]

# Create distribution plot with custom bin_size
chart = figure_factory.create_distplot(hist_data, group_labels, bin_size)

# Plot!
st.plotly_chart(chart)

df_2d_hist = px.data.tips()
fig_2d_hist = px.density_heatmap(df_2d_hist, x="total_bill", y="tip")
st.plotly_chart(fig_2d_hist, theme="streamlit")

long_df_bar = px.data.medals_long()
fig_bar = px.bar(
    long_df_bar, x="nation", y="count", color="medal", title="Long-Form Input"
)
st.plotly_chart(fig_bar, theme="streamlit")

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
st.plotly_chart(fig_bubble, theme="streamlit")

open_data_candlestick = [33.0, 33.3, 33.5, 33.0, 34.1]
high_data_candlestick = [33.1, 33.3, 33.6, 33.2, 34.8]
low_data_candlestick = [32.7, 32.7, 32.8, 32.6, 32.8]
close_data_candlestick = [33.0, 32.9, 33.3, 33.1, 33.1]
dates_candlestick = [
    datetime(year=2013, month=10, day=10),
    datetime(year=2013, month=11, day=10),
    datetime(year=2013, month=12, day=10),
    datetime(year=2014, month=1, day=10),
    datetime(year=2014, month=2, day=10),
]
fig_candlestick = go.Figure(
    data=[
        go.Candlestick(
            x=dates_candlestick,
            open=open_data_candlestick,
            high=high_data_candlestick,
            low=low_data_candlestick,
            close=close_data_candlestick,
        )
    ]
)
st.plotly_chart(fig_candlestick, theme="streamlit")

df_dot = px.data.medals_long()
fig_dot = px.scatter(df_dot, y="nation", x="count", color="medal", symbol="medal")
fig_dot.update_traces(marker_size=10)
st.plotly_chart(fig_dot, theme="streamlit")

df_filled_area = px.data.gapminder()
fig_filled_area = px.area(
    df_filled_area, x="year", y="pop", color="continent", line_group="country"
)
st.plotly_chart(fig_filled_area, theme="streamlit")

# This dataframe has 244 lines, but 4 distinct values for `day`
df_pie = px.data.tips()
fig_pie = px.pie(df_pie, values="tip", names="day")
st.plotly_chart(fig_pie, theme="streamlit")

data_sunburst = dict(
    character=["Eve", "Cain", "Seth", "Enos", "Noam", "Abel", "Awan", "Enoch", "Azura"],
    parent=["", "Eve", "Eve", "Seth", "Seth", "Eve", "Eve", "Awan", "Eve"],
    value=[10, 14, 12, 10, 2, 6, 6, 4, 4],
)
fig_sunburst = px.sunburst(
    data_sunburst,
    names="character",
    parents="parent",
    values="value",
)
st.plotly_chart(fig_sunburst, theme="streamlit")
