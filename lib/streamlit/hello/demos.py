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

from __future__ import division, unicode_literals

import urllib

import streamlit as st


def intro():
    st.sidebar.success("Select a demo above.")

    st.markdown(
        """
        Streamlit is an open-source app framework built specifically for
        Machine Learning and Data Science projects.

        **👈 Select a demo from the dropdown on the left** to see some examples
        of what Streamlit can do!

        ### Want to learn more?

        - Check out [streamlit.io](https://streamlit.io)
        - Jump into our [documentation](https://streamlit.io/docs)
        - Ask a question in our [community
          forums](https://discuss.streamlit.io)

        ### See more complex demos

        - Use a neural net to [analyze the Udacity Self-driving Car Image
          Dataset] (https://github.com/streamlit/demo-self-driving)
        - Explore a [New York City rideshare dataset]
          (https://github.com/streamlit/demo-uber-nyc-pickups)
    """
    )


# Turn off black formatting for this function to present the user with more
# compact code.
# fmt: off
def mapping_demo():
    import pandas as pd

    @st.cache
    def from_data_file(filename):
        url = (
            "https://raw.githubusercontent.com/streamlit/"
            "streamlit/develop/examples/data/%s" % filename)
        return pd.read_json(url)

    try:
        ALL_LAYERS = {
            "Bike Rentals": {
                "type": "HexagonLayer",
                "data": from_data_file("bike_rental_stats.json"),
                "radius": 200,
                "elevationScale": 4,
                "elevationRange": [0, 1000],
                "pickable": True,
                "extruded": True,
            },
            "Bart Stop Exits": {
                "type": "ScatterplotLayer",
                "data": from_data_file("bart_stop_stats.json"),
                "radiusScale": 0.05,
                "getRadius": "exits",
            },
            "Bart Stop Names": {
                "type": "TextLayer",
                "data": from_data_file("bart_stop_stats.json"),
                "getText": "name",
                "getColor": [0, 0, 0, 200],
                "getSize": 15,
            },
            "Outbound Flow": {
                "type": "ArcLayer",
                "data": from_data_file("bart_path_stats.json"),
                "pickable": True,
                "autoHighlight": True,
                "getStrokeWidth": 10,
                "widthScale": 0.0001,
                "getWidth": "outbound",
                "widthMinPixels": 3,
                "widthMaxPixels": 30,
            }
        }
    except urllib.error.URLError as e:
        st.error("""
            **This demo requires internet access.**

            Connection error: %s
        """ % e.reason)
        return

    st.sidebar.markdown('### Map Layers')
    selected_layers = [layer for layer_name, layer in ALL_LAYERS.items()
        if st.sidebar.checkbox(layer_name, True)]
    if selected_layers:
        viewport={"latitude": 37.76, "longitude": -122.4, "zoom": 11, "pitch": 50}
        st.deck_gl_chart(viewport=viewport, layers=selected_layers)
    else:
        st.error("Please choose at least one layer above.")
# fmt: on

# Turn off black formatting for this function to present the user with more
# compact code.
# fmt: off
def fractal_demo():
    import numpy as np

    # Interactive Streamlit elements, like these sliders, return their value.
    # This gives you an extremely simple interaction model.
    iterations = st.sidebar.slider("Level of detail", 2, 20, 10, 1)
    separation = st.sidebar.slider("Separation", 0.7, 2.0, 0.7885)

    # Non-interactive elements return a placeholder to their location
    # in the app. Here we're storing progress_bar to update it later.
    progress_bar = st.sidebar.progress(0)

    # These two elements will be filled in later, so we create a placeholder
    # for them using st.empty()
    frame_text = st.sidebar.empty()
    image = st.empty()

    m, n, s = 960, 640, 400
    x = np.linspace(-m / s, m / s, num=m).reshape((1, m))
    y = np.linspace(-n / s, n / s, num=n).reshape((n, 1))

    for frame_num, a in enumerate(np.linspace(0.0, 4 * np.pi, 100)):
        # Here were setting value for these two elements.
        progress_bar.progress(frame_num)
        frame_text.text("Frame %i/100" % (frame_num + 1))

        # Performing some fractal wizardry.
        c = separation * np.exp(1j * a)
        Z = np.tile(x, (n, 1)) + 1j * np.tile(y, (1, m))
        C = np.full((n, m), c)
        M = np.full((n, m), True, dtype=bool)
        N = np.zeros((n, m))

        for i in range(iterations):
            Z[M] = Z[M] * Z[M] + C[M]
            M[np.abs(Z) > 2] = False
            N[M] = i

        # Update the image placeholder by calling the image() function on it.
        image.image(1.0 - (N / N.max()), use_column_width=True)

    # We clear elements by calling empty on them.
    progress_bar.empty()
    frame_text.empty()

    # Streamlit widgets automatically run the script from top to bottom. Since
    # this button is not connected to any other logic, it just causes a plain
    # rerun.
    st.button("Re-run")


# fmt: on

# Turn off black formatting for this function to present the user with more
# compact code.
# fmt: off
def plotting_demo():
    import time
    import numpy as np

    progress_bar = st.sidebar.progress(0)
    status_text = st.sidebar.empty()
    last_rows = np.random.randn(1, 1)
    chart = st.line_chart(last_rows)

    for i in range(1, 101):
        new_rows = last_rows[-1, :] + np.random.randn(5, 1).cumsum(axis=0)
        status_text.text("%i%% Complete" % i)
        chart.add_rows(new_rows)
        progress_bar.progress(i)
        last_rows = new_rows
        time.sleep(0.05)

    progress_bar.empty()

    # Streamlit widgets automatically run the script from top to bottom. Since
    # this button is not connected to any other logic, it just causes a plain
    # rerun.
    st.button("Re-run")


# fmt: on

# Turn off black formatting for this function to present the user with more
# compact code.
# fmt: off
def data_frame_demo():
    import sys
    import pandas as pd
    import altair as alt

    if sys.version_info[0] < 3:
        reload(sys) # noqa: F821 pylint:disable=undefined-variable
        sys.setdefaultencoding("utf-8")

    @st.cache
    def get_UN_data():
        AWS_BUCKET_URL = "https://streamlit-demo-data.s3-us-west-2.amazonaws.com"
        df = pd.read_csv(AWS_BUCKET_URL + "/agri.csv.gz")
        return df.set_index("Region")

    try:
        df = get_UN_data()
    except urllib.error.URLError as e:
        st.error(
            """
            **This demo requires internet access.**

            Connection error: %s
        """
            % e.reason
        )
        return

    countries = st.multiselect(
        "Choose countries", list(df.index), ["China", "United States of America"]
    )
    if not countries:
        st.error("Please select at least one country.")
        return

    data = df.loc[countries]
    data /= 1000000.0
    st.write("### Gross Agricultural Production ($B)", data.sort_index())

    data = data.T.reset_index()
    data = pd.melt(data, id_vars=["index"]).rename(
        columns={"index": "year", "value": "Gross Agricultural Product ($B)"}
    )
    chart = (
        alt.Chart(data)
        .mark_area(opacity=0.3)
        .encode(
            x="year:T",
            y=alt.Y("Gross Agricultural Product ($B):Q", stack=None),
            color="Region:N",
        )
    )
    st.write("", "", chart)


# fmt: on
