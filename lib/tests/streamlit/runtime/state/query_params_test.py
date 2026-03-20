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

from datetime import date, datetime, time, timezone

import pytest
from parameterized import parameterized

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state.query_params import (
    QueryParams,
    _set_item_in_dict,
    _try_parse_iso_to_micros,
    is_empty_url_value,
    parse_url_param,
    process_query_params,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase

QUERY_PARAMS_DICT_WITH_EMBED_KEY: dict[str, list[str] | str] = {
    "foo": "bar",
    "two": ["x", "y"],
    "embed": "true",
    "embed_options": "disable_scrolling",
}


class QueryParamsMethodTests(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        self.query_params = QueryParams()
        self.query_params._query_params = {"foo": "bar", "two": ["x", "y"]}

    def test__iter__doesnt_include_embed_keys(self):
        self.query_params._query_params = QUERY_PARAMS_DICT_WITH_EMBED_KEY
        for key in iter(self.query_params):
            if key in {"embed", "embed_options"}:
                raise KeyError("Cannot iterate through embed or embed_options key")

    def test__getitem__raises_KeyError_for_nonexistent_key_for_embed(self):
        self.query_params._query_params = QUERY_PARAMS_DICT_WITH_EMBED_KEY
        with pytest.raises(KeyError):
            self.query_params["embed"]

    def test__getitem__raises_KeyError_for_nonexistent_key_for_embed_options(self):
        self.query_params._query_params = QUERY_PARAMS_DICT_WITH_EMBED_KEY
        with pytest.raises(KeyError):
            self.query_params["embed_options"]

    def test__getitem__raises_KeyError_for_nonexistent_key(self):
        with pytest.raises(KeyError):
            self.query_params["nonexistent"]

    def test__getitem__returns_last_element_of_list(self):
        assert self.query_params["two"] == "y"

    def test__getitem__retrieves_existing_key(self):
        assert self.query_params["foo"] == "bar"

    def test__setitem__converts_int_value_to_string(self):
        self.query_params["baz"] = 1
        assert self.query_params["baz"] == "1"
        message = self.get_message_from_queue(0)
        assert "baz=1" in message.page_info_changed.query_string

    def test__setitem__converts_float_value_to_string(self):
        self.query_params["corge"] = 1.23
        assert self.query_params["corge"] == "1.23"
        message = self.get_message_from_queue(0)
        assert "corge=1.23" in message.page_info_changed.query_string

    def test__setitem__adds_new_str_query_param(self):
        assert "test" not in self.query_params
        self.query_params["test"] = "test"
        assert self.query_params.get("test") == "test"
        message = self.get_message_from_queue(0)
        assert "test=test" in message.page_info_changed.query_string

    def test__setitem__adds_empty_string_value(self):
        assert "test" not in self.query_params
        self.query_params["test"] = ""
        assert self.query_params["test"] == ""
        message = self.get_message_from_queue(0)
        assert message.page_info_changed.query_string == "foo=bar&two=x&two=y&test="

    def test__setitem__adds_list_value(self):
        self.query_params["test"] = ["test", "test2"]
        assert self.query_params["test"] == "test2"
        message = self.get_message_from_queue(0)
        assert "test=test&test=test2" in message.page_info_changed.query_string

    def test__setitem__adds_tuple_value(self):
        self.query_params["test"] = (1, 2, 3)
        assert self.query_params["test"] == "3"
        message = self.get_message_from_queue(0)
        assert "test=1&test=2&test=3" in message.page_info_changed.query_string

    def test__setitem__adds_set_value(self):
        self.query_params["test"] = set({1, 2, 3})
        assert self.query_params["test"] == "3"
        message = self.get_message_from_queue(0)
        assert "test=1&test=2&test=3" in message.page_info_changed.query_string

    def test__setitem__sets_old_query_param_key(self):
        self.query_params["foo"] = "test"
        assert self.query_params.get("foo") == "test"
        message = self.get_message_from_queue(0)
        assert "foo=test" in message.page_info_changed.query_string

    def test__setitem__raises_StreamlitException_with_dictionary_value(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params["foo"] = {"test": "test"}

    def test__setitem__raises_exception_for_embed_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params["embed"] = True

    def test__setitem__raises_exception_for_embed_options_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params["embed_options"] = "show_toolbar"

    def test__setitem__raises_error_with_embed_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params["embed"] = "true"

    def test_update_adds_values(self):
        self.query_params.update({"foo": "bar"})
        assert self.query_params.get("foo") == "bar"
        message = self.get_message_from_queue(0)
        assert "foo=bar" in message.page_info_changed.query_string

    def test_update_adds_list_values(self):
        self.query_params.update({"foo": ["bar", "baz"]})
        assert self.query_params.get_all("foo") == ["bar", "baz"]
        message = self.get_message_from_queue(0)
        assert "foo=bar&foo=baz" in message.page_info_changed.query_string

    def test_update_with_iterable(self):
        self.query_params.update([("foo", "bar"), ("stream", ["lit", "rocks"])])
        assert self.query_params.get("foo") == "bar"
        assert self.query_params.get("stream") == "rocks"
        message = self.get_message_from_queue(0)
        assert "foo=bar" in message.page_info_changed.query_string
        assert "stream=lit&stream=rocks" in message.page_info_changed.query_string

    def test_update_with_keywords(self):
        self.query_params.update(foo="bar", stream=["lit", "rocks"])
        assert self.query_params.get("foo") == "bar"
        assert self.query_params.get("stream") == "rocks"
        message = self.get_message_from_queue(0)
        assert "foo=bar" in message.page_info_changed.query_string
        assert "stream=lit&stream=rocks" in message.page_info_changed.query_string

    def test_update_raises_error_with_embed_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.update({"foo": "bar", "embed": "true"})

    def test_update_raises_error_with_embed_options_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.update({"foo": "bar", "embed_options": "show_toolbar"})

    def test_update_raises_exception_with_dictionary_value(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.update({"a_dict": {"test": "test"}})

    def test_update_changes_values_in_single_message(self):
        self.query_params.set_with_no_forward_msg("foo", "test")
        self.query_params.update({"foo": "bar", "baz": "test"})
        assert self.query_params.get("foo") == "bar"
        assert self.query_params.get("baz") == "test"
        assert len(self.forward_msg_queue) == 1
        message = self.get_message_from_queue(0)
        assert "foo=bar" in message.page_info_changed.query_string
        assert "baz=test" in message.page_info_changed.query_string

    def test__delitem__removes_existing_key(self):
        del self.query_params["foo"]
        assert "foo" not in self.query_params
        message = self.get_message_from_queue(0)
        assert "two=x&two=y" in message.page_info_changed.query_string
        assert "foo" not in message.page_info_changed.query_string

    def test__delitem__raises_error_for_nonexistent_key(self):
        with pytest.raises(KeyError):
            del self.query_params["nonexistent"]

    def test__delitem__throws_KeyErrorException_for_embed_key(self):
        self.query_params._query_params = QUERY_PARAMS_DICT_WITH_EMBED_KEY
        with pytest.raises(KeyError):
            del self.query_params["embed"]
        assert "embed" in self.query_params._query_params

    def test__delitem__throws_KeyErrorException_for_embed_options_key(self):
        self.query_params._query_params = QUERY_PARAMS_DICT_WITH_EMBED_KEY
        with pytest.raises(KeyError):
            del self.query_params["embed_options"]
        assert "embed_options" in self.query_params._query_params

    def test_get_all_returns_empty_list_for_nonexistent_key(self):
        assert self.query_params.get_all("nonexistent") == []

    def test_get_all_retrieves_single_element_list(self):
        assert self.query_params.get_all("foo") == ["bar"]

    def test_get_all_retrieves_multiple_values_as_list(self):
        assert self.query_params.get_all("two") == ["x", "y"]

    def test_get_all_handles_mixed_type_values(self):
        self.query_params["test"] = ["", "a", 1, 1.23]
        assert self.query_params.get_all("test") == ["", "a", "1", "1.23"]

    def test_get_all_returns_empty_array_for_embed_key(self):
        self.query_params._query_params = QUERY_PARAMS_DICT_WITH_EMBED_KEY
        assert self.query_params.get_all("embed") == []

    def test_get_all_returns_empty_array_for_embed_options_key(self):
        self.query_params._query_params = QUERY_PARAMS_DICT_WITH_EMBED_KEY
        assert self.query_params.get_all("embed_options") == []

    def test__len__doesnt_include_embed_and_embed_options_key(self):
        self.query_params._query_params = QUERY_PARAMS_DICT_WITH_EMBED_KEY
        assert len(self.query_params) == 2

    def test_clear_removes_all_query_params(self):
        self.query_params.clear()
        assert len(self.query_params) == 0
        message = self.get_message_from_queue(0)
        assert message.page_info_changed.query_string == ""

    def test_clear_doesnt_remove_embed_query_params(self):
        self.query_params._query_params = {
            "foo": "bar",
            "embed": "true",
            "embed_options": ["show_colored_line", "disable_scrolling"],
        }
        result_dict = {
            "embed": "true",
            "embed_options": ["show_colored_line", "disable_scrolling"],
        }
        self.query_params.clear()
        assert self.query_params._query_params == result_dict

    def test_to_dict(self):
        self.query_params["baz"] = ""
        result_dict = {"foo": "bar", "two": "y", "baz": ""}
        assert self.query_params.to_dict() == result_dict

    def test_to_dict_doesnt_include_embed_params(self):
        self.query_params._query_params = {
            "foo": "bar",
            "embed": "true",
            "embed_options": ["show_colored_line", "disable_scrolling"],
        }
        result_dict = {"foo": "bar"}
        assert self.query_params.to_dict() == result_dict

    def test_from_dict(self):
        result_dict = {"hello": "world"}
        self.query_params.from_dict(result_dict)
        assert self.query_params.to_dict() == result_dict

    def test_from_dict_iterable(self):
        self.query_params.from_dict((("key1", 5), ("key2", 6)))
        assert self.query_params._query_params == {"key1": "5", "key2": "6"}

    def test_from_dict_mixed_values(self):
        result_dict = {"hello": ["world", "janice", "amy"], "snow": "flake"}
        self.query_params.from_dict(result_dict)

        # self.query_params.to_dict() has behavior consistent with fetching values using
        # self.query_params["some_key"]. That is, if the value is an array, the last
        # element of the array is returned rather than the array in its entirety.
        assert self.query_params.to_dict() == {"hello": "amy", "snow": "flake"}

        result_as_list = {"hello": ["world", "janice", "amy"], "snow": ["flake"]}
        qp_as_list = {key: self.query_params.get_all(key) for key in self.query_params}
        assert result_as_list == qp_as_list

    def test_from_dict_preserves_embed_keys(self):
        self.query_params._query_params.update(
            {"embed_options": ["disable_scrolling", "show_colored_line"]}
        )
        self.query_params.from_dict({"a": "b", "c": "d"})
        assert self.query_params._query_params == {
            "a": "b",
            "c": "d",
            "embed_options": ["disable_scrolling", "show_colored_line"],
        }

    def test_from_dict_preserves_last_value_on_error(self):
        old_value = self.query_params._query_params
        with pytest.raises(StreamlitAPIException):
            self.query_params.from_dict({"a": "b", "embed": False})
        assert self.query_params._query_params == old_value

    def test_from_dict_changes_values_in_single_message(self):
        self.query_params.set_with_no_forward_msg("hello", "world")
        self.query_params.from_dict({"foo": "bar", "baz": "test"})
        assert self.query_params.get("foo") == "bar"
        assert self.query_params.get("baz") == "test"
        assert len(self.forward_msg_queue) == 1
        message = self.get_message_from_queue(0)
        assert message.page_info_changed.query_string == "foo=bar&baz=test"

    def test_from_dict_raises_error_with_embed_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.from_dict({"foo": "bar", "embed": "true"})

    def test_from_dict_raises_error_with_embed_options_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.from_dict({"foo": "bar", "embed_options": "show_toolbar"})

    def test_from_dict_raises_exception_with_dictionary_value(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.from_dict({"a_dict": {"test": "test"}})

    def test_from_dict_inverse(self):
        self.query_params.from_dict({"a": "b", "c": "d"})
        assert self.query_params._query_params == {"a": "b", "c": "d"}
        message = self.get_message_from_queue(0)
        assert message.page_info_changed.query_string == "a=b&c=d"
        from_dict_inverse = {
            key: self.query_params.get_all(key) for key in self.query_params
        }
        self.query_params.from_dict(from_dict_inverse)
        assert self.query_params._query_params == {"a": ["b"], "c": ["d"]}
        message = self.get_message_from_queue(0)
        assert message.page_info_changed.query_string == "a=b&c=d"

    def test_set_with_no_forward_msg_sends_no_msg_and_sets_query_params(self):
        self.query_params.set_with_no_forward_msg("test", "test")
        assert self.query_params["test"] == "test"
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)

    def test_set_with_no_forward_msg_accepts_embed(self):
        self.query_params.set_with_no_forward_msg("embed", "true")
        assert self.query_params._query_params["embed"] == "true"
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)

    def test_set_with_no_forward_msg_accepts_embed_options(self):
        self.query_params.set_with_no_forward_msg("embed_options", "disable_scrolling")
        assert self.query_params._query_params["embed_options"] == "disable_scrolling"
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)

    def test_set_with_no_forward_msg_accepts_multiple_embed_options(self):
        self.query_params.set_with_no_forward_msg(
            "embed_options", ["disable_scrolling", "show_colored_line"]
        )
        assert self.query_params._query_params["embed_options"] == [
            "disable_scrolling",
            "show_colored_line",
        ]
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)

    def test_clear_with_no_forward_msg_sends_no_msg_and_clears_query_params(self):
        self.query_params._query_params.update(
            {"embed_options": ["disable_scrolling", "show_colored_line"]}
        )
        self.query_params.clear_with_no_forward_msg()
        assert len(self.query_params) == 0
        assert len(self.query_params._query_params) == 0
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)

    def test_clear_with_no_forward_msg_preserve_embed_keys(self):
        self.query_params._query_params.update(
            {"embed_options": ["disable_scrolling", "show_colored_line"]}
        )
        self.query_params.clear_with_no_forward_msg(preserve_embed=True)
        assert len(self.query_params) == 0
        assert len(self.query_params._query_params) == 1
        assert self.query_params._query_params["embed_options"] == (
            ["disable_scrolling", "show_colored_line"]
        )


