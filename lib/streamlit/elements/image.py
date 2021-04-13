# Copyright 2018-2021 Streamlit Inc.
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

import imghdr
import io
import mimetypes
from typing import cast
from urllib.parse import urlparse

import numpy as np
from PIL import Image, ImageFile

import streamlit
from streamlit import config
from streamlit.errors import StreamlitAPIException, StreamlitDeprecationWarning
from streamlit.logger import get_logger
from streamlit.media_file_manager import media_file_manager
from streamlit.proto.Image_pb2 import ImageList as ImageListProto

LOGGER = get_logger(__name__)

# This constant is related to the frontend maximum content width specified
# in App.jsx main container
# 730 is the max width of element-container in the frontend, and 2x is for high
# DPI.
MAXIMUM_CONTENT_WIDTH = 2 * 730


class ImageMixin:
    def image(
        self,
        image,
        caption=None,
        width=None,
        use_column_width=None,
        clamp=False,
        channels="RGB",
        output_format="auto",
    ):
        """Display an image or list of images.

        Parameters
        ----------
        image : numpy.ndarray, [numpy.ndarray], BytesIO, str, or [str]
            Monochrome image of shape (w,h) or (w,h,1)
            OR a color image of shape (w,h,3)
            OR an RGBA image of shape (w,h,4)
            OR a URL to fetch the image from
            OR a path of a local image file
            OR an SVG XML string like `<svg xmlns=...</svg>`
            OR a list of one of the above, to display multiple images.
        caption : str or list of str
            Image caption. If displaying multiple images, caption should be a
            list of captions (one for each image).
        width : int or None
            Image width. None means use the image width,
            but do not exceed the width of the column.
            Should be set for SVG images, as they have no default image width.
        use_column_width : 'auto' or 'always' or 'never' or bool
            If 'auto', set the image's width to its natural size,
            but do not exceed the width of the column.
            If 'always' or True, set the image's width to the column width.
            If 'never' or False, set the image's width to its natural size.
            Note: if set, `use_column_width` takes precedence over the `width` parameter.
        clamp : bool
            Clamp image pixel values to a valid range ([0-255] per channel).
            This is only meaningful for byte array images; the parameter is
            ignored for image URLs. If this is not set, and an image has an
            out-of-range value, an error will be thrown.
        channels : 'RGB' or 'BGR'
            If image is an nd.array, this parameter denotes the format used to
            represent color information. Defaults to 'RGB', meaning
            `image[:, :, 0]` is the red channel, `image[:, :, 1]` is green, and
            `image[:, :, 2]` is blue. For images coming from libraries like
            OpenCV you should set this to 'BGR', instead.
        output_format : 'JPEG', 'PNG', or 'auto'
            This parameter specifies the format to use when transferring the
            image data. Photos should use the JPEG format for lossy compression
            while diagrams should use the PNG format for lossless compression.
            Defaults to 'auto' which identifies the compression type based
            on the type and format of the image argument.

        Example
        -------
        >>> from PIL import Image
        >>> image = Image.open('sunrise.jpg')
        >>>
        >>> st.image(image, caption='Sunrise by the mountains')

        .. output::
           https://static.streamlit.io/0.61.0-yRE1/index.html?id=Sn228UQxBfKoE5C7A7Y2Qk
           height: 630px

        """

        if use_column_width == "auto" or (use_column_width is None and width is None):
            width = -3
        elif use_column_width == "always" or use_column_width == True:
            width = -2
        elif width is None:
            width = -1
        elif width <= 0:
            raise StreamlitAPIException("Image width must be positive.")

        image_list_proto = ImageListProto()
        marshall_images(
            self.dg._get_delta_path_str(),
            image,
            caption,
            width,
            image_list_proto,
            clamp,
            channels,
            output_format,
        )
        return self.dg._enqueue("imgs", image_list_proto)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)


def _image_has_alpha_channel(image):
    if image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    ):
        return True
    else:
        return False


def _format_from_image_type(image, output_format):
    output_format = output_format.upper()
    if output_format == "JPEG" or output_format == "PNG":
        return output_format

    # We are forgiving on the spelling of JPEG
    if output_format == "JPG":
        return "JPEG"

    if _image_has_alpha_channel(image):
        return "PNG"

    return "JPEG"


def _PIL_to_bytes(image, format="JPEG", quality=100):
    tmp = io.BytesIO()

    # User must have specified JPEG, so we must convert it
    if format == "JPEG" and _image_has_alpha_channel(image):
        image = image.convert("RGB")

    image.save(tmp, format=format, quality=quality)

    return tmp.getvalue()


