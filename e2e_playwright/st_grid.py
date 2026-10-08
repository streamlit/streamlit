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

import streamlit as st

# Basic grid with auto columns
st.subheader("Auto-sizing Grid")
with st.grid(key="auto_sizing"):
    st.metric("Temperature", "70 F", "1.2 F")
    st.metric("Wind", "9 mph", "-8%")
    st.metric("Humidity", "86%", "4%")
    st.metric("Pressure", "30.1 inHg", "-0.5")

# Grid with fixed columns and border
st.subheader("Fixed Columns with Border")
grid = st.grid(columns=3, border=True, key="bordered")
for i in range(6):
    with grid.cell():
        st.markdown(f"**Cell {i + 1}**")
        st.write("Some content here")

# Grid with spanning cells
st.subheader("Grid with Spanning Cells")
grid2 = st.grid(columns=4, min_column_width=150, border=True, key="spanning")

with grid2.cell(column_span="all"):
    st.markdown("**Spans all columns**")

with grid2.cell(column_span=2):
    st.markdown("**Spans 2 columns**")
    st.write("This cell takes up two columns")

with grid2.cell():
    st.markdown("**Cell 2**")

with grid2.cell():
    st.markdown("**Cell 3**")

with grid2.cell():
    st.markdown("**Cell 4**")

with grid2.cell():
    st.markdown("**Cell 5**")

# Grid with different gap settings
st.subheader("Grid with Custom Gap")
with st.grid(columns=3, gap=("large", "small"), key="custom_gap"):
    for i in range(6):
        st.button(f"Button {i + 1}", key=f"btn_{i}")

# Grid with vertical alignment
st.subheader("Grid with Vertical Alignment")
grid3 = st.grid(
    columns=3,
    vertical_alignment="center",
    row_height=100,
    border=True,
    key="vertical_align",
)
with grid3.cell():
    st.write("Short")
with grid3.cell():
    st.write("Medium\n\nWith more content")
with grid3.cell():
    st.write("Tall\n\nWith\n\nEven more\n\ncontent")

# wrap=False keeps the declared column count and scrolls horizontally
st.subheader("No wrap")
with st.grid(3, wrap=False, key="no_wrap"):
    for i in range(3):
        st.button(f"No wrap {i + 1}", key=f"no_wrap_btn_{i}")

# Pixel rows give grid.cell() a definite height, so stretch charts fill it.
st.subheader("Stretch inside a fixed-height cell")
stretch_grid = st.grid(2, row_height=240, border=True, key="stretch_cell")
with stretch_grid.cell():
    st.subheader("Revenue")
    st.line_chart({"a": [1, 3, 2], "b": [2, 1, 4]}, height="stretch")
stretch_grid.cell().bar_chart({"a": [1, 3, 2]}, height="stretch")