class ProcessQueryParamsTest(DeltaGeneratorTestCase):
    @parameterized.expand(
        [
            ("dict_input", {"foo": "bar", "baz": "qux"}, "foo=bar&baz=qux"),
            ("iterable_input", [("foo", "bar"), ("baz", "qux")], "foo=bar&baz=qux"),
            ("list_values", {"foo": ["bar", "baz"]}, "foo=bar&foo=baz"),
            ("type_conversion", {"foo": 1, "bar": 1.5}, "foo=1&bar=1.5"),
            (
                "iterable_accumulates_duplicate_keys",
                [("foo", "bar"), ("baz", "1"), ("baz", "2")],
                "foo=bar&baz=1&baz=2",
            ),
        ]
    )
    def test_process_query_params(
        self, _name: str, params: dict | list, expected: str
    ) -> None:
        """Test process_query_params converts various inputs to query string."""
        assert process_query_params(params) == expected

    @parameterized.expand(
        [
            ("embed_key", {"embed": "true"}),
            ("embed_options_key", {"embed_options": "show_toolbar"}),
            ("dict_value", {"foo": {"bar": "baz"}}),
            # Case-insensitive embed key checks
            ("embed_key_uppercase", {"EMBED": "true"}),
            ("embed_key_mixed_case", {"Embed": "true"}),
            ("embed_options_key_uppercase", {"EMBED_OPTIONS": "show_toolbar"}),
            ("embed_options_key_mixed_case", {"Embed_Options": "show_toolbar"}),
        ]
    )
    def test_process_query_params_raises_on_invalid_input(
        self, _name: str, params: dict
    ) -> None:
        """Test process_query_params raises exception on invalid input."""
        with pytest.raises(StreamlitAPIException):
            process_query_params(params)


