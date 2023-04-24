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
from __future__ import annotations

import datetime
import unittest
from decimal import Decimal

import numpy as np
import pandas as pd
import pyarrow as pa
from parameterized import parameterized

from streamlit.elements.lib.column_config_utils import (
    ColumnDataKind,
    _determine_data_kind,
    _determine_data_kind_via_arrow,
    _determine_data_kind_via_inferred_type,
    _determine_data_kind_via_pandas_dtype,
    determine_dataframe_schema,
)


class TestObject(object):
    def __str__(self):
        return "TestObject"


def _get_arrow_schema_field(column: pd.Series) -> pa.Field | None:
    """Get the Arrow schema field for a pandas Series."""
    try:
        arrow_schema = pa.Table.from_pandas(column.to_frame()).schema
        return arrow_schema.field(0)
    except (pa.ArrowTypeError, pa.ArrowInvalid, pa.ArrowNotImplementedError):
        return None


SHARED_DATA_KIND_TEST_CASES = [
    (pd.Series(["a", "b", "c"], dtype=pd.StringDtype()), ColumnDataKind.STRING),
    # We need to use Int64 here, otherwise it gets converted to float if a None is added:
    (pd.Series([1, 2, 3], dtype="Int64"), ColumnDataKind.INTEGER),
    (pd.Series([1.1, 2.2, 3.3]), ColumnDataKind.FLOAT),
    (pd.Series([1, 2.2, 3]), ColumnDataKind.FLOAT),  # mixed-integer-float
    (
        pd.Series([pd.Timestamp("2000-01-01"), pd.Timestamp("2000-01-02")]),
        ColumnDataKind.DATETIME,
    ),
    (
        pd.Series([datetime.datetime(2000, 1, 1), datetime.datetime(2000, 1, 2)]),
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
    (pd.Series([True, False]), ColumnDataKind.BOOLEAN),
    (
        pd.Series([pd.Timedelta("1 day"), pd.Timedelta("2 days")]),
        ColumnDataKind.TIMEDELTA,
    ),
    (
        pd.Series([np.timedelta64(1, "D"), np.timedelta64(2, "D")]),
        ColumnDataKind.TIMEDELTA,
    ),
]


class ColumnConfigUtilsTest(unittest.TestCase):
    @parameterized.expand(
        SHARED_DATA_KIND_TEST_CASES
        + [
            (pd.Series([b"a", b"b", b"c"]), ColumnDataKind.BYTES),
            (pd.Series([Decimal("1.1"), Decimal("2.2")]), ColumnDataKind.DECIMAL),
            (pd.Series([], dtype="object"), ColumnDataKind.EMPTY),
            (pd.Series([None, None]), ColumnDataKind.EMPTY),
            (pd.Series([pd.NA, pd.NA]), ColumnDataKind.EMPTY),
            #
            (pd.Series([1 + 2j, 2 + 3j]), ColumnDataKind.COMPLEX),
            (
                pd.Series([pd.Period("2000Q1"), pd.Period("2000Q2")]),
                ColumnDataKind.PERIOD,
            ),
            (pd.Series(["a", "b", "c"]), ColumnDataKind.STRING),
            (pd.Series(["a", "b", "c"], dtype="category"), ColumnDataKind.STRING),
            (pd.Series([1, 2, 3], dtype="category"), ColumnDataKind.INTEGER),
            (pd.Series([True, False], dtype="category"), ColumnDataKind.BOOLEAN),
            (
                pd.Series([pd.Interval(0, 1), pd.Interval(1, 2)]),
                ColumnDataKind.INTERVAL,
            ),
            (pd.Series([{"a": 1}, {"b": 2}]), ColumnDataKind.DICT),
            (pd.Series([[1, 2], [3, 4]]), ColumnDataKind.LIST),
            (pd.Series([["a", "b"], ["c", "d", "e"]]), ColumnDataKind.LIST),
            # Unsupported types:
            (pd.Series([pd.Timestamp("2000-01-01"), "a"]), ColumnDataKind.UNKNOWN),
            (pd.Series([1, "a"]), ColumnDataKind.UNKNOWN),
            (pd.Series([TestObject(), TestObject()]), ColumnDataKind.UNKNOWN),
        ]
    )
    def test_determine_data_kind(
        self, column: pd.Series, expected_data_kind: ColumnDataKind
    ):
        """Test that _determine_data_kind() returns the expected data kind for a given column."""
        # Create copy to not interfere with other tests:
        column = column.copy()

        self.assertEqual(
            _determine_data_kind(column, _get_arrow_schema_field(column)),
            expected_data_kind,
            f"Expected {column} to be determined as {expected_data_kind} data kind.",
        )

        # Attach a missing value to the end of the column and re-test.
        column.loc[column.index.max() + 1] = None
        self.assertEqual(
            _determine_data_kind(column, _get_arrow_schema_field(column)),
            expected_data_kind,
            f"Expected {column} with missing value to be determined as {expected_data_kind} data kind.",
        )

    @parameterized.expand(
        [
            (pd.Index(["a", "b", "c"]), ColumnDataKind.STRING),
            (pd.Index([1, 2, 3]), ColumnDataKind.INTEGER),
            (pd.Index([1.1, 2.2, 3.3]), ColumnDataKind.FLOAT),
            (pd.Index([1, 2.2, 3]), ColumnDataKind.FLOAT),  # mixed-integer-float
            (
                pd.Index([datetime.date(2000, 1, 1), datetime.date(2000, 1, 2)]),
                ColumnDataKind.DATE,
            ),
            (
                pd.Index([datetime.time(0, 0, 0), datetime.time(0, 0, 1)]),
                ColumnDataKind.TIME,
            ),
            (pd.RangeIndex(0, 3), ColumnDataKind.INTEGER),
            (pd.TimedeltaIndex(["1 day", "2 days"]), ColumnDataKind.TIMEDELTA),
            (
                pd.DatetimeIndex(
                    [datetime.datetime(2000, 1, 1), datetime.datetime(2000, 1, 2)]
                ),
                ColumnDataKind.DATETIME,
            ),
            (
                pd.PeriodIndex([pd.Period("2000Q1"), pd.Period("2000Q2")]),
                ColumnDataKind.PERIOD,
            ),
            (pd.IntervalIndex.from_breaks([0, 1, 2]), ColumnDataKind.INTERVAL),
            (pd.CategoricalIndex(["a", "b", "c"]), ColumnDataKind.STRING),
            (pd.CategoricalIndex([1, 2, 3]), ColumnDataKind.INTEGER),
            (pd.CategoricalIndex([1.1, 2.2, 3.3]), ColumnDataKind.FLOAT),
        ]
    )
    def test_determine_data_kind_with_index(
        self, index: pd.Index, expected_data_kind: ColumnDataKind
    ):
        """Test that _determine_data_kind() returns the expected data kind for a given index."""
        self.assertEqual(
            _determine_data_kind(index, None),
            expected_data_kind,
            f"Expected {index} to be determined as {expected_data_kind} data kind.",
        )

    @parameterized.expand(
        SHARED_DATA_KIND_TEST_CASES
        + [
            (pd.Series([b"a", b"b", b"c"]), ColumnDataKind.BYTES),
            (pd.Series([1, 2, 3]), ColumnDataKind.INTEGER),
            (pd.Series([1 + 2j, 2 + 3j]), ColumnDataKind.COMPLEX),
            (
                pd.Series([pd.Period("2000Q1"), pd.Period("2000Q2")]),
                ColumnDataKind.PERIOD,
            ),
            (pd.Series(["a", "b", "c"]), ColumnDataKind.STRING),
            (
                pd.Series([datetime.date(2000, 1, 1), datetime.date(2000, 1, 2)]),
                ColumnDataKind.DATE,
            ),
            (
                pd.Series([datetime.time(12, 0), datetime.time(13, 0)]),
                ColumnDataKind.TIME,
            ),
            (
                pd.Series([pd.Interval(0, 1), pd.Interval(1, 2)]),
                ColumnDataKind.INTERVAL,
            ),
            (pd.Series([], dtype="object"), ColumnDataKind.EMPTY),
            (pd.Series([None, None]), ColumnDataKind.EMPTY),
            (pd.Series([pd.NA, pd.NA]), ColumnDataKind.EMPTY),
            (pd.Series([[1, 2], [3, 4]]), ColumnDataKind.UNKNOWN),
            (pd.Series([["a", "b"], ["c", "d", "e"]]), ColumnDataKind.UNKNOWN),
            (pd.Series([{"a": 1}, {"b": 2}]), ColumnDataKind.UNKNOWN),
            (pd.Series([pd.Timestamp("2000-01-01"), "a"]), ColumnDataKind.UNKNOWN),
            (pd.Series([1, "a"]), ColumnDataKind.UNKNOWN),
            (pd.Series([TestObject(), TestObject()]), ColumnDataKind.UNKNOWN),
        ]
    )
    def test_determine_data_kind_via_inferred_type(
        self, column: pd.Series, expected_data_kind: ColumnDataKind
    ):
        """Test the data kind determination via the inferred type of the column."""
        # Create copy to not interfere with other tests:
        column = column.copy()
        self.assertEqual(
            _determine_data_kind_via_inferred_type(column),
            expected_data_kind,
            f"Expected {column} to be determined as {expected_data_kind} data kind.",
        )

    @parameterized.expand(
        SHARED_DATA_KIND_TEST_CASES
        + [
            (pd.Series([1, 2, 3]), ColumnDataKind.INTEGER),
            (pd.Series([1 + 2j, 2 + 3j]), ColumnDataKind.COMPLEX),
            (
                pd.Series([pd.Period("2000Q1"), pd.Period("2000Q2")]),
                ColumnDataKind.PERIOD,
            ),
            (
                pd.Series([pd.Interval(0, 1), pd.Interval(1, 2)]),
                ColumnDataKind.INTERVAL,
            ),
            (pd.Series([[1, 2], [3, 4]]), ColumnDataKind.UNKNOWN),
            (pd.Series([["a", "b"], ["c", "d", "e"]]), ColumnDataKind.UNKNOWN),
            (pd.Series([{"a": 1}, {"b": 2}]), ColumnDataKind.UNKNOWN),
            (pd.Series([pd.Timestamp("2000-01-01"), "a"]), ColumnDataKind.UNKNOWN),
            (pd.Series([1, "a"]), ColumnDataKind.UNKNOWN),
            (pd.Series([TestObject(), TestObject()]), ColumnDataKind.UNKNOWN),
        ]
    )
    def test_determine_data_kind_via_pandas_dtype(
        self, column: pd.Series, expected_data_kind: ColumnDataKind
    ):
        """Test that the data kind is correctly determined via the pandas dtype."""
        # Create copy to not interfere with other tests:
        column = column.copy()
        self.assertEqual(
            _determine_data_kind_via_pandas_dtype(column),
            expected_data_kind,
            f"Expected {column} to be determined as {expected_data_kind} data kind.",
        )

    @parameterized.expand(
        SHARED_DATA_KIND_TEST_CASES
        + [
            (pd.Series([1, 2, 3]), ColumnDataKind.INTEGER),
            (pd.Series([b"a", b"b", b"c"]), ColumnDataKind.BYTES),
            (pd.Series(["a", "b", "c"]), ColumnDataKind.STRING),
            (
                pd.Series([datetime.date(2000, 1, 1), datetime.date(2000, 1, 2)]),
                ColumnDataKind.DATE,
            ),
            (
                pd.Series([datetime.time(12, 0), datetime.time(13, 0)]),
                ColumnDataKind.TIME,
            ),
            (pd.Series([Decimal("1.1"), Decimal("2.2")]), ColumnDataKind.DECIMAL),
            (pd.Series([[1, 2], [3, 4]]), ColumnDataKind.LIST),
            (pd.Series([["a", "b"], ["c", "d", "e"]]), ColumnDataKind.LIST),
            (pd.Series([{"a": 1}, {"b": 2}]), ColumnDataKind.DICT),
            (pd.Series([], dtype="object"), ColumnDataKind.EMPTY),
            (pd.Series([None, None]), ColumnDataKind.EMPTY),
            (pd.Series([pd.NA, pd.NA]), ColumnDataKind.EMPTY),
        ]
    )
    def test_determine_data_kind_via_arrow(
        self, column: pd.Series, expected_data_kind: ColumnDataKind
    ):
        """Test that the _determine_data_kind_via_arrow function correctly determines
        the data kind of a column based on the Arrow schema field.
        """
        # Create copy to not interfere with other tests:
        column = column.copy()
        arrow_field = _get_arrow_schema_field(column)

        self.assertIsNotNone(
            arrow_field,
            f"Expected Arrow field to be detected for {column} ({expected_data_kind}).",
        )

        self.assertEqual(
            _determine_data_kind_via_arrow(arrow_field),
            expected_data_kind,
            f"Expected {column} to be determined as {expected_data_kind} data kind.",
        )

    def test_determine_dataframe_schema(self):
        """Test that the determine_dataframe_schema function correctly determines the
        schema of a dataframe.
        """

        df = pd.DataFrame(
            {
                "int": [1, 2, 3],
                "float": [1.1, 2.2, 3.3],
                "bool": [True, False, True],
                "str": ["a", "b", "c"],
                "empty": [None, None, None],
            }
        )

        arrow_schema = pa.Table.from_pandas(df).schema

        self.assertEqual(
            determine_dataframe_schema(df, arrow_schema),
            [
                ColumnDataKind.INTEGER,  # This is the type of the index
                ColumnDataKind.INTEGER,
                ColumnDataKind.FLOAT,
                ColumnDataKind.BOOLEAN,
                ColumnDataKind.STRING,
                ColumnDataKind.EMPTY,
            ],
        )
