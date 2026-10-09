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

from __future__ import annotations

import numpy as np
import numpy.typing as npt
import pandas as pd
import plotly.express as px

import streamlit as st

with st.container(
    horizontal=True,
    border=True,
    horizontal_alignment="left",
    key="container-horizontal-align-left",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    horizontal=True,
    border=True,
    horizontal_alignment="center",
    key="container-horizontal-align-center",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    horizontal=True,
    border=True,
    horizontal_alignment="right",
    key="container-horizontal-align-right",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    horizontal=True,
    border=True,
    horizontal_alignment="distribute",
    key="container-horizontal-align-distribute",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    horizontal=True,
    border=True,
    vertical_alignment="top",
    key="container-horizontal-vertical-align-top",
):
    st.container(border=True, height=70)
    st.container(border=True, height=125)
    st.container(border=True, height=25)

with st.container(
    horizontal=True,
    border=True,
    vertical_alignment="center",
    key="container-horizontal-vertical-align-center",
):
    st.container(border=True, height=70)
    st.container(border=True, height=125)
    st.container(border=True, height=25)

with st.container(
    horizontal=True,
    border=True,
    vertical_alignment="bottom",
    key="container-horizontal-vertical-align-bottom",
):
    st.container(border=True, height=70)
    st.container(border=True, height=125)
    st.container(border=True, height=25)

with st.container(
    horizontal=False,
    border=True,
    vertical_alignment="top",
    height=300,
    key="container-vertical-vertical-align-top",
):
    st.html('<div style="background:lightblue;">One</div>')
    st.html('<div style="background:lightblue;">Two</div>')
    st.html('<div style="background:lightblue;">Three</div>')

with st.container(
    horizontal=False,
    border=True,
    vertical_alignment="center",
    height=300,
    key="container-vertical-vertical-align-center",
):
    st.html('<div style="background:lightblue;">One</div>')
    st.html('<div style="background:lightblue;">Two</div>')
    st.html('<div style="background:lightblue;">Three</div>')

with st.container(
    horizontal=False,
    border=True,
    vertical_alignment="bottom",
    height=300,
    key="container-vertical-vertical-align-bottom",
):
    st.html('<div style="background:lightblue;">One</div>')
    st.html('<div style="background:lightblue;">Two</div>')
    st.html('<div style="background:lightblue;">Three</div>')

with st.container(
    horizontal=False,
    border=True,
    vertical_alignment="distribute",
    height=300,
    key="container-vertical-vertical-align-distribute",
):
    st.html('<div style="background:lightblue;">One</div>')
    st.html('<div style="background:lightblue;">Two</div>')
    st.html('<div style="background:lightblue;">Three</div>')

with st.container(
    horizontal=False,
    border=True,
    horizontal_alignment="left",
    key="container-vertical-horizontal-align-left",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    horizontal=False,
    border=True,
    horizontal_alignment="center",
    key="container-vertical-horizontal-align-center",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    horizontal=False,
    border=True,
    horizontal_alignment="right",
    key="container-vertical-horizontal-align-right",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    horizontal_alignment="center",
    key="container-horizontal-centered-elements",
    border=True,
):
    df = pd.DataFrame(
        {
            "x": list(range(3)),
            "y": [i * i for i in range(3)],
        }
    )
    img: npt.NDArray[np.int64] = np.repeat(0, 2500).reshape(50, 50)
    st.image(img)
    st.dataframe(
        df,
        width="content",
    )
    st.bar_chart(df, x="x", y="y", width="content")

with st.container(horizontal=True, key="container-horizontal-stretch-height"):
    with st.container(border=True, key="stretch-height-tallest"):
        for line in range(6):
            st.write(f"Line {line}")
    with st.container(border=True, height="stretch", key="stretch-height-card"):
        st.write("Stretch card")
    st.metric("Stretch metric", "42", border=True, height="stretch")
    with st.container(border=True, key="stretch-height-content-card"):
        st.write("Content card")

# The tallest card must be taller than the default chart height, which a
# stretch chart uses as its minimum in a content-height row.
with st.container(horizontal=True, key="container-horizontal-stretch-height-data"):
    with st.container(border=True, key="stretch-height-data-tallest"):
        for line in range(10):
            st.write(f"Line {line}")
    st.line_chart(df, x="x", y="y", height="stretch")
    st.dataframe(df, height="stretch")

