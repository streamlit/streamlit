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

"""Tests for query param serializers."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Any

from parameterized import parameterized

from streamlit.runtime.state.query_param_serializers import (
    deserialize_bool,
    deserialize_color,
    deserialize_date,
    deserialize_date_range,
    deserialize_datetime,
    deserialize_multiselect,
    deserialize_number,
    deserialize_number_range,
    deserialize_option,
    deserialize_string,
    deserialize_string_list,
    deserialize_time,
    serialize_bool,
    serialize_color,
    serialize_date,
    serialize_date_range,
    serialize_datetime,
    serialize_multiselect,
    serialize_number,
    serialize_number_range,
    serialize_option,
    serialize_string,
    serialize_string_list,
    serialize_time,
)


def _extract_id_as_str(x: Any) -> str:
    """Extract the 'id' field from a dict and return as string."""
    return str(x["id"])


class TestBoolSerializer:
    """Tests for boolean serialization."""

    @parameterized.expand(
        [
            ("true_value", True, "true"),
            ("false_value", False, "false"),
        ]
    )
    def test_serialize_bool(self, _name: str, value: bool, expected: str) -> None:
        """Test serialize_bool converts booleans correctly."""
        assert serialize_bool(value) == expected

    @parameterized.expand(
        [
            ("true_lowercase", "true", True),
            ("true_uppercase", "TRUE", True),
            ("one", "1", True),
            ("yes", "yes", True),
            ("on", "on", True),
            ("false_lowercase", "false", False),
            ("false_uppercase", "FALSE", False),
            ("zero", "0", False),
            ("no", "no", False),
            ("off", "off", False),
            ("empty", "", False),
            ("random_string", "random", False),
        ]
    )
    def test_deserialize_bool(self, _name: str, value: str, expected: bool) -> None:
        """Test deserialize_bool handles various string representations."""
        assert deserialize_bool(value) == expected

    def test_deserialize_bool_from_list(self) -> None:
        """Test deserialize_bool uses last value from list."""
        assert deserialize_bool(["false", "true"]) is True
        assert deserialize_bool(["true", "false"]) is False

    def test_deserialize_bool_empty_list(self) -> None:
        """Test deserialize_bool handles empty list."""
        assert deserialize_bool([]) is False


class TestStringSerializer:
    """Tests for string serialization."""

    @parameterized.expand(
        [
            ("normal_string", "hello", "hello"),
            ("empty_string", "", ""),
            ("none_value", None, ""),
            ("unicode", "日本語", "日本語"),
            ("special_chars", "hello&world=test", "hello&world=test"),
        ]
    )
    def test_serialize_string(
        self, _name: str, value: str | None, expected: str
    ) -> None:
        """Test serialize_string handles various inputs."""
        assert serialize_string(value) == expected

    @parameterized.expand(
        [
            ("normal_string", "hello", "hello"),
            ("empty_string", "", ""),
        ]
    )
    def test_deserialize_string(self, _name: str, value: str, expected: str) -> None:
        """Test deserialize_string returns the string."""
        assert deserialize_string(value) == expected

    def test_deserialize_string_from_list(self) -> None:
        """Test deserialize_string uses last value from list."""
        assert deserialize_string(["first", "last"]) == "last"

    def test_deserialize_string_empty_list(self) -> None:
        """Test deserialize_string handles empty list."""
        assert deserialize_string([]) == ""


class TestNumberSerializer:
    """Tests for number serialization."""

    @parameterized.expand(
        [
            ("integer", 42, "42"),
            ("negative_int", -42, "-42"),
            ("zero", 0, "0"),
            ("float", 3.14, "3.14"),
            ("float_trailing_zero", 3.0, "3.0"),
            ("none", None, ""),
        ]
    )
    def test_serialize_number(
        self, _name: str, value: int | float | None, expected: str
    ) -> None:
        """Test serialize_number handles various inputs."""
        assert serialize_number(value) == expected

    @parameterized.expand(
        [
            ("integer_string", "42", False, 42.0),
            ("float_string", "3.14", False, 3.14),
            ("negative", "-42", False, -42.0),
            ("as_int", "42", True, 42),
            ("float_as_int", "3.7", True, 3),
            ("empty", "", False, None),
        ]
    )
    def test_deserialize_number(
        self, _name: str, value: str, as_int: bool, expected: int | float | None
    ) -> None:
        """Test deserialize_number handles various inputs."""
        assert deserialize_number(value, as_int=as_int) == expected

    def test_deserialize_number_invalid(self) -> None:
        """Test deserialize_number returns None for invalid input."""
        assert deserialize_number("not_a_number") is None

    def test_deserialize_number_from_list(self) -> None:
        """Test deserialize_number uses last value from list."""
        assert deserialize_number(["1", "42"]) == 42.0


class TestDateSerializer:
    """Tests for date serialization."""

    def test_serialize_date(self) -> None:
        """Test serialize_date formats as ISO 8601."""
        assert serialize_date(date(2025, 12, 9)) == "2025-12-09"

    def test_serialize_date_none(self) -> None:
        """Test serialize_date handles None."""
        assert serialize_date(None) == ""

    def test_deserialize_date(self) -> None:
        """Test deserialize_date parses ISO 8601."""
        assert deserialize_date("2025-12-09") == date(2025, 12, 9)

    def test_deserialize_date_empty(self) -> None:
        """Test deserialize_date handles empty string."""
        assert deserialize_date("") is None

    def test_deserialize_date_invalid(self) -> None:
        """Test deserialize_date handles invalid input."""
        assert deserialize_date("not-a-date") is None

    def test_deserialize_date_from_list(self) -> None:
        """Test deserialize_date uses last value from list."""
        assert deserialize_date(["2025-01-01", "2025-12-09"]) == date(2025, 12, 9)


class TestDateRangeSerializer:
    """Tests for date range serialization."""

    def test_serialize_date_range(self) -> None:
        """Test serialize_date_range formats as comma-separated ISO dates."""
        result = serialize_date_range((date(2025, 1, 1), date(2025, 12, 31)))
        assert result == "2025-01-01,2025-12-31"

    def test_serialize_date_range_none(self) -> None:
        """Test serialize_date_range handles None."""
        assert serialize_date_range(None) == ""

    def test_deserialize_date_range(self) -> None:
        """Test deserialize_date_range parses comma-separated dates."""
        result = deserialize_date_range("2025-01-01,2025-12-31")
        assert result == (date(2025, 1, 1), date(2025, 12, 31))

    def test_deserialize_date_range_empty(self) -> None:
        """Test deserialize_date_range handles empty string."""
        assert deserialize_date_range("") is None

    def test_deserialize_date_range_invalid(self) -> None:
        """Test deserialize_date_range handles invalid input."""
        assert deserialize_date_range("not-a-date") is None
        assert deserialize_date_range("2025-01-01") is None  # Only one date


class TestTimeSerializer:
    """Tests for time serialization."""

    def test_serialize_time(self) -> None:
        """Test serialize_time formats as ISO 8601."""
        assert serialize_time(time(14, 30, 45)) == "14:30:45"

    def test_serialize_time_no_seconds(self) -> None:
        """Test serialize_time includes seconds even if zero."""
        assert serialize_time(time(14, 30, 0)) == "14:30:00"

    def test_serialize_time_none(self) -> None:
        """Test serialize_time handles None."""
        assert serialize_time(None) == ""

    def test_deserialize_time(self) -> None:
        """Test deserialize_time parses ISO 8601."""
        assert deserialize_time("14:30:45") == time(14, 30, 45)

    def test_deserialize_time_no_seconds(self) -> None:
        """Test deserialize_time handles missing seconds."""
        assert deserialize_time("14:30") == time(14, 30, 0)

    def test_deserialize_time_empty(self) -> None:
        """Test deserialize_time handles empty string."""
        assert deserialize_time("") is None

    def test_deserialize_time_invalid(self) -> None:
        """Test deserialize_time handles invalid input."""
        assert deserialize_time("not-a-time") is None


class TestDatetimeSerializer:
    """Tests for datetime serialization."""

    def test_serialize_datetime(self) -> None:
        """Test serialize_datetime formats as ISO 8601."""
        result = serialize_datetime(datetime(2025, 12, 9, 14, 30, 45))
        assert result == "2025-12-09T14:30:45"

    def test_serialize_datetime_none(self) -> None:
        """Test serialize_datetime handles None."""
        assert serialize_datetime(None) == ""

    def test_deserialize_datetime(self) -> None:
        """Test deserialize_datetime parses ISO 8601."""
        result = deserialize_datetime("2025-12-09T14:30:45")
        assert result == datetime(2025, 12, 9, 14, 30, 45)

    def test_deserialize_datetime_empty(self) -> None:
        """Test deserialize_datetime handles empty string."""
        assert deserialize_datetime("") is None

    def test_deserialize_datetime_invalid(self) -> None:
        """Test deserialize_datetime handles invalid input."""
        assert deserialize_datetime("not-a-datetime") is None


class TestNumberRangeSerializer:
    """Tests for number range serialization."""

    def test_serialize_number_range(self) -> None:
        """Test serialize_number_range formats as comma-separated numbers."""
        assert serialize_number_range((10, 50)) == "10,50"
        assert serialize_number_range((1.5, 3.5)) == "1.5,3.5"

    def test_serialize_number_range_none(self) -> None:
        """Test serialize_number_range handles None."""
        assert serialize_number_range(None) == ""

    def test_deserialize_number_range(self) -> None:
        """Test deserialize_number_range parses comma-separated numbers."""
        assert deserialize_number_range("10,50") == (10.0, 50.0)
        assert deserialize_number_range("1.5,3.5") == (1.5, 3.5)

    def test_deserialize_number_range_as_int(self) -> None:
        """Test deserialize_number_range can parse as integers."""
        assert deserialize_number_range("10,50", as_int=True) == (10, 50)

    def test_deserialize_number_range_empty(self) -> None:
        """Test deserialize_number_range handles empty string."""
        assert deserialize_number_range("") is None

    def test_deserialize_number_range_invalid(self) -> None:
        """Test deserialize_number_range handles invalid input."""
        assert deserialize_number_range("10") is None  # Only one number


class TestStringListSerializer:
    """Tests for string list serialization."""

    def test_serialize_string_list(self) -> None:
        """Test serialize_string_list returns a list."""
        assert serialize_string_list(["a", "b", "c"]) == ["a", "b", "c"]

    def test_serialize_string_list_none(self) -> None:
        """Test serialize_string_list handles None."""
        assert serialize_string_list(None) == []

    def test_deserialize_string_list(self) -> None:
        """Test deserialize_string_list handles both string and list."""
        assert deserialize_string_list("single") == ["single"]
        assert deserialize_string_list(["a", "b", "c"]) == ["a", "b", "c"]

    def test_deserialize_string_list_empty(self) -> None:
        """Test deserialize_string_list handles empty."""
        assert deserialize_string_list("") == []
        assert deserialize_string_list([]) == []


class TestOptionSerializer:
    """Tests for option (selectbox/radio) serialization."""

    def test_serialize_option_string(self) -> None:
        """Test serialize_option with string options."""
        options = ["red", "green", "blue"]
        assert serialize_option("green", options) == "green"

    def test_serialize_option_with_key_func(self) -> None:
        """Test serialize_option with custom key function."""
        options = [{"id": 1, "name": "Red"}, {"id": 2, "name": "Green"}]
        assert serialize_option(options[1], options, _extract_id_as_str) == "2"

    def test_serialize_option_none(self) -> None:
        """Test serialize_option handles None."""
        assert serialize_option(None, ["a", "b"]) == ""

    def test_deserialize_option(self) -> None:
        """Test deserialize_option finds matching option."""
        options = ["red", "green", "blue"]
        assert deserialize_option("green", options) == "green"

    def test_deserialize_option_with_key_func(self) -> None:
        """Test deserialize_option with custom key function."""
        options = [{"id": 1, "name": "Red"}, {"id": 2, "name": "Green"}]
        assert deserialize_option("2", options, _extract_id_as_str) == {
            "id": 2,
            "name": "Green",
        }

    def test_deserialize_option_not_found(self) -> None:
        """Test deserialize_option returns default when not found."""
        options = ["red", "green", "blue"]
        assert deserialize_option("yellow", options, default="red") == "red"

    def test_deserialize_option_empty(self) -> None:
        """Test deserialize_option handles empty string."""
        options = ["red", "green", "blue"]
        assert deserialize_option("", options, default="red") == "red"


class TestMultiselectSerializer:
    """Tests for multiselect serialization."""

    def test_serialize_multiselect(self) -> None:
        """Test serialize_multiselect with string options."""
        options = ["red", "green", "blue"]
        assert serialize_multiselect(["red", "blue"], options) == ["red", "blue"]

    def test_serialize_multiselect_with_key_func(self) -> None:
        """Test serialize_multiselect with custom key function."""
        options = [{"id": 1, "name": "Red"}, {"id": 2, "name": "Green"}]
        assert serialize_multiselect(
            [options[0], options[1]], options, _extract_id_as_str
        ) == [
            "1",
            "2",
        ]

    def test_serialize_multiselect_none(self) -> None:
        """Test serialize_multiselect handles None."""
        assert serialize_multiselect(None, ["a", "b"]) == []

    def test_deserialize_multiselect(self) -> None:
        """Test deserialize_multiselect finds matching options."""
        options = ["red", "green", "blue"]
        assert deserialize_multiselect(["red", "blue"], options) == ["red", "blue"]

    def test_deserialize_multiselect_with_key_func(self) -> None:
        """Test deserialize_multiselect with custom key function."""
        options = [{"id": 1, "name": "Red"}, {"id": 2, "name": "Green"}]
        result = deserialize_multiselect(["1", "2"], options, _extract_id_as_str)
        assert result == [{"id": 1, "name": "Red"}, {"id": 2, "name": "Green"}]

    def test_deserialize_multiselect_partial_match(self) -> None:
        """Test deserialize_multiselect only returns matching options."""
        options = ["red", "green", "blue"]
        assert deserialize_multiselect(["red", "yellow"], options) == ["red"]

    def test_deserialize_multiselect_from_string(self) -> None:
        """Test deserialize_multiselect handles single string."""
        options = ["red", "green", "blue"]
        assert deserialize_multiselect("red", options) == ["red"]


class TestColorSerializer:
    """Tests for color serialization."""

    def test_serialize_color(self) -> None:
        """Test serialize_color removes # prefix."""
        assert serialize_color("#ff0000") == "ff0000"
        assert serialize_color("#FF0000") == "ff0000"
        assert serialize_color("ff0000") == "ff0000"

    def test_serialize_color_none(self) -> None:
        """Test serialize_color handles None."""
        assert serialize_color(None) == ""

    def test_deserialize_color(self) -> None:
        """Test deserialize_color adds # prefix."""
        assert deserialize_color("ff0000") == "#ff0000"
        assert deserialize_color("#ff0000") == "#ff0000"
        assert deserialize_color("FF0000") == "#ff0000"

    def test_deserialize_color_empty(self) -> None:
        """Test deserialize_color handles empty string."""
        assert deserialize_color("") is None

    def test_deserialize_color_from_list(self) -> None:
        """Test deserialize_color uses last value from list."""
        assert deserialize_color(["aabbcc", "ff0000"]) == "#ff0000"
