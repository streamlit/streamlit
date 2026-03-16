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

"""Unit tests for st.json_editor."""

from __future__ import annotations

from collections import ChainMap
from typing import Any, NamedTuple

import pytest

import streamlit as st
from streamlit.elements.widgets.json_editor import JsonEditorSerde
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class TestJsonEditor(DeltaGeneratorTestCase):
    """Test st.json_editor."""

    def test_dict_input(self) -> None:
        """Test that dict input returns dict and serializes correctly."""
        value = {"name": "test", "count": 42, "active": True}
        st.json_editor(value)

        element = self.get_delta_from_queue().new_element.json_editor
        assert element.default == '{"name": "test", "count": 42, "active": true}'
        assert element.input_type == "dict"
        assert element.disabled is False
        assert element.height == 0

    def test_list_input(self) -> None:
        """Test that list input returns list and serializes correctly."""
        value = [1, 2, 3, "four"]
        st.json_editor(value)

        element = self.get_delta_from_queue().new_element.json_editor
        assert element.default == '[1, 2, 3, "four"]'
        assert element.input_type == "list"

    def test_string_input(self) -> None:
        """Test that valid JSON string input works."""
        value = '{"key": "value", "nested": {"a": 1}}'
        st.json_editor(value)

        element = self.get_delta_from_queue().new_element.json_editor
        assert element.default == value
        assert element.input_type == "string"

    def test_disabled_parameter(self) -> None:
        """Test that disabled parameter is set correctly."""
        st.json_editor({"key": "value"}, disabled=True)

        element = self.get_delta_from_queue().new_element.json_editor
        assert element.disabled is True

    def test_height_parameter(self) -> None:
        """Test that height parameter is set correctly."""
        st.json_editor({"key": "value"}, height=300)

        element = self.get_delta_from_queue().new_element.json_editor
        assert element.height == 300

    def test_empty_dict(self) -> None:
        """Test that empty dict works."""
        st.json_editor({})

        element = self.get_delta_from_queue().new_element.json_editor
        assert element.default == "{}"
        assert element.input_type == "dict"

    def test_empty_list(self) -> None:
        """Test that empty list works."""
        st.json_editor([])

        element = self.get_delta_from_queue().new_element.json_editor
        assert element.default == "[]"
        assert element.input_type == "list"

    def test_nested_structure(self) -> None:
        """Test that nested structures serialize correctly."""
        value = {
            "level1": {
                "level2": {
                    "level3": ["a", "b", "c"],
                },
            },
            "numbers": [1, 2, 3],
        }
        st.json_editor(value)

        element = self.get_delta_from_queue().new_element.json_editor
        assert '"level1"' in element.default
        assert '"level3"' in element.default
        assert element.input_type == "dict"

    def test_invalid_json_string_raises_error(self) -> None:
        """Test that invalid JSON string raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException) as exc_info:
            st.json_editor("not valid json")

        assert "not valid JSON" in str(exc_info.value)

    def test_tuple_input_converts_to_list(self) -> None:
        """Test that tuple input is converted to list."""
        value = (1, 2, 3)
        st.json_editor(value)

        element = self.get_delta_from_queue().new_element.json_editor
        assert element.default == "[1, 2, 3]"
        assert element.input_type == "list"

    def test_set_input_converts_to_list(self) -> None:
        """Test that set input is converted to list."""
        value = {1, 2, 3}
        st.json_editor(value)

        element = self.get_delta_from_queue().new_element.json_editor
        # Sets are unordered, so we just check it's a valid JSON array
        assert element.default.startswith("[")
        assert element.default.endswith("]")
        assert element.input_type == "list"

    def test_chainmap_input(self) -> None:
        """Test that ChainMap input is converted to dict."""
        value = ChainMap({"a": 1}, {"b": 2})
        st.json_editor(value)

        element = self.get_delta_from_queue().new_element.json_editor
        assert element.input_type == "dict"

    def test_namedtuple_input(self) -> None:
        """Test that namedtuple input is converted to dict."""

        class Point(NamedTuple):
            x: int
            y: int

        value = Point(10, 20)
        st.json_editor(value)

        element = self.get_delta_from_queue().new_element.json_editor
        assert element.input_type == "dict"
        assert '"x"' in element.default
        assert '"y"' in element.default

    def test_with_key(self) -> None:
        """Test that key parameter generates correct widget ID."""
        st.json_editor({"key": "value"}, key="my_json_editor")

        element = self.get_delta_from_queue().new_element.json_editor
        assert "my_json_editor" in element.id


class TestJsonEditorSerde:
    """Test JsonEditorSerde serialization/deserialization."""

    @pytest.mark.parametrize(
        ("default", "input_type", "value", "expected"),
        [
            ('{"default": true}', "dict", {"key": "value"}, '{"key": "value"}'),
            ("[]", "list", [1, 2, 3], "[1, 2, 3]"),
            ("{}", "string", '{"raw": "string"}', '{"raw": "string"}'),
        ],
        ids=["dict", "list", "string"],
    )
    def test_serialize(
        self,
        default: str,
        input_type: str,
        value: dict[str, Any] | list[Any] | str,
        expected: str,
    ) -> None:
        """Test that serialize converts values to JSON strings correctly."""
        serde = JsonEditorSerde(default=default, input_type=input_type)  # type: ignore[arg-type]
        assert serde.serialize(value) == expected

    @pytest.mark.parametrize(
        ("default", "input_type", "ui_value", "expected", "expected_type"),
        [
            ('{"default": true}', "dict", '{"key": "value"}', {"key": "value"}, dict),
            ("[]", "list", "[1, 2, 3]", [1, 2, 3], list),
            ("{}", "string", '{"key": "value"}', '{"key": "value"}', str),
        ],
        ids=["dict", "list", "string"],
    )
    def test_deserialize(
        self,
        default: str,
        input_type: str,
        ui_value: str,
        expected: dict[str, Any] | list[Any] | str,
        expected_type: type,
    ) -> None:
        """Test that deserialize converts JSON strings back to the correct type."""
        serde = JsonEditorSerde(default=default, input_type=input_type)  # type: ignore[arg-type]
        result = serde.deserialize(ui_value)
        assert result == expected
        assert isinstance(result, expected_type)

    @pytest.mark.parametrize(
        "ui_value",
        [None, ""],
        ids=["none", "empty_string"],
    )
    def test_deserialize_missing_uses_default(self, ui_value: str | None) -> None:
        """Test that None or empty string falls back to default."""
        serde = JsonEditorSerde(default='{"default": true}', input_type="dict")
        result = serde.deserialize(ui_value)
        assert result == {"default": True}
