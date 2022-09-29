# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
    "title": f"Interactive Bar Chart Example",
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

st._arrow_vega_lite_chart(df, spec, use_container_width=True)
st._arrow_vega_lite_chart(df, spec, use_container_width=True)
st._arrow_vega_lite_chart(df, spec)
st._arrow_vega_lite_chart(df, spec_with_width)
st._arrow_vega_lite_chart(interactive_spec, None)

# Screenshot comparison

st.header("Different ways to get the exact same plot")

df = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T

st.write("Using a top-level `df` and a `spec` dict:")

st._arrow_vega_lite_chart(
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

st._arrow_vega_lite_chart(
    df,
    mark="bar",
    x_field="a",
    x_type="ordinal",
    y_field="b",
    y_type="quantitative",
    use_container_width=True,
)

st.write("Putting the `df` inside the spec, as a `dataset`:")

st._arrow_vega_lite_chart(
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

st._arrow_vega_lite_chart(
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

st._arrow_vega_lite_chart(
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
spec["usermeta"] = {"embedOptions": {"theme": "streamlit"}}
st._arrow_vega_lite_chart(df, spec, use_container_width=True)

st.write("Show default theme:")
spec["usermeta"] = {"embedOptions": {"theme": "none"}}
st._arrow_vega_lite_chart(df, spec, use_container_width=True)