class TestSetItemInDict:
    """Tests for _set_item_in_dict helper function."""

    @parameterized.expand(
        [
            ("string_value", "bar", {"foo": "bar"}),
            ("int_to_string", 123, {"foo": "123"}),
            ("float_to_string", 1.5, {"foo": "1.5"}),
            ("list_of_strings", ["a", "b", "c"], {"foo": ["a", "b", "c"]}),
            ("list_of_ints_to_strings", [1, 2, 3], {"foo": ["1", "2", "3"]}),
        ]
    )
    def test_sets_value(self, _name: str, value: str | list, expected: dict) -> None:
        """Test _set_item_in_dict sets and converts values correctly."""
        target: dict[str, list[str] | str] = {}
        _set_item_in_dict(target, "foo", value)  # type: ignore[arg-type]
        assert target == expected

    @parameterized.expand(
        [
            ("dict_value", "foo", {"bar": "baz"}, "cannot be set to a dictionary"),
            ("embed_key", "embed", "true", "embed.*cannot be set"),
            (
                "embed_options_key",
                "embed_options",
                "show_toolbar",
                "embed.*cannot be set",
            ),
            # Case-insensitive embed key checks
            ("embed_key_uppercase", "EMBED", "true", "embed.*cannot be set"),
            ("embed_key_mixed_case", "Embed", "true", "embed.*cannot be set"),
            (
                "embed_options_key_uppercase",
                "EMBED_OPTIONS",
                "show_toolbar",
                "embed.*cannot be set",
            ),
            (
                "embed_options_key_mixed_case",
                "Embed_Options",
                "show_toolbar",
                "embed.*cannot be set",
            ),
        ]
    )
    def test_raises_on_invalid_input(
        self, _name: str, key: str, value: str | dict, match: str
    ) -> None:
        """Test _set_item_in_dict raises exception on invalid input."""
        target: dict[str, list[str] | str] = {}
        with pytest.raises(StreamlitAPIException, match=match):
            _set_item_in_dict(target, key, value)  # type: ignore[arg-type]


# =============================================================================
# Query Parameter Widget Binding Unit Tests
# =============================================================================


class ParseUrlParamTest(DeltaGeneratorTestCase):
    """Tests for the parse_url_param function."""

    @parameterized.expand(
        [
            ("true_lowercase", "true", "bool_value", True),
            ("true_uppercase", "TRUE", "bool_value", True),
            ("true_mixed", "True", "bool_value", True),
            ("false_lowercase", "false", "bool_value", False),
            ("false_uppercase", "FALSE", "bool_value", False),
            ("false_mixed", "False", "bool_value", False),
        ]
    )
    def test_parse_bool_value(
        self, _name: str, value: str, value_type: str, expected: bool
    ) -> None:
        """Test parsing boolean values from URL params."""
        assert parse_url_param(value, value_type) == expected

    def test_parse_bool_value_invalid_raises(self) -> None:
        """Test that invalid boolean values raise ValueError."""
        with pytest.raises(ValueError, match="Invalid boolean"):
            parse_url_param("not_a_bool", "bool_value")

    @parameterized.expand(
        [
            ("positive_int", "42", "int_value", 42),
            ("negative_int", "-10", "int_value", -10),
            ("zero", "0", "int_value", 0),
        ]
    )
    def test_parse_int_value(
        self, _name: str, value: str, value_type: str, expected: int
    ) -> None:
        """Test parsing integer values from URL params."""
        assert parse_url_param(value, value_type) == expected

    def test_parse_int_value_returns_string_on_failure(self) -> None:
        """Test that non-numeric strings are returned as-is for int_value.

        This allows deserializers to handle human-readable option values.
        """
        result = parse_url_param("option_a", "int_value")
        assert result == "option_a"
        assert isinstance(result, str)

    @parameterized.expand(
        [
            ("positive_float", "3.14", "double_value", 3.14),
            ("negative_float", "-2.5", "double_value", -2.5),
            ("integer_as_float", "10", "double_value", 10.0),
        ]
    )
    def test_parse_double_value(
        self, _name: str, value: str, value_type: str, expected: float
    ) -> None:
        """Test parsing float values from URL params."""
        assert parse_url_param(value, value_type) == expected

    def test_parse_double_value_invalid_raises(self) -> None:
        """Test that invalid float values raise ValueError."""
        with pytest.raises(ValueError, match="could not convert string to float"):
            parse_url_param("not_a_number", "double_value")

    def test_parse_string_value(self) -> None:
        """Test parsing string values from URL params."""
        assert parse_url_param("hello world", "string_value") == "hello world"

    @parameterized.expand(
        [
            ("single_value", "a", "string_array_value", ["a"]),
            ("multiple_values", ["a", "b", "c"], "string_array_value", ["a", "b", "c"]),
            # Empty strings should be filtered out from arrays
            ("mixed_trailing_empty", ["a", ""], "string_array_value", ["a"]),
            ("mixed_leading_empty", ["", "a"], "string_array_value", ["a"]),
            ("mixed_middle_empty", ["a", "", "b"], "string_array_value", ["a", "b"]),
        ]
    )
    def test_parse_string_array_value(
        self, _name: str, value: str | list[str], value_type: str, expected: list[str]
    ) -> None:
        """Test parsing string array values from URL params."""
        assert parse_url_param(value, value_type) == expected

    @parameterized.expand(
        [
            ("single_int", "1", "int_array_value", [1]),
            ("multiple_ints", ["1", "2", "3"], "int_array_value", [1, 2, 3]),
            (
                "mixed_with_strings",
                ["1", "option_a"],
                "int_array_value",
                [1, "option_a"],
            ),
            # Empty strings should be filtered out from arrays
            ("mixed_trailing_empty", ["1", ""], "int_array_value", [1]),
            ("mixed_leading_empty", ["", "2"], "int_array_value", [2]),
            ("mixed_middle_empty", ["1", "", "3"], "int_array_value", [1, 3]),
        ]
    )
    def test_parse_int_array_value(
        self,
        _name: str,
        value: str | list[str],
        value_type: str,
        expected: list[int | str],
    ) -> None:
        """Test parsing int array values from URL params."""
        assert parse_url_param(value, value_type) == expected

    @parameterized.expand(
        [
            ("single_float", "1.5", "double_array_value", [1.5]),
            ("multiple_floats", ["1.5", "2.5"], "double_array_value", [1.5, 2.5]),
            (
                "mixed_with_strings",
                ["1.5", "option_a"],
                "double_array_value",
                [1.5, "option_a"],
            ),
            # Empty strings should be filtered out from arrays
            ("mixed_trailing_empty", ["1.5", ""], "double_array_value", [1.5]),
            ("mixed_leading_empty", ["", "2.5"], "double_array_value", [2.5]),
            (
                "mixed_middle_empty",
                ["1.5", "", "3.5"],
                "double_array_value",
                [1.5, 3.5],
            ),
        ]
    )
    def test_parse_double_array_value(
        self,
        _name: str,
        value: str | list[str],
        value_type: str,
        expected: list[float | str],
    ) -> None:
        """Test parsing float array values from URL params."""
        assert parse_url_param(value, value_type) == expected

    def test_parse_uses_last_value_for_scalar_types(self) -> None:
        """Test that list values use the last element for scalar types."""
        assert parse_url_param(["first", "last"], "string_value") == "last"
        assert parse_url_param(["1", "99"], "int_value") == 99

    def test_parse_unknown_type_returns_as_is(self) -> None:
        """Test that unknown value types return the value as-is."""
        assert parse_url_param("hello", "unknown_type") == "hello"

    @parameterized.expand(
        [
            # Empty string returns empty array for array types
            ("empty_string_array", "", "string_array_value", []),
            ("empty_int_array", "", "int_array_value", []),
            ("empty_double_array", "", "double_array_value", []),
            # Empty list [""] also returns empty array
            ("empty_list_string_array", [""], "string_array_value", []),
            ("empty_list_int_array", [""], "int_array_value", []),
            ("empty_list_double_array", [""], "double_array_value", []),
            # Empty string returns empty string for string_value
            ("empty_string_value", "", "string_value", ""),
            # Empty string returns None for other scalar types
            ("empty_bool_value", "", "bool_value", None),
            ("empty_int_value", "", "int_value", None),
            ("empty_double_value", "", "double_value", None),
        ]
    )
    def test_parse_empty_string_values(
        self, _name: str, value: str | list[str], value_type: str, expected: object
    ) -> None:
        """Test parsing empty string values from URL params (e.g., ?foo=).

        Empty values should be handled appropriately for each type:
        - Array types: return [] (empty array)
        - string_value: return "" (empty string is valid)
        - Other scalar types: return None (signaling "cleared" state)
        """
        assert parse_url_param(value, value_type) == expected


