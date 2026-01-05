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

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitInvalidSizeError
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class SpaceTest(DeltaGeneratorTestCase):
    """Test ability to marshall space protos."""

    def test_space_default(self):
        """Test st.space() with default size."""
        st.space()

        c = self.get_delta_from_queue().new_element
        assert c.space is not None
        # Default is "small" = 0.75rem
        assert c.width_config.rem_width == 0.75
        assert c.height_config.rem_height == 0.75

    @parameterized.expand(
        [
            ("xxsmall", 0.25),
            ("xsmall", 0.5),
            ("small", 0.75),
            ("medium", 2.5),
            ("large", 4.25),
            ("xlarge", 6),
            ("xxlarge", 8),
        ]
    )
    def test_space_rem_sizes(self, size_name, expected_rem):
        """Test space with rem size literals."""
        st.space(size_name)
        c = self.get_delta_from_queue().new_element
        assert c.space is not None
        assert c.width_config.rem_width == expected_rem
        assert c.height_config.rem_height == expected_rem

    def test_space_stretch(self):
        """Test space with stretch size."""
        st.space("stretch")
        c = self.get_delta_from_queue().new_element
        assert c.space is not None
        assert c.width_config.use_stretch
        assert c.height_config.use_stretch

    @parameterized.expand(
        [
            100,
            50,
            1,
        ]
    )
    def test_space_pixel_sizes(self, pixel_value):
        """Test space with pixel sizes."""
        st.space(pixel_value)
        c = self.get_delta_from_queue().new_element
        assert c.space is not None
        assert c.width_config.pixel_width == pixel_value
        assert c.height_config.pixel_height == pixel_value

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,  # Floats not supported
            -50.5,
            None,
        ]
    )
    def test_space_invalid_sizes(self, invalid_size):
        """Test that invalid size values raise an exception."""
        with pytest.raises(StreamlitInvalidSizeError):
            st.space(invalid_size)
