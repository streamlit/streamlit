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
import os
import re
from enum import IntEnum
from typing import TYPE_CHECKING, Final, Literal, Sequence, Union, cast

from typing_extensions import TypeAlias

from streamlit import runtime, url_util
from streamlit.deprecation_util import show_deprecation_warning
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Image_pb2 import ImageList as ImageListProto
from streamlit.runtime import caching
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
AtomicImage: TypeAlias = Union[PILImage, "npt.NDArray[Any]", io.BytesIO, str, bytes]
ImageOrImageList: TypeAlias = Union[AtomicImage, Sequence[AtomicImage]]
UseColumnWith: TypeAlias = Union[Literal["auto", "always", "never"], bool, None]
Channels: TypeAlias = Literal["RGB", "BGR"]
ImageFormat: TypeAlias = Literal["JPEG", "PNG", "GIF"]
ImageFormatOrAuto: TypeAlias = Literal[ImageFormat, "auto"]


# @see Image.proto
# @see WidthBehavior on the frontend
class WidthBehaviour(IntEnum):
    """
    Special values that are recognized by the frontend and allow us to change the
    behavior of the displayed image.
    """

    ORIGINAL = -1
    COLUMN = -2
    AUTO = -3
    MIN_IMAGE_OR_CONTAINER = -4
    MAX_IMAGE_OR_CONTAINER = -5


WidthBehaviour.ORIGINAL.__doc__ = """Display the image at its original width"""
WidthBehaviour.COLUMN.__doc__ = (
    """Display the image at the width of the column it's in."""
)
WidthBehaviour.AUTO.__doc__ = """Display the image at its original width, unless it
would exceed the width of its column in which case clamp it to
its column width"""


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
            WidthBehaviour.ORIGINAL if (width is None or width <= 0) else width
        )

        if use_column_width is not None:
            show_deprecation_warning(
                "The `use_column_width` parameter has been deprecated and will be removed "
                "in a future release. Please utilize the `use_container_width` parameter instead."
            )

            if use_column_width == "auto":
                image_width = WidthBehaviour.AUTO
            elif use_column_width == "always" or use_column_width is True:
                image_width = WidthBehaviour.COLUMN
            elif use_column_width == "never" or use_column_width is False:
                image_width = WidthBehaviour.ORIGINAL

        else:
            if use_container_width is True:
                image_width = WidthBehaviour.MAX_IMAGE_OR_CONTAINER
            elif image_width is not None and image_width > 0:
                # Use the given width. It will be capped on the frontend if it
                # exceeds the container width.
                pass
            elif use_container_width is False:
                image_width = WidthBehaviour.MIN_IMAGE_OR_CONTAINER

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


def _image_may_have_alpha_channel(image: PILImage) -> bool:
    return image.mode in ("RGBA", "LA", "P")


def _image_is_gif(image: PILImage) -> bool:
    return image.format == "GIF"


def _validate_image_format_string(
    image_data: bytes | PILImage, format: str
) -> ImageFormat:
    """Return either "JPEG", "PNG", or "GIF", based on the input `format` string.

    - If `format` is "JPEG" or "JPG" (or any capitalization thereof), return "JPEG"
    - If `format` is "PNG" (or any capitalization thereof), return "PNG"
    - For all other strings, return "PNG" if the image has an alpha channel,
    "GIF" if the image is a GIF, and "JPEG" otherwise.
    """
    format = format.upper()
    if format in {"JPEG", "PNG"}:
        return cast(ImageFormat, format)

    # We are forgiving on the spelling of JPEG
    if format == "JPG":
        return "JPEG"

    pil_image: PILImage
    if isinstance(image_data, bytes):
        from PIL import Image

        pil_image = Image.open(io.BytesIO(image_data))
    else:
        pil_image = image_data

    if _image_is_gif(pil_image):
        return "GIF"

    if _image_may_have_alpha_channel(pil_image):
        return "PNG"

    return "JPEG"


