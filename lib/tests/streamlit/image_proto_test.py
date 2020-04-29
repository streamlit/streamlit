# Copyright 2018-2020 Streamlit Inc.
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

"""Unit test for image_proto."""

import pytest
from PIL import Image, ImageDraw
from parameterized import parameterized

from streamlit.errors import StreamlitAPIException
from tests import testutil
import cv2
import numpy as np

import streamlit as st


def create_image(size, format="RGB"):
    step = 1
    half = size / 2
    # Create a new image
    image = Image.new("RGB", (size, size))
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
    alpha = Image.new("L", image.size, "white")
    d = ImageDraw.Draw(alpha)
    d.pieslice(
        [(step * 3, step * 3), (size - step, size - step)],
        0,
        90,
        fill="black",
        outline=None,
        width=0,
    )
    image.putalpha(alpha)

    if format == "BGR":
        return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    else:
        return image


IMAGES = {
    "img_32_32_3_rgb": {
        "pil": create_image(32, "RGB"),
        "np": np.array(create_image(32, "RGB")),
    },
    "img_32_32_3_rgba": {
        "pil": create_image(32, "RGBA"),
        "np": np.array(create_image(32, "RGBA")),
    },
    "img_32_32_3_bgr": {
        "pil": create_image(32, "BGR"),
        "np": np.array(create_image(32, "BGR")),
    },
    "img_64_64_rgb": {
        "pil": Image.new("RGB", (64, 64), color="red"),
        "np": np.array(Image.new("RGB", (64, 64), color="red")),
    },
}


class ImageProtoTest(testutil.DeltaGeneratorTestCase):
    """Test streamlit.image_proto."""

    @parameterized.expand(
        [
            (IMAGES["img_32_32_3_rgb"]["np"], "png",),
            (IMAGES["img_32_32_3_bgr"]["np"], "png",),
            (IMAGES["img_64_64_rgb"]["np"], "jpeg",),
            (IMAGES["img_32_32_3_rgba"]["np"], "jpeg",),
        ]
    )
    def test_marshall_images(self, data_in, format):
        """Test streamlit.image_proto.marshall_images.
        Need to test the following:
        * if list
        * if not list (is rgb vs is bgr)
        * if captions is not list but image is
        * if captions length doesnt match image length
        * if the caption is set.
        * PIL Images
        * Numpy Arrays
        * Url
        * Path
        * Bytes
        """
        from streamlit.MediaFileManager import _calculate_file_id
        from streamlit.elements.image_proto import _np_array_to_bytes

        file_id = _calculate_file_id(
            _np_array_to_bytes(data_in, format=format), mimetype="image/" + format
        )

        st.image(data_in, format=format)
        imglist = self.get_delta_from_queue().new_element.imgs
        self.assertEqual(len(imglist.imgs), 1)
        self.assertTrue(imglist.imgs[0].url.startswith("/media"))
        self.assertTrue(file_id in imglist.imgs[0].url)

    def test_BytesIO_to_bytes(self):
        """Test streamlit.image_proto.BytesIO_to_bytes."""
        pass

    def test_verify_np_shape(self):
        """Test streamlit.image_proto.verify_np_shape.
        Need to test the following:
        * check shape not (2, 3)
        * check shape 3 but dims 1, 3, 4
        * if only one channel convert to just 2 dimensions.
        """
        with pytest.raises(StreamlitAPIException) as shape_exc:
            st.image(np.ndarray(shape=1))
        self.assertEqual(
            "Numpy shape has to be of length 2 or 3.", str(shape_exc.value)
        )

        with pytest.raises(StreamlitAPIException) as shape2_exc:
            st.image(np.ndarray(shape=(1, 2, 2)))
        self.assertEqual(
            "Channel can only be 1, 3, or 4 got 2. Shape is (1, 2, 2)",
            str(shape2_exc.value),
        )

    def test_clip_image(self):
        """Test streamlit.image_proto.clip_image.
        Need to test the following:
        * float
        * int
        * float with clipping
        * int  with clipping
        """
        pass
