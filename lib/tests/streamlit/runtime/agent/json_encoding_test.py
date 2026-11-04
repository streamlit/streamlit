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

import collections.abc
import datetime as dt
import decimal
import enum
import itertools
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


def test_only_real_sequences_become_lists() -> None:
    """A dataframe, a mapping, and an endless iterator stay text.

    Listing them would report a dataframe's column names, a mapping's keys, or
    never return.
    """

    class _Keys(collections.abc.Mapping[str, int]):
        def __getitem__(self, key: str) -> int:
            return 1

        def __iter__(self) -> Any:
            yield "only-key"

        def __len__(self) -> int:
            return 1

        def __str__(self) -> str:
            return "mapping"

    class _Seq(collections.abc.Sequence[str]):
        def __getitem__(self, index: int) -> str:
            if index == 0:
                return "a"
            raise IndexError

        def __len__(self) -> int:
            return 1

    class _BrokenSequence(collections.abc.Sequence[int]):
        def __getitem__(self, index: int) -> int:
            raise RuntimeError("nope")

        def __len__(self) -> int:
            return 1

        def __str__(self) -> str:
            return "broken-seq"

    frame = pd.DataFrame({"col": [1]})
    counter = itertools.count()

    assert to_json_value(frame) == str(frame)
    assert to_json_value(_Keys()) == "mapping"
    assert to_json_value(counter) == str(counter)
    assert to_json_value(_Seq()) == ["a"]
    assert to_json_value(_BrokenSequence()) == "broken-seq"


def test_self_reference_becomes_text() -> None:
    """A value that contains itself does not recurse forever."""
    body: list[Any] = []
    body.append(body)
    assert to_json_value(body) == ["[[...]]"]

    mapping: dict[str, Any] = {}
    mapping["self"] = mapping
    assert to_json_value(mapping) == {"self": "{'self': {...}}"}

    shared = [1]
    assert to_json_value([shared, shared]) == [[1], [1]]


def test_tolist_that_returns_itself_becomes_text() -> None:
    """An object whose ``tolist`` returns itself does not recurse."""

    class _SelfList:
        def tolist(self) -> _SelfList:
            return self

        def __str__(self) -> str:
            return "self-list"

    class _ContainsSelf:
        def tolist(self) -> list[_ContainsSelf]:
            return [self]

        def __str__(self) -> str:
            return "contains-self"

    assert to_json_value(_SelfList()) == "self-list"
    assert to_json_value(_ContainsSelf()) == ["contains-self"]
