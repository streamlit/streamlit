# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from __future__ import annotations

from typing import Any, Callable

import altair as alt
import matplotlib.pyplot as plt
import pandas as pd
import plotly.express as px
import pydeck as pdk

import streamlit as st
from streamlit.type_util import is_altair_version_less_than

_CHART_DATA = pd.DataFrame(
    {
        "col1": [1, 2, 3],
        "col2": [3, 2, 1],
    }
)

ELEMENT_PRODUCER = Callable[[], Any]

H3_HEX_DATA = [
    {"hex": "88283082b9fffff", "count": 10},
    {"hex": "88283082d7fffff", "count": 50},
    {"hex": "88283082a9fffff", "count": 100},
]
df = pd.DataFrame(H3_HEX_DATA)

WIDGET_ELEMENTS: list[tuple[str, ELEMENT_PRODUCER]] = [
    # buttons
    ("button", lambda: st.button("Click me")),
    ("download_button", lambda: st.download_button("Download me", b"")),
    (
        "form_submit_button",
        # Form submit button doesn't work in the context of the test
        # since it requires to be wrapped in a form. Therefore,
        # we are just using a text input as a proxy for the form submit button.
        lambda: st.text_input("Write me"),
    ),
    # checkboxes
    ("checkbox", lambda: st.checkbox("Check me")),
    ("pills", lambda: st.pills("Some pills", ["a", "b", "c"])),
    (
        "segmented_control",
        lambda: st.segmented_control("Some segments", ["a", "b", "c"]),
    ),
    ("toggle", lambda: st.toggle("Toggle me")),
    # arrows
    ("data_editor", lambda: st.data_editor(pd.DataFrame())),
    ("dataframe", lambda: st.dataframe(pd.DataFrame(), on_select="rerun")),
    # other widgets
    ("color_picker", lambda: st.color_picker("Pick a color")),
    # media manager
    ("audio_input", lambda: st.audio_input("Record me")),
    ("experimental_audio_input", lambda: st.experimental_audio_input("Record me")),
    ("camera_input", lambda: st.camera_input("Take a picture")),
    ("file_uploader", lambda: st.file_uploader("Upload me")),
    # selectors
    ("feedback", lambda: st.feedback()),
    ("multiselect", lambda: st.multiselect("Show me", ["a", "b", "c"])),
    ("number_input", lambda: st.number_input("Enter a number")),
    ("radio", lambda: st.radio("Choose me", ["a", "b", "c"])),
    ("slider", lambda: st.slider("Slide me")),
    ("selectbox", lambda: st.selectbox("Select me", ["a", "b", "c"])),
    ("select_slider", lambda: st.select_slider("Select me", ["a", "b", "c"])),
    # text_widgets
    ("text_area", lambda: st.text_area("Write me")),
    ("text_input", lambda: st.text_input("Write me")),
    ("chat_input", lambda: st.chat_input("Chat with me")),
    # time_widgets
    ("date_input", lambda: st.date_input("Pick a date")),
    ("time_input", lambda: st.time_input("Pick a time")),
    # hybrid-widgets
    (
        "altair_chart",
        lambda: (
            st.altair_chart(
                alt.Chart(pd.DataFrame({"a": ["A"], "b": [1]}))
                .mark_bar()
                .encode(x="a", y="b")
                .add_params(alt.selection_point()),
                on_select="rerun",
            )
            # altair with 'on_select' only works for versions >= 5.0.0
            if is_altair_version_less_than("5.0.0") is False
            else st.text_input("Write me")  # some other widget that raises an exception
        ),
    ),
    (
        "vega_lite_chart",
        lambda: (
            st.vega_lite_chart(
                {
                    "data": {"values": [{"a": "A", "b": "B"}]},
                    "mark": "rect",
                    "params": [{"name": "select", "select": "point"}],
                    "encoding": {
                        "x": {"field": "a", "type": "ordinal"},
                        "y": {"field": "b", "type": "quantitative"},
                    },
                },
                on_select="rerun",
            )
            # altair with 'on_select' only works for versions >= 5.0.0
            if is_altair_version_less_than("5.0.0") is False
            else st.text_input("Write me")  # some other widget that raises an exception
        ),
    ),
    (
        "plotly_chart",
        lambda: st.plotly_chart(px.line(pd.DataFrame()), on_select="rerun"),
    ),
    (
        "pydeck_chart",
        lambda: st.pydeck_chart(
            pdk.Deck(
                map_style="mapbox://styles/mapbox/outdoors-v12",
                initial_view_state=pdk.ViewState(
                    latitude=37.7749295,
                    longitude=-122.4194155,
                    zoom=11,
                    bearing=0,
                    pitch=30,
                ),
                layers=[
                    pdk.Layer(
                        "H3HexagonLayer",
                        df,
                        id="MyHexLayer",
                        pickable=True,
                        stroked=True,
                        filled=True,
                        get_hexagon="hex",
                        line_width_min_pixels=2,
                        get_fill_color="[120, count > 50 ? 255 : 0, 255]",
                    ),
                ],
            ),
            use_container_width=True,
            key="mocked_pydeck_chart",
            on_select="rerun",
            selection_mode="single-object",
        ),
    ),
]

