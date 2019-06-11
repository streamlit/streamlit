"""Image marshalling."""
__copyright__ = 'Copyright 2019 Streamlit Inc. All rights reserved.'
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


def _PIL_to_png_bytes(image):
    tmp = io.BytesIO()
    image.save(tmp, format='PNG')
    return tmp.getvalue()


def _BytesIO_to_bytes(data):
    data.seek(0)
    return data.getvalue()


def _np_array_to_png_bytes(array):
    tmp = io.BytesIO()
    img = Image.fromarray(array.astype(np.uint8))
    img.save(tmp, format='PNG')
    return tmp.getvalue()


def _4d_to_list_3d(array):
    return [array[i,:,:,:] for i in range(0, array.shape[0])]

def _verify_np_shape(array):
    if len(array.shape) not in (2, 3):
        raise RuntimeError('Numpy shape has to be of length 2 or 3.')
    if len(array.shape) == 3:
        assert array.shape[-1] in (
            1, 3, 4), 'Channel can only be 1, 3, or 4 got %d. Shape is %s' % (
                array.shape[-1], str(array.shape))

    # If there's only one channel, convert is to x, y
    if len(array.shape) == 3 and array.shape[-1] == 1:
        array = array[:, :, 0]

    return array


def _bytes_to_b64(data, width):
    ext = imghdr.what(None, data)
    mime_type = mimetypes.guess_type('image.%s' % ext)[0]

    if width > 0:
        image = Image.open(io.BytesIO(data))
        w, h = image.size
        if w > width:
            image = image.resize((width, int(1.0 * h * width / w)))
            data = _PIL_to_png_bytes(image)
            mime_type = 'image/png'
    b64 = base64.b64encode(data).decode('utf-8')
    return (b64, mime_type)


def _clip_image(image, clamp):
    data = image
    if issubclass(image.dtype.type, np.floating):
        if clamp:
            data = np.clip(image, 0, 1.0)
        else:
            if np.amin(image) < 0.0 or np.amax(image) > 1.0:
                raise RuntimeError(
                    'Data is outside [0.0, 1.0] and clamp is not set.')
        data = data * 255
    else:
        if clamp:
            data = np.clip(image, 0, 255)
        else:
            if np.amin(image) < 0 or np.amax(image) > 255:
                raise RuntimeError(
                    'Data is outside [0, 255] and clamp is not set.')
    return data


def marshall_images(image, caption, width, proto_imgs, clamp):
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

    assert type(
        captions) == list, 'If image is a list then caption should be as well'
    assert len(captions) == len(
        images), 'Cannot pair %d captions with %d images.' % (len(captions),
                                                              len(images))

    proto_imgs.width = width
    for image, caption in zip(images, captions):
        proto_img = proto_imgs.imgs.add()
        if caption is not None:
            proto_img.caption = str(caption)

        # PIL Images
        if isinstance(image, ImageFile.ImageFile) or isinstance(
                image, Image.Image):
            data = _PIL_to_png_bytes(image)

        # BytesIO
        elif type(image) is io.BytesIO:
            data = _BytesIO_to_bytes(image)

        # Numpy Arrays (ie opencv)
        elif type(image) is np.ndarray:
            data = _verify_np_shape(image)
            data = _clip_image(data, clamp)
            data = _np_array_to_png_bytes(data)

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
                with open(image, 'rb') as f:
                    data = f.read()
            # Ok, then it must be bytes inside a str. This happens with
            # Python2's version of open().
            except TypeError:
                data = image

        # By default, image payload is bytes
        else:
            data = image

        (b64, mime_type) = _bytes_to_b64(data, width)

        proto_img.data.base64 = b64
        proto_img.data.mime_type = mime_type