class TryParseIsoToMicrosTest(DeltaGeneratorTestCase):
    """Tests for _try_parse_iso_to_micros helper function."""

    @parameterized.expand(
        [
            ("date_simple", "2024-06-15"),
            ("date_start_of_year", "2020-01-01"),
            ("date_end_of_year", "2025-12-31"),
        ]
    )
    def test_parse_iso_date(self, _name: str, iso_str: str) -> None:
        """Test that ISO date strings are parsed to microsecond floats."""
        result = _try_parse_iso_to_micros(iso_str)
        assert result is not None
        assert isinstance(result, float)

    def test_parse_iso_date_correct_value(self) -> None:
        """Test that 2024-06-15 produces the correct microsecond value."""

        result = _try_parse_iso_to_micros("2024-06-15")
        dt = datetime.combine(date(2024, 6, 15), time(), tzinfo=timezone.utc)
        epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
        expected = (dt - epoch).total_seconds() * 1_000_000
        assert result == expected

    def test_parse_iso_time_hhmm(self) -> None:
        """Test that HH:MM time strings are parsed correctly."""

        result = _try_parse_iso_to_micros("14:30")
        assert result is not None
        dt = datetime.combine(date(2000, 1, 1), time(14, 30), tzinfo=timezone.utc)
        epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
        expected = (dt - epoch).total_seconds() * 1_000_000
        assert result == expected

    def test_parse_iso_time_hhmmss(self) -> None:
        """Test that HH:MM:SS time strings are parsed correctly."""
        result = _try_parse_iso_to_micros("09:30:45")
        assert result is not None

    def test_parse_iso_datetime(self) -> None:
        """Test that ISO datetime strings are parsed correctly."""

        result = _try_parse_iso_to_micros("2024-06-15T14:30")
        assert result is not None
        dt = datetime(2024, 6, 15, 14, 30, tzinfo=timezone.utc)
        epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
        expected = (dt - epoch).total_seconds() * 1_000_000
        assert result == expected

    def test_parse_iso_datetime_with_seconds(self) -> None:
        """Test that ISO datetime with seconds is parsed correctly."""
        result = _try_parse_iso_to_micros("2024-06-15T14:30:45")
        assert result is not None

    @parameterized.expand(
        [
            ("numeric_string", "12345"),
            ("plain_text", "notadate"),
            ("partial_date", "2024-13"),
            ("invalid_date", "2024-13-45"),
            ("invalid_time", "25:61"),
            ("empty_string", ""),
        ]
    )
    def test_parse_invalid_returns_none(self, _name: str, value: str) -> None:
        """Test that invalid strings return None."""
        assert _try_parse_iso_to_micros(value) is None

    @parameterized.expand(
        [
            ("datetime_with_offset", "2024-06-15T14:30+05:00"),
            ("datetime_with_utc", "2024-06-15T14:30+00:00"),
            ("datetime_with_z", "2024-06-15T14:30:00Z"),
            ("time_with_offset", "14:30+05:00"),
            ("time_with_utc", "14:30+00:00"),
        ]
    )
    def test_parse_timezone_aware_returns_none(self, _name: str, value: str) -> None:
        """Timezone-aware ISO strings are rejected to avoid silent mis-conversion."""
        assert _try_parse_iso_to_micros(value) is None


