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

"""Unit tests for st.image and other image.py utility code."""

import PIL.Image as Image
import cv2
import numpy as np
import pytest
from PIL import ImageDraw
from parameterized import parameterized

import streamlit as st
import streamlit.elements.image as image
from streamlit.elements.image import _np_array_to_bytes, _PIL_to_bytes
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Image_pb2 import ImageList as ImageListProto
from streamlit.runtime.media_file_manager import (
    _calculate_file_id,
    media_file_manager,
)
from tests import testutil


def create_image(size, format="RGB", add_alpha=True):
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
    if add_alpha:
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
        "pil": create_image(32, "RGB", add_alpha=False),
        "np": np.array(create_image(32, "RGB", add_alpha=False)),
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
    """Test streamlit.image."""

    @parameterized.expand(
        [
            (IMAGES["img_32_32_3_rgb"]["np"], "png"),
            (IMAGES["img_32_32_3_bgr"]["np"], "png"),
            (IMAGES["img_64_64_rgb"]["np"], "jpeg"),
            (IMAGES["img_32_32_3_rgba"]["np"], "jpeg"),
        ]
    )
    def test_marshall_images(self, data_in, format):
        """Test streamlit.image.marshall_images.
        Need to test the following:
        * if list
        * if not list (is rgb vs is bgr)
        * if captions is not list but image is
        * if captions length doesn't match image length
        * if the caption is set.
        * PIL Images
        * Numpy Arrays
        * Url
        * Path
        * Bytes
        """
        file_id = _calculate_file_id(
            _np_array_to_bytes(data_in, output_format=format),
            mimetype="image/" + format,
        )

        st.image(data_in, output_format=format)
        imglist = self.get_delta_from_queue().new_element.imgs
        self.assertEqual(len(imglist.imgs), 1)
        self.assertTrue(imglist.imgs[0].url.startswith("/media"))
        self.assertTrue(imglist.imgs[0].url.endswith(f".{format}"))
        self.assertTrue(file_id in imglist.imgs[0].url)

    @parameterized.expand(
        [
            (IMAGES["img_32_32_3_rgb"]["np"], "jpeg"),
            (IMAGES["img_32_32_3_bgr"]["np"], "jpeg"),
            (IMAGES["img_64_64_rgb"]["np"], "jpeg"),
            (IMAGES["img_32_32_3_rgba"]["np"], "png"),
            (IMAGES["img_32_32_3_rgb"]["pil"], "jpeg"),
            (IMAGES["img_32_32_3_bgr"]["pil"], "jpeg"),
            (IMAGES["img_64_64_rgb"]["pil"], "jpeg"),
            (IMAGES["img_32_32_3_rgba"]["pil"], "png"),
        ]
    )
    def test_marshall_images_with_auto_output_format(self, data_in, expected_format):
        """Test streamlit.image.marshall_images.
        with auto output_format
        """

        st.image(data_in, output_format="auto")
        imglist = self.get_delta_from_queue().new_element.imgs
        self.assertEqual(len(imglist.imgs), 1)
        self.assertTrue(imglist.imgs[0].url.endswith(f".{expected_format}"))

    @parameterized.expand(
        [
            (IMAGES["img_32_32_3_rgb"]["np"], "/media/"),
            ("https://streamlit.io/test.png", "https://streamlit.io/test.png"),
            ("https://streamlit.io/test.svg", "https://streamlit.io/test.svg"),
        ]
    )
    def test_image_to_url(self, img, expected_prefix):
        url = image.image_to_url(
            img,
            width=-1,
            clamp=False,
            channels="RGB",
            output_format="JPEG",
            image_id="blah",
        )
        self.assertTrue(url.startswith(expected_prefix))

    @parameterized.expand(
        [
            ("<svg fake></svg>", "data:image/svg+xml,<svg fake></svg>"),
            ("<svg\nfake></svg>", "data:image/svg+xml,<svg\nfake></svg>"),
            ("\n<svg fake></svg>", "data:image/svg+xml,\n<svg fake></svg>"),
            (
                '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!-- Created with Inkscape (http://www.inkscape.org/) -->\n\n<svg\n fake></svg>',
                'data:image/svg+xml,<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!-- Created with Inkscape (http://www.inkscape.org/) -->\n\n<svg\n fake></svg>',
            ),
            (
                '<?xml version="1.0" encoding="utf-8"?><!-- Generator: Adobe Illustrator 17.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  --><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg fake></svg>',
                'data:image/svg+xml,<?xml version="1.0" encoding="utf-8"?><!-- Generator: Adobe Illustrator 17.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  --><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg fake></svg>',
            ),
            (
                '\n<?xml version="1.0" encoding="utf-8"?>\n<!-- Generator: Adobe Illustrator 17.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg fake></svg>',
                'data:image/svg+xml,\n<?xml version="1.0" encoding="utf-8"?>\n<!-- Generator: Adobe Illustrator 17.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg fake></svg>',
            ),
        ]
    )
    def test_marshall_svg(self, image_markup: str, expected_prefix: str):
        image_list_proto = ImageListProto()
        image.marshall_images(
            None,
            image_markup,
            None,
            0,
            image_list_proto,
            False,
        )
        img = image_list_proto.imgs[0]
        self.assertTrue(img.markup.startswith(expected_prefix))

    def test_BytesIO_to_bytes(self):
        """Test streamlit.image.BytesIO_to_bytes."""
        pass

    def test_verify_np_shape(self):
        """Test streamlit.image.verify_np_shape.
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
        """Test streamlit.image.clip_image.
        Need to test the following:
        * float
        * int
        * float with clipping
        * int  with clipping
        """
        pass

    @parameterized.expand([("P", True), ("RGBA", True), ("LA", True), ("RGB", False)])
    def test_image_may_have_alpha_channel(self, format: str, expected_alpha: bool):
        img = Image.new(format, (1, 1))
        self.assertEqual(image._image_may_have_alpha_channel(img), expected_alpha)

    def test_st_image_PIL_image(self):
        """Test st.image with PIL image."""
        img = Image.new("RGB", (64, 64), color="red")

        st.image(img, caption="some caption", width=100, output_format="PNG")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, 100)
        self.assertEqual(el.imgs.imgs[0].caption, "some caption")

        # locate resultant file in the file manager and check its metadata.
        file_id = _calculate_file_id(_PIL_to_bytes(img, format="PNG"), "image/png")
        self.assertTrue(file_id in media_file_manager)

        afile = media_file_manager.get(file_id)
        self.assertEqual(afile.mimetype, "image/png")
        self.assertEqual(afile.url, el.imgs.imgs[0].url)

    def test_st_image_PIL_array(self):
        """Test st.image with a PIL array."""
        imgs = [
            Image.new("RGB", (64, 64), color="red"),
            Image.new("RGB", (64, 64), color="blue"),
            Image.new("RGB", (64, 64), color="green"),
        ]

        st.image(
            imgs,
            caption=["some caption"] * 3,
            width=200,
            use_column_width=True,
            clamp=True,
            output_format="PNG",
        )

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, -2)

        # locate resultant file in the file manager and check its metadata.
        for idx in range(len(imgs)):
            file_id = _calculate_file_id(
                _PIL_to_bytes(imgs[idx], format="PNG"), "image/png"
            )
            self.assertEqual(el.imgs.imgs[idx].caption, "some caption")
            self.assertTrue(file_id in media_file_manager)
            afile = media_file_manager.get(file_id)
            self.assertEqual(afile.mimetype, "image/png")
            self.assertEqual(afile.url, el.imgs.imgs[idx].url)

    def test_st_image_with_single_url(self):
        """Test st.image with single url."""
        url = "http://server/fake0.jpg"

        st.image(url, caption="some caption", width=300)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, 300)
        self.assertEqual(el.imgs.imgs[0].caption, "some caption")
        self.assertEqual(el.imgs.imgs[0].url, url)

    def test_st_image_with_list_of_urls(self):
        """Test st.image with list of urls."""
        urls = [
            "http://server/fake0.jpg",
            "http://server/fake1.jpg",
            "http://server/fake2.jpg",
        ]
        st.image(urls, caption=["some caption"] * 3, width=300)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, 300)
        for idx, url in enumerate(urls):
            self.assertEqual(el.imgs.imgs[idx].caption, "some caption")
            self.assertEqual(el.imgs.imgs[idx].url, url)

    def test_st_image_bad_width(self):
        """Test st.image with bad width."""
        with self.assertRaises(StreamlitAPIException) as ctx:
            st.image("does/not/exist", width=-1234)

        self.assertTrue("Image width must be positive." in str(ctx.exception))
