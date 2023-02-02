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

# tests no streamlit theme plot
st.plotly_chart(fig_bubble, theme=None)

# Bubble Chart
# Tests Discrete coloring with streamlit theme
# uses container width when use_container_width flag is True
fig_bubble.update_layout(height=300, width=300)
st.plotly_chart(fig_bubble, use_container_width=True, theme="streamlit")

# Candlestick Chart
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

# Tests sunburst charts and color parameter using streamlit colors
df = px.data.tips()
fig_sunburst = px.sunburst(
    df, path=["sex", "day", "time"], values="total_bill", color="day"
)
st.plotly_chart(fig_sunburst, theme="streamlit")

# Contour Plot and Heatmap
fig = make_subplots(
    rows=2, cols=2, subplot_titles=("connectgaps = False", "connectgaps = True")
)
z = [
    [None, None, None, 12, 13, 14, 15, 16],
    [None, 1, None, 11, None, None, None, 17],
    [None, 2, 6, 7, None, None, None, 18],
    [None, 3, None, 8, None, None, None, 19],
    [5, 4, 10, 9, None, None, None, 20],
    [None, None, None, 27, None, None, None, 21],
    [None, None, None, 26, 25, 24, 23, 22],
]

fig.add_trace(go.Contour(z=z, showscale=False), 1, 1)
fig.add_trace(go.Contour(z=z, showscale=False, connectgaps=True), 1, 2)
fig.add_trace(go.Heatmap(z=z, showscale=False, zsmooth="best"), 2, 1)
fig.add_trace(go.Heatmap(z=z, showscale=False, connectgaps=True, zsmooth="best"), 2, 2)

fig["layout"]["yaxis1"].update(title="Contour map")
fig["layout"]["yaxis3"].update(title="Heatmap")

st.plotly_chart(fig, theme="streamlit")

# Waterfall Chart
fig_waterfall = go.Figure(
    go.Waterfall(
        name="20",
        orientation="v",
        measure=["relative", "relative", "total", "relative", "relative", "total"],
        x=[
            "Sales",
            "Consulting",
            "Net revenue",
            "Purchases",
            "Other expenses",
            "Profit before tax",
        ],
        textposition="outside",
        text=["+60", "+80", "", "-40", "-20", "Total"],
        y=[60, 80, 0, -40, -20, 0],
        connector={"line": {"color": "rgb(63, 63, 63)"}},
    )
)

fig_waterfall.update_layout(
    title="Profit and loss statement 2018", height=300, width=300, showlegend=True
)
# uses figure height and width when use_container_width is False
st.plotly_chart(fig_waterfall, use_container_width=False, theme="streamlit")

# Ternary Chart
df = px.data.election()
fig_ternary = px.scatter_ternary(df, a="Joly", b="Coderre", c="Bergeron")

st.plotly_chart(fig_ternary, theme="streamlit")

# Table Plot
fig_table = go.Figure(
    data=[
        go.Table(
            header=dict(values=["A Scores", "B Scores"]),
            cells=dict(values=[[100, 90, 80, 90], [95, 85, 75, 95]]),
        )
    ]
)
st.plotly_chart(fig_table, theme="streamlit")

# Continuous Customization Chart with plotly.go graph
fig_contour = go.Figure(
    data=go.Contour(
        z=[
            [10, 10.625, 12.5, 15.625, 20],
            [5.625, 6.25, 8.125, 11.25, 15.625],
            [2.5, 3.125, 5.0, 8.125, 12.5],
            [0.625, 1.25, 3.125, 6.25, 10.625],
            [0, 0.625, 2.5, 5.625, 10],
        ],
        colorscale="Electric",
    )
)
st.plotly_chart(fig_contour, theme="streamlit")

# Discrete Customization Chart
df = px.data.wind()
fig = px.scatter_polar(
    df,
    r="frequency",
    theta="direction",
    color="strength",
    symbol="strength",
    size="frequency",
    color_discrete_sequence=px.colors.sequential.Plasma_r,
)
st.plotly_chart(fig, theme="streamlit")

# Layout Customization Chart
fig = go.Figure(
    go.Sunburst(
        labels=[
            "Eve",
            "Cain",
            "Seth",
            "Enos",
            "Noam",
            "Abel",
            "Awan",
            "Enoch",
            "Azura",
        ],
        parents=["", "Eve", "Eve", "Seth", "Seth", "Eve", "Eve", "Awan", "Eve"],
        values=[65, 14, 12, 10, 2, 6, 6, 4, 4],
        branchvalues="total",
    )
)
fig.update_layout(margin=dict(t=10, l=100, r=100, b=110))
st.plotly_chart(fig, theme="streamlit")

# Separate template Customization Chart
df = px.data.gapminder().query("country == 'Canada'")
fig = px.bar(
    df,
    x="year",
    y="pop",
    hover_data=["lifeExp", "gdpPercap"],
    color="lifeExp",
    template="plotly",
    labels={"pop": "population of Canada"},
    height=400,
)

st.plotly_chart(fig, theme="streamlit")

# Histogram chart
df = px.data.tips()

fig = px.density_heatmap(df, x="total_bill", y="tip")
st.plotly_chart(fig, theme="streamlit")

df = pd.read_csv(
    "https://raw.githubusercontent.com/plotly/datasets/master/finance-charts-apple.csv"
)

fig = px.line(
    df, x="Date", y="AAPL.High", title="Time Series with Range Slider and Selectors"
)

fig.update_xaxes(
    rangeslider_visible=True,
    rangeselector=dict(
        buttons=list(
            [
                dict(count=1, label="1m", step="month", stepmode="backward"),
                dict(count=6, label="6m", step="month", stepmode="backward"),
                dict(count=1, label="YTD", step="year", stepmode="todate"),
                dict(count=1, label="1y", step="year", stepmode="backward"),
                dict(step="all"),
            ]
        )
    ),
)
fig.update_layout(height=300, width=600)
fig.update_layout(title_font_size=30)
st.plotly_chart(fig, theme="streamlit")

data = pd.DataFrame((100, 120, 104, 102, 203, 102), columns=["some_col"])

fig = px.line(data, height=100, width=300)
fig.update_xaxes(visible=False, fixedrange=True)
fig.update_yaxes(visible=False, fixedrange=True)
fig.update_layout(annotations=[], overwrite=True)
fig.update_layout(showlegend=False, margin=dict(t=10, l=10, b=10, r=10))

# uses figure height and width when use_container_width is False
st.plotly_chart(
    fig, config=dict(displayModeBar=False), use_container_width=False, theme=None
)

# uses container width when use_container_width flag is True
st.plotly_chart(fig, use_container_width=True, theme=None)
