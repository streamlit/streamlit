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

"""Elements whose loading work the render timing tracker waits for.

The elements are laid out in a grid that fits the default test viewport, so
every element counts as visible.
"""

from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import pydeck as pdk

import streamlit as st
import streamlit.components.v1 as components

HEIGHT = 150
VIDEO_PATH = Path(__file__).parent / "static" / "flower.webm"

chart_data = pd.DataFrame({"a": [1, 3, 2, 4]})

st.markdown("Render timing metrics")

image_col, vega_col, dataframe_col, plotly_col = st.columns(4)
image_col.image(np.full((60, 120, 3), 128, dtype=np.uint8), caption="Gray image")
vega_col.line_chart(chart_data, height=HEIGHT)
dataframe_col.dataframe(pd.DataFrame({"x": range(3)}), height=HEIGHT)
plotly_col.plotly_chart(px.line(chart_data, y="a", height=HEIGHT))

graphviz_col, deck_col, echarts_col, iframe_col = st.columns(4)
graphviz_col.graphviz_chart("digraph { a -> b }", height=HEIGHT)
deck_col.pydeck_chart(
    pdk.Deck(
        map_style=None,
        initial_view_state=pdk.ViewState(latitude=37.76, longitude=-122.4, zoom=11),
        layers=[
            pdk.Layer(
                "ScatterplotLayer",
                data=pd.DataFrame({"lat": [37.76], "lon": [-122.4]}),
                get_position="[lon, lat]",
                get_radius=200,
            )
        ],
    ),
    height=HEIGHT,
)
echarts_col.echarts_chart(
    {
        "animation": False,
        "xAxis": {"type": "category", "data": ["A", "B", "C", "D"]},
        "yAxis": {"type": "value"},
        "series": [{"type": "bar", "data": [1, 3, 2, 4]}],
    },
    height=HEIGHT,
)
with iframe_col:
    components.html("<p>Embedded HTML</p>", height=HEIGHT)

video_col, button_col, _, _ = st.columns(4)
video_col.video(VIDEO_PATH)
button_col.button("Rerun")
