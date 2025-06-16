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

from __future__ import annotations

import time

import pytest

from streamlit.elements.spinner import spinner
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class SpinnerTest(DeltaGeneratorTestCase):
    def test_spinner(self):
        """Test st.spinner."""
        with spinner("some text"):
            # Without the timeout, the spinner is sometimes not available
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_element
            assert el.spinner.text == "some text"
            assert not el.spinner.cache
        # Check if it gets reset to st.empty()
        last_delta = self.get_delta_from_queue()
        assert last_delta.HasField("new_element")
        assert last_delta.new_element.WhichOneof("type") == "empty"
        assert not el.spinner.show_time

    def test_spinner_within_chat_message(self):
        """Test st.spinner in st.chat_message resets to empty container block."""
        import streamlit as st

        with st.chat_message("user"), spinner("some text"):
            # Without the timeout, the spinner is sometimes not available
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_element
            assert el.spinner.text == "some text"
            assert not el.spinner.cache
        # Check that the element gets reset to an empty container block:
        last_delta = self.get_delta_from_queue()
        assert last_delta.HasField("add_block")
        # The block should have `allow_empty` set to false,
        # which means that it will be ignored on the frontend in case
        # it the container is empty. This is the desired behavior
        # for spinner
        assert not last_delta.add_block.allow_empty

    def test_spinner_for_caching(self):
        """Test st.spinner in cache functions."""
        with spinner("some text", _cache=True):
            # Without the timeout, the spinner is sometimes not available
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_element
            assert el.spinner.text == "some text"
            assert el.spinner.cache
        # Check if it gets reset to st.empty()
        last_delta = self.get_delta_from_queue()
        assert last_delta.HasField("new_element")
        assert last_delta.new_element.WhichOneof("type") == "empty"

    def test_spinner_time(self):
        """Test st.spinner with show_time."""
        with spinner("some text", show_time=True):
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_element
            assert el.spinner.text == "some text"
            assert el.spinner.show_time
        # Check if it gets reset to st.empty()
        last_delta = self.get_delta_from_queue()
        assert last_delta.HasField("new_element")
        assert last_delta.new_element.WhichOneof("type") == "empty"

    def test_spinner_with_width(self):
        """Test st.spinner with different width types."""
        test_cases = [
            (500, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 500),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for index, (
            width_value,
            expected_width_spec,
            field_name,
            field_value,
        ) in enumerate(test_cases):
            with self.subTest(width_value=width_value):
                with spinner(f"test text {index}", width=width_value):
                    time.sleep(0.7)
                    el = self.get_delta_from_queue().new_element
                    assert el.spinner.text == f"test text {index}"

                    assert (
                        el.width_config.WhichOneof("width_spec") == expected_width_spec
                    )
                    assert getattr(el.width_config, field_name) == field_value

    def test_spinner_with_invalid_width(self):
        """Test st.spinner with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Invalid width value: 'invalid'. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Invalid width value: -100. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Invalid width value: 0. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Invalid width value: 100.5. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    with spinner("test text", width=width_value):
                        time.sleep(0.1)
                assert str(exc.value) == expected_error_message

    def test_spinner_default_width(self):
        """Test that st.spinner defaults to content width."""
        with spinner("test text"):
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_element
            assert el.spinner.text == "test text"
            assert (
                el.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_CONTENT.value
            )
            assert el.width_config.use_content is True
