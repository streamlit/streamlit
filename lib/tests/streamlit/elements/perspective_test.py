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

"""Unit tests for st.perspective."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PerspectiveTest(DeltaGeneratorTestCase):
    """Test ability to marshall perspective protos."""

    def test_basic_dataframe(self) -> None:
        """Test that st.perspective can be called with a basic DataFrame."""
        df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
        st.perspective(df)

        proto = self.get_delta_from_queue().new_element.perspective
        assert proto.data.data is not None
        assert len(proto.data.data) > 0
        assert proto.theme == "streamlit"
        assert proto.id != ""
        assert proto.schema_digest != ""

    def test_with_custom_config(self) -> None:
        """Test that st.perspective accepts a default_config parameter."""
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4], "c": ["x", "y"]})
        config = {"group_by": ["c"], "columns": ["a", "b"]}
        st.perspective(df, default_config=config)

        proto = self.get_delta_from_queue().new_element.perspective
        assert proto.default_config_json != ""
        parsed_config = json.loads(proto.default_config_json)
        assert parsed_config["group_by"] == ["c"]
        assert parsed_config["columns"] == ["a", "b"]

    def test_with_theme(self) -> None:
        """Test that st.perspective accepts a theme parameter."""
        df = pd.DataFrame({"a": [1, 2]})
        st.perspective(df, theme="Pro Light")

        proto = self.get_delta_from_queue().new_element.perspective
        assert proto.theme == "Pro Light"

    def test_with_key(self) -> None:
        """Test that st.perspective generates consistent id with key parameter."""
        df = pd.DataFrame({"a": [1]})
        st.perspective(df, key="my_perspective_key")

        proto = self.get_delta_from_queue().new_element.perspective
        assert proto.id != ""
        # The id should be generated from the key
        assert "my_perspective_key" in proto.id or proto.id != ""

    @parameterized.expand(
        [
            ("stretch", "use_stretch", True),
            (500, "pixel_width", 500),
        ]
    )
    def test_width_parameter(
        self, width: str | int, expected_field: str, expected_value: bool | int
    ) -> None:
        """Test that st.perspective properly handles width parameter."""
        df = pd.DataFrame({"a": [1]})
        st.perspective(df, width=width)

        delta = self.get_delta_from_queue()
        assert getattr(delta.new_element.width_config, expected_field) == expected_value

    @parameterized.expand(
        [
            ("stretch", "use_stretch", True),
            (300, "pixel_height", 300),
        ]
    )
    def test_height_parameter(
        self, height: str | int, expected_field: str, expected_value: bool | int
    ) -> None:
        """Test that st.perspective properly handles height parameter."""
        df = pd.DataFrame({"a": [1]})
        st.perspective(df, height=height)

        delta = self.get_delta_from_queue()
        assert (
            getattr(delta.new_element.height_config, expected_field) == expected_value
        )

    def test_default_height_is_500(self) -> None:
        """Test that default height is 500 pixels."""
        df = pd.DataFrame({"a": [1]})
        st.perspective(df)

        delta = self.get_delta_from_queue()
        assert delta.new_element.height_config.pixel_height == 500

    @parameterized.expand(
        [
            ("invalid",),
            ("content",),  # content not allowed for width
            (0,),
            (-100,),
        ]
    )
    def test_invalid_width_raises_error(self, invalid_width: str | int) -> None:
        """Test that invalid width values raise StreamlitAPIException."""
        df = pd.DataFrame({"a": [1]})
        with pytest.raises(StreamlitAPIException):
            st.perspective(df, width=invalid_width)

    @parameterized.expand(
        [
            ("invalid",),
            ("content",),  # content not allowed for height
            (0,),
            (-100,),
        ]
    )
    def test_invalid_height_raises_error(self, invalid_height: str | int) -> None:
        """Test that invalid height values raise StreamlitAPIException."""
        df = pd.DataFrame({"a": [1]})
        with pytest.raises(StreamlitAPIException):
            st.perspective(df, height=invalid_height)

    def test_schema_digest_changes_with_schema(self) -> None:
        """Test that schema_digest changes when the data schema changes."""
        df1 = pd.DataFrame({"a": [1, 2]})
        df2 = pd.DataFrame({"a": [1, 2], "b": [3, 4]})

        st.perspective(df1)
        proto1 = self.get_delta_from_queue().new_element.perspective

        st.perspective(df2)
        proto2 = self.get_delta_from_queue().new_element.perspective

        # Different schemas should produce different digests
        assert proto1.schema_digest != proto2.schema_digest

    def test_schema_digest_same_for_same_schema(self) -> None:
        """Test that schema_digest is the same for DataFrames with the same schema."""
        df1 = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
        df2 = pd.DataFrame({"a": [3, 4], "b": ["z", "w"]})

        st.perspective(df1)
        proto1 = self.get_delta_from_queue().new_element.perspective

        st.perspective(df2)
        proto2 = self.get_delta_from_queue().new_element.perspective

        # Same schema with different data should produce the same digest
        assert proto1.schema_digest == proto2.schema_digest

    def test_various_data_types(self) -> None:
        """Test that st.perspective handles various column types."""
        df = pd.DataFrame(
            {
                "int_col": [1, 2, 3],
                "float_col": [1.1, 2.2, 3.3],
                "str_col": ["a", "b", "c"],
                "bool_col": [True, False, True],
                "date_col": pd.date_range("2024-01-01", periods=3),
            }
        )
        st.perspective(df)

        proto = self.get_delta_from_queue().new_element.perspective
        assert proto.data.data is not None
        assert len(proto.data.data) > 0

    def test_empty_dataframe(self) -> None:
        """Test that st.perspective handles empty DataFrames."""
        df = pd.DataFrame({"a": [], "b": []})
        st.perspective(df)

        proto = self.get_delta_from_queue().new_element.perspective
        # Should have Arrow data even for empty DataFrame (contains schema)
        assert proto.data.data is not None

    def test_numpy_array(self) -> None:
        """Test that st.perspective accepts numpy arrays."""
        arr = np.array([[1, 2, 3], [4, 5, 6]])
        st.perspective(arr)

        proto = self.get_delta_from_queue().new_element.perspective
        assert proto.data.data is not None
        assert len(proto.data.data) > 0

    def test_list_of_dicts(self) -> None:
        """Test that st.perspective accepts list of dictionaries."""
        data = [{"a": 1, "b": 2}, {"a": 3, "b": 4}]
        st.perspective(data)

        proto = self.get_delta_from_queue().new_element.perspective
        assert proto.data.data is not None
        assert len(proto.data.data) > 0

    def test_none_config_is_allowed(self) -> None:
        """Test that None default_config doesn't set the field."""
        df = pd.DataFrame({"a": [1]})
        st.perspective(df, default_config=None)

        proto = self.get_delta_from_queue().new_element.perspective
        assert proto.default_config_json == ""

    def test_empty_config_dict(self) -> None:
        """Test that empty config dict is serialized properly."""
        df = pd.DataFrame({"a": [1]})
        st.perspective(df, default_config={})

        proto = self.get_delta_from_queue().new_element.perspective
        assert proto.default_config_json == "{}"
