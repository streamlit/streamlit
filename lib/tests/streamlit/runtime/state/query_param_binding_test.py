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

"""Tests for widget-to-query-param binding functionality."""

from __future__ import annotations

from parameterized import parameterized

from streamlit.runtime.state.common import (
    QUERY_PARAM_KEY_PREFIX,
    extract_query_param_name,
    is_query_param_key,
)
from streamlit.runtime.state.query_params import (
    QueryParams,
    WidgetBinding,
)


def _int_serializer(x: int) -> str:
    """Serialize an integer to a string."""
    return str(x)


def _int_deserializer(x: str | list[str]) -> int:
    """Deserialize a string to an integer."""
    if isinstance(x, list):
        x = x[-1] if x else "0"
    return int(x)


class TestWidgetBinding:
    """Tests for the WidgetBinding dataclass."""

    def test_widget_binding_creation(self) -> None:
        """Test that WidgetBinding can be created with all required fields."""
        binding = WidgetBinding(
            widget_id="widget_123",
            param_key="my_param",
            serializer=_int_serializer,
            deserializer=_int_deserializer,
        )

        assert binding.widget_id == "widget_123"
        assert binding.param_key == "my_param"
        assert binding.serializer(42) == "42"
        assert binding.deserializer("42") == 42


class TestQueryParamsWidgetBindings:
    """Tests for widget binding methods in QueryParams."""

    def setup_method(self) -> None:
        """Set up test fixtures."""
        self.query_params = QueryParams()
        self.serializer = _int_serializer
        self.deserializer = _int_deserializer

    def test_bind_widget(self) -> None:
        """Test that bind_widget creates a binding."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )

        assert self.query_params.is_widget_bound("slider_1")
        binding = self.query_params.get_binding("slider_1")
        assert binding is not None
        assert binding.param_key == "count"
        assert binding.widget_id == "slider_1"

    def test_bind_widget_replaces_existing(self) -> None:
        """Test that binding a widget replaces any existing binding for that widget."""
        self.query_params.bind_widget(
            param_key="old_param",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )
        self.query_params.bind_widget(
            param_key="new_param",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )

        binding = self.query_params.get_binding("slider_1")
        assert binding is not None
        assert binding.param_key == "new_param"
        # Old param should no longer be bound
        assert self.query_params.get_binding_by_param("old_param") is None

    def test_bind_widget_ignores_embed_params(self) -> None:
        """Test that binding to embed params is silently ignored."""
        self.query_params.bind_widget(
            param_key="embed",
            widget_id="widget_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )
        self.query_params.bind_widget(
            param_key="embed_options",
            widget_id="widget_2",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )

        assert not self.query_params.is_widget_bound("widget_1")
        assert not self.query_params.is_widget_bound("widget_2")

    def test_unbind_widget(self) -> None:
        """Test that unbind_widget removes a binding."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )
        self.query_params.unbind_widget("slider_1")

        assert not self.query_params.is_widget_bound("slider_1")
        assert self.query_params.get_binding("slider_1") is None
        assert self.query_params.get_binding_by_param("count") is None

    def test_unbind_widget_nonexistent(self) -> None:
        """Test that unbinding a non-existent widget doesn't raise an error."""
        self.query_params.unbind_widget("nonexistent")  # Should not raise

    def test_get_binding(self) -> None:
        """Test get_binding returns the binding for a widget."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )

        binding = self.query_params.get_binding("slider_1")
        assert binding is not None
        assert binding.widget_id == "slider_1"
        assert binding.param_key == "count"

    def test_get_binding_nonexistent(self) -> None:
        """Test get_binding returns None for non-existent widget."""
        assert self.query_params.get_binding("nonexistent") is None

    def test_get_binding_by_param(self) -> None:
        """Test get_binding_by_param returns the binding for a param."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )

        binding = self.query_params.get_binding_by_param("count")
        assert binding is not None
        assert binding.widget_id == "slider_1"
        assert binding.param_key == "count"

    def test_get_binding_by_param_nonexistent(self) -> None:
        """Test get_binding_by_param returns None for non-existent param."""
        assert self.query_params.get_binding_by_param("nonexistent") is None

    def test_is_widget_bound(self) -> None:
        """Test is_widget_bound correctly identifies bound widgets."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )

        assert self.query_params.is_widget_bound("slider_1") is True
        assert self.query_params.is_widget_bound("slider_2") is False

    def test_get_bound_value_raw(self) -> None:
        """Test get_bound_value_raw returns raw query param value."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )
        self.query_params.set_with_no_forward_msg("count", "42")

        raw_value = self.query_params.get_bound_value_raw("slider_1")
        assert raw_value == "42"

    def test_get_bound_value_raw_list(self) -> None:
        """Test get_bound_value_raw returns list for multi-value params."""
        self.query_params.bind_widget(
            param_key="tags",
            widget_id="multiselect_1",
            serializer=lambda x: x,
            deserializer=lambda x: x,
        )
        self.query_params.set_with_no_forward_msg("tags", ["a", "b", "c"])

        raw_value = self.query_params.get_bound_value_raw("multiselect_1")
        assert raw_value == ["a", "b", "c"]

    def test_get_bound_value_raw_no_value(self) -> None:
        """Test get_bound_value_raw returns None when no value exists."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )

        raw_value = self.query_params.get_bound_value_raw("slider_1")
        assert raw_value is None

    def test_get_bound_value_raw_not_bound(self) -> None:
        """Test get_bound_value_raw returns None for unbound widget."""
        raw_value = self.query_params.get_bound_value_raw("nonexistent")
        assert raw_value is None

    def test_get_bound_value_deserialized(self) -> None:
        """Test get_bound_value returns deserialized value."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )
        self.query_params.set_with_no_forward_msg("count", "42")

        value = self.query_params.get_bound_value("slider_1")
        assert value == 42

    def test_get_bound_value_no_value(self) -> None:
        """Test get_bound_value returns None when no value exists."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )

        value = self.query_params.get_bound_value("slider_1")
        assert value is None

    def test_get_bound_value_not_bound(self) -> None:
        """Test get_bound_value returns None for unbound widget."""
        value = self.query_params.get_bound_value("nonexistent")
        assert value is None

    def test_set_from_widget_value(self) -> None:
        """Test set_from_widget_value serializes and sets the value."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )
        self.query_params.set_from_widget_value(
            widget_id="slider_1", value=42, send_msg=False
        )

        assert self.query_params._query_params["count"] == "42"

    def test_set_from_widget_value_not_bound(self) -> None:
        """Test set_from_widget_value does nothing for unbound widget."""
        self.query_params.set_from_widget_value(
            widget_id="nonexistent", value=42, send_msg=False
        )
        # Should not raise, and should not add anything
        assert "nonexistent" not in self.query_params._query_params

    def test_set_from_widget_value_ignores_embed(self) -> None:
        """Test set_from_widget_value ignores embed params."""
        # Manually set up a binding (bypassing the check in bind_widget)
        binding = WidgetBinding(
            widget_id="widget_1",
            param_key="embed",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )
        self.query_params._bindings_by_widget["widget_1"] = binding
        self.query_params._bindings_by_param["embed"] = binding

        self.query_params.set_from_widget_value(
            widget_id="widget_1", value="true", send_msg=False
        )

        # Value should not be set
        assert "embed" not in self.query_params._query_params

    def test_has_value_for_widget(self) -> None:
        """Test has_value_for_widget correctly identifies existing values."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )

        assert self.query_params.has_value_for_widget("slider_1") is False

        self.query_params.set_with_no_forward_msg("count", "42")
        assert self.query_params.has_value_for_widget("slider_1") is True

    def test_has_value_for_widget_not_bound(self) -> None:
        """Test has_value_for_widget returns False for unbound widget."""
        assert self.query_params.has_value_for_widget("nonexistent") is False

    def test_clear_bindings(self) -> None:
        """Test clear_bindings removes all bindings."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )
        self.query_params.bind_widget(
            param_key="name",
            widget_id="text_input_1",
            serializer=lambda x: x,
            deserializer=lambda x: x,
        )

        self.query_params.clear_bindings()

        assert not self.query_params.is_widget_bound("slider_1")
        assert not self.query_params.is_widget_bound("text_input_1")

    def test_remove_stale_bindings(self) -> None:
        """Test remove_stale_bindings removes bindings for inactive widgets."""
        self.query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=self.serializer,
            deserializer=self.deserializer,
        )
        self.query_params.bind_widget(
            param_key="name",
            widget_id="text_input_1",
            serializer=lambda x: x,
            deserializer=lambda x: x,
        )
        self.query_params.bind_widget(
            param_key="active",
            widget_id="checkbox_1",
            serializer=lambda x: str(x).lower(),
            deserializer=lambda x: x == "true",
        )

        # Only slider_1 and checkbox_1 are active
        active_ids = {"slider_1", "checkbox_1"}
        self.query_params.remove_stale_bindings(active_ids)

        assert self.query_params.is_widget_bound("slider_1")
        assert not self.query_params.is_widget_bound("text_input_1")
        assert self.query_params.is_widget_bound("checkbox_1")


