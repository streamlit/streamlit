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

import plotly.graph_objects as go

import streamlit as st

identical_figure = go.Figure(go.Scatter(x=[1, 2, 3], y=[1, 4, 9]))
st.plotly_chart(identical_figure)
st.plotly_chart(identical_figure)

if "plotly_update" not in st.session_state:
    st.session_state.plotly_update = 0

if st.button("Update chart"):
    st.session_state.plotly_update += 1

offset = st.session_state.plotly_update
updated_figure = go.Figure(
    go.Scatter(x=[1, 2, 3], y=[offset + 1, offset + 2, offset + 3])
)
updated_figure.update_layout(uirevision="constant")
st.plotly_chart(updated_figure)

# A keyed passive chart should restore its frontend state (here, legend
# visibility) when it is unmounted and remounted. Moving the chart between two
# containers forces a genuine remount while keeping the element present so its
# frontend state is recovered.
restore_figure = go.Figure()
restore_figure.add_scatter(x=[1, 2, 3], y=[1, 2, 3], name="Trace A")
restore_figure.add_scatter(x=[1, 2, 3], y=[3, 2, 1], name="Trace B")

first_slot = st.container(key="chart_slot_a")
second_slot = st.container(key="chart_slot_b")
chart_slot = first_slot if st.checkbox("Move keyed chart") else second_slot
with chart_slot:
    st.plotly_chart(restore_figure, key="restore_chart")
