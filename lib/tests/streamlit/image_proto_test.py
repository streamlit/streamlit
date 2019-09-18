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

"""Unit test for image_proto."""

import pytest
from PIL import Image, ImageDraw
from parameterized import parameterized
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
        "base64": (
            "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAt0lEQVR4nO2W3Q6AI"
            "AiF0fX+r0w3rTkVAoFozXPTUsSPI/0UAEBI1AFGgjIb5BJ2C6ph77mequnmfQGkVj"
            "ZxfgDac0RPgNUmwogeUGoDbICfAEzfx7J1fg5oIa543yOQQjRx/j3wBFHG2/z/AV4"
            "IAm9X2/DzjyF219cB4sUA9FXHuJDtABIAVLX+LmQ6gASA8r/aqCwH7ioqMS5db9p8"
            "AhCugbwyc9pcSwsEHyOzWNIqiFnNjZLEJ9goJC2jsDvYAAAAAElFTkSuQmCC"
        ),
    },
    "img_32_32_3_rgba": {
        "pil": create_image(32, "RGBA"),
        "np": np.array(create_image(32, "RGBA")),
        "base64": (
            "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAt0lEQVR4nO2W3Q6AI"
            "AiF0fX+r0w3rTkVAoFozXPTUsSPI/0UAEBI1AFGgjIb5BJ2C6ph77mequnmfQGkVj"
            "ZxfgDac0RPgNUmwogeUGoDbICfAEzfx7J1fg5oIa543yOQQjRx/j3wBFHG2/z/AV4"
            "IAm9X2/DzjyF219cB4sUA9FXHuJDtABIAVLX+LmQ6gASA8r/aqCwH7ioqMS5db9p8"
            "AhCugbwyc9pcSwsEHyOzWNIqiFnNjZLEJ9goJC2jsDvYAAAAAElFTkSuQmCC"
        ),
    },
    "img_32_32_3_bgr": {
        "pil": create_image(32, "BGR"),
        "np": np.array(create_image(32, "BGR")),
        "base64": (
            "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAl0lEQVR4nO2WQRKAI"
            "AhFv97/zrTJsjL9gNTGt2iaxJ5AMwEEkwAAot9SaG6tQrL2ROO3X587BP20y6pVwB"
            "RVzAK+ZeLsAcESLEGbNA45Iq0ZMI4EuErUd5RVXw/eHHwNA1H9Ijr89JlKdQ0RTKQ"
            "hkJf7aYK53AXPIzuT+DYDYgrxCSI4BdyY4xAEsQvoOcoqiCNDN6ip2QDGkhkrdjjL"
            "bQAAAABJRU5ErkJggg=="
        ),
    },
    "img_64_64_rgb": {
        "pil": Image.new("RGB", (64, 64), color="red"),
        "np": np.array(Image.new("RGB", (64, 64), color="red")),
        "base64": (
            "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSE"
            "w8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQ"
            "wLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjI"
            "yMjIyMjIyMjIyMjL/wAARCABAAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAA"
            "AAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE"
            "1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRk"
            "dISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKW"
            "mp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3"
            "+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDB"
            "AcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNO"
            "El8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl"
            "6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU"
            "1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3EKKKK"
            "ACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKA"
            "CiiigAooooA//Z"
        ),
    },
}


class ImageProtoTest(testutil.DeltaGeneratorTestCase):
    """Test streamlit.image_proto."""

    @parameterized.expand(
        [
            (
                IMAGES["img_32_32_3_rgb"]["np"],
                IMAGES["img_32_32_3_rgb"]["base64"],
                "png",
            ),
            (
                IMAGES["img_32_32_3_bgr"]["np"],
                IMAGES["img_32_32_3_bgr"]["base64"],
                "png",
            ),
            (IMAGES["img_64_64_rgb"]["np"], IMAGES["img_64_64_rgb"]["base64"], "jpeg"),
            (
                IMAGES["img_32_32_3_rgba"]["np"],
                IMAGES["img_32_32_3_rgba"]["base64"],
                "jpeg",
            ),
        ]
    )
    def test_marshall_images(self, data_in, base64_out, format):
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
        st.image(data_in, format=format)
        imglist = self.get_delta_from_queue().new_element.imgs
        self.assertEqual(len(imglist.imgs), 1)
        self.assertEqual(imglist.imgs[0].data.base64, base64_out)
        self.assertEqual(imglist.imgs[0].data.mime_type, "image/" + format)

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
        with pytest.raises(RuntimeError) as shape_exc:
            st.image(np.ndarray(shape=1))
        assert "Numpy shape has to be of length 2 or 3." == str(shape_exc.value)

        with pytest.raises(AssertionError) as shape2_exc:
            st.image(np.ndarray(shape=(1, 2, 2)))
        assert "Channel can only be 1, 3, or 4 got 2. Shape is (1, 2, 2)" == str(
            shape2_exc.value
        )

    def test_bytes_to_b64(self):
        """Test streamlit.image_proto.bytes_to_b64.
        Need to test the following:
        * if width is greater then requested then shrink
        """
        pass

    def test_clip_image(self):
        """Test streamlit.image_proto.clip_image.
        Need to test the following:
        * float
        * int
        * float with clipping
        * int  with clipping
        """
        pass
