# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import streamlit as st
import pandas as pd
import numpy as np
from dateutil.parser import parse

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

st.vega_lite_chart(df, spec, use_container_width=True)
st.vega_lite_chart(df, spec, use_container_width=True)
st.vega_lite_chart(df, spec)
st.vega_lite_chart(df, spec_with_width)

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

# st.write("Putting the `df` inside the spec, as inline `data` (different notation):")
# This fails now, but not a big deal. It's a weird notation.

# st.vega_lite_chart({
#     'data': {'values': df},
#     'mark': 'bar',
#     'encoding': {
#       'x': {'field': 'a', 'type': 'ordinal'},
#       'y': {'field': 'b', 'type': 'quantitative'}
#     }
#   })
