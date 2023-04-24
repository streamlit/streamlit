# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import datetime
import unittest
from decimal import Decimal

import numpy as np
import pandas as pd
from parameterized import parameterized

from streamlit.elements.lib.column_config_utils import (
    ColumnDataKind,
    _determine_data_kind,
)
from tests.streamlit.data_mocks import TestObject


class ColumnConfigUtilsTest(unittest.TestCase):
    @parameterized.expand(
        [
            (pd.Series(["a", "b", "c"]), ColumnDataKind.STRING),
            (pd.Series([b"a", b"b", b"c"]), ColumnDataKind.BYTES),
            (pd.Series([1, 2, 3], dtype="Int64"), ColumnDataKind.INTEGER),
            (pd.Series([1.1, 2.2, 3.3]), ColumnDataKind.FLOAT),
            (pd.Series([1, 2.2, 3]), ColumnDataKind.FLOAT),  # mixed-integer-float
            (
                pd.Series([pd.Timestamp("2000-01-01"), pd.Timestamp("2000-01-02")]),
                ColumnDataKind.DATETIME,
            ),
            (
                pd.Series(
                    [
                        pd.Timestamp("2000-01-01", tz="US/Central"),
                        pd.Timestamp("2000-01-02", tz="US/Central"),
                    ]
                ),
                ColumnDataKind.DATETIME,
            ),
            (
                pd.Series([datetime.date(2000, 1, 1), datetime.date(2000, 1, 2)]),
                ColumnDataKind.DATE,
            ),
            (
                pd.Series([datetime.time(12, 0), datetime.time(13, 0)]),
                ColumnDataKind.TIME,
            ),
            (
                pd.Series([pd.Timedelta("1 day"), pd.Timedelta("2 days")]),
                ColumnDataKind.TIMEDELTA,
            ),
            (
                pd.Series([np.timedelta64(1, "D"), np.timedelta64(2, "D")]),
                ColumnDataKind.TIMEDELTA,
            ),
            (
                pd.Series([pd.Period("2000Q1"), pd.Period("2000Q2")]),
                ColumnDataKind.PERIOD,
            ),
            (pd.Series([True, False]), ColumnDataKind.BOOLEAN),
            (pd.Series([Decimal("1.1"), Decimal("2.2")]), ColumnDataKind.DECIMAL),
            (pd.Series(["a", "b", "c", "a"], dtype="category"), ColumnDataKind.STRING),
            (pd.Series([1, 2, 3], dtype="category"), ColumnDataKind.INTEGER),
            (pd.Series([True, False], dtype="category"), ColumnDataKind.BOOLEAN),
            (pd.Series([]), ColumnDataKind.EMPTY),
            # TODO: (pd.Series([[1, 2], [3, 4]]), ColumnDataKind.LIST),
            (pd.Series([1 + 2j, 2 + 3j]), ColumnDataKind.COMPLEX),
            (
                pd.Series([pd.Interval(0, 1), pd.Interval(1, 2)]),
                ColumnDataKind.INTERVAL,
            ),
            (pd.Series([{"a": 1}, {"b": 2}]), ColumnDataKind.UNKNOWN),
            (pd.Series([pd.Timestamp("2000-01-01"), "a"]), ColumnDataKind.UNKNOWN),
            (pd.Series([1, "a"]), ColumnDataKind.UNKNOWN),
            (pd.Series([pd.Categorical(["a", "b", "c"])]), ColumnDataKind.UNKNOWN),
            (pd.Series([TestObject(), TestObject()]), ColumnDataKind.UNKNOWN),
        ]
    )
    def test_determine_data_kind_via_inferred_type(
        self, column: pd.Series, expected_data_kind: ColumnDataKind
    ):
        self.assertEqual(
            _determine_data_kind(column),
            expected_data_kind,
            f"Expected {column} to be determined as {expected_data_kind} data kind.",
        )

        # Attach a missing value to the end of the column and re-test.
        column.loc[column.index.max() + 1] = None
        self.assertEqual(
            _determine_data_kind(column),
            expected_data_kind,
            f"Expected {column} with missing value to be determined as {expected_data_kind} data kind.",
        )
