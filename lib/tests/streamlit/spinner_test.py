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

from __future__ import annotations

import time

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class SpinnerTest(DeltaGeneratorTestCase):
    def test_spinner(self):
        """Test st.spinner."""
        with st.spinner("some text"):
            # Without the timeout, the spinner is sometimes not available
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_transient.elements[0]
            assert el.spinner.text == "some text"
            assert not el.spinner.cache
        # Check if it gets reset to st.empty()
        last_delta = self.get_delta_from_queue()
        assert last_delta.HasField("new_transient")
        assert len(last_delta.new_transient.elements) == 0
        assert not el.spinner.show_time

    def test_spinner_for_caching(self):
        """Test st.spinner in cache functions."""
        with st.spinner("some text", _cache=True):
            # Without the timeout, the spinner is sometimes not available
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_transient.elements[0]
            assert el.spinner.text == "some text"
            assert el.spinner.cache
        # Check if it gets reset to st.empty()
        last_delta = self.get_delta_from_queue()
        assert last_delta.HasField("new_transient")
        assert len(last_delta.new_transient.elements) == 0

    def test_spinner_time(self):
        """Test st.spinner with show_time."""
        with st.spinner("some text", show_time=True):
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_transient.elements[0]
            assert el.spinner.text == "some text"
            assert el.spinner.show_time
        # Check if it gets reset to st.empty()
        last_delta = self.get_delta_from_queue()
        assert last_delta.HasField("new_transient")
        assert len(last_delta.new_transient.elements) == 0

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
                with st.spinner(f"test text {index}", width=width_value):
                    time.sleep(0.7)
                    el = self.get_delta_from_queue().new_transient.elements[0]
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
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    with st.spinner("test text", width=width_value):
                        time.sleep(0.1)
                assert expected_error_message in str(exc.value)

    def test_spinner_default_width(self):
        """Test that st.spinner defaults to content width."""
        with st.spinner("test text"):
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_transient.elements[0]
            assert el.spinner.text == "test text"
            assert (
                el.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_CONTENT.value
            )
            assert el.width_config.use_content is True
