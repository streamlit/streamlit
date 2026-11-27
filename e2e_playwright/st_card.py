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

from typing import Any

import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(layout="wide")

df = pd.DataFrame(
    {"month": [f"M{i}" for i in range(1, 7)], "revenue": [4, 6, 5, 8, 7, 9]}
)

LONG_LABEL = "A very long card label that does not fit on one line of a narrow card"
LONG_CAPTION = (
    "A long caption that runs over more than two lines of the card, so "
    "that it ends in an ellipsis and shows its full text in a tooltip "
    "when the pointer rests on it."
)

SURFACES = [
    ("Outlined", True, False),
    ("Filled with outline", True, True),
    ("Filled without outline", False, True),
    ("Frameless", False, False),
]


def surface_card(prefix: str, name: str, border: bool, background: bool) -> None:
    with st.card(
        name,
        border=border,
        background=background,
        key=f"{prefix}_{name.lower().replace(' ', '_')}",
    ):
        st.write("Body text")


def header_cards(prefix: str, slots: list[Any], with_chart: bool) -> None:
    """Draw the header variants, one per slot."""
    with slots[0]:
        with st.card(
            "Revenue",
            icon=":material/payments:",
            caption="Monthly recurring revenue",
            help="Revenue **per month**",
            key=f"{prefix}_full_header",
        ):
            if with_chart:
                st.bar_chart(df, x="month", y="revenue", height=160)
            else:
                st.write("Body")
    with slots[1]:
        with st.card(
            LONG_LABEL, caption=LONG_CAPTION, key=f"{prefix}_truncated_header"
        ):
            st.write("Body")
    with slots[2]:
        with st.card("Label only", key=f"{prefix}_label_only"):
            st.write("Body")


st.header("Surfaces")
for column, (name, border, background) in zip(st.columns(4), SURFACES, strict=True):
    with column:
        surface_card("surface", name, border, background)

st.header("Header")
header_cards("header", list(st.columns(3)), with_chart=True)

st.header("Sizing")
sizing_columns = st.columns(3)
with sizing_columns[0]:
    with st.card("Short", key="equal_short"):
        st.write("One line")
with sizing_columns[1]:
    with st.card("Tall", key="equal_tall"):
        st.write("One line")
        st.write("Two lines")
        st.write("Three lines")
        st.write("Four lines")
with sizing_columns[2]:
    with st.card("Stretch chart", key="equal_chart"):
        st.bar_chart(df, x="month", y="revenue", height="stretch")

with st.card("Fixed height", height=180, key="fixed_height", caption="Body scrolls"):
    for i in range(12):
        st.write(f"Row {i}")

with st.card("Empty body", key="empty_body", height="content"):
    pass

with st.card("Content width", width="content", key="content_width"):
    st.write("Fits the content")

st.header("Grid")
grid = st.grid(2, row_height=320)
with grid.card("Trend", key="grid_trend", caption="Last six months"):
    st.line_chart(df, x="month", y="revenue", height="stretch")
with grid.card("Data", key="grid_data", background=True):
    st.dataframe(
        pd.DataFrame(np.arange(60).reshape(20, 3), columns=["a", "b", "c"]),
        height="stretch",
    )

st.header("Nested")
with st.card("Outer", key="nested_outer"):
    with st.card("Inner", border=False, background=True, key="nested_inner"):
        st.write("Inner body")

with st.sidebar:
    with st.container(key="sidebar_surfaces"):
        for name, border, background in SURFACES:
            surface_card("sidebar", name, border, background)
    header_cards("sidebar", [st.sidebar] * 3, with_chart=False)
