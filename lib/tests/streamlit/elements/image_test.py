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

import io
import random
from unittest import mock

import cv2
import numpy as np
import PIL.Image as Image
import pytest
from parameterized import parameterized
from PIL import ImageDraw

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
from tests.delta_generator_test_case import DeltaGeneratorTestCase


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


def create_gif(size):
    # Create grayscale image.
    im = Image.new("L", (size, size), "white")

    images = []

    # Make ten frames with the circle of a random size and location
    random.seed(0)
    for i in range(0, 10):
        frame = im.copy()
        draw = ImageDraw.Draw(frame)
        pos = (random.randrange(0, size), random.randrange(0, size))
        circle_size = random.randrange(10, size / 2)
        draw.ellipse([pos, tuple(p + circle_size for p in pos)], "black")
        images.append(frame.copy())

    # Save the frames as an animated GIF
    data = io.BytesIO()
    images[0].save(
        data,
        format="GIF",
        save_all=True,
        append_images=images[1:],
        duration=100,
        loop=0,
    )

    return data.getvalue()


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
    "gif_64_64": {
        "gif": create_gif(64),
    },
}


class ImageProtoTest(DeltaGeneratorTestCase):
    """Test streamlit.image."""

    @parameterized.expand(
        [
            (IMAGES["img_32_32_3_rgb"]["np"], "png"),
            (IMAGES["img_32_32_3_bgr"]["np"], "png"),
            (IMAGES["img_64_64_rgb"]["np"], "jpeg"),
            (IMAGES["img_32_32_3_rgba"]["np"], "jpeg"),
            (IMAGES["gif_64_64"]["gif"], "gif"),
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
        if isinstance(data_in, bytes):
            file_id = _calculate_file_id(data_in, mimetype=mimetype)
        else:
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
            (IMAGES["gif_64_64"]["gif"], ".gif"),
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
            (IMAGES["gif_64_64"]["gif"], "/media/"),
            ("https://streamlit.io/test.png", "https://streamlit.io/test.png"),
            ("https://streamlit.io/test.svg", "https://streamlit.io/test.svg"),
        ]
    )
    def test_image_to_url_prefix(self, img, expected_prefix):
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
            (IMAGES["img_32_32_3_rgb"]["np"], ".jpg"),
            (IMAGES["gif_64_64"]["gif"], ".gif"),
            ("https://streamlit.io/test.png", ".png"),
            ("https://streamlit.io/test.svg", ".svg"),
        ]
    )
    def test_image_to_url_suffix(self, img, expected_suffix):
        url = image.image_to_url(
            img,
            width=-1,
            clamp=False,
            channels="RGB",
            output_format="auto",
            image_id="blah",
        )
        self.assertTrue(url.endswith(expected_suffix))

    @parameterized.expand(
        [
            ("foo.png", "image/png", False),
            ("path/to/foo.jpg", "image/jpeg", False),
            ("path/to/foo.gif", "image/gif", False),
            ("foo.unknown_extension", "application/octet-stream", False),
            ("foo", "application/octet-stream", False),
            ("https://foo.png", "image/png", True),
            ("https://foo.gif", "image/gif", True),
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
        # Mock out save_image_data to avoid polluting the cache for later tests
        with mock.patch(
            "streamlit.runtime.media_file_manager.MediaFileManager.add"
        ) as mock_mfm_add, mock.patch("streamlit.runtime.caching.save_media_data"):
            mock_mfm_add.return_value = "https://mockoutputurl.com"

            result = image.image_to_url(
                input_string,
                width=-1,
                clamp=False,
                channels="RGB",
                output_format="auto",
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
            "http://server/fake1.png",
            "http://server/fake2.gif",
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
