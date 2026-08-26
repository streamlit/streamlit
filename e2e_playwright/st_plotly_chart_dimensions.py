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

"""E2E test app for st.plotly_chart width and height parameters."""

import plotly.graph_objects as go

import streamlit as st

# Width parameter tests
st.write("## Width Parameter Tests")

# Create a simple chart for width testing
simple_fig = go.Figure()
simple_fig.add_trace(
    go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17], name="Simple Chart")
)
simple_fig.update_layout(height=200, width=500, title="Chart with width='content':")

st.plotly_chart(simple_fig, width="content", theme="streamlit")

simple_fig.update_layout(title="Chart with width='stretch':")
st.plotly_chart(simple_fig, width="stretch", theme="streamlit")

simple_fig.update_layout(title="Chart with width=400:")
st.plotly_chart(simple_fig, width=400, theme="streamlit")

large_fig = go.Figure()
large_fig.add_trace(
    go.Scatter(x=[1, 2, 3, 4, 5, 6], y=[10, 15, 13, 17, 20, 18], name="Large Chart")
)
large_fig.update_layout(
    height=400, width=1000, title="Chart with figure width=1000 and width='content':"
)
st.plotly_chart(large_fig, width="content", theme="streamlit")

# Height parameter tests
st.write("## Height Parameter Tests")

# Create a simple chart for height testing
height_fig = go.Figure()
height_fig.add_trace(
    go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17], name="Height Test Chart")
)

height_fig.update_layout(title="Chart with height='content':")
st.plotly_chart(height_fig, height="content", theme="streamlit")

st.write("Chart with height='stretch' (in 600px container):")
with st.container(border=True, key="test_height_stretch", height=600):
    height_fig.update_layout(title="Chart with height='stretch':")
    st.plotly_chart(height_fig, height="stretch", theme="streamlit")

height_fig.update_layout(title="Chart with height=300:")
st.plotly_chart(height_fig, height=300, theme="streamlit")

# Chart with explicit figure height to test content height resolution
tall_fig = go.Figure()
tall_fig.add_trace(
    go.Scatter(x=[1, 2, 3, 4, 5], y=[10, 15, 13, 17, 20], name="Tall Chart")
)
tall_fig.update_layout(
    height=600, width=500, title="Chart with figure height=600 and height='content':"
)
st.plotly_chart(tall_fig, height="content", theme="streamlit")
