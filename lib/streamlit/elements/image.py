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

from typing import TYPE_CHECKING, Final, List, Literal, Optional, Sequence, Union, cast

from typing_extensions import TypeAlias

from streamlit.deprecation_util import show_deprecation_warning
from streamlit.elements.lib.image_utils import (
    AtomicImage,
    Channels,
    ImageFormatOrAuto,
    WidthBehavior,
    marshall_images,
)
from streamlit.proto.Image_pb2 import ImageList as ImageListProto
from streamlit.runtime.metrics_util import gather_metrics

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
        caption: Optional[str | List[str]] = None,
        width: Optional[int | WidthBehavior] = None,
        use_column_width: Optional[bool | str] = None,
        clamp: bool = False,
        channels: Channels = "RGB",
        output_format: ImageFormatOrAuto = "auto",
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

        if use_column_width is not None:
            show_deprecation_warning(
                "The `use_column_width` parameter has been deprecated and will be removed "
                "in a future release. Please utilize the `use_container_width` parameter instead."
            )

        image_list_proto = ImageListProto()
        marshall_images(
            self.dg._get_coordinates(),
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
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def _4d_to_list_3d(array: npt.NDArray[Any]) -> list[npt.NDArray[Any]]:
    return [array[i, :, :, :] for i in range(0, array.shape[0])]
