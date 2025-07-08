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
    direction="horizontal",
    border=True,
    horizontal_alignment="left",
    key="container-horizontal-align-left",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    direction="horizontal",
    border=True,
    horizontal_alignment="center",
    key="container-horizontal-align-center",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    direction="horizontal",
    border=True,
    horizontal_alignment="right",
    key="container-horizontal-align-right",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    direction="horizontal",
    border=True,
    horizontal_alignment="distribute",
    key="container-horizontal-align-distribute",
    wrap=False,
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    direction="horizontal",
    border=True,
    vertical_alignment="top",
    wrap=False,
    key="container-horizontal-vertical-align-top",
):
    st.container(border=True, height=70)
    st.container(border=True, height=125)
    st.container(border=True, height=25)

with st.container(
    direction="horizontal",
    border=True,
    vertical_alignment="center",
    wrap=False,
    key="container-horizontal-vertical-align-center",
):
    st.container(border=True, height=70)
    st.container(border=True, height=125)
    st.container(border=True, height=25)

with st.container(
    direction="horizontal",
    border=True,
    vertical_alignment="bottom",
    wrap=False,
    key="container-horizontal-vertical-align-bottom",
):
    st.container(border=True, height=70)
    st.container(border=True, height=125)
    st.container(border=True, height=25)

with st.container(
    direction="vertical",
    border=True,
    vertical_alignment="top",
    wrap=False,
    height=300,
    key="container-vertical-vertical-align-top",
):
    st.html('<div style="background:lightblue;">One</div>')
    st.html('<div style="background:lightblue;">Two</div>')
    st.html('<div style="background:lightblue;">Three</div>')

with st.container(
    direction="vertical",
    border=True,
    vertical_alignment="center",
    wrap=False,
    height=300,
    key="container-vertical-vertical-align-center",
):
    st.html('<div style="background:lightblue;">One</div>')
    st.html('<div style="background:lightblue;">Two</div>')
    st.html('<div style="background:lightblue;">Three</div>')

with st.container(
    direction="vertical",
    border=True,
    vertical_alignment="bottom",
    wrap=False,
    height=300,
    key="container-vertical-vertical-align-bottom",
):
    st.html('<div style="background:lightblue;">One</div>')
    st.html('<div style="background:lightblue;">Two</div>')
    st.html('<div style="background:lightblue;">Three</div>')

with st.container(
    direction="vertical",
    border=True,
    vertical_alignment="distribute",
    wrap=False,
    height=300,
    key="container-vertical-vertical-align-distribute",
):
    st.html('<div style="background:lightblue;">One</div>')
    st.html('<div style="background:lightblue;">Two</div>')
    st.html('<div style="background:lightblue;">Three</div>')

with st.container(
    direction="vertical",
    border=True,
    horizontal_alignment="left",
    wrap=False,
    key="container-vertical-horizontal-align-left",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    direction="vertical",
    border=True,
    horizontal_alignment="center",
    wrap=False,
    key="container-vertical-horizontal-align-center",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")

with st.container(
    direction="vertical",
    border=True,
    horizontal_alignment="right",
    wrap=False,
    key="container-vertical-horizontal-align-right",
):
    st.html('<div style="background:lightblue;">One</div>', width="content")
    st.html('<div style="background:lightblue;">Two</div>', width="content")
    st.html('<div style="background:lightblue;">Three</div>', width="content")
