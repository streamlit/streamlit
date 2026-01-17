# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Test app for host config bypass feature."""

import numpy as np
import pandas as pd
import pydeck as pdk

import streamlit as st


def page1():
    pass


def page2():
    pass


def page3():
    pass


pages = {
    "General": [
        st.Page(page1, title="Home", icon=":material/home:"),
        st.Page(page2, title="Data visualizations", icon=":material/monitoring:"),
    ],
    "Admin": [st.Page(page3, title="Settings", icon=":material/settings:")],
}


pg = st.navigation(pages)
pg.run()

st.subheader("Connection status test", divider="gray")

st.slider("Slider", value=50, min_value=0, max_value=100)

st.multiselect(
    "Multiselect",
    default=["Option 1", "Option 2"],
    options=["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
)

# Add a button to verify interactivity
st.write("Button:")
if st.button("Click me"):
    st.write("Button clicked!")

with st.sidebar:
    st.metric("Temperature", "70 °F", "1.2 °F")
    st.metric("Wind", "9 mph", "-8%")

# Elements for testing disableFullscreenMode
st.subheader("Fullscreen mode test", divider="gray")
# Always generate the same data
np.random.seed(0)
st.dataframe(
    pd.DataFrame(np.random.randint(0, 100, size=(10, 4)), columns=list("ABCD")),
    key="test_dataframe",
)

# Elements for testing mapboxToken - uses pydeck with explicit Mapbox style
# This ensures the mapboxToken from host config is actually used in API requests
st.subheader("Mapbox token test", divider="gray")
st.pydeck_chart(
    pdk.Deck(
        map_style="mapbox://styles/mapbox/light-v9",
        map_provider="mapbox",
        initial_view_state=pdk.ViewState(
            latitude=37.76,
            longitude=-122.4,
            zoom=11,
        ),
    )
)
