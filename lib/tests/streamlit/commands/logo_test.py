# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
from streamlit.commands.logo import _invalid_logo_text
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
        assert c.image.startswith(MEDIA_ENDPOINT)
        assert c.image.endswith(get_extension_for_mimetype("image/png"))
        assert c.link == ""
        assert c.icon_image == ""
        assert c.size == "medium"

    def test_image_and_link(self):
        """Test that it can be called with image & link."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        st.logo(streamlit, link="http://www.example.com")

        c = self.get_message_from_queue().logo
        assert c.image.startswith(MEDIA_ENDPOINT)
        assert c.image.endswith(get_extension_for_mimetype("image/png"))
        assert c.link == "http://www.example.com"
        assert c.icon_image == ""
        assert c.size == "medium"

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
        assert c.image.startswith(MEDIA_ENDPOINT)
        assert c.image.endswith(png_extension)
        assert c.link == "https://www.example.com"
        assert c.icon_image.startswith(MEDIA_ENDPOINT)
        assert c.icon_image.endswith(png_extension)
        assert c.size == "medium"

    def test_small_image_size(self):
        """Test that it can be called with small image size."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        st.logo(streamlit, size="small")

        c = self.get_message_from_queue().logo
        assert c.image.startswith(MEDIA_ENDPOINT)
        assert c.image.endswith(get_extension_for_mimetype("image/png"))
        assert c.link == ""
        assert c.icon_image == ""
        assert c.size == "small"

    def test_large_image_size(self):
        """Test that it can be called with large image size."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        st.logo(streamlit, size="large")

        c = self.get_message_from_queue().logo
        assert c.image.startswith(MEDIA_ENDPOINT)
        assert c.image.endswith(get_extension_for_mimetype("image/png"))
        assert c.link == ""
        assert c.icon_image == ""
        assert c.size == "large"

    def test_invalid_image_size(self):
        """Test that it can be only be called with a valid image size."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        with pytest.raises(StreamlitAPIException):
            st.logo(streamlit, size="corgi")

    def test_material_icon(self):
        """Test that it can be called with a material icon."""
        st.logo(":material/home:")

        c = self.get_message_from_queue().logo
        assert c.image == ":material/home:"
        assert c.image_type == 2  # ICON
        assert c.link == ""
        assert c.icon_image == ""
        assert c.size == "medium"

    def test_emoji(self):
        """Test that it can be called with an emoji."""
        st.logo("🏠")

        c = self.get_message_from_queue().logo
        assert c.image == "🏠"
        assert c.image_type == 1  # EMOJI
        assert c.link == ""
        assert c.icon_image == ""
        assert c.size == "medium"

    def test_material_icon_with_link(self):
        """Test that material icons can be used with a link."""
        st.logo(":material/rocket_launch:", link="https://www.example.com")

        c = self.get_message_from_queue().logo
        assert c.image == ":material/rocket_launch:"
        assert c.image_type == 2  # ICON
        assert c.link == "https://www.example.com"
        assert c.size == "medium"

    def test_icon_with_icon_image(self):
        """Test that icon_image can also be a material icon."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        st.logo(streamlit, icon_image=":material/menu:")

        c = self.get_message_from_queue().logo
        assert c.image.startswith(MEDIA_ENDPOINT)
        assert c.image_type == 0  # IMAGE
        assert c.icon_image == ":material/menu:"
        assert c.icon_image_type == 2  # ICON
        assert c.size == "medium"

    def test_invalid_material_icon(self):
        """Test that invalid material icons raise an error."""
        with pytest.raises(StreamlitAPIException):
            st.logo(":material/not_a_real_icon_name:")

    def test_invalid_material_icon_in_icon_image(self):
        """Test that invalid material icons in icon_image raise an error."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        with pytest.raises(StreamlitAPIException):
            st.logo(streamlit, icon_image=":material/not_a_real_icon_name:")

    def test_emoji_as_icon_image(self):
        """Test that emoji can be used as icon_image."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        st.logo(streamlit, icon_image="🏠")

        c = self.get_message_from_queue().logo
        assert c.image.startswith(MEDIA_ENDPOINT)
        assert c.image_type == 0  # IMAGE
        assert c.icon_image == "🏠"
        assert c.icon_image_type == 1  # EMOJI

    def test_empty_string_raises_error(self):
        """Test that empty string raises an error."""
        with pytest.raises(StreamlitAPIException):
            st.logo("")

    def test_plain_text_raises_error(self):
        """Test that plain text (not emoji, not icon) raises an error."""
        with pytest.raises(StreamlitAPIException):
            st.logo("hello")

    def test_invalid_logo_text_returns_error_message(self):
        """Test _invalid_logo_text returns formatted error message."""
        result = _invalid_logo_text("image")
        assert "image passed to st.logo is invalid" in result
        assert "documentation" in result

        result = _invalid_logo_text("icon_image")
        assert "icon_image passed to st.logo is invalid" in result

    def test_invalid_image_raises_exception(self):
        """Test that invalid image input raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.logo("not_a_valid_image_path_that_does_not_exist.xyz")

        assert "image passed to st.logo is invalid" in str(exc.value)
        assert "documentation" in str(exc.value)

    def test_invalid_icon_image_raises_exception(self):
        """Test that invalid icon_image input raises StreamlitAPIException."""
        streamlit = Image.open(
            str(pathlib.Path(__file__).parent / "full-streamlit.png")
        )
        with pytest.raises(StreamlitAPIException) as exc:
            st.logo(streamlit, icon_image="not_a_valid_icon_path.xyz")

        assert "icon_image passed to st.logo is invalid" in str(exc.value)
        assert "documentation" in str(exc.value)
