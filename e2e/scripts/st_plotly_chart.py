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
import plotly.figure_factory as ff
import plotly.graph_objects as go

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
chart = ff.create_distplot(hist_data, group_labels, bin_size)

# tests no streamlit theme plot
st.plotly_chart(chart)

# Bar Chart
# tests applyStreamlitThemeTemplateData and applyDiscreteColors
long_df = px.data.medals_long()
fig_bar = px.bar(long_df, x="nation", y="count", color="medal", title="Long-Form Input")
st.plotly_chart(fig_bar, theme="streamlit")

# Bubble Chart
# tests applyDiscreteColors and applyStreamlitThemeData, specifically the bar line code
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

# Candlestick Chart
# tests applyUniqueGraphColorsData
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

# Sunburst Chart
# tests customdata code in applyDiscreteColors
df = px.data.tips()
fig_sunburst = px.sunburst(
    df, path=["sex", "day", "time"], values="total_bill", color="day"
)
st.plotly_chart(fig_sunburst, theme="streamlit")

# Contour Plot
# tests applyColorscale
fig_contour = go.Figure(
    data=go.Contour(
        z=[
            [10, 10.625, 12.5, 15.625, 20],
            [5.625, 6.25, 8.125, 11.25, 15.625],
            [2.5, 3.125, 5.0, 8.125, 12.5],
            [0.625, 1.25, 3.125, 6.25, 10.625],
            [0, 0.625, 2.5, 5.625, 10],
        ]
    )
)
st.plotly_chart(fig_contour, theme="streamlit")

# Dist plot
# tests applyDiscreteColors, specifically the box type code
df = px.data.tips()
fig_dist = px.histogram(
    df, x="total_bill", y="tip", color="sex", marginal="rug", hover_data=df.columns
)
st.plotly_chart(fig_dist, theme="streamlit")


# Waterfall Chart
# tests ApplyUniqueGraphColorsData waterfall code
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

fig_waterfall.update_layout(title="Profit and loss statement 2018", showlegend=True)
st.plotly_chart(fig_waterfall, theme="streamlit")

# Ternary Chart
# tests applyStreamlitThemeTemplateLayout, specifically the ternary code
df = px.data.election()
fig_ternary = px.scatter_ternary(df, a="Joly", b="Coderre", c="Bergeron")

st.plotly_chart(fig_ternary, theme="streamlit")

# Table Plot
# tests ApplyUniqueGraphColorsData, specifically the table code
fig_table = go.Figure(
    data=[
        go.Table(
            header=dict(values=["A Scores", "B Scores"]),
            cells=dict(values=[[100, 90, 80, 90], [95, 85, 75, 95]]),
        )
    ]
)
st.plotly_chart(fig_table, theme="streamlit")
