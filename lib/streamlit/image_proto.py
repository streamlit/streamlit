# -*- coding: future_fstrings -*-

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
LOGGER = get_logger()

def marshall_images(img, captions, width, proto_imgs):
    """
    Mashalls img and captions into a protobuf.ImageList.

    Args
    ----
    img: list of NumPy images or a buffer containing image bytes.
    captions: list of caption strings.
    width: the image width.
    proto_imgs: the ImageList proto to fill.
    """
    # Convert into cannonical form.
    if isinstance(img, BytesIO):
        img.seek(0)
        pil_img = Image.open(img)
        pil_imgs = [pil_img]
    else:
        numpy_imgs = np.array(img)
        numpy_imgs = convert_to_uint8(numpy_imgs)
        numpy_imgs = convert_to_4_color_channels(numpy_imgs)
        numpy_imgs = convert_imgs_to_list(numpy_imgs)
        pil_imgs = list(map(Image.fromarray, numpy_imgs))

    captions = convert_captions_to_list(captions, len(pil_imgs))

    # Load it into the protobuf.
    for (img, caption) in zip(pil_imgs, captions):
        img_bytes = BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes = img_bytes.getvalue()

        proto_img = proto_imgs.imgs.add()
        proto_img.base_64_png = base64.b64encode(img_bytes).decode('utf-8')
        proto_img.caption = caption

    # Assign the width parameter.
    proto_imgs.width = width

def convert_to_uint8(imgs):
    """
    Converts floating point image on the range [0,1] and integer images
    on the range [0,255] to uint8, clipping if necessary.
    """
    if issubclass(imgs.dtype.type, np.floating):
        imgs = (imgs * 255).astype(np.int32)
    assert issubclass(imgs.dtype.type, np.integer), 'Illegal image format.'
    return imgs.clip(0, 255).astype(np.uint8)

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
        raise RuntimeError(f'Illegal image array shape: {imgs.shape}')

def convert_captions_to_list(captions, n_imgs):
    """Canonicalize the caption format and ensure one caption per image."""
    if captions is None:
        captions = [''] * n_imgs
    elif isinstance(captions, string_types):
        captions = [captions] * n_imgs
    else:
        captions = list(map(str, captions))

    assert len(captions) == n_imgs, \
        f"Cannot pair {len(captions)} captions with {n_imgs} images."

    return captions