class TestQueryParamsWidgetBindingsIntegration:
    """Integration tests for widget binding with serialization."""

    def test_round_trip_integer(self) -> None:
        """Test round-trip serialization of an integer value."""
        query_params = QueryParams()

        def serialize(x: int) -> str:
            return str(x)

        def deserialize(x: str | list[str]) -> int:
            if isinstance(x, list):
                x = x[-1] if x else "0"
            return int(x)

        query_params.bind_widget(
            param_key="count",
            widget_id="slider_1",
            serializer=serialize,
            deserializer=deserialize,
        )

        # Set value from widget
        query_params.set_from_widget_value("slider_1", 42, send_msg=False)

        # Get value back
        value = query_params.get_bound_value("slider_1")
        assert value == 42

    def test_round_trip_boolean(self) -> None:
        """Test round-trip serialization of a boolean value."""
        query_params = QueryParams()

        def serialize(x: bool) -> str:
            return "true" if x else "false"

        def deserialize(x: str | list[str]) -> bool:
            if isinstance(x, list):
                x = x[-1] if x else "false"
            return x.lower() == "true"

        query_params.bind_widget(
            param_key="enabled",
            widget_id="checkbox_1",
            serializer=serialize,
            deserializer=deserialize,
        )

        # Test True
        query_params.set_from_widget_value("checkbox_1", True, send_msg=False)
        assert query_params.get_bound_value("checkbox_1") is True
        assert query_params._query_params["enabled"] == "true"

        # Test False
        query_params.set_from_widget_value("checkbox_1", False, send_msg=False)
        assert query_params.get_bound_value("checkbox_1") is False
        assert query_params._query_params["enabled"] == "false"

    def test_round_trip_list(self) -> None:
        """Test round-trip serialization of a list value."""
        query_params = QueryParams()

        def serialize(x: list[str]) -> list[str]:
            return x

        def deserialize(x: str | list[str]) -> list[str]:
            if isinstance(x, str):
                return [x] if x else []
            return x

        query_params.bind_widget(
            param_key="tags",
            widget_id="multiselect_1",
            serializer=serialize,
            deserializer=deserialize,
        )

        # Set value from widget
        query_params.set_from_widget_value(
            "multiselect_1", ["red", "green", "blue"], send_msg=False
        )

        # Get value back
        value = query_params.get_bound_value("multiselect_1")
        assert value == ["red", "green", "blue"]

    @parameterized.expand(
        [
            ("float_value", 3.14159, "3.14159", 3.14159),
            ("negative_int", -42, "-42", -42),
            ("zero", 0, "0", 0),
        ]
    )
    def test_round_trip_numbers(
        self,
        _name: str,
        input_val: float | int,
        expected_serialized: str,
        expected_deserialized: float | int,
    ) -> None:
        """Test round-trip serialization of various number values."""
        query_params = QueryParams()

        def serialize(x: float | int) -> str:
            return str(x)

        def deserialize(x: str | list[str]) -> float:
            if isinstance(x, list):
                x = x[-1] if x else "0"
            return float(x)

        query_params.bind_widget(
            param_key="value",
            widget_id="number_input_1",
            serializer=serialize,
            deserializer=deserialize,
        )

        query_params.set_from_widget_value("number_input_1", input_val, send_msg=False)

        assert query_params._query_params["value"] == expected_serialized
        # Note: deserialized value might be float even if input was int
        assert query_params.get_bound_value("number_input_1") == expected_deserialized


