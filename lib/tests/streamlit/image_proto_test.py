"""Unit test for image_proto.

Copyright 2018 Streamlit Inc. All rights reserved.
"""
import io
import unittest

import streamlit.image_proto as image_proto
import PIL.Image


class ImageProtoTest(unittest.TestCase):
    """Test streamlit.image_proto."""

    def test_marshall_images(self):
        """Test streamlit.image_proto.marshall_images.

        Need to test the following:
        * images
        * urls
        """
        pass

    def test_clamp_range(self):
        """Test streamlit.image_proto.convert_to_uint8.clamp_range.

        Need to test:
        * If clamp is set
        * If img min/max is within set min/max
        * If img min/max is outside min/max
        * If img max is greater than 200 but max is 1.0, ie normalize.
        * If none of the following happened.
        """
        pass

    def test_convert_to_uint8(self):
        """Test streamlit.image_proto.convert_to_uint8.

        Need to test:
        * If img is floating point ie [0.0, 1.0]
        * If img is integer ie [0, 255)
        * Neither
        """
        pass

    def test_convert_to_4_color_channels(self):
        """Test streamlit.image_proto.convert_to_4_color_channels.

        Need to test:
        * Image with 4 channels (RGB + A)
        * Image with 3 channels
        * Image with 1 channel (recursion)
        * Image with 0 channels ie pass in MxN
        """
        pass

    def test_convert_imgs_to_list(self):
        """Test streamlit.image_proto.convert_imgs_to_list.

        Need to test:
        * Shape is 3
        * Shape is 4
        * Shape is neither
        """
        pass

    def test_convert_captions_to_list(self):
        """Test streamlit.image_proto.convert_captions_to_list.

        Need to test:
        * No caption
        * caption is string type
        * caption is not a string type
        * len(captions) != len(images)
        """
        pass

    def test_get_imagelist_and_type(self):
        """Test streamlit.image_proto._get_imagelist_and_type."""
        # Test single URL
        ret = image_proto._get_imagelist_and_type('some_url', None)
        self.assertEqual(ret, (['some_url'], 'image_type_url'))

        # Test list of URLs
        urls = ['url0', 'url1', 'url2']
        ret = image_proto._get_imagelist_and_type(urls, None)
        self.assertEqual(ret, (urls, 'image_type_url'))

        # Test with single BytesIO image.
        img = PIL.Image.new('RGB', (64, 64), color = 'red')
        with io.BytesIO() as output:
            img.save(output, format="png")
            ([pil_image], image_type) = image_proto._get_imagelist_and_type(output, None)

            self.assertEqual(image_type, 'image_type_bytes')
            self.assertEqual(type(pil_image).__name__, 'PngImageFile')

        # TODO(armando): Test with single and array of PIL Images
