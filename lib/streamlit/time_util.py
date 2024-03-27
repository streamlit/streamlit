# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from typing import Literal, overload

from streamlit.errors import MarkdownFormattedException, StreamlitAPIException


def adjust_years(input_date: date, years: int) -> date:
    """Add or subtract years from a date."""
    try:
        # Attempt to directly add/subtract years
        return input_date.replace(year=input_date.year + years)
    except ValueError as err:
        # Handle case for leap year date (February 29) that doesn't exist in the target year
        # by moving the date to February 28
        if input_date.month == 2 and input_date.day == 29:
            return input_date.replace(year=input_date.year + years, month=2, day=28)

        raise StreamlitAPIException(
            f"Date {input_date} does not exist in the target year {input_date.year + years}. "
            "This should never happen. Please report this bug."
        ) from err


class BadTimeStringError(StreamlitAPIException):
    """Raised when a bad time string argument is passed."""

    def __init__(self, t: str):
        MarkdownFormattedException.__init__(
            self,
            "Time string doesn't look right. It should be formatted as"
            f"`'1d2h34m'` or `2 days`, for example. Got: {t}",
        )


@overload
def time_to_seconds(
    t: float | timedelta | str | None, *, coerce_none_to_inf: Literal[False]
) -> float | None:
    ...


@overload
def time_to_seconds(t: float | timedelta | str | None) -> float:
    ...


def time_to_seconds(
    t: float | timedelta | str | None, *, coerce_none_to_inf: bool = True
) -> float | None:
    """
    Convert a time string value to a float representing "number of seconds".
    """
    if coerce_none_to_inf and t is None:
        return math.inf
    if isinstance(t, timedelta):
        return t.total_seconds()
    if isinstance(t, str):
        import numpy as np
        import pandas as pd

        try:
            seconds: float = pd.Timedelta(t).total_seconds()

            if np.isnan(seconds):
                raise BadTimeStringError(t)

            return seconds
        except ValueError as ex:
            raise BadTimeStringError(t) from ex

    return t