class TestQueryParamKeyDetection:
    """Tests for the query param key detection helper functions."""

    @parameterized.expand(
        [
            ("query_param_key", "?enabled", True),
            ("query_param_key_long", "?my_long_param_name", True),
            ("regular_key", "enabled", False),
            ("empty_string", "", False),
            ("just_prefix", "?", True),  # Edge case: just the prefix
            ("underscore_prefix", "_enabled", False),
            ("hash_prefix", "#enabled", False),
        ]
    )
    def test_is_query_param_key(self, _name: str, key: str, expected: bool) -> None:
        """Test detection of query param keys based on the '?' prefix."""
        assert is_query_param_key(key) == expected

    def test_is_query_param_key_none(self) -> None:
        """Test that None returns False."""
        assert is_query_param_key(None) is False

    @parameterized.expand(
        [
            ("simple", "?enabled", "enabled"),
            ("long_name", "?my_long_param_name", "my_long_param_name"),
            ("with_underscore", "?my_param", "my_param"),
            ("just_prefix", "?", ""),  # Edge case: just the prefix
        ]
    )
    def test_extract_query_param_name(
        self, _name: str, key: str, expected: str
    ) -> None:
        """Test extraction of query param name from user key."""
        assert extract_query_param_name(key) == expected

    def test_query_param_key_prefix_constant(self) -> None:
        """Test that the prefix constant is '?'."""
        assert QUERY_PARAM_KEY_PREFIX == "?"
