# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

# Some casts in this file are only occasionally necessary depending on the
# user's Python version, and mypy doesn't have a good way of toggling this
# specific config option at a per-line level.
# mypy: no-warn-unused-ignores

"""Image marshalling."""

from __future__ import annotations

import io
from typing import TYPE_CHECKING, Final, Literal, Sequence, Union, cast

from typing_extensions import TypeAlias

from streamlit.deprecation_util import show_deprecation_warning
from streamlit.elements.lib.image_utils import (
    AtomicImage,
    Channels,
    ImageFormatOrAuto,
    WidthBehavior,
    image_to_url,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Image_pb2 import ImageList as ImageListProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.type_util import NumpyShape

if TYPE_CHECKING:
    from typing import Any

    import numpy.typing as npt
    from PIL import GifImagePlugin, Image, ImageFile

    from streamlit.delta_generator import DeltaGenerator

# This constant is related to the frontend maximum content width specified
# in App.jsx main container
# 730 is the max width of element-container in the frontend, and 2x is for high
# DPI.
MAXIMUM_CONTENT_WIDTH: Final[int] = 2 * 730

PILImage: TypeAlias = Union[
    "ImageFile.ImageFile", "Image.Image", "GifImagePlugin.GifImageFile"
]
ImageOrImageList: TypeAlias = Union[AtomicImage, Sequence[AtomicImage]]
UseColumnWith: TypeAlias = Union[Literal["auto", "always", "never"], bool, None]


class ImageMixin:
    @gather_metrics("image")
    def image(
        self,
        image: ImageOrImageList,
        # TODO: Narrow type of caption, dependent on type of image,
        #  by way of overload
        caption: str | list[str] | None = None,
        width: int | None = None,
        use_column_width: UseColumnWith = None,
        clamp: bool = False,
        channels: Channels = "RGB",
        output_format: ImageFormatOrAuto = "auto",
        *,
        use_container_width: bool = False,
    ) -> DeltaGenerator:
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
        use_column_width : "auto", "always", "never", or bool
            If "auto", set the image's width to its natural size,
            but do not exceed the width of the column.
            If "always" or True, set the image's width to the column width.
            If "never" or False, set the image's width to its natural size.
            Note: if set, `use_column_width` takes precedence over the `width` parameter.
        .. deprecated::
            The `use_column_width` parameter has been deprecated and will be removed in a future release.
            Please utilize the `use_container_width` parameter instead.
        clamp : bool
            Clamp image pixel values to a valid range ([0-255] per channel).
            This is only meaningful for byte array images; the parameter is
            ignored for image URLs. If this is not set, and an image has an
            out-of-range value, an error will be thrown.
        channels : "RGB" or "BGR"
            If image is an nd.array, this parameter denotes the format used to
            represent color information. Defaults to "RGB", meaning
            `image[:, :, 0]` is the red channel, `image[:, :, 1]` is green, and
            `image[:, :, 2]` is blue. For images coming from libraries like
            OpenCV you should set this to "BGR", instead.
        output_format : "JPEG", "PNG", or "auto"
            This parameter specifies the format to use when transferring the
            image data. Photos should use the JPEG format for lossy compression
            while diagrams should use the PNG format for lossless compression.
            Defaults to "auto" which identifies the compression type based
            on the type and format of the image argument.
        use_container_width : bool
            Whether to override the figure's native width with the width of the
            parent container. If ``use_container_width`` is ``True``, Streamlit
            sets the width of the figure to match the width of the parent
            container. If ``use_container_width`` is ``False`` (default),
            Streamlit sets the width of the image to its natural width, up to
            the width of the parent container.
            Note: if `use_container_width` is set to `True`, it will take
            precedence over the `width` parameter

        Example
        -------
        >>> import streamlit as st
        >>> st.image("sunrise.jpg", caption="Sunrise by the mountains")

        .. output::
           https://doc-image.streamlit.app/
           height: 710px

        """

        if use_container_width is True and use_column_width is not None:
            raise StreamlitAPIException(
                "`use_container_width` and `use_column_width` cannot be set at the same time.",
                "Please utilize `use_container_width` since `use_column_width` is deprecated.",
            )

        image_width: int = (
            WidthBehavior.ORIGINAL if (width is None or width <= 0) else width
        )

        if use_column_width is not None:
            show_deprecation_warning(
                "The `use_column_width` parameter has been deprecated and will be removed "
                "in a future release. Please utilize the `use_container_width` parameter instead."
            )

            if use_column_width == "auto":
                image_width = WidthBehavior.AUTO
            elif use_column_width == "always" or use_column_width is True:
                image_width = WidthBehavior.COLUMN
            elif use_column_width == "never" or use_column_width is False:
                image_width = WidthBehavior.ORIGINAL

        else:
            if use_container_width is True:
                image_width = WidthBehavior.MAX_IMAGE_OR_CONTAINER
            elif image_width is not None and image_width > 0:
                # Use the given width. It will be capped on the frontend if it
                # exceeds the container width.
                pass
            elif use_container_width is False:
                image_width = WidthBehavior.MIN_IMAGE_OR_CONTAINER

        image_list_proto = ImageListProto()
        marshall_images(
            self.dg._get_delta_path_str(),
            image,
            caption,
            image_width,
            image_list_proto,
            clamp,
            channels,
            output_format,
        )
        return self.dg._enqueue("imgs", image_list_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)



def _4d_to_list_3d(array: npt.NDArray[Any]) -> list[npt.NDArray[Any]]:
    return [array[i, :, :, :] for i in range(0, array.shape[0])]


def marshall_images(
    coordinates: str,
    image: ImageOrImageList,
    caption: str | npt.NDArray[Any] | list[str] | None,
    width: int | WidthBehavior,
    proto_imgs: ImageListProto,
    clamp: bool,
    channels: Channels = "RGB",
    output_format: ImageFormatOrAuto = "auto",
) -> None:
    """Fill an ImageListProto with a list of images and their captions.

    The images will be resized and reformatted as necessary.

    Parameters
    ----------
    coordinates
        A string indentifying the images' location in the frontend.
    image
        The image or images to include in the ImageListProto.
    caption
        Image caption. If displaying multiple images, caption should be a
        list of captions (one for each image).
    width
        The desired width of the image or images. This parameter will be
        passed to the frontend.
        Positive values set the image width explicitly.
        Negative values has some special. For details, see: `WidthBehavior`
    proto_imgs
        The ImageListProto to fill in.
    clamp
        Clamp image pixel values to a valid range ([0-255] per channel).
        This is only meaningful for byte array images; the parameter is
        ignored for image URLs. If this is not set, and an image has an
        out-of-range value, an error will be thrown.
    channels
        If image is an nd.array, this parameter denotes the format used to
        represent color information. Defaults to 'RGB', meaning
        `image[:, :, 0]` is the red channel, `image[:, :, 1]` is green, and
        `image[:, :, 2]` is blue. For images coming from libraries like
        OpenCV you should set this to 'BGR', instead.
    output_format
        This parameter specifies the format to use when transferring the
        image data. Photos should use the JPEG format for lossy compression
        while diagrams should use the PNG format for lossless compression.
        Defaults to 'auto' which identifies the compression type based
        on the type and format of the image argument.
    """
    import numpy as np

    channels = cast(Channels, channels.upper())

    # Turn single image and caption into one element list.
    images: Sequence[AtomicImage]
    if isinstance(image, (list, set, tuple)):
        images = list(image)
    elif isinstance(image, np.ndarray) and len(cast(NumpyShape, image.shape)) == 4:
        images = _4d_to_list_3d(image)
    else:
        images = [image]  # type: ignore

    if isinstance(caption, list):
        captions: Sequence[str | None] = caption
    elif isinstance(caption, str):
        captions = [caption]
    elif isinstance(caption, np.ndarray) and len(cast(NumpyShape, caption.shape)) == 1:
        captions = caption.tolist()
    elif caption is None:
        captions = [None] * len(images)
    else:
        captions = [str(caption)]

    assert isinstance(
        captions, list
    ), "If image is a list then caption should be as well"
    assert len(captions) == len(images), "Cannot pair %d captions with %d images." % (
        len(captions),
        len(images),
    )

    proto_imgs.width = int(width)
    # Each image in an image list needs to be kept track of at its own coordinates.
    for coord_suffix, (image, caption) in enumerate(zip(images, captions)):
        proto_img = proto_imgs.imgs.add()
        if caption is not None:
            proto_img.caption = str(caption)

        # We use the index of the image in the input image list to identify this image inside
        # MediaFileManager. For this, we just add the index to the image's "coordinates".
        image_id = "%s-%i" % (coordinates, coord_suffix)

        proto_img.url = image_to_url(
            image, width, clamp, channels, output_format, image_id
        )