def _PIL_to_bytes(
    image: PILImage,
    format: ImageFormat = "JPEG",
    quality: int = 100,
) -> bytes:
    """Convert a PIL image to bytes."""
    tmp = io.BytesIO()

    # User must have specified JPEG, so we must convert it
    if format == "JPEG" and _image_may_have_alpha_channel(image):
        image = image.convert("RGB")

    image.save(tmp, format=format, quality=quality)

    return tmp.getvalue()


def _BytesIO_to_bytes(data: io.BytesIO) -> bytes:
    data.seek(0)
    return data.getvalue()


def _np_array_to_bytes(array: npt.NDArray[Any], output_format: str = "JPEG") -> bytes:
    import numpy as np
    from PIL import Image

    img = Image.fromarray(array.astype(np.uint8))
    format = _validate_image_format_string(img, output_format)

    return _PIL_to_bytes(img, format)


def _4d_to_list_3d(array: npt.NDArray[Any]) -> list[npt.NDArray[Any]]:
    return [array[i, :, :, :] for i in range(0, array.shape[0])]


def _verify_np_shape(array: npt.NDArray[Any]) -> npt.NDArray[Any]:
    shape: NumpyShape = array.shape
    if len(shape) not in (2, 3):
        raise StreamlitAPIException("Numpy shape has to be of length 2 or 3.")
    if len(shape) == 3 and shape[-1] not in (1, 3, 4):
        raise StreamlitAPIException(
            "Channel can only be 1, 3, or 4 got %d. Shape is %s"
            % (shape[-1], str(shape))
        )

    # If there's only one channel, convert is to x, y
    if len(shape) == 3 and shape[-1] == 1:
        array = array[:, :, 0]

    return array


def _get_image_format_mimetype(image_format: ImageFormat) -> str:
    """Get the mimetype string for the given ImageFormat."""
    return f"image/{image_format.lower()}"


def _ensure_image_size_and_format(
    image_data: bytes, width: int, image_format: ImageFormat
) -> bytes:
    """Resize an image if it exceeds the given width, or if exceeds
    MAXIMUM_CONTENT_WIDTH. Ensure the image's format corresponds to the given
    ImageFormat. Return the (possibly resized and reformatted) image bytes.
    """
    from PIL import Image

    pil_image: PILImage = Image.open(io.BytesIO(image_data))
    actual_width, actual_height = pil_image.size

    if width < 0 and actual_width > MAXIMUM_CONTENT_WIDTH:
        width = MAXIMUM_CONTENT_WIDTH

    if width > 0 and actual_width > width:
        # We need to resize the image.
        new_height = int(1.0 * actual_height * width / actual_width)
        # pillow reexports Image.Resampling.BILINEAR as Image.BILINEAR for backwards
        # compatibility reasons, so we use the reexport to support older pillow
        # versions. The types don't seem to reflect this, though, hence the type: ignore
        # below.
        pil_image = pil_image.resize((width, new_height), resample=Image.BILINEAR)  # type: ignore[attr-defined]
        return _PIL_to_bytes(pil_image, format=image_format, quality=90)

    if pil_image.format != image_format:
        # We need to reformat the image.
        return _PIL_to_bytes(pil_image, format=image_format, quality=90)

    # No resizing or reformatting necessary - return the original bytes.
    return image_data