class IsoMicrosRoundTripTest(DeltaGeneratorTestCase):
    """Verify _try_parse_iso_to_micros produces the same value as slider's _datetime_to_micros."""

    def test_date_round_trip(self) -> None:
        from streamlit.elements.widgets.slider import (
            _date_to_datetime,
            _datetime_to_micros,
        )

        d = date(2024, 6, 15)
        expected = _datetime_to_micros(_date_to_datetime(d))
        assert _try_parse_iso_to_micros("2024-06-15") == float(expected)

    def test_time_round_trip(self) -> None:
        from streamlit.elements.widgets.slider import (
            _datetime_to_micros,
            _time_to_datetime,
        )

        t = time(14, 30)
        expected = _datetime_to_micros(_time_to_datetime(t))
        assert _try_parse_iso_to_micros("14:30") == float(expected)

    def test_time_with_seconds_round_trip(self) -> None:
        from streamlit.elements.widgets.slider import (
            _datetime_to_micros,
            _time_to_datetime,
        )

        t = time(9, 30, 45)
        expected = _datetime_to_micros(_time_to_datetime(t))
        assert _try_parse_iso_to_micros("09:30:45") == float(expected)

    def test_datetime_round_trip(self) -> None:
        from streamlit.elements.widgets.slider import _datetime_to_micros

        dt = datetime(2024, 6, 15, 14, 30)
        expected = _datetime_to_micros(dt)
        assert _try_parse_iso_to_micros("2024-06-15T14:30") == float(expected)

    def test_datetime_with_seconds_round_trip(self) -> None:
        from streamlit.elements.widgets.slider import _datetime_to_micros

        dt = datetime(2024, 6, 15, 14, 30, 45)
        expected = _datetime_to_micros(dt)
        assert _try_parse_iso_to_micros("2024-06-15T14:30:45") == float(expected)


class ParseUrlParamIsoDateSliderTest(DeltaGeneratorTestCase):
    """Tests for parse_url_param with ISO date/time/datetime strings in double_array_value."""

    def test_iso_date_parsed_as_float(self) -> None:
        """Test that ISO date string in double_array_value is converted to micros."""
        result = parse_url_param("2024-06-15", "double_array_value")
        assert len(result) == 1
        assert isinstance(result[0], float)

    def test_iso_time_parsed_as_float(self) -> None:
        """Test that ISO time string in double_array_value is converted to micros."""
        result = parse_url_param("14:30", "double_array_value")
        assert len(result) == 1
        assert isinstance(result[0], float)

    def test_iso_datetime_parsed_as_float(self) -> None:
        """Test that ISO datetime string in double_array_value is converted to micros."""
        result = parse_url_param("2024-06-15T14:30", "double_array_value")
        assert len(result) == 1
        assert isinstance(result[0], float)

    def test_iso_date_range_parsed(self) -> None:
        """Test that repeated ISO date params are converted to float array."""
        result = parse_url_param(["2021-06-01", "2023-12-15"], "double_array_value")
        assert len(result) == 2
        assert all(isinstance(v, float) for v in result)

    def test_numeric_strings_still_work(self) -> None:
        """Test that numeric strings are still parsed as floats (backward compat)."""
        result = parse_url_param("1718409600000000", "double_array_value")
        assert result == [1718409600000000.0]

    def test_non_iso_non_numeric_kept_as_string(self) -> None:
        """Test that non-ISO, non-numeric strings are kept as strings (select_slider)."""
        result = parse_url_param("option_a", "double_array_value")
        assert result == ["option_a"]

    def test_mixed_iso_and_numeric(self) -> None:
        """Test mix of ISO and numeric in repeated params."""
        result = parse_url_param(["2024-06-15", "1.5"], "double_array_value")
        assert len(result) == 2
        assert isinstance(result[0], float)  # ISO parsed to micros
        assert result[1] == 1.5  # Numeric parsed directly


class IsEmptyUrlValueTest(DeltaGeneratorTestCase):
    """Tests for is_empty_url_value helper function."""

    @parameterized.expand(
        [
            # Truly empty values should return True
            ("empty_string", "", True),
            ("empty_list", [""], True),
            # Multiple empty values should also return True (e.g., ?foo=&foo=)
            ("multiple_empty", ["", ""], True),
            ("triple_empty", ["", "", ""], True),
            # Non-empty values should return False
            ("single_value", "a", False),
            ("single_value_list", ["a"], False),
            ("multiple_values", ["a", "b"], False),
            # Mixed values with trailing empty should return False (has valid data)
            ("mixed_trailing_empty", ["a", ""], False),
            ("mixed_leading_empty", ["", "a"], False),
            ("mixed_middle_empty", ["a", "", "b"], False),
        ]
    )
    def test_is_empty_url_value(
        self, _name: str, value: str | list[str], expected: bool
    ) -> None:
        """Test that is_empty_url_value correctly identifies empty vs non-empty values.

        All-empty values like ["", ""] should be treated as empty (clearable applies).
        Mixed values like ["a", ""] should NOT be considered empty because
        they contain valid data that should be processed.
        """
        assert is_empty_url_value(value) == expected


class WidgetBindingTest(DeltaGeneratorTestCase):
    """Tests for widget binding registration and management."""

    def setUp(self) -> None:
        super().setUp()
        self.query_params = QueryParams()

    def test_bind_widget_registers_binding(self) -> None:
        """Test that bind_widget creates a binding in both registries."""
        self.query_params.bind_widget(
            param_key="my_key",
            widget_id="widget_123",
            value_type="string_value",
            script_hash="hash_abc",
        )

        # Check binding exists in both registries
        assert self.query_params.is_bound("my_key")
        assert "widget_123" in self.query_params._bindings_by_widget

        # Check binding data is correct
        binding = self.query_params.get_binding_for_param("my_key")
        assert binding is not None
        assert binding.widget_id == "widget_123"
        assert binding.param_key == "my_key"
        assert binding.value_type == "string_value"
        assert binding.script_hash == "hash_abc"

    def test_bind_widget_overwrites_param_binding_and_cleans_up_old(self) -> None:
        """Test that binding a new widget to the same param overwrites and cleans up."""
        self.query_params.bind_widget(
            param_key="my_key",
            widget_id="widget_old",
            value_type="string_value",
            script_hash="hash_old",
        )
        self.query_params.bind_widget(
            param_key="my_key",
            widget_id="widget_new",
            value_type="int_value",
            script_hash="hash_new",
        )

        # The param should now be bound to the new widget
        binding = self.query_params.get_binding_for_param("my_key")
        assert binding is not None
        assert binding.widget_id == "widget_new"
        assert binding.value_type == "int_value"
        assert binding.script_hash == "hash_new"

        # New widget should be in _bindings_by_widget
        assert "widget_new" in self.query_params._bindings_by_widget

        # Old widget should be removed from _bindings_by_widget (cleanup)
        assert "widget_old" not in self.query_params._bindings_by_widget

    def test_bind_widget_same_widget_same_param_no_cleanup(self) -> None:
        """Test that re-binding same widget to same param doesn't cause issues."""
        self.query_params.bind_widget(
            param_key="my_key",
            widget_id="widget_123",
            value_type="string_value",
            script_hash="hash_abc",
        )
        # Re-bind same widget (can happen on reruns)
        self.query_params.bind_widget(
            param_key="my_key",
            widget_id="widget_123",
            value_type="string_value",
            script_hash="hash_abc",
        )

        # Widget should still be bound
        assert self.query_params.is_bound("my_key")
        assert "widget_123" in self.query_params._bindings_by_widget

    def test_unbind_widget_removes_binding(self) -> None:
        """Test that unbind_widget removes the binding from both registries."""
        self.query_params.bind_widget(
            param_key="my_key",
            widget_id="widget_123",
            value_type="string_value",
            script_hash="hash_abc",
        )

        self.query_params.unbind_widget("widget_123")

        assert not self.query_params.is_bound("my_key")
        assert "widget_123" not in self.query_params._bindings_by_widget
        assert self.query_params.get_binding_for_param("my_key") is None

    def test_unbind_widget_noop_for_unknown_widget(self) -> None:
        """Test that unbind_widget is a no-op for unknown widget IDs."""
        # Should not raise
        self.query_params.unbind_widget("nonexistent_widget")

    def test_unbind_and_clear_param_removes_binding_and_url_param(self) -> None:
        """Test that unbind_and_clear_param removes binding and query param."""
        self.query_params.bind_widget(
            param_key="my_key",
            widget_id="widget_123",
            value_type="string_value",
            script_hash="hash_abc",
        )
        self.query_params.set_with_no_forward_msg("my_key", "some_value")

        self.query_params.unbind_and_clear_param("widget_123")

        assert not self.query_params.is_bound("my_key")
        assert "widget_123" not in self.query_params._bindings_by_widget
        assert "my_key" not in self.query_params._query_params

        message = self.get_message_from_queue(0)
        assert "my_key" not in message.page_info_changed.query_string

    def test_unbind_and_clear_param_noop_for_unknown_widget(self) -> None:
        """Test that unbind_and_clear_param is a no-op for unknown widget IDs."""
        self.query_params.set_with_no_forward_msg("other_key", "val")

        self.query_params.unbind_and_clear_param("nonexistent_widget")

        # Unrelated param should be untouched
        assert self.query_params["other_key"] == "val"

    def test_unbind_and_clear_param_skips_msg_when_param_already_cleared(
        self,
    ) -> None:
        """Test that no forward message is sent when binding exists but param was already removed."""
        self.query_params.bind_widget(
            param_key="my_key",
            widget_id="widget_123",
            value_type="string_value",
            script_hash="hash_abc",
        )
        # Binding exists but no corresponding query param in _query_params

        self.query_params.unbind_and_clear_param("widget_123")

        # Binding should be removed
        assert not self.query_params.is_bound("my_key")
        assert "widget_123" not in self.query_params._bindings_by_widget
        # No forward message should have been enqueued
        assert self.forward_msg_queue.is_empty()

    def test_is_bound_returns_false_for_unbound_param(self) -> None:
        """Test that is_bound returns False for parameters that aren't bound."""
        assert not self.query_params.is_bound("unbound_key")

    def test_get_binding_for_widget_returns_none_for_unknown(self) -> None:
        """Test that get_binding_for_widget returns None for unknown widgets."""
        assert self.query_params.get_binding_for_widget("unknown") is None