NON_WIDGET_ELEMENTS: list[tuple[str, ELEMENT_PRODUCER]] = [
    # text elements
    ("header", lambda: st.header("Header")),
    ("title", lambda: st.title("Title")),
    ("subheader", lambda: st.subheader("Subheader")),
    ("caption", lambda: st.caption("Caption")),
    ("divider", lambda: st.divider()),
    ("text", lambda: st.text("Hello")),
    ("code", lambda: st.code("Hello")),
    ("html", lambda: st.html("Hello")),
    ("latex", lambda: st.latex("Hello")),
    ("markdown", lambda: st.markdown("Hello")),
    ("write", lambda: st.write("Hello")),
    ("write_stream", lambda: st.write_stream([])),
    # alerts
    ("error", lambda: st.error("Hello")),
    ("info", lambda: st.info("Hello")),
    ("success", lambda: st.success("Hello")),
    ("warning", lambda: st.warning("Hello")),
    ("exception", lambda: st.exception(Exception("Hello"))),
    # progress
    ("spinner", lambda: st.spinner("Hello")),
    ("toast", lambda: st.toast("Hello")),
    ("progress", lambda: st.progress(0.5)),
    ("balloons", lambda: st.balloons()),
    ("snow", lambda: st.snow()),
    # media
    ("audio", lambda: st.audio(b"")),
    ("video", lambda: st.video(b"")),
    (
        "image",
        lambda: st.image("https://streamlit.io/images/brand/streamlit-mark-color.png"),
    ),
    (
        "logo",
        lambda: st.logo("https://streamlit.io/images/brand/streamlit-mark-color.png"),
    ),
    # data elements
    ("json", lambda: st.json({})),
    ("metric", lambda: st.metric("Metric", 100)),
    ("dataframe", lambda: st.dataframe(pd.DataFrame())),
    ("table", lambda: st.table(pd.DataFrame())),
    # charts:
    ("line_chart", lambda: st.line_chart(_CHART_DATA)),
    ("area_chart", lambda: st.area_chart(_CHART_DATA)),
    ("bar_chart", lambda: st.bar_chart(_CHART_DATA)),
    ("scatter_chart", lambda: st.scatter_chart(_CHART_DATA)),
    (
        "altair_chart",
        lambda: (
            st.altair_chart(alt.Chart().mark_bar(), on_select="ignore")
            # altair with 'on_select' only works for versions >= 5.0.0
            if is_altair_version_less_than("5.0.0") is False
            else st.write("")
        ),
    ),
    (
        "vega_lite_chart",
        lambda: (
            st.vega_lite_chart({"mark": "rect"}, on_select="ignore")
            # altair with 'on_select' only works for versions >= 5.0.0
            if is_altair_version_less_than("5.0.0") is False
            else st.write("")
        ),
    ),
    (
        "plotly_chart",
        lambda: st.plotly_chart(px.line(_CHART_DATA), on_select="ignore"),
    ),
    ("pydeck_chart", lambda: st.pydeck_chart(pdk.Deck())),
    (
        "map",
        lambda: st.map(pd.DataFrame({"lat": [1, 2, 3], "lon": [3, 2, 1]})),
    ),
    (
        "graphviz_chart",
        lambda: st.graphviz_chart("""
    digraph {
        run -> intr
    }
    """),
    ),
    ("pyplot", lambda: st.pyplot(plt.figure())),
    (
        "bokeh_chart",
        lambda: (
            # Ignore bokeh chart since it requires outdated dependencies:
            st.write("")
        ),
    ),
    # utilities
    ("help", lambda: st.help("Hello")),
    ("echo", lambda: st.echo()),
    # other elements
    ("link_button", lambda: st.link_button("Link", "https://streamlit.io")),
    ("page_link", lambda: st.page_link("https://streamlit.io", label="Streamlit")),
]

CONTAINER_ELEMENTS: list[tuple[str, ELEMENT_PRODUCER]] = [
    ("container", lambda: st.container()),
    ("expander", lambda: st.expander("Expand me")),
    ("tabs", lambda: st.tabs(["Tab 1", "Tab 2"])),
    ("chat_message", lambda: st.chat_message("user")),
    ("popover", lambda: st.popover("Popover")),
    ("columns", lambda: st.columns(2)),
    ("status", lambda: st.status("Status")),
    ("form", lambda: st.form("Form")),
    ("empty", lambda: st.empty()),
    ("dialog", lambda: st.dialog("Dialog")),
    ("experimental_dialog", lambda: st.experimental_dialog("Dialog")),
]
