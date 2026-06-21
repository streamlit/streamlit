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
with st.grid():
    st.metric("Temperature", "70 F", "1.2 F")
    st.metric("Wind", "9 mph", "-8%")
    st.metric("Humidity", "86%", "4%")
    st.metric("Pressure", "30.1 inHg", "-0.5")

# Grid with fixed columns and border
st.subheader("Fixed Columns with Border")
grid = st.grid(columns=3, border=True, cell_height="equal")
for i in range(6):
    with grid.container():
        st.markdown(f"**Cell {i + 1}**")
        st.write("Some content here")

# Grid with span
st.subheader("Grid with Spanning Cells")
grid2 = st.grid(columns=4, min_column_width=150, border=True)

with grid2.span(columns=2):
    st.markdown("**Spans 2 columns**")
    st.write("This cell takes up two columns")

with grid2.container():
    st.markdown("**Cell 2**")

with grid2.container():
    st.markdown("**Cell 3**")

with grid2.container():
    st.markdown("**Cell 4**")

with grid2.container():
    st.markdown("**Cell 5**")

# Grid with different gap settings
st.subheader("Grid with Custom Gap")
with st.grid(columns=3, gap=("large", "small")):
    for i in range(6):
        st.button(f"Button {i + 1}", key=f"btn_{i}")

# Grid with vertical alignment
st.subheader("Grid with Vertical Alignment")
grid3 = st.grid(columns=3, vertical_alignment="center", cell_height=100, border=True)
with grid3.container():
    st.write("Short")
with grid3.container():
    st.write("Medium\n\nWith more content")
with grid3.container():
    st.write("Tall\n\nWith\n\nEven more\n\ncontent")