class ProtectedParamsBindingTest(DeltaGeneratorTestCase):
    """Tests for protected query parameter binding behavior."""

    def setUp(self) -> None:
        super().setUp()
        self.query_params = QueryParams()

    @parameterized.expand(
        [
            ("embed", "embed"),
            ("embed_options", "embed_options"),
            ("embed_uppercase", "EMBED"),
            ("embed_options_uppercase", "EMBED_OPTIONS"),
        ]
    )
    def test_bind_widget_raises_for_protected_params(
        self, _name: str, param_key: str
    ) -> None:
        """Test that binding to protected params raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="Cannot bind to reserved"):
            self.query_params.bind_widget(
                param_key=param_key,
                widget_id="widget_123",
                value_type="string_value",
                script_hash="hash_abc",
            )


class DirectManipulationProtectionTest(DeltaGeneratorTestCase):
    """Tests for preventing direct manipulation of bound query parameters."""

    def setUp(self) -> None:
        super().setUp()
        self.query_params = QueryParams()
        self.query_params._query_params = {"bound_key": "value", "unbound_key": "other"}
        self.query_params.bind_widget(
            param_key="bound_key",
            widget_id="widget_123",
            value_type="string_value",
            script_hash="hash_abc",
        )

    def test_setitem_raises_for_bound_param(self) -> None:
        """Test that __setitem__ raises for bound parameters."""
        with pytest.raises(StreamlitAPIException, match="bound to a widget"):
            self.query_params["bound_key"] = "new_value"

    def test_setitem_allows_unbound_param(self) -> None:
        """Test that __setitem__ allows setting unbound parameters."""
        self.query_params["unbound_key"] = "new_value"
        assert self.query_params["unbound_key"] == "new_value"

    def test_delitem_raises_for_bound_param(self) -> None:
        """Test that __delitem__ raises for bound parameters."""
        with pytest.raises(StreamlitAPIException, match="bound to a widget"):
            del self.query_params["bound_key"]

    def test_delitem_allows_unbound_param(self) -> None:
        """Test that __delitem__ allows deleting unbound parameters."""
        del self.query_params["unbound_key"]
        assert "unbound_key" not in self.query_params

    def test_update_raises_if_any_key_is_bound(self) -> None:
        """Test that update raises if any key in the update is bound."""
        with pytest.raises(StreamlitAPIException, match="bound to a widget"):
            self.query_params.update({"bound_key": "new_value", "new_key": "value"})

    def test_update_allows_only_unbound_keys(self) -> None:
        """Test that update allows updating only unbound keys."""
        self.query_params.update({"unbound_key": "updated", "another_key": "value"})
        assert self.query_params["unbound_key"] == "updated"
        assert self.query_params["another_key"] == "value"

    def test_clear_raises_if_any_bound_params_exist(self) -> None:
        """Test that clear raises if any bound parameters exist."""
        with pytest.raises(StreamlitAPIException, match="bound to widgets"):
            self.query_params.clear()

    def test_clear_works_when_no_bound_params(self) -> None:
        """Test that clear works when there are no bound parameters."""
        # Unbind the widget first
        self.query_params.unbind_widget("widget_123")
        self.query_params.clear()
        assert len(self.query_params) == 0


class InitialQueryParamsTest(DeltaGeneratorTestCase):
    """Tests for initial query parameter storage and retrieval."""

    def setUp(self) -> None:
        super().setUp()
        self.query_params = QueryParams()

    def test_set_initial_query_params_parses_and_stores(self) -> None:
        """Test that set_initial_query_params correctly parses and stores params."""
        self.query_params.set_initial_query_params("foo=bar&baz=1&baz=2")

        assert self.query_params._initial_query_params == {
            "foo": ["bar"],
            "baz": ["1", "2"],
        }

    def test_set_initial_query_params_handles_empty_string(self) -> None:
        """Test that set_initial_query_params handles empty query string."""
        self.query_params.set_initial_query_params("")
        assert self.query_params._initial_query_params == {}

    def test_get_initial_value_returns_single_value(self) -> None:
        """Test that get_initial_value returns single value as string."""
        self.query_params.set_initial_query_params("foo=bar")
        assert self.query_params.get_initial_value("foo") == "bar"

    def test_get_initial_value_returns_list_for_multiple(self) -> None:
        """Test that get_initial_value returns list for multiple values."""
        self.query_params.set_initial_query_params("foo=a&foo=b&foo=c")
        assert self.query_params.get_initial_value("foo") == ["a", "b", "c"]

    def test_get_initial_value_returns_none_for_missing(self) -> None:
        """Test that get_initial_value returns None for missing params."""
        self.query_params.set_initial_query_params("foo=bar")
        assert self.query_params.get_initial_value("nonexistent") is None

    def test_set_initial_query_params_from_current_copies_filtered_state(self) -> None:
        """Test that set_initial_query_params_from_current copies current _query_params."""
        # Set up some initial params
        self.query_params._query_params = {"foo": "bar", "baz": ["a", "b"]}

        self.query_params.set_initial_query_params_from_current()

        # Should copy current state to initial params (in list format)
        assert self.query_params._initial_query_params == {
            "foo": ["bar"],
            "baz": ["a", "b"],
        }
        assert self.query_params.get_initial_value("foo") == "bar"
        assert self.query_params.get_initial_value("baz") == ["a", "b"]

    def test_set_initial_query_params_from_current_handles_empty(self) -> None:
        """Test that set_initial_query_params_from_current handles empty state."""
        self.query_params._query_params = {}

        self.query_params.set_initial_query_params_from_current()

        assert self.query_params._initial_query_params == {}
        assert self.query_params.get_initial_value("anything") is None

    def test_page_transition_filtering_prevents_stale_seeding(self) -> None:
        """Test that MPA page transitions don't allow stale params to seed widgets.

        This is the key regression test for the bug where filtered params from
        a previous page could still seed widgets on the new page if they used
        the same key.
        """
        # Simulate Page A having a bound widget with key "shared_key"
        self.query_params.bind_widget(
            param_key="shared_key",
            widget_id="widget_a",
            value_type="string_value",
            script_hash="page_a",
        )

        # User is on Page A with URL ?shared_key=old_value&other=keep
        # Now navigate to Page B (different page hash)
        # This simulates what script_runner.py does:
        valid_script_hashes = {"main", "page_b"}  # page_a is NOT in this set
        self.query_params.populate_from_query_string(
            "shared_key=old_value&other=keep", valid_script_hashes
        )

        # shared_key should be filtered out (bound to page_a, not in valid set)
        assert "shared_key" not in self.query_params
        assert "other" in self.query_params  # unbound params are kept

        # Now set initial params from the FILTERED state (the fix)
        self.query_params.set_initial_query_params_from_current()

        # Widget seeding on Page B should NOT see the stale value
        assert self.query_params.get_initial_value("shared_key") is None
        # But unbound params should still be available for seeding
        assert self.query_params.get_initial_value("other") == "keep"

    def test_initial_page_load_preserves_all_url_params(self) -> None:
        """Test that on initial page load (no bindings), all URL params are preserved.

        This verifies the fix doesn't break initial page load where there are
        no prior bindings and all URL params should be available for seeding.
        """
        # Simulate initial page load - no bindings exist yet
        # script_runner.py calls populate_from_query_string with valid_script_hashes
        # but since no bindings exist, nothing should be filtered
        valid_script_hashes = {"main", "page_a"}
        self.query_params.populate_from_query_string(
            "foo=bar&baz=qux", valid_script_hashes
        )

        # All params should be preserved (no bindings to filter)
        assert "foo" in self.query_params
        assert "baz" in self.query_params

        # Set initial params from current state
        self.query_params.set_initial_query_params_from_current()

        # All params available for widget seeding
        assert self.query_params.get_initial_value("foo") == "bar"
        assert self.query_params.get_initial_value("baz") == "qux"

    def test_same_page_rerun_uses_fresh_url_params(self) -> None:
        """Test that same-page reruns set initial params from fresh URL.

        This verifies the fix doesn't break same-page reruns where we want
        the current URL params to be available for widget seeding.
        """
        # Simulate first load - binding registered, initial params set
        self.query_params.bind_widget(
            param_key="my_input",
            widget_id="widget_1",
            value_type="string_value",
            script_hash="page_a",
        )
        self.query_params.set_initial_query_params("my_input=original")
        self.query_params.populate_from_query_string("my_input=original")

        assert self.query_params.get_initial_value("my_input") == "original"

        # Now simulate same-page rerun with updated URL (e.g., browser back)
        # This is what reset() does when is_same_page=True
        self.query_params.set_initial_query_params("my_input=updated")
        self.query_params.populate_from_query_string("my_input=updated")

        # Initial params should reflect the new URL
        assert self.query_params.get_initial_value("my_input") == "updated"
        assert self.query_params["my_input"] == "updated"


class RemoveParamTest(DeltaGeneratorTestCase):
    """Tests for remove_param method."""

    def setUp(self) -> None:
        super().setUp()
        self.query_params = QueryParams()
        self.query_params._query_params = {"foo": "bar", "baz": "qux"}

    def test_has_param(self) -> None:
        """Test has_param returns whether a parameter exists."""
        assert self.query_params.has_param("foo") is True
        assert self.query_params.has_param("missing") is False

    def test_remove_param_removes_existing_param(self) -> None:
        """Test that remove_param removes an existing parameter."""
        result = self.query_params.remove_param("foo")
        assert result is True
        assert "foo" not in self.query_params._query_params
        assert "baz" in self.query_params._query_params

    def test_remove_param_returns_false_for_nonexistent(self) -> None:
        """Test that remove_param returns False for nonexistent param."""
        result = self.query_params.remove_param("nonexistent")
        assert result is False
        # Original params unchanged
        assert self.query_params._query_params == {"foo": "bar", "baz": "qux"}

    def test_remove_param_sends_forward_message(self) -> None:
        """Test that remove_param sends a forward message to update URL."""
        self.query_params.remove_param("foo")
        message = self.get_message_from_queue(0)
        assert "baz=qux" in message.page_info_changed.query_string
        assert "foo" not in message.page_info_changed.query_string

    def test_remove_param_no_message_for_nonexistent(self) -> None:
        """Test that no forward message is sent when param doesn't exist."""
        self.query_params.remove_param("nonexistent")
        with pytest.raises(IndexError):
            self.get_message_from_queue(0)

    def test_discard_param_no_forward_msg_removes_existing_param(self) -> None:
        """Test discarding a cached param does not forward URL updates."""
        result = self.query_params.discard_param_no_forward_msg("foo")
        assert result is True
        assert "foo" not in self.query_params._query_params
        with pytest.raises(IndexError):
            self.get_message_from_queue(0)

    def test_discard_param_no_forward_msg_returns_false_for_missing(self) -> None:
        """Test discard returns False when parameter is absent."""
        result = self.query_params.discard_param_no_forward_msg("nonexistent")
        assert result is False
        with pytest.raises(IndexError):
            self.get_message_from_queue(0)


