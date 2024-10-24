from __future__ import annotations

import io
import os
import re
from enum import IntEnum
from typing import TYPE_CHECKING, Literal, Sequence, Union

import numpy as np
from PIL import Image, ImageFile
from typing_extensions import TypeAlias

from streamlit import runtime, url_util
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Image_pb2 import ImageList as ImageListProto
from streamlit.runtime import caching
from streamlit.type_util import NumpyShape

if TYPE_CHECKING:
    from typing import Any

    import numpy.typing as npt
    from PIL import GifImagePlugin

AtomicImage: TypeAlias = Union[
    "ImageFile.ImageFile",
    "Image.Image",
    "GifImagePlugin.GifImageFile",
    "npt.NDArray[Any]",
    io.BytesIO,
    str,
    bytes,
]

Channels: TypeAlias = Literal["RGB", "BGR"]
ImageFormat: TypeAlias = Literal["JPEG", "PNG", "GIF"]
ImageFormatOrAuto: TypeAlias = Literal[ImageFormat, "auto"]

MAXIMUM_CONTENT_WIDTH: int = 2 * 730

ImageOrImageList = Union[AtomicImage, Sequence[AtomicImage]]


class WidthBehavior(IntEnum):
    ORIGINAL = -1
    COLUMN = -2
    AUTO = -3
    MIN_IMAGE_OR_CONTAINER = -4
    MAX_IMAGE_OR_CONTAINER = -5


WidthBehavior.ORIGINAL.__doc__ = """Display the image at its original width"""
WidthBehavior.COLUMN.__doc__ = (
    """Display the image at the width of the column it's in."""
)
WidthBehavior.AUTO.__doc__ = """Display the image at its original width, unless it
would exceed the width of its column in which case clamp it to
its column width"""


def _image_may_have_alpha_channel(
    image: ImageFile.ImageFile | Image.Image | GifImagePlugin.GifImageFile,
) -> bool:
    return image.mode in ("RGBA", "LA", "P")


def _image_is_gif(
    image: ImageFile.ImageFile | Image.Image | GifImagePlugin.GifImageFile,
) -> bool:
    return image.format == "GIF"


def _validate_image_format_string(
    image_data: bytes | ImageFile.ImageFile | Image.Image | GifImagePlugin.GifImageFile,
    format: str,
) -> ImageFormat:
    format = format.upper()
    if format in {"JPEG", "PNG"}:
        return format
    if format == "JPG":
        return "JPEG"

    pil_image: ImageFile.ImageFile | Image.Image | GifImagePlugin.GifImageFile
    if isinstance(image_data, bytes):
        pil_image = Image.open(io.BytesIO(image_data))
    else:
        pil_image = image_data

    if _image_is_gif(pil_image):
        return "GIF"
    if _image_may_have_alpha_channel(pil_image):
        return "PNG"
    return "JPEG"


def _PIL_to_bytes(
    image: ImageFile.ImageFile | Image.Image | GifImagePlugin.GifImageFile,
    format: ImageFormat = "JPEG",
    quality: int = 100,
) -> bytes:
    tmp = io.BytesIO()
    if format == "JPEG" and _image_may_have_alpha_channel(image):
        image = image.convert("RGB")
    image.save(tmp, format=format, quality=quality)
    return tmp.getvalue()


def _BytesIO_to_bytes(data: io.BytesIO) -> bytes:
    data.seek(0)
    return data.getvalue()


def _np_array_to_bytes(array: npt.NDArray[Any], output_format: str = "JPEG") -> bytes:
    img = Image.fromarray(array.astype(np.uint8))
    format = _validate_image_format_string(img, output_format)
    return _PIL_to_bytes(img, format)


def _verify_np_shape(array: npt.NDArray[Any]) -> npt.NDArray[Any]:
    shape = array.shape
    if len(shape) not in (2, 3):
        raise StreamlitAPIException("Numpy shape has to be of length 2 or 3.")
    if len(shape) == 3 and shape[-1] not in (1, 3, 4):
        raise StreamlitAPIException(
            f"Channel can only be 1, 3, or 4 got {shape[-1]}. Shape is {shape}"
        )
    if len(shape) == 3 and shape[-1] == 1:
        array = array[:, :, 0]
    return array


def _get_image_format_mimetype(image_format: ImageFormat) -> str:
    return f"image/{image_format.lower()}"


