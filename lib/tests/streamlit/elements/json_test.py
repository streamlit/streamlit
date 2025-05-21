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

import numpy as np
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitInvalidWidthError
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class StJsonAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_st_json(self):
        """Test st.json."""
        st.json('{"some": "json"}')

        el = self.get_delta_from_queue().new_element
        assert el.json.body == '{"some": "json"}'
        assert el.json.expanded is True
        assert el.json.HasField("max_expand_depth") is False
        assert (
            el.json.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.json.width_config.use_stretch is True

        # Test that an object containing non-json-friendly keys can still
        # be displayed.  Resultant json body will be missing those keys.

        n = np.array([1, 2, 3, 4, 5])
        data = {n[0]: "this key will not render as JSON", "array": n}
        st.json(data)

        el = self.get_delta_from_queue().new_element
        assert el.json.body == '{"array": "array([1, 2, 3, 4, 5])"}'
        assert (
            el.json.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.json.width_config.use_stretch is True

    def test_expanded_param(self):
        """Test expanded parameter for `st.json`"""
        st.json(
            {
                "level1": {"level2": {"level3": {"a": "b"}}, "c": "d"},
            },
            expanded=2,
        )

        el = self.get_delta_from_queue().new_element
        assert el.json.expanded is True
        assert el.json.max_expand_depth == 2
        assert (
            el.json.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.json.width_config.use_stretch is True

        with pytest.raises(TypeError):
            st.json(
                {
                    "level1": {"level2": {"level3": {"a": "b"}}, "c": "d"},
                },
                expanded=["foo"],  # type: ignore
            )

    def test_st_json_with_width_pixels(self):
        """Test st.json with width in pixels."""
        st.json('{"some": "json"}', width=500)

        el = self.get_delta_from_queue().new_element
        assert (
            el.json.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.json.width_config.pixel_width == 500

    def test_st_json_with_width_stretch(self):
        """Test st.json with stretch width."""
        st.json('{"some": "json"}', width="stretch")

        el = self.get_delta_from_queue().new_element
        assert (
            el.json.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.json.width_config.use_stretch is True

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_st_json_with_invalid_width(self, width):
        """Test st.json with invalid width values."""
        with pytest.raises(StreamlitInvalidWidthError) as e:
            st.json('{"some": "json"}', width=width)
        assert "Invalid width" in str(e.value)
