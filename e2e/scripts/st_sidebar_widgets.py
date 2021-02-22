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

np.random.seed(0)  # ensure random numbers are always the same

area_chart_data = np.random.randn(20, 3)
bar_chart_data = np.random.randn(50, 3)
map_data = np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4]
altair_chart_data = np.random.randn(200, 3)
pydeck_chart_data = np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4]
vega_chart_data = np.random.randn(200, 3)

plotly_chart_data = []
plotly_chart_data.append(np.random.randn(200) - 2)
plotly_chart_data.append(np.random.randn(200))
plotly_chart_data.append(np.random.randn(200) + 2)


def show_bokeh_chart():
    p = figure(title="simple line example", x_axis_label="x", y_axis_label="y")
    p.line([1, 2, 3, 4, 5], [6, 7, 2, 4, 5], legend="Trend", line_width=2)
    st.bokeh_chart(p, use_container_width=True)


def show_graphviz_chart():
    hello = graphviz.Digraph("Hello World")
    hello.edge("Hello", "World")
    st.graphviz_chart(hello, use_container_width=True)


def show_pydeck_chart():
    df = pd.DataFrame(pydeck_chart_data, columns=["lat", "lon"])
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
        ),
        use_container_width=True,
    )


all_widgets = {
    "area_chart": lambda: st.area_chart(
        pd.DataFrame(area_chart_data, columns=["a", "b", "c"]),
        use_container_width=True,
    ),
    "bar_chart": lambda: st.bar_chart(
        pd.DataFrame(bar_chart_data, columns=["a", "b", "c"]),
        use_container_width=True,
    ),
    "button": lambda: st.button("button"),
    "checkbox": lambda: st.checkbox("checkbox"),
    "code": lambda: st.code('import streamlit\n\nst.write("lol")'),
    "color_picker": lambda: st.color_picker("color picker"),
    "dataframe": lambda: st.dataframe({"foo": ["hello", "world", "foo " * 30]}),
    "date_input": lambda: st.date_input("date_input"),
    "file_uploader": lambda: st.file_uploader("Drop a file:", type=["txt"]),
    "header": lambda: st.header("header"),
    "latex": lambda: st.latex(r"\LaTeX"),
    "markdown": lambda: st.markdown("asldkjfh **alkdjf** *asljdkfh*"),
    "multiselect": lambda: st.multiselect(
        "multiselect", ["coffee", "tea", "water"], ["tea", "water"]
    ),
    "number_input": lambda: st.number_input("number_input", 0, 100),
    "progress": lambda: st.progress(50),
    "radio": lambda: st.radio("radio", ["a", "b", "c"]),
    "select_slider": lambda: st.select_slider(
        "select slider", options=["a", "b", "c", "d"]
    ),
    "selectbox": lambda: st.selectbox("selectbox", ["a", "b", "c"], 1),
    "slider": lambda: st.slider("slider", 0, 100),
    "subheader": lambda: st.subheader("subheader"),
    "table": lambda: st.table(pd.DataFrame(np.arange(0, 100, 1).reshape(10, 10))),
    "text_area": lambda: st.text_area("textarea"),
    "text_input": lambda: st.text_input("text input"),
    "time_input": lambda: st.time_input("time input"),
    "title": lambda: st.title("title"),
    "write": lambda: st.write("asdf"),
    "image": lambda: st.image(
        np.zeros((100, 100, 4), dtype=np.uint8),
        caption="Transparent Black Square",
        width=100,
    ),
    "map": lambda: st.map(pd.DataFrame(map_data, columns=["lat", "lon"])),
    "plotly_chart": lambda: st.plotly_chart(
        figure_factory.create_distplot(
            plotly_chart_data,
            ["Group 1", "Group 2", "Group 3"],
            [0.1, 0.25, 0.5],
        ),
        use_container_width=True,
    ),
    "altair_chart": lambda: st.altair_chart(
        alt.Chart(pd.DataFrame(altair_chart_data, columns=["a", "b", "c"]))
        .mark_circle()
        .encode(x="a", y="b", size="c", color="c"),
        use_container_width=True,
    ),
    "vega_lite_chart": lambda: st.vega_lite_chart(
        pd.DataFrame(vega_chart_data, columns=["a", "b", "c"]),
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
    "bokeh_chart": show_bokeh_chart,
    "graphviz_chart": show_graphviz_chart,
    "pydeck_chart": show_pydeck_chart,
}

with st.sidebar:
    text = st.text_input("enter widget", "")
    widget = all_widgets.get(text)
    if widget:
        with st.beta_container():
            widget()
