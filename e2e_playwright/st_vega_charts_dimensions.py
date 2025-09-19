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

st.header("Vega Charts Dimensions Tests")

# Test default width behavior for different chart types
st.subheader("Default Width Behavior Tests")

st.write("Regular chart (should default to stretch):")
st.vega_lite_chart(simple_df, simple_spec)

st.write("Facet chart (should default to content):")
facet_df = pd.DataFrame(
    {
        "category": ["A", "A", "B", "B"],
        "subcategory": ["X", "Y", "X", "Y"],
        "value": ["green", "blue", "red", "yellow"],
    }
)

facet_spec = {
    "facet": {"field": "category", "type": "ordinal"},
    "spec": {
        "mark": "bar",
        "encoding": {
            "x": {"field": "subcategory", "type": "ordinal"},
            "y": {"field": "value", "type": "nominal"},
        },
    },
}
st.vega_lite_chart(facet_df, facet_spec)

st.write("Chart with row encoding (should default to content):")
row_spec = {
    "mark": "bar",
    "encoding": {
        "x": {"field": "category", "type": "ordinal"},
        "y": {"field": "subcategory", "type": "ordinal"},
        "row": {"field": "category", "type": "ordinal"},
    },
}
st.vega_lite_chart(facet_df, row_spec)

st.write("Chart with column encoding (should default to content):")
column_spec = {
    "mark": "bar",
    "encoding": {
        "x": {"field": "a", "type": "ordinal"},
        "y": {"field": "b", "type": "quantitative"},
        "column": {"field": "a", "type": "ordinal"},
    },
}
st.vega_lite_chart(simple_df, column_spec)

st.write("Horizontal concatenation chart (should default to content):")
hconcat_spec = {
    "hconcat": [
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
st.vega_lite_chart(simple_df, hconcat_spec)

st.write("Vertical concatenation chart (should default to stretch):")
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

st.write("Repeat chart (should default to content):")
repeat_spec = {
    "repeat": {"row": ["a", "b"]},
    "spec": {
        "mark": "bar",
        "encoding": {
            "x": {"field": {"repeat": "row"}, "type": "ordinal"},
            "y": {"field": "b", "type": "quantitative"},
        },
    },
}
st.vega_lite_chart(simple_df, repeat_spec)

# Test explicit width parameters
st.subheader("Explicit Width Parameter Tests")

st.write("Chart with width='content':")
st.vega_lite_chart(simple_df, simple_spec, width="content")

st.write("Chart with width='stretch':")
st.vega_lite_chart(simple_df, simple_spec, width="stretch")

st.write("Chart with width=400:")
st.vega_lite_chart(simple_df, simple_spec, width=400)

# Test chart with width in spec vs width parameter
spec_with_width = {
    "mark": "bar",
    "encoding": {
        "x": {"field": "a", "type": "ordinal"},
        "y": {"field": "b", "type": "quantitative"},
    },
    "width": 500,
}

st.write("Chart with width in spec (500) and width='content' parameter:")
st.vega_lite_chart(simple_df, spec_with_width, width="content")

st.write("Chart with width in spec (500) and width='stretch' parameter:")
st.vega_lite_chart(simple_df, spec_with_width, width="stretch")

st.write("Chart with width in spec (500) and width=200 parameter:")
st.vega_lite_chart(simple_df, spec_with_width, width=200)
