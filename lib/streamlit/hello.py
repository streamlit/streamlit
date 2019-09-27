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

"""A "Hello World" app."""

import streamlit as st
import inspect
from collections import OrderedDict
import urllib

AWS_BUCKET_URL = "https://streamlit-demo-data.s3-us-west-2.amazonaws.com"


def intro():
    st.markdown(
        """
## Intro...

text text text text text text text text text text text text text text text text
text text text text text text text text text text text text text text text text
text text text text text text text text text text text text text text text text
text text text text text text text text text text text text text text text text
text text text text text text text text text text text text text text text text
text text text text text text text text text text text text text text text text
"""
    )


def demo_random_numbers():
    """
    This demo illustrates a combination of plotting and animation with Streamlit.
    We're generating a bunch of random numbers in a loop for around 10 seconds.
    Enjoy!.
    """
    import time
    import numpy as np

    progress_bar, success = None, None
    status_text = st.empty()
    chart = st.line_chart(np.random.randn(10, 1))
    for i in range(1, 101):
        new_rows = np.random.randn(10, 1)
        status_text.text("The latest random number is: %s" % new_rows[-1, 0])
        chart.add_rows(new_rows)
        if progress_bar is None:
            progress_bar = st.progress(0)
            success = st.empty()
        progress_bar.progress(i)
        time.sleep(0.1)
    progress_bar.empty()
    success.success("Complete!")
    st.button("Re-run")


