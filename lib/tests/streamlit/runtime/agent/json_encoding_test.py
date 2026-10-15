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

"""JSON forms for the values an agent-API description can carry."""

from __future__ import annotations

import datetime as dt
import decimal
import enum
import math
from typing import Any

import numpy as np
import pandas as pd
import pytest

from streamlit.runtime.agent.json_encoding import to_json_value


class _Color(enum.Enum):
    RED = "red"


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (dt.date(2026, 10, 12), "2026-10-12"),
        (
            dt.datetime(2026, 10, 12, 9, 30, tzinfo=dt.UTC),
            "2026-10-12T09:30:00+00:00",
        ),
        (dt.datetime(2026, 10, 12, 9, 30), "2026-10-12T09:30:00"),
        (dt.time(9, 30), "09:30:00"),
        (dt.timedelta(hours=1, minutes=30), 5400.0),
        (decimal.Decimal("0.10"), "0.10"),
        (decimal.Decimal("NaN"), None),
        (decimal.Decimal("Infinity"), None),
        (decimal.Decimal("-Infinity"), None),
        (math.nan, None),
        (math.inf, None),
        (pd.NA, None),
        (pd.NaT, None),
        (b"abc", {"bytes": 3}),
        (_Color.RED, "red"),
        ((20, 80), [20, 80]),
        (9223372036854775807, 9223372036854775807),
    ],
)
def test_encodes_spec_table(value: Any, expected: Any) -> None:
    """Each encoding-table row has one JSON form."""
    assert to_json_value(value) == expected


def test_encodes_set_as_list_without_depending_on_order() -> None:
    """A set becomes a list of its members."""
    assert set(to_json_value({"a", "b"})) == {"a", "b"}


def test_failed_conversions_fall_back_to_str() -> None:
    """A value that cannot be listed does not fail the snapshot."""

    class _BrokenList:
        def tolist(self) -> list[int]:
            raise RuntimeError("nope")

        def __str__(self) -> str:
            return "broken-list"

    class _BrokenIter:
        def __iter__(self) -> Any:
            raise RuntimeError("nope")

        def __str__(self) -> str:
            return "broken-iter"

    assert to_json_value(_BrokenList()) == "broken-list"
    assert to_json_value(_BrokenIter()) == "broken-iter"


def test_encodes_numpy_and_falls_back_to_str() -> None:
    """NumPy values use their list form, and an unknown object becomes text."""

    class _Point:
        def __str__(self) -> str:
            return "Point(1, 2)"

    assert to_json_value(np.int64(7)) == 7
    assert to_json_value(np.array([1.0, np.nan])) == [1.0, None]
    assert to_json_value(_Point()) == "Point(1, 2)"
