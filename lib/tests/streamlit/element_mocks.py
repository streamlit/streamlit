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
import pandas as pd
import plotly.express as px

import streamlit as st
from streamlit.type_util import is_altair_version_less_than

ELEMENT_PRODUCER = Callable[[], Any]

WIDGET_ELEMENTS: list[tuple[str, ELEMENT_PRODUCER]] = [
    ("button", lambda: st.button("Click me")),
    ("camera_input", lambda: st.camera_input("Take a picture")),
    ("chat_input", lambda: st.chat_input("Chat with me")),
    # checkboxes
    ("checkbox", lambda: st.checkbox("Check me")),
    ("toggle", lambda: st.toggle("Toggle me")),
    # end checkboxes
    ("color_picker", lambda: st.color_picker("Pick a color")),
    ("data_editor", lambda: st.data_editor(pd.DataFrame())),
    ("file_uploader", lambda: st.file_uploader("Upload me")),
    ("multiselect", lambda: st.multiselect("Show me", ["a", "b", "c"])),
    ("number_input", lambda: st.number_input("Enter a number")),
    ("radio", lambda: st.radio("Choose me", ["a", "b", "c"])),
    ("slider", lambda: st.slider("Slide me")),
    ("selectbox", lambda: st.selectbox("Select me", ["a", "b", "c"])),
    # text_widgets
    ("text_area", lambda: st.text_area("Write me")),
    ("text_input", lambda: st.text_input("Write me")),
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
]

NON_WIDGET_ELEMENTS: list[tuple[str, ELEMENT_PRODUCER]] = [
    # alerts
    ("error", lambda: st.error("Hello")),
    ("info", lambda: st.info("Hello")),
    ("success", lambda: st.success("Hello")),
    ("warning", lambda: st.warning("Hello")),
    # arrows
    ("dataframe", lambda: st.dataframe(None)),
    # balloons
    ("balloons", lambda: st.balloons()),
    ("snow", lambda: st.snow()),
    # docstrings
    ("help", lambda: st.help("Hello")),
    # headings
    ("header", lambda: st.header("Header")),
    ("title", lambda: st.title("Title")),
    ("subheader", lambda: st.subheader("Subheader")),
    # html, markdown
    ("code", lambda: st.code("Hello")),
    ("html", lambda: st.html("Hello")),
    ("latex", lambda: st.latex("Hello")),
    ("markdown", lambda: st.markdown("Hello")),
    ("write", lambda: st.write("Hello")),
    ("toast", lambda: st.toast("Hello")),
    # progress
    ("spinner", lambda: st.spinner("Hello")),
    ("progress", lambda: st.progress(0.5)),
    # media
    ("audio", lambda: st.audio(b"")),
    ("video", lambda: st.video(b"")),
    # hybrid-widgets
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
        lambda: st.plotly_chart(px.line(pd.DataFrame()), on_select="ignore"),
    ),
]
