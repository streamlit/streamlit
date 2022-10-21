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

# Histogram Plot
df_2d_hist = px.data.tips()
fig_2d_hist = px.density_heatmap(df_2d_hist, x="total_bill", y="tip")
st.plotly_chart(fig_2d_hist, theme="streamlit")

# Bar Cart
long_df_bar = px.data.medals_long()
fig_bar = px.bar(
    long_df_bar, x="nation", y="count", color="medal", title="Long-Form Input"
)
st.plotly_chart(fig_bar, theme="streamlit")

# Bubble Cart
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

# Dot Plot
df_dot = px.data.medals_long()
fig_dot = px.scatter(df_dot, y="nation", x="count", color="medal", symbol="medal")
fig_dot.update_traces(marker_size=10)
st.plotly_chart(fig_dot, theme="streamlit")

# Filled Area Chart
df_filled_area = px.data.gapminder()
fig_filled_area = px.area(
    df_filled_area, x="year", y="pop", color="continent", line_group="country"
)
st.plotly_chart(fig_filled_area, theme="streamlit")

# Pie Chart
df_pie = px.data.tips()
fig_pie = px.pie(df_pie, values="tip", names="day")
st.plotly_chart(fig_pie, theme="streamlit")

# Sunburst Chart
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

# Contour Plot
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

import numpy as np

# Dist plot
import plotly.figure_factory as ff

# Add histogram data
x1 = np.random.randn(200) - 2
x2 = np.random.randn(200)
x3 = np.random.randn(200) + 2
x4 = np.random.randn(200) + 4

# Group data together
hist_data = [x1, x2, x3, x4]

group_labels = ["Group 1", "Group 2", "Group 3", "Group 4"]

# Create distplot with custom bin_size
fig_dist = ff.create_distplot(hist_data, group_labels, bin_size=0.2)
st.plotly_chart(fig_dist, theme="streamlit")

# Funnel Chart
fig_funnel = go.Figure()

fig_funnel.add_trace(
    go.Funnel(
        name="Montreal",
        y=["Website visit", "Downloads", "Potential customers", "Requested price"],
        x=[120, 60, 30, 20],
        textinfo="value+percent initial",
    )
)

fig_funnel.add_trace(
    go.Funnel(
        name="Toronto",
        orientation="h",
        y=[
            "Website visit",
            "Downloads",
            "Potential customers",
            "Requested price",
            "invoice sent",
        ],
        x=[100, 60, 40, 30, 20],
        textposition="inside",
        textinfo="value+percent previous",
    )
)

fig_funnel.add_trace(
    go.Funnel(
        name="Vancouver",
        orientation="h",
        y=[
            "Website visit",
            "Downloads",
            "Potential customers",
            "Requested price",
            "invoice sent",
            "Finalized",
        ],
        x=[90, 70, 50, 30, 10, 5],
        textposition="outside",
        textinfo="value+percent total",
    )
)

st.plotly_chart(fig_funnel, theme="streamlit")

# Heatmap
fig_heatmap = go.Figure(
    data=go.Heatmap(
        z=[[1, None, 30, 50, 1], [20, 1, 60, 80, 30], [30, 60, 1, -10, 20]],
        x=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        y=["Morning", "Afternoon", "Evening"],
        hoverongaps=False,
    )
)
st.plotly_chart(fig_heatmap, theme="streamlit")

# Icicle Chart
fig_icicle = go.Figure(
    go.Icicle(
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
        root_color="lightgrey",
    )
)

# Treemaps Chart
vendors = ["A", "B", "C", "D", None, "E", "F", "G", "H", None]
sectors = [
    "Tech",
    "Tech",
    "Finance",
    "Finance",
    "Other",
    "Tech",
    "Tech",
    "Finance",
    "Finance",
    "Other",
]
regions = [
    "North",
    "North",
    "North",
    "North",
    "North",
    "South",
    "South",
    "South",
    "South",
    "South",
]
sales = [1, 3, 2, 4, 1, 2, 2, 1, 4, 1]
df = pd.DataFrame(dict(vendors=vendors, sectors=sectors, regions=regions, sales=sales))
df["all"] = "all"  # in order to have a single root node
fig_icicle = px.treemap(
    df, path=["all", "regions", "sectors", "vendors"], values="sales"
)

st.plotly_chart(fig_icicle, theme="streamlit")

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

fig_waterfall.update_layout(title="Profit and loss statement 2018", showlegend=True)
st.plotly_chart(fig_waterfall, theme="streamlit")

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