def _BytesIO_to_bytes(data):
    data.seek(0)
    return data.getvalue()


def _np_array_to_bytes(array, output_format="JPEG"):
    img = Image.fromarray(array.astype(np.uint8))
    format = _format_from_image_type(img, output_format)

    return _PIL_to_bytes(img, format)


def _4d_to_list_3d(array):
    return [array[i, :, :, :] for i in range(0, array.shape[0])]


def _verify_np_shape(array):
    if len(array.shape) not in (2, 3):
        raise StreamlitAPIException("Numpy shape has to be of length 2 or 3.")
    if len(array.shape) == 3 and array.shape[-1] not in (1, 3, 4):
        raise StreamlitAPIException(
            "Channel can only be 1, 3, or 4 got %d. Shape is %s"
            % (array.shape[-1], str(array.shape))
        )

    # If there's only one channel, convert is to x, y
    if len(array.shape) == 3 and array.shape[-1] == 1:
        array = array[:, :, 0]

    return array


def _normalize_to_bytes(data, width, output_format):
    image = Image.open(io.BytesIO(data))
    actual_width, actual_height = image.size
    format = _format_from_image_type(image, output_format)
    if output_format.lower() == "auto":
        ext = imghdr.what(None, data)
        mimetype = mimetypes.guess_type("image.%s" % ext)[0]
    else:
        mimetype = "image/" + format.lower()

    if width < 0 and actual_width > MAXIMUM_CONTENT_WIDTH:
        width = MAXIMUM_CONTENT_WIDTH

    if width > 0 and actual_width > width:
        new_height = int(1.0 * actual_height * width / actual_width)
        image = image.resize((width, new_height))
        data = _PIL_to_bytes(image, format=format, quality=90)
        mimetype = "image/" + format.lower()

    return data, mimetype


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


def image_to_url(
    image, width, clamp, channels, output_format, image_id, allow_emoji=False
):
    # PIL Images
    if isinstance(image, ImageFile.ImageFile) or isinstance(image, Image.Image):
        format = _format_from_image_type(image, output_format)
        data = _PIL_to_bytes(image, format)

    # BytesIO
    # Note: This doesn't support SVG. We could convert to png (cairosvg.svg2png)
    # or just decode BytesIO to string and handle that way.
    elif isinstance(image, io.BytesIO):
        data = _BytesIO_to_bytes(image)

    # Numpy Arrays (ie opencv)
    elif type(image) is np.ndarray:
        data = _verify_np_shape(image)
        data = _clip_image(data, clamp)

        if channels == "BGR":
            if len(data.shape) == 3:
                data = data[:, :, [2, 1, 0]]
            else:
                raise StreamlitAPIException(
                    'When using `channels="BGR"`, the input image should '
                    "have exactly 3 color channels"
                )

        data = _np_array_to_bytes(data, output_format=output_format)

    # Strings
    elif isinstance(image, str):
        # If it's a url, then set the protobuf and continue
        try:
            p = urlparse(image)
            if p.scheme:
                return image
        except UnicodeDecodeError:
            pass

        # Finally, see if it's a file.
        try:
            with open(image, "rb") as f:
                data = f.read()
        except:
            if allow_emoji:
                # This might be an emoji string, so just pass it to the frontend
                return image
            else:
                # Allow OS filesystem errors to raise
                raise

    # Assume input in bytes.
    else:
        data = image

    (data, mimetype) = _normalize_to_bytes(data, width, output_format)
    this_file = media_file_manager.add(data, mimetype, image_id)
    return this_file.url


def marshall_images(
    coordinates,
    image,
    caption,
    width,
    proto_imgs,
    clamp,
    channels="RGB",
    output_format="auto",
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
        if isinstance(caption, str):
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
    # Each image in an image list needs to be kept track of at its own coordinates.
    for coord_suffix, (image, caption) in enumerate(zip(images, captions)):
        proto_img = proto_imgs.imgs.add()
        if caption is not None:
            proto_img.caption = str(caption)

        # We use the index of the image in the input image list to identify this image inside
        # MediaFileManager. For this, we just add the index to the image's "coordinates".
        image_id = "%s-%i" % (coordinates, coord_suffix)

        is_svg = False
        if isinstance(image, str):
            # Unpack local SVG image file to an SVG string
            if image.endswith(".svg"):
                with open(image) as textfile:
                    image = textfile.read()
            if image.strip().startswith("<svg"):
                proto_img.markup = f"data:image/svg+xml,{image}"
                is_svg = True
        if not is_svg:
            proto_img.url = image_to_url(
                image, width, clamp, channels, output_format, image_id
            )
