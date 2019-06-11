"""Unit test for image_proto."""
__copyright__ = 'Copyright 2019 Streamlit Inc. All rights reserved.'
import unittest


class ImageProtoTest(unittest.TestCase):
    """Test streamlit.image_proto."""

    def test_PIL_to_png_bytes(self):
        """Test streamlit.image_proto.PIL_to_png_bytes."""
        pass

    def test_BytesIO_to_bytes(self):
        """Test streamlit.image_proto.BytesIO_to_bytes."""
        pass

    def test_np_array_to_png_bytes(self):
        """Test streamlit.image_proto.np_array_to_png_bytes."""
        pass

    def test_verify_np_shape(self):
        """Test streamlit.image_proto.verify_np_shape.

        Need to test the following:
        * check shape not (2, 3)
        * check shape 3 but dims 1, 3, 4
        * if only one channel convert to just 2 dimensions.
        """
        pass

    def test_bytes_to_b64(self):
        """Test streamlit.image_proto.bytes_to_b64.

        Need to test the following:
        * if width is greater then requested then shrink
        """
        pass

    def test_clip_image(self):
        """Test streamlit.image_proto.clip_image.

        Need to test the following:
        * float
        * int
        * float with clipping
        * int  with clipping
        """
        pass

    def test_marshall_images(self):
        """Test streamlit.image_proto.marshall_images.

        Need to test the following:
        * if list
        * if not list
        * if captions is not list but image is
        * if captions length doesnt match image length
        * if the caption is set.
        * PIL Images
        * BytesIO
        * Url
        * Path
        * Bytes
        """
        pass
