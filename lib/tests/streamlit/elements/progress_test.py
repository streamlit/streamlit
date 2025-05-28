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

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class DeltaGeneratorProgressTest(DeltaGeneratorTestCase):
    """Test DeltaGenerator Progress."""

    def test_progress_int(self):
        """Test Progress with int values."""
        values = [0, 42, 100]
        for value in values:
            st.progress(value)

            element = self.get_delta_from_queue().new_element
            assert value == element.progress.value

    def test_progress_float(self):
        """Test Progress with float values."""
        values = [0.0, 0.42, 1.0]
        for value in values:
            st.progress(value)

            element = self.get_delta_from_queue().new_element
            assert int(value * 100) == element.progress.value

    def test_progress_bad_values(self):
        """Test Progress with bad values."""
        values = [-1, 101, -0.01, 1.01]
        for value in values:
            with pytest.raises(StreamlitAPIException):
                st.progress(value)

        with pytest.raises(StreamlitAPIException):
            st.progress("some string")

    def test_progress_text(self):
        """Test Progress with text."""
        text = "TEST_TEXT"
        st.progress(42, text=text)

        element = self.get_delta_from_queue().new_element
        assert text == element.progress.text

    def test_progress_with_text(self):
        """Test Progress with invalid type in text parameter."""
        text = object()
        with pytest.raises(StreamlitAPIException):
            st.progress(42, text=text)

    def test_progress_with_close_float(self):
        """Test Progress with float values close to 0.0 and 1.0"""
        values = [-0.0000000000021, 1.0000000000000013]
        for value in values:
            st.progress(value)
            element = self.get_delta_from_queue().new_element
            assert int(value * 100) == element.progress.value

    def test_progress_width(self):
        """Test Progress with width parameter."""
        st.progress(50, width="stretch")
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

        st.progress(50, width=500)
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 500

        st.progress(50)
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_progress_invalid_width(self, invalid_width):
        """Test Progress with invalid width values."""
        with pytest.raises(StreamlitAPIException) as ctx:
            st.progress(50, width=invalid_width)
        assert "Invalid width" in str(ctx.value)
