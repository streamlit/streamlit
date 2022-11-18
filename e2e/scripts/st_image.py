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


import streamlit as st

img = np.repeat(0, 10000).reshape(100, 100)
img800 = np.repeat(0, 640000).reshape(800, 800)
gif = create_gif(64, frames=32)

st.image(img, caption="Black Square as JPEG", output_format="JPEG", width=100)

st.image(img, caption="Black Square as PNG", output_format="PNG", width=100)

st.image(img, caption="Black Square with no output format specified", width=100)

transparent_img = np.zeros((100, 100, 4), dtype=np.uint8)
st.image(transparent_img, caption="Transparent Black Square", width=100)

col1, col2, col3 = st.columns(3)
col2.image(img)  # 100
col2.image(img, use_column_width="auto")  # 100

col2.image(img, use_column_width="never")  # 100
col2.image(img, use_column_width=False)  # 100

col2.image(img, use_column_width="always")  # column
col2.image(img, use_column_width=True)  # column

col2.image(img800, use_column_width="auto")  # column

st.image("""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100">
    <image href='https://avatars.githubusercontent.com/karriebear' width=50 height=50/>   
      </svg> """)
      
st.image(
    """<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100">
    <clipPath id="clipCircle">
        <circle r="25" cx="25" cy="25"/>
    </clipPath>
    <image href="https://avatars.githubusercontent.com/karriebear" width="50" height="50" clip-path="url(#clipCircle)"/>
</svg>
"""
)

st.image(
    """
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="500" height="100">
<text x="0" y="50">"I am a quote" - https://avatars.githubusercontent.com/karriebear</text>
</svg>
"""
)

st.image(
    """<?xml version="1.0" encoding="utf-8"?>
    <!-- Generator: Adobe Illustrator 17.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
    <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="500" height="100">
    <text x="0" y="50">"I am prefixed with some meta tags</text>
    </svg>
"""
)

st.image(gif, width=100)
st.image(create_gif(64), caption="Black Circle as GIF", width=100)
st.image(gif, caption="GIF as PNG", output_format="PNG", width=100)
