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

import pandas as pd
import plotly.graph_objects as go

import streamlit as st

with st.sidebar:
    st.text("Sidebar filter")

left, right = st.columns(2)
with left:
    with st.container(key="plain"):
        st.markdown("Plain column")
with right:
    with st.container(border=True, key="bordered"):
        st.markdown("Bordered column")

feedback = pd.DataFrame(
    {
        "Feedback Message": ["Please add support for custom components"],
        "Date": ["2026-10-20"],
        "Salesforce Account Name": ["Umbrella"],
        "Deployment": ["gcp_us_central1"],
        "Snowflake Account Name": ["ACME_017"],
        "Username": ["user_388"],
        "Agreement Type": ["Capacity"],
    }
)
with st.container(border=True, key="feedback"):
    st.dataframe(feedback, hide_index=True, width="stretch")

with st.container(key="metric_row"):
    for index, column in enumerate(st.columns(4, border=True)):
        column.metric(f"Metric {index}", f"{index * 1000:,}", f"{index}%")

with st.container(border=True, key="chart_card"):
    st.markdown("Chart card")
    st.line_chart(pd.DataFrame({"value": [3, 1, 2]}), height=160)

with st.container(horizontal_alignment="center", key="centered"):
    st.markdown("Centered line")

with st.container(horizontal_alignment="center", key="centered_chart"):
    st.bar_chart(pd.DataFrame({"value": [2, 1, 3]}), height=160)
    st.dataframe(feedback, hide_index=True)

st.markdown("After the centered chart")

with st.container(height=120, vertical_alignment="center", key="vertically_centered"):
    st.markdown("Vertically centered")

with (
    st.container(height=200, key="stretch_parent"),
    st.container(height="stretch", vertical_alignment="center", key="stretch_centered"),
):
    st.markdown("Stretch centered")

with st.expander("Chart expander", expanded=True):
    st.bar_chart(pd.DataFrame({"value": [3, 2, 1]}), height=160)

st.markdown("After the expander chart")

with st.container(key="chart_row"):
    chart_column, second_column = st.columns(2)
    with chart_column:
        st.bar_chart(pd.DataFrame({"value": [1, 3, 2]}), height=160)
    with second_column:
        st.markdown("Second chart column")

st.markdown("After the chart row")

with st.container(key="metric_extras"):
    content_column, chart_column = st.columns(2, border=True)
    content_column.metric("Content width", "1,234,567,890", "12%", width="content")
    chart_column.metric(
        "Sparkline", "42", "3%", chart_data=[1, 5, 2, 6, 3, 7, 4], chart_type="area"
    )

with st.container(key="plotly_row"):
    plotly_column, text_column = st.columns(2)
    plotly_column.plotly_chart(
        go.Figure(go.Bar(x=["a", "b", "c"], y=[1, 3, 2])), height=200
    )
    text_column.markdown("Beside the Plotly chart")

st.markdown("After the Plotly row")

with st.container(border=True, key="trailing_empty"):
    st.markdown("Text above a trailing placeholder")
    st.empty()
