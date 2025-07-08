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
    wrap=False,
    border=True,
    direction="horizontal",
    key="container-horizontal-wrap-false-st-write",
):
    st.write("Hello")
    st.write("World")
    st.write("Hello")
    st.write("World")

with st.container(
    wrap=True,
    border=True,
    direction="horizontal",
    key="container-horizontal-wrap-true-st-write",
):
    st.write("Hello")
    st.write("World")
    st.write("Hello")
    st.write("World")

with st.container(
    wrap=True,
    border=True,
    direction="horizontal",
    key="container-horizontal-wrap-true-fit-one-line",
):
    st.html('<div style="background:lightblue">Hello</div>', width=200)
    st.html('<div style="background:lightblue">World</div>', width=200)
    st.html('<div style="background:lightblue">Hello</div>', width=200)

with st.container(
    wrap=True,
    border=True,
    direction="horizontal",
    key="container-horizontal-wrap-true-wraps",
):
    st.html('<div style="background:lightblue">Hello</div>', width=200)
    st.html('<div style="background:lightblue">World</div>', width=300)
    st.html('<div style="background:lightblue">Hello</div>', width=200)

with st.container(
    wrap=True,
    border=True,
    direction="horizontal",
    key="container-horizontal-wrap-true-charts",
):
    st.vega_lite_chart(
        {
            "data": {"values": [{"x": i, "y": i * 2} for i in range(5)]},
            "mark": "line",
            "encoding": {"x": {"field": "x"}, "y": {"field": "y"}},
        }
    )
    st.bar_chart([1, 2, 3, 4, 5])
    st.vega_lite_chart(
        {
            "data": {"values": [{"x": i, "y": i**2} for i in range(5)]},
            "mark": "bar",
            "encoding": {"x": {"field": "x"}, "y": {"field": "y"}},
        }
    )
    st.bar_chart([5, 4, 3, 2, 1])

with st.container(
    wrap=False,
    border=True,
    direction="horizontal",
    key="container-horizontal-wrap-false-charts",
):
    st.vega_lite_chart(
        {
            "data": {"values": [{"x": i, "y": i * 2} for i in range(5)]},
            "mark": "line",
            "encoding": {"x": {"field": "x"}, "y": {"field": "y"}},
        }
    )
    st.bar_chart([1, 2, 3, 4, 5])
    st.vega_lite_chart(
        {
            "data": {"values": [{"x": i, "y": i**2} for i in range(5)]},
            "mark": "bar",
            "encoding": {"x": {"field": "x"}, "y": {"field": "y"}},
        }
    )
    st.bar_chart([5, 4, 3, 2, 1])
