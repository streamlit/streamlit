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

import streamlit as st
import datetime

import numpy as np

from PIL import Image, ImageDraw

from streamlit.widgets import Widgets


@st.cache
def create_image(r=0, g=0, b=0, a=0):
    color = "rgb(%d%%, %d%%, %d%%)" % (int(r), int(g), int(b))
    size = 200
    step = 10
    half = size / 2

    # Create a new image
    image = Image.new("RGB", (size, size), color=color)
    d = ImageDraw.Draw(image)

    # Draw a red square
    d.rectangle(
        [(step, step), (half - step, half - step)], fill="red", outline=None, width=0
    )

    # Draw a green circle.  In PIL, green is 00800, lime is 00ff00
    d.ellipse(
        [(half + step, step), (size - step, half - step)],
        fill="lime",
        outline=None,
        width=0,
    )

    # Draw a blue triangle
    d.polygon(
        [(half / 2, half + step), (half - step, size - step), (step, size - step)],
        fill="blue",
        outline=None,
    )

    # Creating a pie slice shaped 'mask' ie an alpha channel.
    alpha = Image.new("L", image.size, 0xFF)
    d = ImageDraw.Draw(alpha)
    d.pieslice(
        [(step * 3, step * 3), (size - step, size - step)],
        0,
        90,
        fill=a,
        outline=None,
        width=0,
    )

    image.putalpha(alpha)

    return np.array(image).astype("float") / 255.0


if True:
    st.title("Image, checkbox and slider test")

    st.write("Script ran at", datetime.datetime.now().isoformat())

    st.subheader("Background color")
    r_color = st.slider("Red amount", 0, 100)
    g_color = st.slider("Green amount", 0, 100)
    b_color = st.slider("Blue amount", 0, 100)
    alpha_pct = st.slider("Alpha amount", 0, 100, 50)

    image = create_image(r_color, g_color, b_color, alpha_pct)
    r = image[:, :, 0]
    g = image[:, :, 1]
    b = image[:, :, 2]
    alpha = image[:, :, 3]

    z = np.zeros(r.shape)
    mask = np.ones(r.shape)

    image = np.stack([r, g, b], 2)

    st.subheader("Channels to include in output")
    r_on = st.checkbox("Red", True)
    g_on = st.checkbox("Green", True)
    b_on = st.checkbox("Blue", True)
    alpha_on = st.checkbox("Alpha", True)
    image = np.stack(
        [
            r if r_on else z,
            g if g_on else z,
            b if b_on else z,
            alpha if alpha_on else mask,
        ],
        2,
    )

    st.image(image, format="png")
