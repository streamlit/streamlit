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
import pydeck as pdk

import streamlit as st

st.subheader("Maps in horizontal containers")

with st.container(direction="horizontal", border=True):
    st.markdown("West Coast and East Coast Map", width="content")
    # West Coast map data
    west_coast_data = pd.DataFrame(
        {
            "latitude": [37.7749, 34.0522],
            "longitude": [-122.4194, -118.2437],
            "name": ["San Francisco", "Los Angeles"],
        }
    )

    # East Coast map data
    east_coast_data = pd.DataFrame(
        {
            "latitude": [40.7128, 25.7617],
            "longitude": [-74.0060, -80.1918],
            "name": ["New York", "Miami"],
        }
    )

    st.map(west_coast_data, use_container_width=True)
    st.map(east_coast_data, use_container_width=True)


st.subheader("PyDeck charts in horizontal containers")

# More complex pydeck data
pydeck_data = pd.DataFrame(
    {
        "latitude": np.random.uniform(37.7, 37.8, 100),
        "longitude": np.random.uniform(-122.5, -122.4, 100),
        "elevation": np.random.uniform(0, 1000, 100),
    }
)

with st.container(direction="horizontal", border=True):
    st.pydeck_chart(
        pdk.Deck(
            map_style="mapbox://styles/mapbox/light-v9",
            initial_view_state=pdk.ViewState(
                latitude=37.76,
                longitude=-122.4,
                zoom=11,
                pitch=0,
            ),
            layers=[
                pdk.Layer(
                    "ScatterplotLayer",
                    data=pydeck_data,
                    get_position=["longitude", "latitude"],
                    get_color=[200, 30, 0, 160],
                    get_radius=50,
                ),
            ],
        ),
        use_container_width=True,
    )

    st.pydeck_chart(
        pdk.Deck(
            map_style="mapbox://styles/mapbox/dark-v9",
            initial_view_state=pdk.ViewState(
                latitude=37.76,
                longitude=-122.4,
                zoom=11,
                pitch=45,
            ),
            layers=[
                pdk.Layer(
                    "ColumnLayer",
                    data=pydeck_data,
                    get_position=["longitude", "latitude"],
                    get_elevation="elevation",
                    elevation_scale=1,
                    radius=50,
                    get_fill_color=[255, 140, 0, 180],
                ),
            ],
        ),
        use_container_width=True,
    )
