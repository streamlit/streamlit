# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

with st.container(
    horizontal=True,
    border=True,
    key="container-horizontal-basic",
):
    st.html(
        '<div style="background:lightblue">Hello</div>',
        width=300,
    )
    st.html(
        '<div style="background:lightblue">World</div>',
        width=300,
    )

with st.container(horizontal=False, border=True, key="container-vertical-basic"):
    st.html(
        '<div style="background:lightblue">Hello</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">World</div>',
        width="stretch",
    )

# # Horizontal layout with a fixed-width element
with st.container(
    horizontal=True,
    border=True,
    key="container-horizontal-fixed-width-and-stretch-element",
):
    st.html(
        '<div style="background:lightyellow">Fixed width element (400px)</div>',
        width=400,
    )
    st.html(
        '<div style="background:lightblue">Stretch width element</div>',
        width="stretch",
    )

# Horizontal layout with a fixed-height element
with st.container(
    horizontal=True,
    border=True,
    key="container-horizontal-fixed-height-element",
):
    with st.container(height=500, border=True):
        st.write("Fixed 500px height container")
    with st.container(border=True):
        st.write("Default height container")

# Vertical layout with a fixed-width element
with st.container(
    horizontal=False,
    key="container-vertical-fixed-width-and-stretch-element",
    border=True,
):
    st.html(
        '<div style="background:lightyellow">Fixed width element (500px)</div>',
        width=500,
    )
    st.html(
        '<div style="background:lightblue">Stretch width element</div>',
        width="stretch",
    )

# Vertical layout with a fixed-height element
with st.container(
    horizontal=False, border=True, key="container-vertical-fixed-height-element"
):
    with st.container(height=500, border=True):
        st.write("Fixed 500px height container")
    with st.container(border=True):
        st.write("Default height container")