class SetCorrectedValueTest(DeltaGeneratorTestCase):
    """Tests for URL auto-correction via set_corrected_value."""

    def setUp(self) -> None:
        super().setUp()
        self.query_params = QueryParams()

    @parameterized.expand(
        [
            ("string", "corrected", "string_value", "corrected"),
            ("int", 42, "int_value", "42"),
            ("bool_true", True, "bool_value", "true"),
            ("bool_false", False, "bool_value", "false"),
            ("float_whole", 5.0, "double_value", "5.0"),
            ("float_decimal", 3.14, "double_value", "3.14"),
        ]
    )
    def test_set_corrected_value_scalar(
        self,
        _name: str,
        value: str | int | float | bool,
        value_type: str,
        expected: str,
    ) -> None:
        """Test setting corrected scalar values."""
        self.query_params.set_corrected_value("key", value, value_type)
        assert self.query_params._query_params["key"] == expected

    @parameterized.expand(
        [
            ("string_list", ["a", "b"], "string_array_value", ["a", "b"]),
            ("int_list", [1, 2, 3], "int_array_value", ["1", "2", "3"]),
            (
                "double_list_formats_whole",
                [1.0, 2.5, 3.0],
                "double_array_value",
                ["1", "2.5", "3"],
            ),
        ]
    )
    def test_set_corrected_value_list(
        self, _name: str, value: list, value_type: str, expected: list[str]
    ) -> None:
        """Test setting corrected list values."""
        self.query_params.set_corrected_value("key", value, value_type)
        assert self.query_params._query_params["key"] == expected


