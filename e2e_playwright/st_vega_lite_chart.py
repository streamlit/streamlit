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

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)
data = np.random.randn(200, 3)
df = pd.DataFrame(data, columns=["a", "b", "c"])
spec = {
    "mark": "circle",
    "encoding": {
        "x": {"field": "a", "type": "quantitative"},
        "y": {"field": "b", "type": "quantitative"},
        "size": {"field": "c", "type": "quantitative"},
        "color": {"field": "c", "type": "quantitative"},
    },
}

spec_with_width = {
    "mark": "circle",
    "encoding": {
        "x": {"field": "a", "type": "quantitative"},
        "y": {"field": "b", "type": "quantitative"},
        "size": {"field": "c", "type": "quantitative"},
        "color": {"field": "c", "type": "quantitative"},
    },
    "width": "500",
}

interactive_spec = {
    "data": {
        "values": [
            {"a": "A", "b": 28},
            {"a": "B", "b": 55},
            {"a": "C", "b": 43},
            {"a": "D", "b": 91},
            {"a": "E", "b": 81},
            {"a": "F", "b": 53},
            {"a": "G", "b": 19},
            {"a": "H", "b": 87},
            {"a": "I", "b": 52},
        ]
    },
    "params": [
        {"name": "highlight", "select": {"type": "point", "on": "mouseover"}},
        {"name": "select", "select": "point"},
    ],
    "mark": {"type": "bar", "fill": "#4C78A8", "stroke": "black", "cursor": "pointer"},
    "encoding": {
        "x": {"field": "a", "type": "ordinal"},
        "y": {"field": "b", "type": "quantitative"},
        "fillOpacity": {"condition": {"param": "select", "value": 1}, "value": 0.3},
        "strokeWidth": {
            "condition": [
                {"param": "select", "empty": False, "value": 2},
                {"param": "highlight", "empty": False, "value": 1},
            ],
            "value": 0,
        },
    },
    "config": {"scale": {"bandPaddingInner": 0.2}},
}

st.vega_lite_chart(df, spec)
st.vega_lite_chart(df, spec)
st.vega_lite_chart(df, spec, use_container_width=False)
st.vega_lite_chart(df, spec_with_width, use_container_width=False)
st.vega_lite_chart(interactive_spec, None, use_container_width=False)

# Screenshot comparison

st.header("Different ways to get the exact same plot")

df = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T

st.write("Using a top-level `df` and a `spec` dict:")

st.vega_lite_chart(
    df,
    {
        "mark": "bar",
        "encoding": {
            "x": {"field": "a", "type": "ordinal"},
            "y": {"field": "b", "type": "quantitative"},
        },
    },
    use_container_width=True,
)

st.write("Using a top-level `df` and keywords as a spec:")

st.vega_lite_chart(
    df,
    mark="bar",
    x_field="a",
    x_type="ordinal",
    y_field="b",
    y_type="quantitative",
    use_container_width=True,
)

st.write("Putting the `df` inside the spec, as a `dataset`:")

st.vega_lite_chart(
    {
        "datasets": {"foo": df},
        "data": {"name": "foo"},
        "mark": "bar",
        "encoding": {
            "x": {"field": "a", "type": "ordinal"},
            "y": {"field": "b", "type": "quantitative"},
        },
    },
    use_container_width=True,
)

st.write("Putting the `df` inside the spec, as inline `data`:")

st.vega_lite_chart(
    {
        "data": df,
        "mark": "bar",
        "encoding": {
            "x": {"field": "a", "type": "ordinal"},
            "y": {"field": "b", "type": "quantitative"},
        },
    },
    use_container_width=True,
)

st.write("Putting the `df` inside the spec, as inline `data` (different notation):")

st.vega_lite_chart(
    {
        "data": {"values": df},
        "mark": "bar",
        "encoding": {
            "x": {"field": "a", "type": "ordinal"},
            "y": {"field": "b", "type": "quantitative"},
        },
    }
)

df = pd.DataFrame(data, columns=["a", "b", "c"])

st.write("Show streamlit theme:")
st.vega_lite_chart(df, spec, use_container_width=True, theme="streamlit")

st.write("Show default theme:")
st.vega_lite_chart(df, spec, use_container_width=True, theme=None)

st.write("Show custom colors:")
st.vega_lite_chart(
    df,
    {
        "mark": "bar",
        "encoding": {
            "x": {"field": "a", "type": "ordinal"},
            "y": {"field": "b", "type": "quantitative"},
        },
        "config": {"background": "purple", "axis": {"labelColor": "blue"}},
    },
    use_container_width=True,
)

spec = {
    "mark": "line",
    "encoding": {
        "x": {"field": "a", "type": "quantitative"},
        "y": {"field": "b", "type": "quantitative"},
    },
}

# empty chart
st.vega_lite_chart(spec, use_container_width=True)

data1 = {"VALUE": [420, 380, 390], "DATE": [50, 60, 70]}
data = pd.DataFrame(data1)

data2 = {
    "VALUE": [420, 380, 600, 390],
    "DATE": [50, 60, 70, 80],
}


if st.button(label="change"):
    data = pd.DataFrame(data2)

st.dataframe(data)
st.vega_lite_chart(
    data=data,
    spec={
        "autosize": {
            "type": "fit",
            "contains": "padding",
            "resize": True,
        },
        "title": "test",
        "layer": [
            {
                "layer": [
                    {
                        "mark": "line",
                    },
                ],
                "encoding": {
                    "x": {
                        "field": "DATE",
                        "title": "",
                        "type": "quantitative",
                    },
                    "y": {
                        "field": "VALUE",
                        "title": "",
                        "type": "quantitative",
                    },
                },
            },
        ],
    },
    use_container_width=True,
    theme="streamlit",
)