def map_demo():
    """
    This demo shows how to use
    [`st.deck_gl_chart`](https://streamlit.io/docs/api.html#streamlit.deck_gl_chart)
    to display geospatial data.
    """
    import pandas as pd
    import copy, os
    from collections import OrderedDict

    @st.cache
    def from_data_file(filename):
        GITHUB_DATA = "https://raw.githubusercontent.com/streamlit/streamlit/develop/examples/"
        return pd.read_json(os.path.join(GITHUB_DATA, "data", filename))

    layers_def = {
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

    st.sidebar.markdown('## Map Layers')
    layers = [layer_name for layer_name in layers_def
        if st.sidebar.checkbox(layer_name, True)]# st.multiselect("Select layers", list(layers_def.keys()))
    if layers:
        viewport={"latitude": 37.76, "longitude": -122.4, "zoom": 11, "pitch": 50}
        st.deck_gl_chart(viewport=viewport, layers=[layers_def[k] for k in layers])
    else:
        st.error("Please choose at least one layer above.")

def demo_fractals():
    """
    This app shows how you can use Streamlit to build cool animations.
    It displays an animated fractal based on the the Julia Set. Use the slider
    to tune the level of detail.
    """
    import numpy as np

    iterations = st.slider("Level of detail", 1, 100, 70, 1)

    m, n, s = 480, 320, 300
    x = np.linspace(-m / s, m / s, num=m).reshape((1, m))
    y = np.linspace(-n / s, n / s, num=n).reshape((n, 1))
    image = st.empty()

    progress_bar = st.progress(0)
    for a in np.linspace(0.0, 4 * np.pi, 100):
        progress_bar.progress(int(round(100 * a / (4 * np.pi))))
        c = 0.7885 * np.exp(1j * a)
        Z = np.tile(x, (n, 1)) + 1j * np.tile(y, (1, m))
        C = np.full((n, m), c)
        M = np.full((n, m), True, dtype=bool)
        N = np.zeros((n, m))

        for i in range(iterations):
            Z[M] = Z[M] * Z[M] + C[M]
            M[np.abs(Z) > 2] = False
            N[M] = i

        image.image(1.0 - (N / N.max()), use_column_width=True)
    progress_bar.empty()
    st.button("Re-run")


def demo_deformation():
    """
    <...>
    """
    import requests
    from io import BytesIO

    @st.cache(show_spinner=False)
    def load_image():
        return Image.open(
            BytesIO(
                requests.get(AWS_BUCKET_URL + "/maarten-van-den-heuvel.jpg").content
            )
        )

    import numpy as np
    from PIL import Image

    def griddify(rect, w_div, h_div):
        w = rect[2] - rect[0]
        h = rect[3] - rect[1]
        x_step = w / float(w_div)
        y_step = h / float(h_div)
        y = rect[1]
        grid_vertex_matrix = []
        for _ in range(h_div + 1):
            grid_vertex_matrix.append([])
            x = rect[0]
            for _ in range(w_div + 1):
                grid_vertex_matrix[-1].append([int(x), int(y)])
                x += x_step
            y += y_step
        grid = np.array(grid_vertex_matrix)
        return grid

    def distort_grid(org_grid, max_shift):
        new_grid = np.copy(org_grid)
        x_min = np.min(new_grid[:, :, 0])
        y_min = np.min(new_grid[:, :, 1])
        x_max = np.max(new_grid[:, :, 0])
        y_max = np.max(new_grid[:, :, 1])
        new_grid += np.random.randint(-max_shift, max_shift + 1, new_grid.shape)
        new_grid[:, :, 0] = np.maximum(x_min, new_grid[:, :, 0])
        new_grid[:, :, 1] = np.maximum(y_min, new_grid[:, :, 1])
        new_grid[:, :, 0] = np.minimum(x_max, new_grid[:, :, 0])
        new_grid[:, :, 1] = np.minimum(y_max, new_grid[:, :, 1])
        return new_grid

    def grid_to_mesh(src_grid, dst_grid):
        assert src_grid.shape == dst_grid.shape
        mesh = []
        for i in range(src_grid.shape[0] - 1):
            for j in range(src_grid.shape[1] - 1):
                src_quad = [
                    src_grid[i, j, 0],
                    src_grid[i, j, 1],
                    src_grid[i + 1, j, 0],
                    src_grid[i + 1, j, 1],
                    src_grid[i + 1, j + 1, 0],
                    src_grid[i + 1, j + 1, 1],
                    src_grid[i, j + 1, 0],
                    src_grid[i, j + 1, 1],
                ]
                dst_quad = [
                    dst_grid[i, j, 0],
                    dst_grid[i, j, 1],
                    dst_grid[i + 1, j, 0],
                    dst_grid[i + 1, j, 1],
                    dst_grid[i + 1, j + 1, 0],
                    dst_grid[i + 1, j + 1, 1],
                    dst_grid[i, j + 1, 0],
                    dst_grid[i, j + 1, 1],
                ]
                dst_rect = (dst_quad[0], dst_quad[1], dst_quad[4], dst_quad[3])
                mesh.append([dst_rect, src_quad])
        return mesh

    p1 = st.sidebar.slider("Parm1", 0, 100, 0, 1)
    try:
        image = load_image()
    except urllib.error.URLError:
        st.error("Connection Error. This demo requires internet access")
        return

    dst_grid = griddify((0, 0, 1024, 576), 4, 4)
    src_grid = distort_grid(dst_grid, p1)
    mesh = grid_to_mesh(src_grid, dst_grid)
    im = image.transform(image.size, Image.MESH, mesh)
    st.image(im, use_column_width=True)


def demo_movies():
    """
    Discover the gross revenue of a movie of your liking!
    Note that the network loading and preprocessing of the data is cached
    by using Streamlit st.cache annotation.
    """
    import pandas as pd

    @st.cache
    def load_dataframe_from_url():
        return pd.read_csv(AWS_BUCKET_URL + "/movies-revenue.csv.gz").transform(
            {"title": lambda x: x, "revenue": lambda x: round(x / 1000 / 1000)}
        )

    try:
        df = load_dataframe_from_url()
    except urllib.error.URLError:
        st.error("Connection Error. This demo requires internet access")
        return
    movie = st.text_input("Search movie titles")
    df = df[df.title.str.contains(movie, case=False)].sort_values(
        ascending=False, by="revenue"
    )
    st.markdown("#### Result dataframe for %d movie(s)" % df.shape[0])
    st.dataframe(df.rename(columns={"title": "Title", "revenue": "Revenue [$1M]"}))


def demo_agri():
    """
    This demo shows how to use Streamlit to visualize Dataframes.
    The app allows you to explore the Gross Agricultultural Production (GPA)
    in the world from 1960 to 2007. Data are derived from a United Nation
    publicly available dataset (http://data.un.org/Explorer.aspx). Use the
    select box to choose some countries to compare.
    """
    import pandas as pd

    @st.cache
    def read():
        return pd.read_csv(AWS_BUCKET_URL + "/agri.csv.gz")

    try:
        df = read().copy()
    except urllib.error.URLError:
        st.error("Connection Error. This demo requires internet access")
        return

    df = df.set_index("Region")
    countries = st.multiselect("Choose countries", df.index)
    if len(countries) == 0:
        st.error(
            (
                "Please select at least one country. For example, search"
                " for China and United States. Just type the initial letters in"
                " the search box!"
            )
        )
        return

    st.text("Gross Agricultural Production [$1B]")
    st.write(df.loc[countries].sort_index())

    ax = df.loc[countries].T.plot(kind="area", figsize=(20, 8), stacked=False)

    ax.set_ylabel("GAP in Billions (Int $)", fontsize=25)
    ax.set_xlabel("Year", fontsize=25)
    ax.tick_params(labelsize=20)
    ax.legend(loc=2, prop={"size": 20})
    st.pyplot()


DEMOS = OrderedDict(
    {
        "---": intro,
        "Map": map_demo,
        "Animation": demo_fractals,
        "Dataframe": demo_agri,
        "Plotting": demo_random_numbers,
    }
)


def run():
    demo_name = st.sidebar.selectbox("Choose a demo", list(DEMOS.keys()), 0)
    demo = DEMOS[demo_name]

    if demo_name != "---":
        st.markdown("# %s Demo" % demo_name)
        st.write(inspect.getdoc(demo))
        demo()
        if st.sidebar.checkbox("Show Code", True):
            st.markdown("## Code")
            sourcelines, n_lines = inspect.getsourcelines(demo)
            sourcelines = reset_indentation(remove_docstring(sourcelines))
            st.code("".join(sourcelines))
    else:
        st.title("Welcome to Streamlit!")
        st.write(
            """
            Streamlit is the best way to create bespoke apps.
            """
        )
        demo()


# This function parses the lines of the function and removes the docstring
# if found.
def remove_docstring(lines):
    if len(lines) < 3 and '"""' not in lines[1]:
        return lines
    #  lines[2] is the first line of the docstring, past the inital """
    index = 2
    while '"""' not in lines[index]:
        index += 1
        # limit to ~100 lines
        if index > 100:
            return lines
    # lined[index] is the closing """
    return lines[index + 1 :]


# This function remove the common leading indentation from a code block
def reset_indentation(lines):
    if len(lines) == 0:
        return []
    spaces = len(lines[0]) - len(lines[0].lstrip())
    return [line[spaces:] if len(line) > spaces else "\n" for line in lines]


if __name__ == "__main__":
    run()
