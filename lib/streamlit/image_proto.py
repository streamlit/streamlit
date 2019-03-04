# Copyright 2018 Streamlit Inc. All rights reserved.

"""
Converts a numpy image array and list of caption to protobuf.ImageList.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import numpy as np
from io import BytesIO
import base64
from PIL import Image

# setup logging
from streamlit.logger import get_logger
LOGGER = get_logger(__name__)

# Imagelist types returned from _get_imagelist_and_type
IMAGE_TYPE_URL = 'image_type_url'
IMAGE_TYPE_BYTES = 'image_type_bytes'


def marshall_images(image_data, captions, width, proto_imgs, clamp):
    """
    Mashalls image_data and captions into a protobuf.ImageList.

    Parameters
    ----------
    image_data : numpy.ndarray, [numpy.ndarray], BytesIO, str, or [str]
        Monochrome image of shape (w,h) or (w,h,1)
        OR a color image of shape (w,h,3)
        OR an RGBA image of shape (w,h,4)
        OR a URL to fetch the image from
        OR a list of one of the above, to display multiple images.
    captions : str or list of str
        Image caption. If displaying multiple images, caption should be a
        list of captions (one for each image).
    width : int
        Image width. -1 means use the image width, -2 means use column width.
    clamp : bool
        Clamp image pixel values to a valid range ([0-255] per channel).
        This is only meaningful for byte array images; the parameter is
        ignored for image URLs. If this is not set, and an image has an
        out-of-range value, an error will be thrown.
    proto_imgs : ImageList
        The ImageList protobuf object to fill out
    """

    image_list, image_type = _get_imagelist_and_type(image_data, clamp)
    captions = convert_captions_to_list(captions, len(image_list))

    # Load images into the protobuf.
    for (image_data, caption) in zip(image_list, captions):
        proto_img = proto_imgs.imgs.add()
        proto_img.caption = caption

        if image_type == IMAGE_TYPE_URL:
            proto_img.url = image_data
        else:
            img_bytes = BytesIO()
            image_data.save(img_bytes, format='PNG')
            img_bytes = img_bytes.getvalue()
            proto_img.base_64_png = base64.b64encode(img_bytes).decode('utf-8')

    # Assign the width parameter.
    proto_imgs.width = width


def convert_to_uint8(imgs, clamp):
    """
    Converts floating point image on the range [0,1] and integer images
    on the range [0,255] to uint8.
    clamp - True if you want to clamp to range. Otherwise, throws an error.
    """
    def clamp_range(imgs, min, max, image_type):
        if clamp:
            return np.clip(imgs, min, max)
        elif np.amin(imgs) >= min and np.amax(imgs) <= max:
            return imgs
        elif np.amax(np.absolute(imgs)) > 200 and max <= 1.0:
            raise RuntimeError(
                '%(image_type)s images must be on the range %(min)s to '
                '%(max)s. Try dividing your image values by 255.0.' %
                {'image_type': image_type, 'min': min, 'max': max})
        else:
            raise RuntimeError(
                '%(image_type)s images must be on the range %(min)s to '
                '%(max)s. Use clamp=True to clamp the image to that range.' %
                {'image_type': image_type, 'min': min, 'max': max})

    if issubclass(imgs.dtype.type, np.floating):
        LOGGER.debug(
            'Expanding range of floating point image: clamp=%s', clamp)
        imgs = clamp_range(imgs, 0.0, 1.0, 'Floating point')
        imgs = imgs * 255
    elif issubclass(imgs.dtype.type, np.integer):
        LOGGER.debug('Clipping an integer-type image.')
        imgs = clamp_range(imgs, 0, 255, 'Integer-type')
    else:
        raise RuntimeError('Illegal image format: %s' % imgs.dtype)
    return imgs.astype(np.uint8)


def convert_to_4_color_channels(imgs):
    """Final dimension should be 3 for three color channels."""
    if imgs.shape[-1] == 4:
        return imgs
    elif imgs.shape[-1] == 3:
        alpha_channel = np.full(imgs.shape[:-1] + (1,), 255, dtype=np.uint8)
        return np.concatenate([imgs, alpha_channel], axis=len(imgs.shape)-1)
        # raise RuntimeError('Ok. Let us get out of here.')
    elif imgs.shape[-1] == 1:
        return convert_to_4_color_channels(imgs.reshape(imgs.shape[:-1]))
    else:
        imgs = np.array([imgs, imgs, imgs])
        if len(imgs.shape) == 3:
            return convert_to_4_color_channels(imgs.transpose((1, 2, 0)))
        elif len(imgs.shape) == 4:
            return convert_to_4_color_channels(imgs.transpose((1, 2, 3, 0)))
    raise RuntimeError('Array shape cannot be displayed as an image.')


def convert_imgs_to_list(imgs):
    """Convert single images into a length 1 array."""
    if len(imgs.shape) == 3:
        return [imgs]
    elif len(imgs.shape) == 4:
        return list(imgs)
    else:
        raise RuntimeError('Illegal image array shape: %s' % imgs.shape)


def convert_captions_to_list(captions, n_imgs):
    """Canonicalize the caption format and ensure one caption per image."""
    if captions is None:
        captions = [''] * n_imgs
    elif isinstance(captions, string_types):
        captions = [captions] * n_imgs
    else:
        captions = list(map(str, captions))

    assert len(captions) == n_imgs, \
        'Cannot pair %(len)s captions with %(n_imgs)s images.' % {
            'len': len(captions),
            'n_imgs': n_imgs,
        }

    return captions


def _get_imagelist_and_type(input, clamp):
    """
    Converts 'input' into a list of URL strings or a list of
    image byte arrays.

    Parameters
    ----------
    input : numpy.ndarray, list of numpy.ndarray, or BytesIO
        Monochrome image of shape (w,h) or (w,h,1)
        OR a color image of shape (w,h,3)
        OR an RGBA image of shape (w,h,4)
        OR a URL to fetch the image from
        OR a list of one of the above, to display multiple images.
    clamp : bool
        Clamp image pixel values to a valid range ([0-255] per channel).
        This is only meaningful for byte array images; the parameter is
        ignored for image URLs. If this is not set, and an image has an
        out-of-range value, an error will be thrown.

    Returns
    -------
    (image_list, image_type) : A tuple containing a list of
    URL strings OR image byte arrays (suitable for sticking into an ImageList
    proto), and a constant indicating the images' type - either
    'image_type_url' or 'image_type_bytes'
    """
    if isinstance(input, str):
        # Input is a single URL - wrap it in a list.
        return [input], IMAGE_TYPE_URL
    elif isinstance(input, list) and len(input) > 0 and isinstance(input[0], str):
        # Input is a list of URLs
        return input, IMAGE_TYPE_URL
    else:
        if isinstance(input, BytesIO):
            input.seek(0)
            pil_img = Image.open(input)
            image_list = [pil_img]
        else:
            # extra map enables support for arrays of PIL images
            try:
                numpy_imgs = np.array(input)
            except TypeError:
                LOGGER.debug(
                    'Unable to convert %s directly to an array.',
                    type(input))
                numpy_imgs = np.array(list(map(np.array, input)))
            numpy_imgs = convert_to_uint8(numpy_imgs, clamp)
            numpy_imgs = convert_to_4_color_channels(numpy_imgs)
            numpy_imgs = convert_imgs_to_list(numpy_imgs)
            image_list = list(map(Image.fromarray, numpy_imgs))

        return image_list, IMAGE_TYPE_BYTES
