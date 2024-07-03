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

import pathlib

import pytest
from PIL import Image

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.memory_media_file_storage import get_extension_for_mimetype
from streamlit.web.server.server import MEDIA_ENDPOINT
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class LogoTest(DeltaGeneratorTestCase):
    """Test st.logo"""

    def test_image(self):
        """Test that it can be called with image param only."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        st.logo(streamlit)

        c = self.get_message_from_queue().logo
        self.assertTrue(c.image.startswith(MEDIA_ENDPOINT))
        self.assertTrue(c.image.endswith(get_extension_for_mimetype("image/png")))
        self.assertEqual(c.link, "")
        self.assertEqual(c.icon_image, "")

    def test_image_and_link(self):
        """Test that it can be called with image & link."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        st.logo(streamlit, link="http://www.example.com")

        c = self.get_message_from_queue().logo
        self.assertTrue(c.image.startswith(MEDIA_ENDPOINT))
        self.assertTrue(c.image.endswith(get_extension_for_mimetype("image/png")))
        self.assertEqual(c.link, "http://www.example.com")
        self.assertEqual(c.icon_image, "")

    def test_invalid_link(self):
        """Test that it can be only be called with a valid link."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        with pytest.raises(StreamlitAPIException):
            st.logo(streamlit, link="www.example.com")

    def test_with_icon_image(self):
        """Test that it can be called with image & link."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        collapsed = Image.open(
            str(pathlib.Path(__file__).parent / "small-streamlit.png")
        )

        st.logo(streamlit, link="https://www.example.com", icon_image=collapsed)

        png_extension = get_extension_for_mimetype("image/png")

        c = self.get_message_from_queue().logo
        self.assertTrue(c.image.startswith(MEDIA_ENDPOINT))
        self.assertTrue(c.image.endswith(png_extension))
        self.assertEqual(c.link, "https://www.example.com")
        self.assertTrue(c.icon_image.startswith(MEDIA_ENDPOINT))
        self.assertTrue(c.image.endswith(png_extension))
