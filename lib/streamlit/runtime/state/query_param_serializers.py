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

"""Serializers for converting widget values to/from URL query parameter strings.

These serializers are used when widgets are bound to query parameters. Unlike the
widget's internal serializers (which convert to/from protobuf), these convert
to/from URL-safe string representations.

The format parameter on widgets is for display only and does NOT affect serialization.
We always use canonical formats that are unambiguous and parseable.
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence


def serialize_bool(value: bool) -> str:
    """Serialize a boolean value to a query param string.

    Parameters
    ----------
    value : bool
        The boolean value to serialize.

    Returns
    -------
    str
        "true" or "false"
    """
    return "true" if value else "false"


def deserialize_bool(value: str | list[str]) -> bool:
    """Deserialize a query param string to a boolean value.

    Accepts common boolean string representations (case-insensitive):
    - true, 1, yes, on -> True
    - false, 0, no, off -> False

    Parameters
    ----------
    value : str or list[str]
        The query param value. If a list, uses the last value.

    Returns
    -------
    bool
        The deserialized boolean value.
    """
    if isinstance(value, list):
        value = value[-1] if value else "false"

    return value.lower() in ("true", "1", "yes", "on")


def serialize_string(value: str | None) -> str:
    """Serialize a string value to a query param string.

    Parameters
    ----------
    value : str or None
        The string value to serialize.

    Returns
    -------
    str
        The string value, or empty string if None.
    """
    return value if value is not None else ""


def deserialize_string(value: str | list[str]) -> str:
    """Deserialize a query param string to a string value.

    Parameters
    ----------
    value : str or list[str]
        The query param value. If a list, uses the last value.

    Returns
    -------
    str
        The deserialized string value.
    """
    if isinstance(value, list):
        return value[-1] if value else ""
    return value


def serialize_number(value: int | float | None) -> str:
    """Serialize a number value to a query param string.

    Uses appropriate precision to avoid floating point representation issues.

    Parameters
    ----------
    value : int, float, or None
        The number value to serialize.

    Returns
    -------
    str
        The string representation of the number.
    """
    if value is None:
        return ""

    if isinstance(value, int):
        return str(value)

    # For floats, use repr for full precision, then clean up trailing zeros
    # but keep at least one decimal place for clarity
    result = repr(value)
    # Handle cases like "1.0" -> keep as "1.0", but "1.10" -> "1.1"
    if "." in result and "e" not in result.lower():
        # Remove trailing zeros, but keep at least one digit after decimal
        parts = result.split(".")
        decimal_part = parts[1].rstrip("0") or "0"
        result = f"{parts[0]}.{decimal_part}"
    return result


def deserialize_number(
    value: str | list[str], as_int: bool = False
) -> int | float | None:
    """Deserialize a query param string to a number value.

    Parameters
    ----------
    value : str or list[str]
        The query param value. If a list, uses the last value.
    as_int : bool
        If True, parse as integer. Otherwise, parse as float.

    Returns
    -------
    int, float, or None
        The deserialized number value, or None if empty/invalid.
    """
    if isinstance(value, list):
        value = value[-1] if value else ""

    if not value:
        return None

    try:
        if as_int:
            # Handle float strings by converting to float first, then int
            return int(float(value))
        return float(value)
    except ValueError:
        return None


def serialize_date(value: date | None) -> str:
    """Serialize a date value to ISO 8601 format.

    Parameters
    ----------
    value : date or None
        The date value to serialize.

    Returns
    -------
    str
        ISO 8601 date string (YYYY-MM-DD), or empty string if None.
    """
    if value is None:
        return ""
    return value.isoformat()


def deserialize_date(value: str | list[str]) -> date | None:
    """Deserialize an ISO 8601 date string to a date value.

    Parameters
    ----------
    value : str or list[str]
        The query param value. If a list, uses the last value.

    Returns
    -------
    date or None
        The deserialized date value, or None if empty/invalid.
    """
    if isinstance(value, list):
        value = value[-1] if value else ""

    if not value:
        return None

    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def serialize_date_range(value: tuple[date, date] | None) -> str:
    """Serialize a date range to comma-separated ISO 8601 format.

    Parameters
    ----------
    value : tuple[date, date] or None
        The date range (start, end) to serialize.

    Returns
    -------
    str
        Comma-separated ISO dates (YYYY-MM-DD,YYYY-MM-DD), or empty if None.
    """
    if value is None or len(value) != 2:
        return ""
    return f"{value[0].isoformat()},{value[1].isoformat()}"


def deserialize_date_range(value: str | list[str]) -> tuple[date, date] | None:
    """Deserialize comma-separated ISO 8601 dates to a date range.

    Parameters
    ----------
    value : str or list[str]
        The query param value. If a list, uses the last value.

    Returns
    -------
    tuple[date, date] or None
        The deserialized date range, or None if empty/invalid.
    """
    if isinstance(value, list):
        value = value[-1] if value else ""

    if not value:
        return None

    try:
        parts = value.split(",")
        if len(parts) != 2:
            return None
        return (date.fromisoformat(parts[0]), date.fromisoformat(parts[1]))
    except ValueError:
        return None


def serialize_date_input_value(value: Any) -> str:
    """Serialize a st.date_input value to a query param string.

    Notes
    -----
    `st.date_input` can return either a single date (scalar) or a tuple of up to
    two dates (range). For ranges, we serialize as comma-separated ISO dates.
    """
    if value is None:
        return ""

    # Range: tuple/list of dates
    if isinstance(value, (tuple, list)):
        if len(value) == 0:
            return ""
        if len(value) == 1:
            return serialize_date(value[0])
        if len(value) == 2:
            return serialize_date_range((value[0], value[1]))
        return ""

    if isinstance(value, datetime):
        return serialize_date(value.date())
    if isinstance(value, date):
        return serialize_date(value)

    return ""


def deserialize_date_input_value(value: str | list[str]) -> Any:
    """Deserialize a query param string into a st.date_input value.

    Returns either:
    - `datetime.date` for scalar values
    - `tuple[datetime.date, ...]` for comma-separated ranges (0-2 items)
    - `None` for empty/invalid values
    """
    if isinstance(value, list):
        value = value[-1] if value else ""

    if not value:
        return None

    if "," in value:
        parts = [p for p in value.split(",") if p]
        if len(parts) == 0 or len(parts) > 2:
            return None
        try:
            return tuple(date.fromisoformat(p) for p in parts)
        except ValueError:
            return None

    # Scalar date
    return deserialize_date(value)


def serialize_slider_value(value: Any) -> str:
    """Serialize a st.slider value to a query param string.

    Notes
    -----
    Sliders can return scalars (int/float/date/time/datetime) or 2-tuples for ranges.
    For ranges, we serialize as comma-separated values.
    """
    if value is None:
        return ""

    def serialize_scalar(v: Any) -> str:
        if isinstance(v, datetime):
            return serialize_datetime(v)
        if isinstance(v, date) and not isinstance(v, datetime):
            return serialize_date(v)
        if isinstance(v, time):
            return serialize_time(v)
        if isinstance(v, (int, float)):
            return serialize_number(v)
        return ""

    if isinstance(value, (tuple, list)):
        if len(value) != 2:
            return ""
        left = serialize_scalar(value[0])
        right = serialize_scalar(value[1])
        if not left or not right:
            return ""
        return f"{left},{right}"

    return serialize_scalar(value)


def deserialize_slider_value(
    value: str | list[str],
    *,
    data_type: str,
) -> Any:
    """Deserialize a query param string into a st.slider value.

    Parameters
    ----------
    value : str or list[str]
        Query param value (uses last item if a list).
    data_type : str
        One of: "int", "float", "date", "time", "datetime".

    Returns
    -------
    Any
        Scalar value for non-range sliders, or a tuple for range sliders. Returns
        None if empty/invalid.
    """
    if isinstance(value, list):
        value = value[-1] if value else ""

    if not value:
        return None

    def parse_scalar(raw: str) -> Any:
        if data_type == "int":
            parsed = deserialize_number(raw, as_int=True)
            return parsed if isinstance(parsed, int) else None
        if data_type == "float":
            return deserialize_number(raw, as_int=False)
        if data_type == "date":
            return deserialize_date(raw)
        if data_type == "time":
            return deserialize_time(raw)
        if data_type == "datetime":
            return deserialize_datetime(raw)
        return None

    if "," in value:
        parts = value.split(",")
        if len(parts) != 2:
            return None
        left = parse_scalar(parts[0])
        right = parse_scalar(parts[1])
        if left is None or right is None:
            return None
        return (left, right)

    return parse_scalar(value)


def serialize_time(value: time | None) -> str:
    """Serialize a time value to ISO 8601 format.

    Parameters
    ----------
    value : time or None
        The time value to serialize.

    Returns
    -------
    str
        ISO 8601 time string (HH:MM:SS or HH:MM), or empty string if None.
    """
    if value is None:
        return ""
    # Use isoformat which gives HH:MM:SS or HH:MM:SS.ffffff
    result = value.isoformat()
    # Strip microseconds if present and zero
    if "." in result:
        result = result.split(".")[0]
    return result


def deserialize_time(value: str | list[str]) -> time | None:
    """Deserialize an ISO 8601 time string to a time value.

    Parameters
    ----------
    value : str or list[str]
        The query param value. If a list, uses the last value.

    Returns
    -------
    time or None
        The deserialized time value, or None if empty/invalid.
    """
    if isinstance(value, list):
        value = value[-1] if value else ""

    if not value:
        return None

    try:
        return time.fromisoformat(value)
    except ValueError:
        return None


def serialize_datetime(value: datetime | None) -> str:
    """Serialize a datetime value to ISO 8601 format.

    Parameters
    ----------
    value : datetime or None
        The datetime value to serialize.

    Returns
    -------
    str
        ISO 8601 datetime string, or empty string if None.
    """
    if value is None:
        return ""
    # Use isoformat for standard representation
    result = value.isoformat()
    # Strip microseconds if zero
    if "." in result:
        result = result.split(".")[0]
    return result


def deserialize_datetime(value: str | list[str]) -> datetime | None:
    """Deserialize an ISO 8601 datetime string to a datetime value.

    Parameters
    ----------
    value : str or list[str]
        The query param value. If a list, uses the last value.

    Returns
    -------
    datetime or None
        The deserialized datetime value, or None if empty/invalid.
    """
    if isinstance(value, list):
        value = value[-1] if value else ""

    if not value:
        return None

    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def serialize_number_range(value: tuple[int | float, int | float] | None) -> str:
    """Serialize a number range to comma-separated format.

    Parameters
    ----------
    value : tuple[int|float, int|float] or None
        The number range (min, max) to serialize.

    Returns
    -------
    str
        Comma-separated numbers (min,max), or empty if None.
    """
    if value is None or len(value) != 2:
        return ""
    return f"{serialize_number(value[0])},{serialize_number(value[1])}"


def deserialize_number_range(
    value: str | list[str], as_int: bool = False
) -> tuple[int | float, int | float] | None:
    """Deserialize comma-separated numbers to a number range.

    Parameters
    ----------
    value : str or list[str]
        The query param value. If a list, uses the last value.
    as_int : bool
        If True, parse as integers. Otherwise, parse as floats.

    Returns
    -------
    tuple[int|float, int|float] or None
        The deserialized number range, or None if empty/invalid.
    """
    if isinstance(value, list):
        value = value[-1] if value else ""

    if not value:
        return None

    try:
        parts = value.split(",")
        if len(parts) != 2:
            return None
        if as_int:
            return (int(float(parts[0])), int(float(parts[1])))
        return (float(parts[0]), float(parts[1]))
    except ValueError:
        return None


def serialize_string_list(value: Sequence[str] | None) -> list[str]:
    """Serialize a list of strings for repeated query params.

    Parameters
    ----------
    value : Sequence[str] or None
        The list of strings to serialize.

    Returns
    -------
    list[str]
        The list of strings, or empty list if None.
    """
    if value is None:
        return []
    return list(value)


def deserialize_string_list(value: str | list[str]) -> list[str]:
    """Deserialize query params to a list of strings.

    Parameters
    ----------
    value : str or list[str]
        The query param value(s).

    Returns
    -------
    list[str]
        The list of string values.
    """
    if isinstance(value, list):
        return value
    return [value] if value else []


def serialize_option(
    value: Any,
    _options: Sequence[Any],
    key_func: Callable[[Any], str] | None = None,
) -> str:
    """Serialize a selected option value to a query param string.

    Uses str(value) by default, or a custom key function if provided.

    Parameters
    ----------
    value : Any
        The selected option value.
    _options : Sequence[Any]
        The available options. Currently unused but included for API consistency
        with deserialize_option.
    key_func : Callable[[Any], str] or None
        Optional function to extract a string key from an option.

    Returns
    -------
    str
        The serialized option key.
    """
    if value is None:
        return ""

    if key_func is not None:
        return str(key_func(value))
    return str(value)


def deserialize_option(
    value: str | list[str],
    options: Sequence[Any],
    key_func: Callable[[Any], str] | None = None,
    default: Any = None,
) -> Any:
    """Deserialize a query param string to a selected option value.

    Finds the option whose key matches the query param value.

    Parameters
    ----------
    value : str or list[str]
        The query param value. If a list, uses the last value.
    options : Sequence[Any]
        The available options to search.
    key_func : Callable[[Any], str] or None
        Optional function to extract a string key from an option.
    default : Any
        The default value if no match is found.

    Returns
    -------
    Any
        The matched option value, or default if not found.
    """
    if isinstance(value, list):
        value = value[-1] if value else ""

    if not value:
        return default

    for option in options:
        option_key = str(key_func(option)) if key_func else str(option)
        if option_key == value:
            return option

    return default


def serialize_multiselect(
    values: Sequence[Any] | None,
    _options: Sequence[Any],
    key_func: Callable[[Any], str] | None = None,
) -> list[str]:
    """Serialize selected multiselect values to query param strings.

    Parameters
    ----------
    values : Sequence[Any] or None
        The selected option values.
    _options : Sequence[Any]
        The available options. Currently unused but included for API consistency
        with deserialize_multiselect.
    key_func : Callable[[Any], str] or None
        Optional function to extract a string key from an option.

    Returns
    -------
    list[str]
        The serialized option keys.
    """
    if values is None:
        return []

    if key_func is not None:
        return [str(key_func(val)) for val in values]
    return [str(val) for val in values]


def deserialize_multiselect(
    values: str | list[str],
    options: Sequence[Any],
    key_func: Callable[[Any], str] | None = None,
) -> list[Any]:
    """Deserialize query param strings to selected multiselect values.

    Parameters
    ----------
    values : str or list[str]
        The query param value(s).
    options : Sequence[Any]
        The available options to search.
    key_func : Callable[[Any], str] or None
        Optional function to extract a string key from an option.

    Returns
    -------
    list[Any]
        The matched option values.
    """
    if isinstance(values, str):
        values = [values] if values else []

    result = []
    for val in values:
        for option in options:
            option_key = str(key_func(option)) if key_func else str(option)
            if option_key == val:
                result.append(option)
                break
    return result


def serialize_color(value: str | None) -> str:
    """Serialize a hex color value to a query param string.

    Removes the leading '#' for cleaner URLs.

    Parameters
    ----------
    value : str or None
        The hex color value (e.g., "#ff0000").

    Returns
    -------
    str
        The hex color without '#' (e.g., "ff0000").
    """
    if value is None:
        return ""
    return value.lstrip("#").lower()


def deserialize_color(value: str | list[str]) -> str | None:
    """Deserialize a query param string to a hex color value.

    Adds the leading '#' if not present.

    Parameters
    ----------
    value : str or list[str]
        The query param value. If a list, uses the last value.

    Returns
    -------
    str or None
        The hex color with '#' (e.g., "#ff0000"), or None if empty.
    """
    if isinstance(value, list):
        value = value[-1] if value else ""

    if not value:
        return None

    # Add '#' prefix if not present
    if not value.startswith("#"):
        value = f"#{value}"

    return value.lower()
