# Copyright 2018-2021 Streamlit Inc.
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
import pydeck as pdk

H3_HEX_DATA = [
    {"hex": "88283082b9fffff", "count": 10},
    {"hex": "88283082d7fffff", "count": 50},
    {"hex": "88283082a9fffff", "count": 100},
]
df = pd.DataFrame(H3_HEX_DATA)

st.pydeck_chart(
    pdk.Deck(
        map_style="mapbox://styles/mapbox/light-v9",
        tooltip={"text": "Count: {count}"},
        initial_view_state=pdk.ViewState(
            latitude=37.7749295, longitude=-122.4194155, zoom=12, bearing=0, pitch=30
        ),
        layers=[
            pdk.Layer(
                "H3HexagonLayer",
                df,
                pickable=True,
                stroked=True,
                filled=True,
                get_hexagon="hex",
                get_fill_color="[0, 255, 0]",
                get_line_color=[255, 255, 255],
                line_width_min_pixels=2,
            ),
        ],
    )
)
