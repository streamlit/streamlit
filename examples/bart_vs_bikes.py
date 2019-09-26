# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

import copy
import os
import pandas as pd
import streamlit as st


st.title("BART stops vs. bike rentals")

st.write(
    """
    This plot shows two things:
    * Bay Area Rapit Transit (BART) train lines plotted as arcs connecting the
    stations.
    * A 3D hexagonal histogram plot of bike-sharing rentals (origin locations).
"""
)


@st.cache
def from_data_file(filename):
    dirname = "https://raw.githubusercontent.com/streamlit/streamlit/develop/examples/"
    url = os.path.join(dirname, "data", filename)
    return pd.read_json(url)


# Grab some data
bart_stop_stats = copy.deepcopy(from_data_file("bart_stop_stats.json"))
bart_path_stats = from_data_file("bart_path_stats.json")
bike_rental_stats = from_data_file("bike_rental_stats.json")

# Move bart stop name to the 1st column, so it looks nicer when printed as a
# table.
bart_stop_names = bart_stop_stats["name"]
bart_stop_stats.drop(labels=["name"], axis=1, inplace=True)
bart_stop_stats.insert(0, "name", bart_stop_names)

st.deck_gl_chart(
    viewport={"latitude": 37.76, "longitude": -122.4, "zoom": 11, "pitch": 50},
    layers=[
        {
            # Plot number of bike rentals throughtout the city
            "type": "HexagonLayer",
            "data": bike_rental_stats,
            "radius": 200,
            "elevationScale": 4,
            "elevationRange": [0, 1000],
            "pickable": True,
            "extruded": True,
        },
        {
            # Now plot locations of Bart stops
            # ...and let's size the stops according to traffic
            "type": "ScatterplotLayer",
            "data": bart_stop_stats,
            "radiusScale": 10,
            "getRadius": 50,
        },
        {
            # Now Add names of Bart stops
            "type": "TextLayer",
            "data": bart_stop_stats,
            "getText": "name",
            "getColor": [0, 0, 0, 200],
            "getSize": 15,
        },
        {
            # And draw some arcs connecting the stops
            "type": "ArcLayer",
            "data": bart_path_stats,
            "pickable": True,
            "autoHighlight": True,
            "getStrokeWidth": 10,
        },
    ],
)
