# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
import pydeck as pdk

import streamlit as st

st.subheader("Charts with container width")

# Generate sample data for charts
chart_data = pd.DataFrame(
    {
        "x": range(10),
        "y1": np.random.randn(10).cumsum(),
        "y2": np.random.randn(10).cumsum(),
        "y3": np.random.randn(10).cumsum(),
    }
)

with st.container(direction="horizontal", border=True):
    st.line_chart(chart_data[["y1"]], use_container_width=True)

with st.container(direction="horizontal", border=True):
    st.line_chart(chart_data[["y1"]], use_container_width=True)
    st.bar_chart(chart_data[["y2"]], use_container_width=True)
    st.area_chart(chart_data[["y3"]], use_container_width=True)

st.subheader("Mixed charts and content")

with st.container(direction="horizontal", border=True):
    st.metric("Revenue", "$1,234", "12%")
    st.line_chart(chart_data[["y1", "y2"]], use_container_width=True)
    st.metric("Users", "5,678", "-3%")

st.subheader("Small data displays")

small_data = pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6], "C": [7, 8, 9]})

with st.container(direction="horizontal", border=True):
    st.dataframe(small_data, use_container_width=True)
    st.bar_chart(small_data["A"], use_container_width=True)
    st.line_chart(small_data["B"], use_container_width=True)

with st.container(direction="horizontal", border=True):
    st.info("Info")
    st.bar_chart(small_data["A"], use_container_width=True)

st.subheader("GraphViz charts in horizontal containers")

# Simple graph
simple_graph = """
digraph {
    A -> B;
    B -> C;
    C -> A;
}
"""

# More complex graph
complex_graph = """
digraph {
    rankdir=LR;
    node [shape=box];

    Start -> Process1;
    Process1 -> Decision;
    Decision -> Process2 [label="Yes"];
    Decision -> End [label="No"];
    Process2 -> End;
}
"""

# Hierarchical graph
hierarchy_graph = """
digraph {
    rankdir=TB;
    node [shape=ellipse];

    CEO -> CTO;
    CEO -> CFO;
    CEO -> CMO;
    CTO -> "Dev Team";
    CTO -> "QA Team";
    CFO -> "Finance Team";
    CMO -> "Marketing Team";
}
"""

with st.container(direction="horizontal", border=True):
    st.graphviz_chart(simple_graph)
    st.graphviz_chart(complex_graph, use_container_width=True)

with st.container(direction="horizontal", border=True):
    st.markdown("**Simple Flow**", width="content")
    st.graphviz_chart(simple_graph, use_container_width=True)
    st.markdown("**Complex Process**", width="content")
    st.graphviz_chart(complex_graph, use_container_width=True)
    st.markdown("**Organization**", width="content")
    st.graphviz_chart(hierarchy_graph, use_container_width=True)

with st.container(direction="horizontal", border=True):
    st.metric("Total Nodes", "12")
    st.graphviz_chart(hierarchy_graph, use_container_width=True)
    st.metric("Connections", "8")


st.subheader("PyDeck charts in horizontal containers")

# More complex pydeck data
pydeck_data = pd.DataFrame(
    {
        "latitude": np.random.uniform(37.7, 37.8, 100),
        "longitude": np.random.uniform(-122.5, -122.4, 100),
        "elevation": np.random.uniform(0, 1000, 100),
    }
)

with st.container(direction="horizontal", border=True):
    st.pydeck_chart(
        pdk.Deck(
            map_style="mapbox://styles/mapbox/light-v9",
            initial_view_state=pdk.ViewState(
                latitude=37.76,
                longitude=-122.4,
                zoom=11,
                pitch=0,
            ),
            layers=[
                pdk.Layer(
                    "ScatterplotLayer",
                    data=pydeck_data,
                    get_position=["longitude", "latitude"],
                    get_color=[200, 30, 0, 160],
                    get_radius=50,
                ),
            ],
        ),
        use_container_width=True,
    )

    st.pydeck_chart(
        pdk.Deck(
            map_style="mapbox://styles/mapbox/dark-v9",
            initial_view_state=pdk.ViewState(
                latitude=37.76,
                longitude=-122.4,
                zoom=11,
                pitch=45,
            ),
            layers=[
                pdk.Layer(
                    "ColumnLayer",
                    data=pydeck_data,
                    get_position=["longitude", "latitude"],
                    get_elevation="elevation",
                    elevation_scale=1,
                    radius=50,
                    get_fill_color=[255, 140, 0, 180],
                ),
            ],
        ),
        use_container_width=True,
    )

st.subheader("Plotly charts in horizontal containers")

# Sample data for plotly charts
plotly_data = pd.DataFrame(
    {
        "x": range(10),
        "y1": np.random.randn(10).cumsum(),
        "y2": np.random.randn(10).cumsum(),
        "y3": np.random.randn(10).cumsum(),
        "category": ["A"] * 5 + ["B"] * 5,
    }
)

# Create different plotly chart types
line_fig = px.line(plotly_data, x="x", y="y1", title="Line Chart")
bar_fig = px.bar(plotly_data, x="x", y="y2", title="Bar Chart")
scatter_fig = px.scatter(
    plotly_data, x="y1", y="y2", color="category", title="Scatter Plot"
)

# 3D scatter plot
scatter_3d_fig = px.scatter_3d(
    plotly_data, x="y1", y="y2", z="y3", color="category", title="3D Scatter"
)

with st.container(direction="horizontal", border=True):
    st.plotly_chart(line_fig, use_container_width=True, key="line_triple_1")
    st.plotly_chart(bar_fig, use_container_width=True, key="bar_triple_1")
    st.plotly_chart(scatter_fig, use_container_width=True, key="scatter_triple_1")

with st.container(direction="horizontal", border=True):
    st.metric("Data Points", "10")
    st.plotly_chart(scatter_fig, use_container_width=True, key="scatter_with_metrics")
    st.metric("Categories", "2")

st.subheader("Plotly charts in horizontal containers")

# Sample data for plotly charts
plotly_data = pd.DataFrame(
    {
        "x": range(10),
        "y1": np.random.randn(10).cumsum(),
        "y2": np.random.randn(10).cumsum(),
        "y3": np.random.randn(10).cumsum(),
        "category": ["A"] * 5 + ["B"] * 5,
    }
)

# Create different plotly chart types
line_fig = px.line(plotly_data, x="x", y="y1", title="Line Chart")
bar_fig = px.bar(plotly_data, x="x", y="y2", title="Bar Chart")
scatter_fig = px.scatter(
    plotly_data, x="y1", y="y2", color="category", title="Scatter Plot"
)

# 3D scatter plot
scatter_3d_fig = px.scatter_3d(
    plotly_data, x="y1", y="y2", z="y3", color="category", title="3D Scatter"
)

with st.container(direction="horizontal", border=True):
    st.plotly_chart(line_fig, use_container_width=True, key="line_triple_1")
    st.plotly_chart(bar_fig, use_container_width=True, key="bar_triple_1")
    st.plotly_chart(scatter_fig, use_container_width=True, key="scatter_triple_1")

with st.container(direction="horizontal", border=True):
    st.metric("Data Points", "10")
    st.plotly_chart(scatter_fig, use_container_width=True, key="scatter_with_metrics")
    st.metric("Categories", "2")
