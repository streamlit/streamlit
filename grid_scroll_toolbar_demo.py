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

"""Side-by-side look at toolbar clearance on a horizontally scrolling grid.

Hover a chart in the first row of each section. The colored box above each
grid makes the extra top space easy to compare.
"""

import pandas as pd

import streamlit as st
from streamlit.delta_generator import DeltaGenerator

st.set_page_config(page_title="Grid toolbar clearance", layout="centered")

CHART = pd.DataFrame(
    {
        "revenue": [12, 18, 15, 22, 19, 28, 24],
        "cost": [8, 11, 9, 14, 13, 16, 15],
    }
)
TABLE = pd.DataFrame(
    {
        "region": ["North", "South", "East", "West"],
        "orders": [120, 98, 143, 87],
    }
)

st.title("Grid toolbar clearance")
st.markdown(
    "Each grid is 640px wide. Hover the first chart. "
    "The lilac box is the element directly above the grid."
)


def marker(text: str) -> None:
    st.markdown(
        (
            "<div style='background:#efe8ff;border:1px solid #c4b5fd;"
            "border-radius:8px;padding:8px 12px;margin:0'>"
            f"{text}</div>"
        ),
        unsafe_allow_html=True,
    )


def charts(grid: DeltaGenerator) -> None:
    grid.line_chart(CHART, height=200)
    grid.bar_chart(CHART, height=200)
    grid.area_chart(CHART, height=200)
    grid.dataframe(TABLE, height=200)


st.header("Scrolling sideways, content height")
st.caption(
    "Four columns at 220px. This is the case that reserves toolbar space "
    "above the first row."
)
marker("Directly above the scrolling grid")
charts(st.grid(4, min_column_width=220, wrap=False, width=640, key="scroll"))

st.header("Same charts, wrapping")
st.caption("Same width, but the grid wraps, so it does not reserve that space.")
marker("Directly above the wrapping grid")
charts(st.grid(4, min_column_width=220, wrap=True, width=640, key="wrap"))

st.header("wrap=False, columns fit")
st.caption(
    "Two columns fit inside 640px, so this grid does not scroll or reserve space."
)
marker("Directly above a grid that fits")
fit = st.grid(2, min_column_width=200, wrap=False, width=640, key="fit")
fit.line_chart(CHART, height=200)
fit.bar_chart(CHART, height=200)

st.header("Fixed height, scrolling sideways")
st.caption(
    "The clearance is inside the 260px box. A vertical scrollbar appears "
    "only if the rows plus that room no longer fit."
)
marker("Directly above the fixed-height grid")
charts(
    st.grid(
        4,
        min_column_width=220,
        wrap=False,
        width=640,
        height=260,
        key="fixed",
    )
)
