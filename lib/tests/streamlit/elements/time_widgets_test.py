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

"""Unit tests for internal helpers of the time_widgets module."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import TYPE_CHECKING

import pytest

from streamlit.elements.widgets.time_widgets import (
    TimeInputSerde,
    _convert_datetimelike_to_datetime,
    _DateInputValues,
    _parse_max_date,
    _parse_min_date,
)
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from collections.abc import Callable


@pytest.mark.parametrize("parse_fn", [_parse_min_date, _parse_max_date])
def test_parse_date_bound_rejects_invalid_type(parse_fn: Callable[..., date]) -> None:
    """Test that a non-date/datetime/None bound raises a StreamlitAPIException."""
    with pytest.raises(StreamlitAPIException):
        parse_fn(123, None)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        # Slash-separated datetime format (not accepted by ``fromisoformat``).
        ("2021/05/06 14:30", datetime(2021, 5, 6, 14, 30)),
        # Time-only ISO string combines with the fallback date.
        ("14:30", datetime(2020, 1, 1, 14, 30)),
    ],
)
def test_convert_datetimelike_string_fallbacks(value: str, expected: datetime) -> None:
    """Test that slash-separated datetimes and time-only ISO strings are parsed.

    These inputs are not handled by ``datetime.fromisoformat`` and instead fall
    through to the ``strptime`` formats and the ``time.fromisoformat`` branch.
    """
    result = _convert_datetimelike_to_datetime(
        value,
        fallback_date=date(2020, 1, 1),
        fallback_time=time(9, 0),
    )
    assert result == expected


def test_convert_datetimelike_rejects_unparseable_string() -> None:
    """Test that a string matching no supported format raises an exception."""
    with pytest.raises(StreamlitAPIException):
        _convert_datetimelike_to_datetime(
            "not-a-date",
            fallback_date=date(2020, 1, 1),
            fallback_time=time(9, 0),
        )


def test_date_input_values_rejects_min_after_max() -> None:
    """Test that constructing date bounds with min > max raises an exception."""
    with pytest.raises(StreamlitAPIException, match="min_value"):
        _DateInputValues(
            value=None,
            is_range=False,
            min=date(2022, 1, 1),
            max=date(2020, 1, 1),
        )


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (datetime(2021, 5, 6, 14, 30), "14:30"),
        (None, None),
    ],
    ids=["datetime", "none"],
)
def test_time_input_serde_serialize(
    value: datetime | None, expected: str | None
) -> None:
    """Test that a datetime serializes to its time component and ``None`` to ``None``."""
    serde = TimeInputSerde(value=None, step=900)
    assert serde.serialize(value) == expected
