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
import numpy as np
import pandas as pd

np.random.seed(12345)

data = np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4]
df = pd.DataFrame(data, columns=["lat", "lon"])

# Test for scatterplot basic charts:
#   st.deck_gl_chart(viewport=viewport_dict, layers=layers_list).

viewport = {"latitude": 37.76, "longitude": -122.4, "zoom": 11, "pitch": 50}

layers = [{"data": df, "type": "ScatterplotLayer"}]

st.deck_gl_chart(viewport=viewport, layers=layers)

# Test a similar chart but with a full dict spec:
#   st.deck_gl_chart(spec=spec_dict)
spec = {
    "viewport": {"latitude": 37.76, "longitude": -122.4, "zoom": 11, "pitch": 50},
    "layers": [
        {"data": df, "type": "ScatterplotLayer", "radius": 250, "extruded": True}
    ],
}
st.deck_gl_chart(spec=spec)


# Test a similar chart but with spec sent as keywords.
#   st.deck_gl_chart(foo=bar, boz=bonk)
st.deck_gl_chart(
    viewport={"latitude": 37.76, "longitude": -122.4, "zoom": 11, "pitch": 50},
    layers=[{"data": df, "type": "ScatterplotLayer", "radius": 250}],
)


# Test a similar chart but with spec sent a flattened dict.
st.deck_gl_chart(
    viewport_latitude=37.76,
    viewport_longitude=-122.4,
    viewport_zoom=11,
    viewport_pitch=50,
    layers=[{"data": df, "type": "ScatterplotLayer", "radius": 250}],
)


# Test custom column names (not "latitude" and "longitude").
st.deck_gl_chart(
    viewport={"latitude": 37.76, "longitude": -122.4, "zoom": 11, "pitch": 50},
    layers=[
        {
            "data": pd.DataFrame(data, columns=["my_lat", "my_lon"]),
            "type": "ScatterplotLayer",
            "radius": 250,
            "getLatitude": "my_lat",
            "getLongitude": "my_lon",
        }
    ],
)


# Test two layers on top of one another.
st.deck_gl_chart(
    viewport={"latitude": 37.76, "longitude": -122.4, "zoom": 11, "pitch": 50},
    layers=[
        {"data": df, "type": "HexagonLayer", "radius": 250, "extruded": True},
        {"data": df, "type": "ScatterplotLayer", "radius": 250},
    ],
)
