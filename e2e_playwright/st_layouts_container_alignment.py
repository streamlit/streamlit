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

from __future__ import annotations

import numpy as np
import numpy.typing as npt
import pandas as pd

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
    horizontal_alignment="center", key="container-horizontal-centered-elements"
):
    img: npt.NDArray[np.int64] = np.repeat(0, 10000).reshape(100, 100)
    st.image(img)
    st.dataframe(
        pd.DataFrame(
            {
                "x": list(range(3)),
                "y": [i * i for i in range(3)],
            }
        ),
        width=250,
    )
    st.button("Details")
