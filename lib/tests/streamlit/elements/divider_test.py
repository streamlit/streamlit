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

"""Divider unit test."""

from typing import Any

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import (
    StreamlitInvalidWidthError,
    StreamlitValueError,
    StreamlitValueOutOfRangeError,
)
from streamlit.proto.GapSize_pb2 import GapSize
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class DividerTest(DeltaGeneratorTestCase):
    """Test ability to marshall divider protos."""

    def test_divider(self):
        st.divider()

        c = self.get_delta_from_queue().new_element
        assert c.markdown.body == "---"
        assert not c.markdown.HasField("wrap")
        assert c.markdown.HasField("gap_config")
        assert c.markdown.gap_config.WhichOneof("gap_spec") == "gap_size"
        assert c.markdown.gap_config.gap_size == GapSize.MEDIUM

    @parameterized.expand(
        [
            (500, WidthConfigFields.PIXEL_WIDTH, 500),
            ("stretch", WidthConfigFields.USE_STRETCH, True),
            (None, WidthConfigFields.USE_STRETCH, True),
        ]
    )
    def test_divider_width(self, width_value, expected_field, expected_value):
        """Test divider width configurations."""
        if width_value is None:
            st.divider()
        else:
            st.divider(width=width_value)
        c = self.get_delta_from_queue().new_element
        assert c.markdown.body == "---"
        assert c.width_config.WhichOneof("width_spec") == expected_field.value
        if expected_field == WidthConfigFields.PIXEL_WIDTH:
            assert c.width_config.pixel_width == expected_value
        else:
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
    def test_divider_invalid_width(self, width_value):
        """Test that invalid width values raise an exception."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.divider(width=width_value)

    @parameterized.expand(
        [
            ("xxsmall", GapSize.XXSMALL),
            ("xsmall", GapSize.XSMALL),
            ("small", GapSize.SMALL),
            ("medium", GapSize.MEDIUM),
            ("large", GapSize.LARGE),
            ("xlarge", GapSize.XLARGE),
            ("xxlarge", GapSize.XXLARGE),
            ("Large", GapSize.LARGE),
            (None, GapSize.NONE),
        ]
    )
    def test_divider_gap_size(self, gap: str | None, expected: GapSize.ValueType):
        """Named sizes, mixed case, and None map to GapSize."""
        st.divider(gap=gap)  # type: ignore[arg-type]
        c = self.get_delta_from_queue().new_element
        assert c.markdown.gap_config.WhichOneof("gap_spec") == "gap_size"
        assert c.markdown.gap_config.gap_size == expected

    @parameterized.expand([(0,), (24,)])
    def test_divider_pixel_gap(self, gap: int):
        """Non-negative integer gaps map to pixel_gap."""
        st.divider(gap=gap)
        c = self.get_delta_from_queue().new_element
        assert c.markdown.gap_config.WhichOneof("gap_spec") == "pixel_gap"
        assert c.markdown.gap_config.pixel_gap == gap

    @parameterized.expand(
        [
            ("huge", StreamlitValueError),
            (-1, StreamlitValueError),
            (1.5, StreamlitValueError),
            (True, StreamlitValueError),
            (2**32, StreamlitValueOutOfRangeError),
        ]
    )
    def test_divider_invalid_gap(self, gap: Any, expected_error: type[Exception]):
        """Invalid gap values raise before anything is enqueued."""
        with pytest.raises(expected_error):
            st.divider(gap=gap)
        assert self.get_all_deltas_from_queue() == []

    def test_divider_width_and_gap(self):
        """Width and gap can be set together."""
        st.divider(gap="large", width=300)
        c = self.get_delta_from_queue().new_element
        assert c.markdown.gap_config.gap_size == GapSize.LARGE
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 300