def _ensure_image_size_and_format(
    image_data: bytes, width: int, image_format: ImageFormat
) -> bytes:
    pil_image = Image.open(io.BytesIO(image_data))
    actual_width, actual_height = pil_image.size

    if width < 0 and actual_width > MAXIMUM_CONTENT_WIDTH:
        width = MAXIMUM_CONTENT_WIDTH

    if width > 0 and actual_width > width:
        new_height = int(1.0 * actual_height * width / actual_width)
        pil_image = pil_image.resize((width, new_height), resample=Image.BILINEAR)
        return _PIL_to_bytes(pil_image, format=image_format, quality=90)

    if pil_image.format != image_format:
        return _PIL_to_bytes(pil_image, format=image_format, quality=90)

    return image_data


def _clip_image(image: npt.NDArray[Any], clamp: bool) -> npt.NDArray[Any]:
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
    image_data: bytes

    if isinstance(image, str):
        if not os.path.isfile(image) and url_util.is_url(
            image, allowed_schemas=("http", "https", "data")
        ):
            return image

        if image.endswith(".svg") and os.path.isfile(image):
            with open(image) as textfile:
                image = textfile.read()

        if re.search(r"(^\s?(<\?xml[\s\S]*<svg\s)|^\s?<svg\s|^\s?<svg>\s)", image):
            if "xmlns" not in image:
                image = image.replace(
                    "<svg", '<svg xmlns="http://www.w3.org/2000/svg" ', 1
                )
            import base64

            image_b64_encoded = base64.b64encode(image.encode("utf-8")).decode("utf-8")
            return f"data:image/svg+xml;base64,{image_b64_encoded}"

        try:
            with open(image, "rb") as f:
                image_data = f.read()
        except Exception:
            import mimetypes

            mimetype, _ = mimetypes.guess_type(image)
            if mimetype is None:
                mimetype = "application/octet-stream"
            url = runtime.get_instance().media_file_mgr.add(image, mimetype, image_id)
            caching.save_media_data(image, mimetype, image_id)
            return url

    elif isinstance(image, (ImageFile.ImageFile, Image.Image)):
        format = _validate_image_format_string(image, output_format)
        image_data = _PIL_to_bytes(image, format)

    elif isinstance(image, io.BytesIO):
        image_data = _BytesIO_to_bytes(image)

    elif isinstance(image, np.ndarray):
        image = _clip_image(
            _verify_np_shape(image),
            clamp,
        )

        if channels == "BGR":
            if len(image.shape) == 3:
                image = image[:, :, [2, 1, 0]]
            else:
                raise StreamlitAPIException(
                    'When using `channels="BGR"`, the input image should '
                    "have exactly 3 color channels"
                )

        image_data = _np_array_to_bytes(
            array=image,
            output_format=output_format,
        )

    else:
        image_data = image

    image_format = _validate_image_format_string(image_data, output_format)
    image_data = _ensure_image_size_and_format(image_data, width, image_format)
    mimetype = _get_image_format_mimetype(image_format)

    if runtime.exists():
        url = runtime.get_instance().media_file_mgr.add(image_data, mimetype, image_id)
        caching.save_media_data(image_data, mimetype, image_id)
        return url
    else:
        return ""


def marshall_images(
    coordinates: str,
    image: AtomicImage | Sequence[AtomicImage],
    caption: str | npt.NDArray[Any] | Sequence[str] | None,
    width: int | WidthBehavior,
    proto_imgs: ImageListProto,
    clamp: bool,
    channels: Channels = "RGB",
    output_format: ImageFormatOrAuto = "auto",
) -> None:
    if isinstance(image, (list, tuple)):
        images = image
    else:
        images = [image]

    if isinstance(caption, (list, tuple)):
        captions = caption
    else:
        if isinstance(caption, str) or caption is None:
            captions = [caption] * len(images)
        else:
            captions = caption

    assert len(images) == len(captions), "Cannot pair %d images with %d captions" % (
        len(images),
        len(captions),
    )

    for image, caption in zip(images, captions):
        proto_img = proto_imgs.imgs.add()
        proto_img.caption = str(caption or "")
        proto_img.width = int(width)

        if isinstance(image, NumpyShape):
            image = np.asarray(image)

        image_id = "%s-%d" % (coordinates, id(image))
        proto_img.url = image_to_url(
            image, width, clamp, channels, output_format, image_id
        )
