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

import math
from typing import Any, cast

import numpy as np
import pandas as pd
import pydeck as pdk

import streamlit as st

np.random.seed(12345)

random_scatter_sf = pd.DataFrame(
    cast("Any", np.random.randn(1000, 2) / [50, 50]) + [37.76, -122.4],  # noqa: RUF005
    columns=["lat", "lon"],
)

H3_HEX_DATA = [
    {"hex": "88283082b9fffff", "count": 10},
    {"hex": "88283082d7fffff", "count": 50},
    {"hex": "88283082a9fffff", "count": 100},
]
hex_data = pd.DataFrame(H3_HEX_DATA)


def empty_chart_subtest():
    st.write("""
    ## Test empty chart
    """)

    st.pydeck_chart()


def basic_chart_subtest():
    st.write("""
    ## Test basic chart

    Should show a map with default settings and random data centered in SF, using
    hex and scatter plots.
    """)

    st.pydeck_chart(
        pdk.Deck(
            initial_view_state=pdk.ViewState(
                latitude=37.76,
                longitude=-122.4,
                zoom=11,
                pitch=50,
            ),
            layers=[
                pdk.Layer(
                    "HexagonLayer",
                    data=random_scatter_sf,
                    get_position="[lon, lat]",
                    radius=200,
                    elevation_scale=4,
                    elevation_range=[0, 1000],
                    pickable=True,
                    extruded=True,
                ),
                pdk.Layer(
                    "ScatterplotLayer",
                    data=random_scatter_sf,
                    get_position="[lon, lat]",
                    get_fill_color="[200, 30, 0, 160]",
                    get_radius=200,
                ),
            ],
        )
    )


def invalid_prop_subtest():
    st.write("""
    ## Test invalid property

    See [issue #5799.](https://github.com/streamlit/streamlit/issues/5799)

    You should see a map with a single datapoint. There should be no error message.
    """)

    data = pd.DataFrame(
        {"lng": [-109.037673], "lat": [36.994672], "weight": [math.nan]}
    )

    layer = pdk.Layer(
        "ScatterplotLayer", data=data, get_position=["lng", "lat"], radius_min_pixels=4
    )

    deck = pdk.Deck(
        layers=[layer],
        map_style=pdk.map_styles.CARTO_LIGHT,
        tooltip={"text": "weight: {weight}"},
    )

    st.pydeck_chart(deck, use_container_width=True)


def map_styles_subtest():
    st.write("""
    ## Test map styles

    You should see a colorful "road"-style map with 3 green hex prisms.
    """)

    st.pydeck_chart(
        pdk.Deck(
            map_style="road",
            tooltip={"text": "Count: {count}"},
            initial_view_state=pdk.ViewState(
                latitude=37.7749295,
                longitude=-122.4194155,
                zoom=12,
                bearing=0,
                pitch=30,
            ),
            layers=[
                pdk.Layer(
                    "H3HexagonLayer",
                    hex_data,
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


def light_style_subtest():
    st.write("""
    ## Test light style

    Should show a _light_ map with random data centered in SF, using hex and scatter plots.
    """)

    st.pydeck_chart(
        pdk.Deck(
            map_style="light",
            initial_view_state=pdk.ViewState(
                latitude=37.76,
                longitude=-122.4,
                zoom=11,
                pitch=50,
            ),
            layers=[
                pdk.Layer(
                    "HexagonLayer",
                    data=random_scatter_sf,
                    get_position="[lon, lat]",
                    radius=200,
                    elevation_scale=4,
                    elevation_range=[0, 1000],
                    pickable=True,
                    extruded=True,
                ),
                pdk.Layer(
                    "ScatterplotLayer",
                    data=random_scatter_sf,
                    get_position="[lon, lat]",
                    get_fill_color="[200, 30, 0, 160]",
                    get_radius=200,
                ),
            ],
        )
    )


def dark_style_subtest():
    st.write("""
    ## Test dark style

    Should show a _dark_ map with random data centered in SF, using hex and scatter plots.
    """)

    st.pydeck_chart(
        pdk.Deck(
            map_style="dark",
            initial_view_state=pdk.ViewState(
                latitude=37.76,
                longitude=-122.4,
                zoom=11,
                pitch=50,
            ),
            layers=[
                pdk.Layer(
                    "HexagonLayer",
                    data=random_scatter_sf,
                    get_position="[lon, lat]",
                    radius=200,
                    elevation_scale=4,
                    elevation_range=[0, 1000],
                    pickable=True,
                    extruded=True,
                ),
                pdk.Layer(
                    "ScatterplotLayer",
                    data=random_scatter_sf,
                    get_position="[lon, lat]",
                    get_fill_color="[200, 30, 0, 160]",
                    get_radius=200,
                ),
            ],
        )
    )


def dimensions_subtest():
    st.write("""
    ## Test with width and height set

    Should show a "road"-style map with random data centered in SF, and small width and
    height (200x250).
    """)

    st.pydeck_chart(
        pdk.Deck(
            map_style="road",
            initial_view_state=pdk.ViewState(
                latitude=37.7749295,
                longitude=-122.4194155,
                zoom=12,
                bearing=0,
                pitch=30,
            ),
            layers=[
                pdk.Layer(
                    "ScatterplotLayer",
                    data=random_scatter_sf,
                    get_position="[lon, lat]",
                    get_fill_color="[200, 30, 0, 160]",
                    get_radius=200,
                ),
            ],
        ),
        width=200,
        height=250,
        use_container_width=False,
    )


def mapbox_subtest():
    st.write("""
    ## Test with Mapbox provider

    You should see a "satellite"-style map served by Mapbox with random data centered in SF.
    This test requires an API key to be set. See MAPBOX_API_KEY in our Github automation.
    """)

    st.pydeck_chart(
        pdk.Deck(
            map_style="mapbox://styles/mapbox/satellite-v9",
            map_provider="mapbox",
            tooltip={"text": "Count: {count}"},
            initial_view_state=pdk.ViewState(
                latitude=37.7749295,
                longitude=-122.4194155,
                zoom=12,
                bearing=0,
                pitch=30,
            ),
            layers=[
                pdk.Layer(
                    "ScatterplotLayer",
                    data=random_scatter_sf,
                    get_position="[lon, lat]",
                    get_fill_color="[200, 30, 0, 160]",
                    get_radius=200,
                ),
            ],
        )
    )


SUBTESTS = {k: v for k, v in globals().items() if k.endswith("_subtest")}

subtest = SUBTESTS[st.selectbox("Test to run", SUBTESTS.keys())]

subtest()
