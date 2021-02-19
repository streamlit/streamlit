# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import streamlit as st

from bokeh.plotting import figure
from plotly import figure_factory
import altair as alt
import graphviz
import numpy as np
import pandas as pd
import pydeck as pdk
import requests


def show_bokeh_chart():
    p = figure(title="simple line example", x_axis_label="x", y_axis_label="y")
    p.line([1, 2, 3, 4, 5], [6, 7, 2, 4, 5], legend="Trend", line_width=2)
    st.bokeh_chart(p)


def show_graphviz_chart():
    hello = graphviz.Digraph("Hello World")
    hello.edge("Hello", "World")
    st.graphviz_chart(hello)


def show_pydeck_chart():
    df = pd.DataFrame(
        np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4], columns=["lat", "lon"]
    )
    st.pydeck_chart(
        pdk.Deck(
            map_style="mapbox://styles/mapbox/light-v9",
            initial_view_state=pdk.ViewState(
                latitude=37.76,
                longitude=-122.4,
                zoom=11,
                pitch=50,
            ),
            layers=[
                pdk.Layer(
                    "HexagonLayer",
                    data=df,
                    get_position="[lon, lat]",
                    radius=200,
                    elevation_scale=4,
                    elevation_range=[0, 1000],
                    pickable=True,
                    extruded=True,
                ),
                pdk.Layer(
                    "ScatterplotLayer",
                    data=df,
                    get_position="[lon, lat]",
                    get_color="[200, 30, 0, 160]",
                    get_radius=200,
                ),
            ],
        )
    )


all_renderers = [
    lambda: st.area_chart(
        pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
    ),
    lambda: st.bar_chart(pd.DataFrame(np.random.randn(50, 3), columns=["a", "b", "c"])),
    lambda: st.button("button"),
    lambda: st.checkbox("checkbox"),
    lambda: st.code('import streamlit\n\nst.write("lol")'),
    lambda: st.color_picker("color picker"),
    lambda: st.dataframe({"foo": ["hello", "world", "foo " * 30]}),
    lambda: st.date_input("date_input"),
    lambda: st.file_uploader("Drop a file:", type=["txt"]),
    lambda: st.header("header"),
    lambda: st.latex(r"\LaTeX"),
    lambda: st.markdown("asldkjfh **alkdjf** *asljdkfh*"),
    lambda: st.multiselect("multiselect", ["coffee", "tea", "water"], ["tea", "water"]),
    lambda: st.number_input("number_input", 0, 100),
    lambda: st.progress(50),
    lambda: st.radio("radio", ["a", "b", "c"]),
    lambda: st.select_slider("select slider", options=["a", "b", "c", "d"]),
    lambda: st.selectbox("selectbox", ["a", "b", "c"], 1),
    lambda: st.slider("slider", 0, 100),
    lambda: st.subheader("subheader"),
    lambda: st.table(pd.DataFrame(np.arange(0, 100, 1).reshape(10, 10))),
    lambda: st.text_area("textarea"),
    lambda: st.text_input("text input"),
    lambda: st.time_input("time input"),
    lambda: st.title("title"),
    lambda: st.video(
        requests.get("https://www.w3schools.com/html/mov_bbb.mp4").content
    ),
    lambda: st.write("asdf"),
    lambda: st.image(
        np.zeros((100, 100, 4), dtype=np.uint8),
        caption="Transparent Black Square",
        width=100,
    ),
    lambda: st.map(
        pd.DataFrame(
            np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
            columns=["lat", "lon"],
        )
    ),
    lambda: st.plotly_chart(
        figure_factory.create_distplot(
            [np.random.randn(200) - 2, np.random.randn(200), np.random.randn(200) + 2],
            ["Group 1", "Group 2", "Group 3"],
            [0.1, 0.25, 0.5],
        )
    ),
    lambda: st.altair_chart(
        alt.Chart(pd.DataFrame(np.random.randn(200, 3), columns=["a", "b", "c"]))
        .mark_circle()
        .encode(x="a", y="b", size="c", color="c")
    ),
    lambda: st.vega_lite_chart(
        pd.DataFrame(np.random.randn(200, 3), columns=["a", "b", "c"]),
        {
            "mark": "circle",
            "encoding": {
                "x": {"field": "a", "type": "quantitative"},
                "y": {"field": "b", "type": "quantitative"},
                "size": {"field": "c", "type": "quantitative"},
                "color": {"field": "c", "type": "quantitative"},
            },
        },
        use_container_width=True,
    ),
    show_bokeh_chart,
    show_graphviz_chart,
    show_pydeck_chart,
]

with st.sidebar:
    options = list(map(str, range(len(all_renderers))))
    widget_idx = st.selectbox("select widget", options=options)
    widget_idx = int(widget_idx)
    renderer = all_renderers[widget_idx]
    with st.beta_container():
        renderer()
