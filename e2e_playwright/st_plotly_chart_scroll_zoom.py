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

"""E2E app for st.plotly_chart scroll-zoom plot-box stability (#8076)."""

import numpy as np
import plotly.express as px
from plotly.graph_objects import Figure

import streamlit as st

img = np.arange(64 * 64, dtype=np.uint8).reshape(64, 64)
config = {"scrollZoom": True}


def _imshow() -> Figure:
    fig = px.imshow(img, color_continuous_scale="gray")
    fig.update_xaxes(scaleanchor="y", constrain="domain")
    fig.update_yaxes(constrain="domain")
    fig.update_layout(height=300)
    return fig


st.plotly_chart(
    _imshow(), theme="streamlit", config=config, key="imshow_streamlit", height=300
)
st.plotly_chart(_imshow(), theme=None, config=config, key="imshow_none", height=300)

scatter = px.scatter(x=[1, 10, 100, 1000], y=[1, 2, 3, 4])
scatter.update_layout(height=300)
# Keep tick label width stable so plot-box assertions measure automargin
# feedback, not a one-time change from "4" to "2.50" after zoom.
scatter.update_xaxes(tickformat=".2f")
scatter.update_yaxes(tickformat=".2f")
st.plotly_chart(
    scatter, theme="streamlit", config=config, key="scatter_streamlit", height=300
)

if st.button("Rerun without changing figures"):
    st.write("reran")
