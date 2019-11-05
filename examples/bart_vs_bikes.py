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
import pydeck as pdk
import streamlit as st

default_color = [200, 30, 0, 160]

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

# Set the map style
map_style="mapbox://styles/mapbox/light-v10",

# Set the viewport location
view_state = pdk.ViewState(
    longitude=-122.4,
    latitude=37.76,
    zoom=11,
    pitch=50
)

# Plot number of bike rentals throughtout the city
hexagon_layer = pdk.Layer(
    type='HexagonLayer',
    data=bike_rental_stats,
    get_position="[lon, lat]",
    radius=200,
    elevation_scale=4,
    elevation_range=[0, 1000],
    pickable=True,
    extruded=True
)

# Now plot locations of Bart stops
# ...and let's size the stops according to traffic
scatterplot_layer = pdk.Layer(
    type='ScatterplotLayer',
    data=bart_stop_stats,
    get_position="[lon, lat]",
    radius_scale=10,
    get_radius=50,
    get_fill_color=default_color
)

 # Now Add names of Bart stops
text_layer = pdk.Layer(
    type='TextLayer',
    data=bart_stop_stats,
    get_position="[lon, lat]",
    get_text="name",
    get_size=15
)

# And draw some arcs connecting the stops
arc_layer = pdk.Layer(
    type='ArcLayer',
    data=bart_path_stats,
    pickable=True,
    auto_highlight=True,
    get_width=10,
    get_source_position="[lon, lat]",
    get_target_position="[lon2, lat2]",
    get_target_color=default_color,
    get_source_color=default_color
)

# Combined all of it
pydeck_obj = pdk.Deck(initial_view_state=view_state, layers=[hexagon_layer, scatterplot_layer, text_layer, arc_layer], map_style=map_style)
st.write(pydeck_obj)