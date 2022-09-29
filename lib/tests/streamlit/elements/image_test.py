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

from unittest import mock

import PIL.Image as Image
import cv2
import numpy as np
import pytest
import xml.etree.ElementTree as ET
from PIL import ImageDraw
from parameterized import parameterized

import streamlit as st
import streamlit.elements.image as image
from streamlit.elements.image import _np_array_to_bytes, _PIL_to_bytes
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Image_pb2 import ImageList as ImageListProto
from streamlit.runtime.memory_media_file_storage import (
    _calculate_file_id,
    get_extension_for_mimetype,
)
from streamlit.web.server.server import MEDIA_ENDPOINT
from tests import testutil
from typing import Optional


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


class SvgTestCase:
    def __init__(
        self,
        image_markup: str,
        normalized_markup: str = "",
        can_be_rendered_as_img: bool = False,
        width_from_viewbox: Optional[str] = None,
    ):
        self.image_markup = image_markup
        self.normalized_markup = normalized_markup
        self.can_be_rendered_as_img = can_be_rendered_as_img
        self.width_from_viewbox = width_from_viewbox


SVG_TEST_CASES = [
    SvgTestCase(
        "<svg fake></svg>",
        '<svg fake xmlns="http://www.w3.org/2000/svg"></svg>',
        False,
        None,
    ),
    SvgTestCase(
        "<svg\nfake></svg>",
        '<svg\nfake xmlns="http://www.w3.org/2000/svg"></svg>',
        False,
        None,
    ),
    SvgTestCase(
        "\n<svg fake></svg>",
        '\n<svg fake xmlns="http://www.w3.org/2000/svg"></svg>',
        False,
        None,
    ),
    SvgTestCase(
        '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!-- Created with Inkscape (http://www.inkscape.org/) -->\n\n<svg\n fake></svg>',
        '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!-- Created with Inkscape (http://www.inkscape.org/) -->\n\n<svg\n fake xmlns="http://www.w3.org/2000/svg"></svg>',
        False,
        None,
    ),
    SvgTestCase(
        '<?xml version="1.0" encoding="utf-8"?><!-- Generator: Adobe Illustrator 17.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  --><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg fake></svg>',
        '<?xml version="1.0" encoding="utf-8"?><!-- Generator: Adobe Illustrator 17.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  --><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg fake xmlns="http://www.w3.org/2000/svg"></svg>',
        False,
        None,
    ),
    SvgTestCase(
        '\n<?xml version="1.0" encoding="utf-8"?>\n<!-- Generator: Adobe Illustrator 17.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg fake></svg>',
        '\n<?xml version="1.0" encoding="utf-8"?>\n<!-- Generator: Adobe Illustrator 17.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg fake xmlns="http://www.w3.org/2000/svg"></svg>',
        False,
        None,
    ),
    SvgTestCase(
        '<svg height="100" width="100"> <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" /></svg>',
        '<svg height="100" width="100" xmlns="http://www.w3.org/2000/svg"> <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" /></svg>',
        True,
        None,
    ),
    SvgTestCase(
        '<svg> <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" /></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"> <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" /></svg>',
        False,
        None,
    ),
    SvgTestCase(
        '<svg viewBox="{x} 0 100 90" xmlns="http://www.w3.org/2000/svg"> <rect x="0" y="0" width="100" height="90" fill="yellow" /> <rect x="100" y="0" width="100" height="90" fill="green" /> </svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} 0 100 90" width="100"> <rect x="0" y="0" width="100" height="90" fill="yellow" /> <rect x="100" y="0" width="100" height="90" fill="green" /> </svg>',
        True,
        "100",
    ),
    SvgTestCase(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100"> <clipPath id="clipCircle"> <circle r="25" cx="25" cy="25"/> </clipPath> <image href="https://avatars.githubusercontent.com/karriebear" width="50" height="50" clip-path="url(#clipCircle)"/> </svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100"> <clipPath id="clipCircle"> <circle r="25" cx="25" cy="25"/> </clipPath> <image href="https://avatars.githubusercontent.com/karriebear" width="50" height="50" clip-path="url(#clipCircle)"/> </svg>',
        False,
        None,
    ),
    SvgTestCase(
        '<svg viewBox="0 0 160 40" xmlns="http://www.w3.org/2000/svg"> <a xlink:href="https://developer.mozilla.org/"> <text x="10" y="25">MDN Web Docs</text> </a> </svg>',
        '<svg viewBox="0 0 160 40" xmlns="http://www.w3.org/2000/svg" width="160"> <a xlink:href="https://developer.mozilla.org/"> <text x="10" y="25">MDN Web Docs</text> </a> </svg>',
        False,
        "160",
    ),
    SvgTestCase(
        '<svg viewBox="0 0 160 40" xmlns="http://www.w3.org/2000/svg"> <a href="https://developer.mozilla.org/"> <text x="10" y="25">MDN Web Docs</text> </a> </svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40" width="160"> <a href="https://developer.mozilla.org/"> <text x="10" y="25">MDN Web Docs</text> </a> </svg>',
        True,
        "160",
    ),
]


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
    def test_marshall_images(self, data_in: image.AtomicImage, format: str):
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
        mimetype = f"image/{format}"
        file_id = _calculate_file_id(
            _np_array_to_bytes(data_in, output_format=format),
            mimetype=mimetype,
        )

        st.image(data_in, output_format=format)
        imglist = self.get_delta_from_queue().new_element.imgs
        self.assertEqual(len(imglist.imgs), 1)
        self.assertTrue(imglist.imgs[0].url.startswith(MEDIA_ENDPOINT))
        self.assertTrue(
            imglist.imgs[0].url.endswith(get_extension_for_mimetype(mimetype))
        )
        self.assertTrue(file_id in imglist.imgs[0].url)

    @parameterized.expand(
        [
            (IMAGES["img_32_32_3_rgb"]["np"], ".jpg"),
            (IMAGES["img_32_32_3_bgr"]["np"], ".jpg"),
            (IMAGES["img_64_64_rgb"]["np"], ".jpg"),
            (IMAGES["img_32_32_3_rgba"]["np"], ".png"),
            (IMAGES["img_32_32_3_rgb"]["pil"], ".jpg"),
            (IMAGES["img_32_32_3_bgr"]["pil"], ".jpg"),
            (IMAGES["img_64_64_rgb"]["pil"], ".jpg"),
            (IMAGES["img_32_32_3_rgba"]["pil"], ".png"),
        ]
    )
    def test_marshall_images_with_auto_output_format(
        self, data_in: image.AtomicImage, expected_extension: str
    ):
        """Test streamlit.image.marshall_images.
        with auto output_format
        """

        st.image(data_in, output_format="auto")
        imglist = self.get_delta_from_queue().new_element.imgs
        self.assertEqual(len(imglist.imgs), 1)
        self.assertTrue(imglist.imgs[0].url.endswith(expected_extension))

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
            ("foo.png", "image/png", False),
            ("path/to/foo.jpg", "image/jpeg", False),
            ("foo.unknown_extension", "application/octet-stream", False),
            ("foo", "application/octet-stream", False),
            ("https://foo.png", "image/png", True),
        ]
    )
    def test_image_to_url_adds_filenames_to_media_file_mgr(
        self, input_string: str, expected_mimetype: str, is_url: bool
    ):
        """if `image_to_url` is unable to open an image passed by name, it
        still passes the filename to MediaFileManager. (MediaFileManager may have a
        storage backend that's able to open the file, so it's up to the manager -
        and not image_to_url - to throw an error.)
        """
        with mock.patch(
            "streamlit.runtime.media_file_manager.MediaFileManager.add"
        ) as mock_mfm_add:
            mock_mfm_add.return_value = "https://mockoutputurl.com"

            result = image.image_to_url(
                input_string,
                width=-1,
                clamp=False,
                channels="RGB",
                output_format="JPEG",
                image_id="mock_image_id",
            )

            if is_url:
                # URLs should be returned as-is, and should not result in a call to
                # MediaFileManager.add
                self.assertEqual(input_string, result)
                mock_mfm_add.assert_not_called()
            else:
                # Other strings should be passed to MediaFileManager.add
                self.assertEqual("https://mockoutputurl.com", result)
                mock_mfm_add.assert_called_once_with(
                    input_string, expected_mimetype, "mock_image_id"
                )

    @parameterized.expand(
        [
            (svg_test_case.image_markup, svg_test_case.can_be_rendered_as_img)
            for svg_test_case in SVG_TEST_CASES
        ]
    )
    def test_check_if_svg_can_be_rendered_as_img(
        self, image_markup: str, expected_result: bool
    ):
        self.assertEqual(
            image._check_if_svg_can_be_rendered_as_img(image_markup), expected_result
        )

    @parameterized.expand(
        [
            (svg_test_case.image_markup, svg_test_case.width_from_viewbox)
            for svg_test_case in SVG_TEST_CASES
        ]
    )
    def test_get_svg_width(self, image_markup: str, expected_width: Optional[str]):
        if image._check_if_svg_can_be_rendered_as_img(image_markup):
            self.assertEqual(
                image._get_svg_width(ET.fromstring(image_markup)), expected_width
            )

    @parameterized.expand(
        [
            (svg_test_case.image_markup, svg_test_case.normalized_markup)
            for svg_test_case in SVG_TEST_CASES
        ]
    )
    def test_normalize_svg(self, image_markup: str, normalized_markup: str):
        if image._check_if_svg_can_be_rendered_as_img(image_markup):
            self.assertEqual(image._normalize_svg(image_markup), normalized_markup)

    @parameterized.expand(
        [(svg_test_case.image_markup,) for svg_test_case in SVG_TEST_CASES]
    )
    def test_marshall_svg(self, image_markup: str):
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
        expect = "data:image/svg+xml"
        if image._check_if_svg_can_be_rendered_as_img(image_markup):
            self.assertEqual(len(img.markup), 0)
            self.assertTrue(img.url.startswith(expect))
        else:
            self.assertTrue(img.markup.startswith(expect))

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
        media_file = self.media_file_storage.get_file(file_id)
        self.assertIsNotNone(media_file)
        self.assertEqual(media_file.mimetype, "image/png")
        self.assertEqual(self.media_file_storage.get_url(file_id), el.imgs.imgs[0].url)

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
            media_file = self.media_file_storage.get_file(file_id)
            self.assertIsNotNone(media_file)
            self.assertEqual(media_file.mimetype, "image/png")
            self.assertEqual(
                self.media_file_storage.get_url(file_id), el.imgs.imgs[idx].url
            )

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