class PopulateFromQueryStringTest(DeltaGeneratorTestCase):
    """Tests for populate_from_query_string method."""

    def setUp(self) -> None:
        super().setUp()
        self.query_params = QueryParams()

    def test_populate_clears_and_repopulates(self) -> None:
        """Test that populate_from_query_string clears existing params first."""
        self.query_params._query_params = {"old_key": "old_value"}
        self.query_params.populate_from_query_string("new_key=new_value")

        assert "old_key" not in self.query_params._query_params
        assert self.query_params["new_key"] == "new_value"

    def test_populate_handles_single_values(self) -> None:
        """Test populating single-value parameters."""
        self.query_params.populate_from_query_string("foo=bar")
        assert self.query_params._query_params["foo"] == "bar"

    def test_populate_handles_multiple_values(self) -> None:
        """Test populating multi-value parameters."""
        self.query_params.populate_from_query_string("foo=a&foo=b&foo=c")
        assert self.query_params._query_params["foo"] == ["a", "b", "c"]

    def test_populate_handles_empty_values(self) -> None:
        """Test populating empty-value parameters."""
        self.query_params.populate_from_query_string("foo=")
        assert self.query_params._query_params["foo"] == ""

    def test_populate_without_filter_keeps_all_params(self) -> None:
        """Test that without valid_script_hashes, all params are kept."""
        # Bind a widget to a param
        self.query_params.bind_widget(
            param_key="bound_key",
            widget_id="widget_123",
            value_type="string_value",
            script_hash="page_hash",
        )

        self.query_params.populate_from_query_string(
            "bound_key=value&unbound_key=other"
        )

        assert self.query_params["bound_key"] == "value"
        assert self.query_params["unbound_key"] == "other"

    def test_populate_filters_params_from_other_pages(self) -> None:
        """Test MPA page transition filtering."""
        # Bind a widget with a specific page hash
        self.query_params.bind_widget(
            param_key="page_a_key",
            widget_id="widget_page_a",
            value_type="string_value",
            script_hash="page_a_hash",
        )

        # Populate with valid_script_hashes that exclude page_a
        self.query_params.populate_from_query_string(
            "page_a_key=value&main_key=main_value",
            valid_script_hashes={"main_hash", "page_b_hash"},
        )

        # page_a_key should be filtered out
        assert "page_a_key" not in self.query_params._query_params
        assert self.query_params["main_key"] == "main_value"

        # Widget binding should also be removed
        assert "widget_page_a" not in self.query_params._bindings_by_widget

    def test_populate_keeps_params_from_valid_pages(self) -> None:
        """Test that params from valid pages are kept."""
        self.query_params.bind_widget(
            param_key="main_key",
            widget_id="widget_main",
            value_type="string_value",
            script_hash="main_hash",
        )

        self.query_params.populate_from_query_string(
            "main_key=value",
            valid_script_hashes={"main_hash", "page_hash"},
        )

        assert self.query_params["main_key"] == "value"
        assert "widget_main" in self.query_params._bindings_by_widget


class RemoveStaleBindingsTest(DeltaGeneratorTestCase):
    """Tests for remove_stale_bindings method."""

    def setUp(self) -> None:
        super().setUp()
        self.query_params = QueryParams()

    def test_removes_bindings_for_inactive_widgets(self) -> None:
        """Test that bindings are removed for widgets not in active set."""
        self.query_params._query_params = {"key1": "val1", "key2": "val2"}
        self.query_params.bind_widget(
            param_key="key1",
            widget_id="widget_active",
            value_type="string_value",
            script_hash="hash",
        )
        self.query_params.bind_widget(
            param_key="key2",
            widget_id="widget_inactive",
            value_type="string_value",
            script_hash="hash",
        )

        # Only widget_active is active
        self.query_params.remove_stale_bindings(active_widget_ids={"widget_active"})

        # widget_inactive should be unbound and its param removed
        assert not self.query_params.is_bound("key2")
        assert "key2" not in self.query_params._query_params
        assert "widget_inactive" not in self.query_params._bindings_by_widget

        # widget_active should still be bound
        assert self.query_params.is_bound("key1")
        assert "key1" in self.query_params._query_params

    def test_preserves_widgets_outside_running_fragment(self) -> None:
        """Test that widgets outside the running fragment are preserved."""
        from dataclasses import dataclass

        @dataclass
        class MockMetadata:
            fragment_id: str | None

        widget_metadata = {
            "widget_main": MockMetadata(None),  # Main script widget
            "widget_frag_a": MockMetadata("fragment_a"),
            "widget_frag_b": MockMetadata("fragment_b"),
        }

        self.query_params._query_params = {
            "main_key": "main_val",
            "frag_a_key": "frag_a_val",
            "frag_b_key": "frag_b_val",
        }
        self.query_params.bind_widget(
            param_key="main_key",
            widget_id="widget_main",
            value_type="string_value",
            script_hash="hash",
        )
        self.query_params.bind_widget(
            param_key="frag_a_key",
            widget_id="widget_frag_a",
            value_type="string_value",
            script_hash="hash",
        )
        self.query_params.bind_widget(
            param_key="frag_b_key",
            widget_id="widget_frag_b",
            value_type="string_value",
            script_hash="hash",
        )

        # Running only fragment_a - only widget_frag_a is active in this run
        self.query_params.remove_stale_bindings(
            active_widget_ids={"widget_frag_a"},
            fragment_ids_this_run=["fragment_a"],
            widget_metadata=widget_metadata,
        )

        # widget_main and widget_frag_b should be preserved (different fragment)
        assert self.query_params.is_bound("main_key")
        assert self.query_params.is_bound("frag_b_key")

        # widget_frag_a is active, so it should also be preserved
        assert self.query_params.is_bound("frag_a_key")

    def test_removes_inactive_widgets_in_running_fragment(self) -> None:
        """Test that inactive widgets IN the running fragment are removed."""
        from dataclasses import dataclass

        @dataclass
        class MockMetadata:
            fragment_id: str | None

        widget_metadata = {
            "widget_frag_active": MockMetadata("fragment_a"),
            "widget_frag_conditional": MockMetadata("fragment_a"),  # Hidden
        }

        self.query_params._query_params = {
            "active_key": "active_val",
            "conditional_key": "conditional_val",
        }
        self.query_params.bind_widget(
            param_key="active_key",
            widget_id="widget_frag_active",
            value_type="string_value",
            script_hash="hash",
        )
        self.query_params.bind_widget(
            param_key="conditional_key",
            widget_id="widget_frag_conditional",
            value_type="string_value",
            script_hash="hash",
        )

        # Only widget_frag_active is active (conditional widget is hidden)
        self.query_params.remove_stale_bindings(
            active_widget_ids={"widget_frag_active"},
            fragment_ids_this_run=["fragment_a"],
            widget_metadata=widget_metadata,
        )

        # Conditional widget should be removed
        assert not self.query_params.is_bound("conditional_key")
        assert "conditional_key" not in self.query_params._query_params

        # Active widget should be preserved
        assert self.query_params.is_bound("active_key")
