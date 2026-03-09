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

"""menu_button unit tests."""

from __future__ import annotations

from typing import Any

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.lib.options_selector_utils import create_mappings
from streamlit.elements.widgets.menu_button import MenuButtonSerde
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.Common_pb2 import StringTriggerValue
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class MenuButtonTest(DeltaGeneratorTestCase):
    """Test ability to marshall menu_button protos."""

    def test_just_label(self):
        """Test that it can be called with just label and options."""
        st.menu_button("the label", ["Option A", "Option B"])

        c = self.get_delta_from_queue().new_element.menu_button
        assert c.label == "the label"
        assert list(c.options) == ["Option A", "Option B"]
        assert c.type == "secondary"
        assert not c.disabled
        assert c.help == ""
        assert c.icon == ""

    def test_disabled(self):
        """Test that disabled param is set correctly."""
        st.menu_button("the label", ["Option A", "Option B"], disabled=True)

        c = self.get_delta_from_queue().new_element.menu_button
        assert c.disabled

    @parameterized.expand(["primary", "secondary", "tertiary"])
    def test_button_types(self, button_type: str):
        """Test that different button types are set correctly."""
        st.menu_button("the label", ["Option A"], type=button_type)

        c = self.get_delta_from_queue().new_element.menu_button
        assert c.type == button_type

    def test_invalid_type(self):
        """Test that invalid type raises an exception."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.menu_button("the label", ["Option A"], type="invalid")  # type: ignore[arg-type]
        assert "Invalid `type` value" in str(exc.value)

    def test_help_text(self):
        """Test that help text is set correctly."""
        st.menu_button("the label", ["Option A"], help="This is help text")

        c = self.get_delta_from_queue().new_element.menu_button
        assert c.help == "This is help text"

    def test_help_dedent(self):
        """Test that help text is dedented."""
        st.menu_button(
            "the label",
            ["Option A"],
            help="""
            This is help text
            with multiple lines
        """,
        )

        c = self.get_delta_from_queue().new_element.menu_button
        assert c.help == "\nThis is help text\nwith multiple lines\n"

    @parameterized.expand(
        [
            (":material/settings:", ":material/settings:"),
            ("🎉", "🎉"),
        ]
    )
    def test_icon(self, icon: str, expected: str):
        """Test that icons (material and emoji) are set correctly."""
        st.menu_button("the label", ["Option A"], icon=icon)

        c = self.get_delta_from_queue().new_element.menu_button
        assert c.icon == expected

    def test_format_func(self):
        """Test that format_func is applied to options."""
        options = [{"name": "john"}, {"name": "lisa"}]
        st.menu_button("the label", options, format_func=lambda x: x["name"])

        c = self.get_delta_from_queue().new_element.menu_button
        assert list(c.options) == ["john", "lisa"]

    def test_format_func_with_default_str(self):
        """Test that default format_func (str) works."""
        options = [1, 2, 3]
        st.menu_button("the label", options)

        c = self.get_delta_from_queue().new_element.menu_button
        assert list(c.options) == ["1", "2", "3"]

    def test_empty_options_raises(self):
        """Test that empty options raises an exception."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.menu_button("the label", [])
        assert "must contain at least one option" in str(exc.value)

    def test_duplicate_formatted_labels_raises(self):
        """Test that duplicate formatted labels raise an exception."""
        # Using format_func that produces duplicate labels
        options = [{"name": "same"}, {"name": "same"}]
        with pytest.raises(StreamlitAPIException) as exc:
            st.menu_button("the label", options, format_func=lambda x: x["name"])
        assert "duplicate labels" in str(exc.value)

    def test_form_raises(self):
        """Test that using menu_button inside a form raises an exception."""
        with pytest.raises(StreamlitAPIException) as exc:
            with st.form("test_form"):
                st.menu_button("the label", ["Option A"])
        assert "can't be used in an `st.form()`" in str(exc.value)

    @parameterized.expand(
        [
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            (200, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 200),
        ]
    )
    def test_width_config(
        self,
        width: str | int,
        expected_field: str,
        attr_name: str,
        expected_value: bool | int,
    ):
        """Test that width configurations are set correctly."""
        st.menu_button("the label", ["Option A"], width=width)

        c = self.get_delta_from_queue().new_element
        assert c.width_config.WhichOneof("width_spec") == expected_field
        assert getattr(c.width_config, attr_name) == expected_value

    def test_invalid_width(self):
        """Test that invalid width raises an exception."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.menu_button("the label", ["Option A"], width="invalid")  # type: ignore[arg-type]

    def test_options_from_different_iterables(self):
        """Test that options work with different iterable types."""
        # Tuple
        st.menu_button("tuple", ("A", "B"))
        c = self.get_delta_from_queue().new_element.menu_button
        assert list(c.options) == ["A", "B"]

        # Set (note: order may vary)
        st.menu_button("set", {"A", "B"})
        c = self.get_delta_from_queue().new_element.menu_button
        assert set(c.options) == {"A", "B"}

        # Generator
        st.menu_button("generator", (x for x in ["A", "B"]))
        c = self.get_delta_from_queue().new_element.menu_button
        assert list(c.options) == ["A", "B"]


class TestMenuButtonSerde:
    """Test MenuButtonSerde serialization/deserialization."""

    def test_serialize(self):
        """Test serializing a selected option."""
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MenuButtonSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        result = serde.serialize("Option A")
        assert isinstance(result, StringTriggerValue)
        assert result.data == "Option A"

    @pytest.mark.parametrize(
        ("value", "options"),
        [
            (None, ["Option A", "Option B"]),
            ("anything", []),
        ],
        ids=["none_value", "empty_options"],
    )
    def test_serialize_returns_empty_proto(self, value: str | None, options: list[str]):
        """Test that serialize returns empty proto for None value or empty options."""
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MenuButtonSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        result = serde.serialize(value)
        # Should return empty StringTriggerValue (no data field set)
        assert isinstance(result, StringTriggerValue)
        assert not result.HasField("data")

    def test_serialize_with_format_func(self):
        """Test serializing with a custom format_func."""
        options = [{"name": "john"}, {"name": "lisa"}]

        def format_func(x: dict[str, str]) -> str:
            return x["name"]

        formatted_options, formatted_option_to_option_index = create_mappings(
            options, format_func
        )
        serde = MenuButtonSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=format_func,
        )

        result = serde.serialize({"name": "john"})
        assert isinstance(result, StringTriggerValue)
        assert result.data == "john"

    def test_serialize_format_func_exception_fallback(self):
        """Test that serialize falls back to str() if format_func raises."""
        options = ["Option A", "Option B"]

        def bad_format_func(x: Any) -> str:
            raise ValueError("Format failed")

        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MenuButtonSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=bad_format_func,
        )

        result = serde.serialize("Option A")
        assert isinstance(result, StringTriggerValue)
        assert result.data == "Option A"

    def test_deserialize(self):
        """Test deserializing a UI value to the original option."""
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MenuButtonSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        result = serde.deserialize("Option B")
        assert result == "Option B"

    @pytest.mark.parametrize(
        ("ui_value", "options"),
        [
            (None, ["Option A", "Option B"]),
            ("something", []),
            ("Unknown Option", ["Option A", "Option B"]),
        ],
        ids=["none_value", "empty_options", "unknown_value"],
    )
    def test_deserialize_returns_none(self, ui_value: str | None, options: list[str]):
        """Test that deserialize returns None for None, empty options, or unknown values."""
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MenuButtonSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        assert serde.deserialize(ui_value) is None

    def test_deserialize_with_format_func(self):
        """Test deserializing returns the original object, not the formatted string."""
        options = [{"name": "john", "id": 1}, {"name": "lisa", "id": 2}]

        def format_func(x: dict[str, Any]) -> str:
            return x["name"]

        formatted_options, formatted_option_to_option_index = create_mappings(
            options, format_func
        )
        serde = MenuButtonSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=format_func,
        )

        result = serde.deserialize("john")
        assert result == {"name": "john", "id": 1}

    def test_deserialize_numeric_options(self):
        """Test deserializing numeric options returns the original type."""
        options = [1, 2, 3]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MenuButtonSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        result = serde.deserialize("2")
        assert result == 2
        assert isinstance(result, int)
