# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import unittest

import pytest

import streamlit as st
from streamlit.elements.iframe import marshall
from streamlit.errors import StreamlitAPIException
from streamlit.proto.IFrame_pb2 import IFrame as IFrameProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class IFrameTest(unittest.TestCase):
    def test_marshall_with_valid_tab_index_values(self):
        """Test that valid tab_index values are correctly marshalled."""
        test_cases = [None, -1, 0, 1, 100]

        for tab_index in test_cases:
            proto = IFrameProto()
            marshall(proto, src="https://example.com", tab_index=tab_index)

            if tab_index is not None:
                assert proto.tab_index == tab_index

    def test_marshall_with_invalid_tab_index_type(self):
        """Test that invalid tab_index types raise StreamlitAPIException."""
        invalid_values = ["0", 1.5, True, [], {}]

        for invalid_value in invalid_values:
            proto = IFrameProto()
            with pytest.raises(StreamlitAPIException):
                marshall(proto, src="https://example.com", tab_index=invalid_value)

    def test_marshall_with_invalid_tab_index_value(self):
        """Test that invalid tab_index values raise StreamlitAPIException."""
        invalid_values = [-2, -100]

        for invalid_value in invalid_values:
            proto = IFrameProto()
            with pytest.raises(StreamlitAPIException):
                marshall(proto, src="https://example.com", tab_index=invalid_value)

    def test_marshall_deprecated_fields_not_set(self):
        """Test that deprecated width, height, and has_width fields are not set on proto."""
        proto = IFrameProto()
        marshall(proto, src="https://example.com")

        # Basic fields should be set
        assert proto.src == "https://example.com"
        assert proto.scrolling is False

        # Deprecated fields should remain at default values
        assert proto.width == 0.0
        assert proto.height == 0.0
        assert proto.has_width is False


class IFrameComponentTest(DeltaGeneratorTestCase):
    """Test the streamlit.components.v1.iframe and html functions."""

    def test_iframe_no_width_uses_stretch_width_config(self):
        """Test that components.iframe without width uses 'stretch' in width_config."""
        st.components.v1.iframe("https://example.com")

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch is True
        assert element.height_config.pixel_height == 150

        assert element.iframe.src == "https://example.com"

    def test_iframe_with_width_uses_pixel_width_config(self):
        """Test that components.iframe with width uses pixel value in width_config."""
        st.components.v1.iframe("https://example.com", width=300, height=200)

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 300
        assert element.height_config.pixel_height == 200

        assert element.iframe.src == "https://example.com"

    def test_iframe_with_width_no_height_uses_default_height(self):
        """Test that components.iframe with width but no height uses default height."""
        st.components.v1.iframe("https://example.com", width=300)

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 300
        assert element.height_config.pixel_height == 150

        assert element.iframe.src == "https://example.com"

    def test_html_no_width_uses_stretch_width_config(self):
        """Test that components.html without width uses 'stretch' in width_config."""
        st.components.v1.html("<h1>Test</h1>")

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch is True
        assert element.height_config.pixel_height == 150

        assert element.iframe.srcdoc == "<h1>Test</h1>"

    def test_html_with_width_uses_pixel_width_config(self):
        """Test that components.html with width uses pixel value in width_config."""
        st.components.v1.html("<h1>Test</h1>", width=400, height=300)

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 400
        assert element.height_config.pixel_height == 300

        assert element.iframe.srcdoc == "<h1>Test</h1>"

    def test_iframe_with_zero_width_and_height(self):
        """Test that components.iframe accepts both width=0 and height=0."""
        st.components.v1.iframe("https://example.com", width=0, height=0)

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 0
        assert element.height_config.pixel_height == 0

        assert element.iframe.src == "https://example.com"

    def test_html_with_zero_width_and_height(self):
        """Test that components.html accepts both width=0 and height=0."""
        st.components.v1.html("<h1>Test</h1>", width=0, height=0)

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 0
        assert element.height_config.pixel_height == 0

        assert element.iframe.srcdoc == "<h1>Test</h1>"
