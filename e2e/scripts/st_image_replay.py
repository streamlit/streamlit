# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import io

import numpy as np
from PIL import Image, ImageDraw

import streamlit as st


def create_gif(size, frames=1):
    # Create grayscale image.
    im = Image.new("L", (size, size), "white")

    images = []

    # Make circle of a constant size with a number of frames, moving across the
    # principal diagonal of a 64x64 image. The GIF will not loop and stops
    # animating after frames x 100ms.
    for i in range(0, frames):
        frame = im.copy()
        draw = ImageDraw.Draw(frame)
        pos = (i, i)
        circle_size = size / 2
        draw.ellipse([pos, tuple(p + circle_size for p in pos)], "black")
        images.append(frame.copy())

    # Save the frames as an animated GIF
    data = io.BytesIO()
    images[0].save(
        data,
        format="GIF",
        save_all=True,
        append_images=images[1:],
        duration=1,
    )

    return data.getvalue()


img = np.repeat(0, 10000).reshape(100, 100)
gif = create_gif(64, frames=32)


@st.experimental_memo
def numpy_image():
    st.image(img, caption="Black Square with no output format specified", width=100)


numpy_image()
numpy_image()


@st.experimental_memo
def svg_image():
    st.image(
        """<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100">
        <clipPath id="clipCircle">
            <circle r="25" cx="25" cy="25"/>
        </clipPath>
        <image href="https://avatars.githubusercontent.com/karriebear" width="50" height="50" clip-path="url(#clipCircle)"/>
    </svg>
    """
    )


svg_image()
svg_image()


@st.experimental_memo
def gif_image():
    st.image(gif, width=100)


gif_image()
gif_image()


@st.experimental_memo
def url_image():
    st.image("https://avatars.githubusercontent.com/anoctopus", width=200)


url_image()
url_image()