def _clip_image(image: npt.NDArray[Any], clamp: bool) -> npt.NDArray[Any]:
    import numpy as np

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
    image: AtomicImage,
    width: int,
    clamp: bool,
    channels: Channels,
    output_format: ImageFormatOrAuto,
    image_id: str,
) -> str:
    """Return a URL that an image can be served from.
    If `image` is already a URL, return it unmodified.
    Otherwise, add the image to the MediaFileManager and return the URL.

    (When running in "raw" mode, we won't actually load data into the
    MediaFileManager, and we'll return an empty URL.)
    """
    import numpy as np
    from PIL import Image, ImageFile

    image_data: bytes

    # Strings
    if isinstance(image, str):
        if not os.path.isfile(image) and url_util.is_url(
            image, allowed_schemas=("http", "https", "data")
        ):
            # If it's a url, return it directly.
            return image

        if image.endswith(".svg") and os.path.isfile(image):
            # Unpack local SVG image file to an SVG string
            with open(image) as textfile:
                image = textfile.read()

        # Following regex allows svg image files to start either via a "<?xml...>" tag
        # eventually followed by a "<svg...>" tag or directly starting with a "<svg>" tag
        if re.search(r"(^\s?(<\?xml[\s\S]*<svg\s)|^\s?<svg\s|^\s?<svg>\s)", image):
            if "xmlns" not in image:
                # The xmlns attribute is required for SVGs to render in an img tag.
                # If it's not present, we add to the first SVG tag:
                image = image.replace(
                    "<svg", '<svg xmlns="http://www.w3.org/2000/svg" ', 1
                )
            # Convert to base64 to prevent issues with encoding:
            import base64

            image_b64_encoded = base64.b64encode(image.encode("utf-8")).decode("utf-8")
            # Return SVG as data URI:
            return f"data:image/svg+xml;base64,{image_b64_encoded}"

        # Otherwise, try to open it as a file.
        try:
            with open(image, "rb") as f:
                image_data = f.read()
        except Exception:
            # When we aren't able to open the image file, we still pass the path to
            # the MediaFileManager - its storage backend may have access to files
            # that Streamlit does not.
            import mimetypes

            mimetype, _ = mimetypes.guess_type(image)
            if mimetype is None:
                mimetype = "application/octet-stream"

            url = runtime.get_instance().media_file_mgr.add(image, mimetype, image_id)
            caching.save_media_data(image, mimetype, image_id)
            return url

    # PIL Images
    elif isinstance(image, (ImageFile.ImageFile, Image.Image)):
        format = _validate_image_format_string(image, output_format)
        image_data = _PIL_to_bytes(image, format)

    # BytesIO
    # Note: This doesn't support SVG. We could convert to png (cairosvg.svg2png)
    # or just decode BytesIO to string and handle that way.
    elif isinstance(image, io.BytesIO):
        image_data = _BytesIO_to_bytes(image)

    # Numpy Arrays (ie opencv)
    elif isinstance(image, np.ndarray):
        image = _clip_image(
            _verify_np_shape(image),
            clamp,
        )

        if channels == "BGR":
            if len(cast(NumpyShape, image.shape)) == 3:
                image = image[:, :, [2, 1, 0]]
            else:
                raise StreamlitAPIException(
                    'When using `channels="BGR"`, the input image should '
                    "have exactly 3 color channels"
                )

        # Depending on the version of numpy that the user has installed, the
        # typechecker may not be able to deduce that indexing into a
        # `npt.NDArray[Any]` returns a `npt.NDArray[Any]`, so we need to
        # ignore redundant casts below.
        image_data = _np_array_to_bytes(
            array=cast("npt.NDArray[Any]", image),  # type: ignore[redundant-cast]
            output_format=output_format,
        )

    # Raw bytes
    else:
        image_data = image

    # Determine the image's format, resize it, and get its mimetype
    image_format = _validate_image_format_string(image_data, output_format)
    image_data = _ensure_image_size_and_format(image_data, width, image_format)
    mimetype = _get_image_format_mimetype(image_format)

    if runtime.exists():
        url = runtime.get_instance().media_file_mgr.add(image_data, mimetype, image_id)
        caching.save_media_data(image_data, mimetype, image_id)
        return url
    else:
        # When running in "raw mode", we can't access the MediaFileManager.
        return ""


def marshall_images(
    coordinates: str,
    image: ImageOrImageList,
    caption: str | npt.NDArray[Any] | list[str] | None,
    width: int | WidthBehaviour,
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
        Negative values has some special. For details, see: `WidthBehaviour`
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