with st.container(horizontal=True, key="container-horizontal-stretch-height-input"):
    with st.container(border=True, key="stretch-height-input-tallest"):
        for line in range(6):
            st.write(f"Line {line}")
    st.text_area("Stretch text area", height="stretch", width=200)

with st.container(
    horizontal=True,
    vertical_alignment="bottom",
    key="container-horizontal-bottom-checkboxes",
):
    st.text_input("Bottom-aligned input")
    st.checkbox("Bottom-aligned checkbox")
    st.toggle("Bottom-aligned toggle")

with st.container(horizontal=True, key="container-horizontal-top-checkboxes"):
    st.text_input("Top-aligned input")
    st.checkbox("Top-aligned checkbox")

# Without a taller sibling, a stretch chart uses its default height.
with st.container(horizontal=True, key="container-horizontal-stretch-chart-fallback"):
    st.line_chart(df, x="x", y="y", height="stretch")
    st.button("Chart neighbor")

with st.container(horizontal=True, key="container-horizontal-content-width-chart"):
    st.line_chart(df, x="x", y="y", width="content", height="stretch")
    st.button("Content-width chart neighbor")

with st.container(
    horizontal=True, key="container-horizontal-content-width-pixel-height-chart"
):
    st.line_chart(df, x="x", y="y", width="content", height=200)
    st.button("Pixel-height chart neighbor")

with st.container(horizontal=True, key="container-horizontal-stretch-plotly-fallback"):
    st.plotly_chart(px.line(df, x="x", y="y"), height="stretch")
    st.button("Plotly neighbor")

# In a container with a definite height, stretch charts shrink to fit their
# siblings instead of claiming their default height.
with st.container(height=300, border=True, key="fixed-card-title-and-chart"):
    st.subheader("Revenue")
    st.line_chart(df, x="x", y="y", height="stretch")

with st.container(horizontal=True, height=250, key="fixed-row-stretch-kpi-cards"):
    for index in range(2):
        with st.container(
            border=True, height="stretch", key=f"stretch-kpi-card-{index}"
        ):
            st.metric(f"KPI {index}", index)
            st.line_chart(df, x="x", y="y", height="stretch")

with st.container(key="fixed-tabs-title-and-chart"):
    with st.tabs(["Revenue tab"], height=300)[0]:
        st.subheader("Revenue")
        st.line_chart(df, x="x", y="y", height="stretch")

tall_card = st.toggle("Tall card", value=True)
with st.container(horizontal=True, key="container-horizontal-stretch-chart-shrink"):
    with st.container(border=True, key="stretch-chart-shrink-card"):
        for line in range(12 if tall_card else 2):
            st.write(f"Line {line}")
    st.line_chart(df, x="x", y="y", height="stretch")

# Stretch containers and forms grow to fit content taller than their
# fixed-height parent, while stretch tabs scroll inside their panel.
with st.container(height=250, key="fixed-parent-stretch-form"):
    with st.form("stretch_form", height="stretch"):
        for index in range(5):
            st.text_input(f"Form input {index}")
        st.form_submit_button("Submit")

with st.container(horizontal=True, height=250, key="fixed-row-stretch-card"):
    with st.container(border=True, height="stretch", key="stretch-card-overflow"):
        for line in range(12):
            st.write(f"Line {line}")
    st.write("Side")

with st.container(height=250, key="fixed-parent-stretch-tabs"):
    stretch_tabs = st.tabs(["Tab A", "Tab B"], height="stretch")
    with stretch_tabs[0]:
        for line in range(12):
            st.write(f"Tab line {line}")

with st.container(horizontal=True, key="container-horizontal-stretch-graphviz"):
    st.graphviz_chart(
        "digraph { run -> intr; intr -> runbl; runbl -> run }", height="stretch"
    )
    st.button("Graph neighbor")

with st.container(
    horizontal=True,
    vertical_alignment="distribute",
    key="container-horizontal-distribute-text-area",
):
    st.text_area("Distribute text area")
    with st.container(border=True):
        for line in range(8):
            st.write(f"Line {line}")
