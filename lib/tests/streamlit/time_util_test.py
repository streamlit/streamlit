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

from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any

import pytest
from parameterized import parameterized

from streamlit.errors import StreamlitBadTimeStringError
from streamlit.time_util import adjust_years, time_to_seconds

TIME_STRING_TO_SECONDS_PARAMS = [
    ("float", 3.5, 3.5),
    ("timedelta", timedelta(minutes=3), 60 * 3),
    ("str 1 arg", "1d", 24 * 60 * 60),
    ("str 2 args", "1d23h", 24 * 60 * 60 + 23 * 60 * 60),
    (
        "complex str 3 args",
        "1 day 23hr 45minutes",
        24 * 60 * 60 + 23 * 60 * 60 + 45 * 60,
    ),
    ("str 2 args with float", "1.5d23.5h", 1.5 * 24 * 60 * 60 + 23.5 * 60 * 60),
]


@parameterized.expand(
    [
        # Test adding one year to a regular date:
        (date(2021, 1, 1), 1, date(2022, 1, 1)),
        # Test adding one year to a leap day, resulting in a non-leap year (Feb 28):
        (date(2020, 2, 29), 1, date(2021, 2, 28)),
        # Test subtracting one year from a leap day, adjusting to the previous year's Feb 28.
        (date(2020, 2, 29), -1, date(2019, 2, 28)),
        # Non-leap year, regular date
        (date(2021, 3, 15), 1, date(2022, 3, 15)),
        # Leap year to leap year:
        (date(2020, 2, 29), 4, date(2024, 2, 29)),
        # Subtracting years from a non-leap year date
        (date(2019, 3, 15), -1, date(2018, 3, 15)),
        # Adding 100 years, including a century leap year:
        (date(1920, 4, 10), 100, date(2020, 4, 10)),
        # End of year date
        (date(2019, 12, 31), 1, date(2020, 12, 31)),
    ]
)
def test_adjust_years(input_date: date, years: int, expected_date: date):
    """Test that `adjust_years` correctly` adjusts the year of a date."""
    assert adjust_years(input_date, years) == expected_date


@parameterized.expand(
    [
        *TIME_STRING_TO_SECONDS_PARAMS,
        ("None", None, math.inf),
    ]
)
def test_time_to_seconds_coerced(_, input_value: Any, expected_seconds: float):
    """Test the various types of input that time_to_seconds accepts."""
    assert expected_seconds == time_to_seconds(input_value)


@parameterized.expand(
    [
        *TIME_STRING_TO_SECONDS_PARAMS,
        ("None", None, None),
    ]
)
def test_time_to_seconds_not_coerced(_, input_value: Any, expected_seconds: float):
    """Test the various types of input that time_to_seconds accepts."""
    assert expected_seconds == time_to_seconds(input_value, coerce_none_to_inf=False)


def test_time_str_exception():
    """Test that a badly-formatted time string raises an exception."""
    with pytest.raises(StreamlitBadTimeStringError):
        time_to_seconds("")

    with pytest.raises(StreamlitBadTimeStringError):
        time_to_seconds("1 flecond")
