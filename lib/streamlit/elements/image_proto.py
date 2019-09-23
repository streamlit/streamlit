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

"""Image marshalling."""

import base64
import io
import imghdr
import mimetypes

import numpy as np
import six

from PIL import Image, ImageFile
from streamlit.logger import get_logger
from urllib.parse import urlparse

LOGGER = get_logger(__name__)

# This constant is related to the frontend maximum content width specified
# in App.jsx main container
MAXIMUM_CONTENT_WIDTH = 610


def _PIL_to_bytes(image, format="JPEG", quality=100):
    format = format.upper()
    tmp = io.BytesIO()
    image.save(tmp, format=format, quality=quality)
    return tmp.getvalue()


def _BytesIO_to_bytes(data):
    data.seek(0)
    return data.getvalue()


def _np_array_to_bytes(array, format="JPEG"):
    tmp = io.BytesIO()
    img = Image.fromarray(array.astype(np.uint8))
    img.save(tmp, format=format)
    return tmp.getvalue()


def _4d_to_list_3d(array):
    return [array[i, :, :, :] for i in range(0, array.shape[0])]


def _verify_np_shape(array):
    if len(array.shape) not in (2, 3):
        raise RuntimeError("Numpy shape has to be of length 2 or 3.")
    if len(array.shape) == 3:
        assert array.shape[-1] in (1, 3, 4), (
            "Channel can only be 1, 3, or 4 got %d. Shape is %s"
            % (array.shape[-1], str(array.shape))
        )

    # If there's only one channel, convert is to x, y
    if len(array.shape) == 3 and array.shape[-1] == 1:
        array = array[:, :, 0]

    return array


def _bytes_to_b64(data, width, format):
    format = format.lower()
    ext = imghdr.what(None, data)

    if format is None:
        mime_type = mimetypes.guess_type("image.%s" % ext)[0]
    else:
        mime_type = "image/" + format

    image = Image.open(io.BytesIO(data))
    actual_width, actual_height = image.size

    if width < 0 and actual_width > MAXIMUM_CONTENT_WIDTH:
        width = MAXIMUM_CONTENT_WIDTH

    if width > 0:
        if actual_width > width:
            new_height = int(1.0 * actual_height * width / actual_width)
            image = image.resize((width, new_height))
            data = _PIL_to_bytes(image, format=format, quality=90)

            if format is None:
                mime_type = "image/png"
            else:
                mime_type = "image/" + format

    b64 = base64.b64encode(data).decode("utf-8")

    return b64, mime_type


def _clip_image(image, clamp):
    data = image
    if issubclass(image.dtype.type, np.floating):
        if clamp:
            data = np.clip(image, 0, 1.0)
        else:
            if np.amin(image) < 0.0 or np.amax(image) > 1.0:
                raise RuntimeError("Data is outside [0.0, 1.0] and clamp is not set.")
        data = data * 255
    else:
        if clamp:
            data = np.clip(image, 0, 255)
        else:
            if np.amin(image) < 0 or np.amax(image) > 255:
                raise RuntimeError("Data is outside [0, 255] and clamp is not set.")
    return data


def marshall_images(
    image, caption, width, proto_imgs, clamp, channels="RGB", format="JPEG"
):
    channels = channels.upper()

    # Turn single image and caption into one element list.
    if type(image) is list:
        images = image
    else:
        if type(image) == np.ndarray and len(image.shape) == 4:
            images = _4d_to_list_3d(image)
        else:
            images = [image]

    if type(caption) is list:
        captions = caption
    else:
        if isinstance(caption, six.string_types):
            captions = [caption]
        # You can pass in a 1-D Numpy array as captions.
        elif type(caption) == np.ndarray and len(caption.shape) == 1:
            captions = caption.tolist()
        # If there are no captions then make the captions list the same size
        # as the images list.
        elif caption is None:
            captions = [None] * len(images)
        else:
            captions = [str(caption)]

    assert type(captions) == list, "If image is a list then caption should be as well"
    assert len(captions) == len(images), "Cannot pair %d captions with %d images." % (
        len(captions),
        len(images),
    )

    proto_imgs.width = width
    for image, caption in zip(images, captions):
        proto_img = proto_imgs.imgs.add()
        if caption is not None:
            proto_img.caption = str(caption)

        # PIL Images
        if isinstance(image, ImageFile.ImageFile) or isinstance(image, Image.Image):
            data = _PIL_to_bytes(image, format)

        # BytesIO
        elif type(image) is io.BytesIO:
            data = _BytesIO_to_bytes(image)

        # Numpy Arrays (ie opencv)
        elif type(image) is np.ndarray:
            data = _verify_np_shape(image)
            data = _clip_image(data, clamp)

            if channels == "BGR":
                if len(data.shape) == 3:
                    data = data[:, :, [2, 1, 0]]
                else:
                    raise RuntimeError(
                        'When using `channels="BGR"`, the input image should '
                        "have exactly 3 color channels"
                    )

            data = _np_array_to_bytes(data, format=format)

        # Strings
        elif isinstance(image, six.string_types):
            # If it's a url, then set the protobuf and continue
            try:
                p = urlparse(image)
                if p.scheme:
                    proto_img.url = image
                    continue
            except UnicodeDecodeError:
                pass

            # If not, see if it's a file.
            try:
                # If file, open and continue.
                with open(image, "rb") as f:
                    data = f.read()
            # Ok, then it must be bytes inside a str. This happens with
            # Python2's version of open().
            except TypeError:
                data = image

        # By default, image payload is bytes
        else:
            data = image

        (b64, mime_type) = _bytes_to_b64(data, width, format)

        proto_img.data.base64 = b64
        proto_img.data.mime_type = mime_type
