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

import pandas as pd

import streamlit as st

# Test data
simple_df = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T
simple_spec = {
    "mark": "bar",
    "encoding": {
        "x": {"field": "a", "type": "ordinal"},
        "y": {"field": "b", "type": "quantitative"},
    },
}

st.header("Vega Charts Height Tests")

# Test explicit height parameters
st.subheader("Explicit Height Parameter Tests")

st.write("Chart with height='content':")
st.vega_lite_chart(simple_df, simple_spec, height="content")

st.write("Chart with height='stretch':")
with st.container(border=True, key="test_height_stretch", height=500):
    st.vega_lite_chart(simple_df, simple_spec, height="stretch")

st.write("Chart with height=150:")
st.vega_lite_chart(simple_df, simple_spec, height=150)

# Test chart with height in spec vs height parameter
spec_with_height = {
    "mark": "bar",
    "encoding": {
        "x": {"field": "a", "type": "ordinal"},
        "y": {"field": "b", "type": "quantitative"},
    },
    "height": 200,
}

st.write("Chart with height in spec (200) and height='content' parameter:")
st.vega_lite_chart(simple_df, spec_with_height, height="content")

st.write("Chart with height in spec (200) and height='stretch' parameter:")
with st.container(border=True, key="test_height_stretch_with_spec", height=400):
    st.vega_lite_chart(simple_df, spec_with_height, height="stretch")

st.write("Chart with height in spec (200) and height=100 parameter:")
st.vega_lite_chart(simple_df, spec_with_height, height=100)

st.write("Vertical concatenation chart:")
vconcat_spec = {
    "vconcat": [
        {
            "mark": "bar",
            "encoding": {
                "x": {"field": "a", "type": "ordinal"},
                "y": {"field": "b", "type": "quantitative"},
            },
        },
        {
            "mark": "point",
            "encoding": {
                "x": {"field": "a", "type": "ordinal"},
                "y": {"field": "b", "type": "quantitative"},
            },
        },
    ]
}
st.vega_lite_chart(simple_df, vconcat_spec)
