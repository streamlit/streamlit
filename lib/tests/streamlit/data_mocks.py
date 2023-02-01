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

import random
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import NamedTuple

import numpy as np
import pandas as pd
import pyarrow as pa

from streamlit.type_util import DataFormat
from tests.streamlit.snowpark_mocks import DataFrame as SnowparkDataFrame
from tests.streamlit.snowpark_mocks import Table as SnowparkTable

np.random.seed(0)
random.seed(0)


class TestCaseMetadata(NamedTuple):
    expected_rows: int
    expected_cols: int
    expected_data_format: DataFormat


SHARED_TEST_CASES = [
    # None:
    (None, TestCaseMetadata(0, 0, DataFormat.EMPTY)),
    # Empty list:
    ([], TestCaseMetadata(0, 0, DataFormat.LIST_OF_VALUES)),
    # Empty tuple:
    ((), TestCaseMetadata(0, 0, DataFormat.TUPLE_OF_VALUES)),
    # Empty dict (not a an empty set!)
    ({}, TestCaseMetadata(0, 0, DataFormat.KEY_VALUE_DICT)),
    # Empty set:
    (set(), TestCaseMetadata(0, 0, DataFormat.SET_OF_VALUES)),
    # Empty numpy array:
    # for unknown reasons, pd.DataFrame initializes empty numpy arrays with a single column
    (np.ndarray(0), TestCaseMetadata(0, 1, DataFormat.NUMPY_LIST)),
    # Empty column value mapping with columns:
    ({"name": [], "type": []}, TestCaseMetadata(0, 2, DataFormat.COLUMN_VALUE_MAPPING)),
    # Empty dataframe:
    (pd.DataFrame(), TestCaseMetadata(0, 0, DataFormat.PANDAS_DATAFRAME)),
    # Empty dataframe with columns:
    (
        pd.DataFrame(columns=["name", "type"]),
        TestCaseMetadata(0, 2, DataFormat.PANDAS_DATAFRAME),
    ),
    # Pandas DataFrame:
    (
        pd.DataFrame(["st.text_area", "st.markdown"]),
        TestCaseMetadata(2, 1, DataFormat.PANDAS_DATAFRAME),
    ),
    # List of strings (List[str]):
    (
        ["st.text_area", "st.number_input", "st.text_input"],
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES),
    ),
    # List of integers (List[int]):
    ([1, 2, 3], TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES)),
    # List of floats (List[float]):
    ([1.0, 2.0, 3.0], TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES)),
    # List of booleans (List[bool]):
    ([True, False, True], TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES)),
    # List of Nones (List[None]):
    ([None, None, None], TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES)),
    # List of dates (List[date]):
    (
        [date(2020, 1, 1), date(2020, 1, 2), date(2020, 1, 3)],
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES),
    ),
    # Set of strings (Set[str]):
    # Set does not have a stable order across different Python version.
    # Therefore, we are only testing this with one item.
    (
        {"st.number_input", "st.number_input"},
        TestCaseMetadata(1, 1, DataFormat.SET_OF_VALUES),
    ),
    # Tuple of strings (Tuple[str]):
    (
        ("st.text_area", "st.number_input", "st.text_input"),
        TestCaseMetadata(3, 1, DataFormat.TUPLE_OF_VALUES),
    ),
    # Numpy list / 1D numpy array (np.array[str]):
    (
        np.array(["st.text_area", "st.number_input", "st.text_input"]),
        TestCaseMetadata(3, 1, DataFormat.NUMPY_LIST),
    ),
    # np.array[int]:
    (np.array([1, 2, 3]), TestCaseMetadata(3, 1, DataFormat.NUMPY_LIST)),
    # Multi-dimensional numpy array (np.array[List[Scalar]])
    (
        np.array(
            [
                ["st.text_area", "widget"],
                ["st.markdown", "element"],
            ]
        ),
        TestCaseMetadata(2, 2, DataFormat.NUMPY_MATRIX),
    ),
    # np.array[List[str]]:
    (
        np.array([["st.text_area"], ["st.number_input"], ["st.text_input"]]),
        TestCaseMetadata(3, 1, DataFormat.NUMPY_MATRIX),
    ),
    # Pandas Series (pd.Series):
    (
        pd.Series(["st.text_area", "st.number_input", "st.text_input"], name="widgets"),
        TestCaseMetadata(3, 1, DataFormat.PANDAS_SERIES),
    ),
    # Pandas Styler (pd.Styler):
    (
        pd.DataFrame(["st.text_area", "st.markdown"]).style,
        TestCaseMetadata(2, 1, DataFormat.PANDAS_STYLER),
    ),
    # Pandas Index (pd.Index):
    (
        pd.Index(["st.text_area", "st.markdown"]),
        TestCaseMetadata(2, 1, DataFormat.PANDAS_INDEX),
    ),
    # Pyarrow Table (pyarrow.Table):
    (
        pa.Table.from_pandas(pd.DataFrame(["st.text_area", "st.markdown"])),
        TestCaseMetadata(2, 1, DataFormat.PYARROW_TABLE),
    ),
    # List of rows (List[List[Scalar]]):
    (
        [["st.text_area", "widget"], ["st.markdown", "element"]],
        TestCaseMetadata(2, 2, DataFormat.LIST_OF_ROWS),
    ),
    # List of records (List[Dict[str, Scalar]]):
    (
        [
            {"name": "st.text_area", "type": "widget"},
            {"name": "st.markdown", "type": "element"},
        ],
        TestCaseMetadata(2, 2, DataFormat.LIST_OF_RECORDS),
    ),
    # Column-index mapping ({column: {index: value}}):
    (
        {
            "type": {"st.text_area": "widget", "st.markdown": "element"},
            "usage": {"st.text_area": 4.92, "st.markdown": 47.22},
        },
        TestCaseMetadata(2, 2, DataFormat.COLUMN_INDEX_MAPPING),
    ),
    # Column-value mapping ({column: List[values]}}):
    (
        {
            "name": ["st.text_area", "st.markdown"],
            "type": ["widget", "element"],
        },
        TestCaseMetadata(2, 2, DataFormat.COLUMN_VALUE_MAPPING),
    ),
    # Column-series mapping ({column: Series(values)}):
    (
        {
            "name": pd.Series(["st.text_area", "st.markdown"], name="name"),
            "type": pd.Series(["widget", "element"], name="type"),
        },
        TestCaseMetadata(2, 2, DataFormat.COLUMN_SERIES_MAPPING),
    ),
    # Key-value dict ({index: value}):
    (
        {"st.text_area": "widget", "st.markdown": "element"},
        TestCaseMetadata(2, 1, DataFormat.KEY_VALUE_DICT),
    ),
    # Snowpark DataFrame:
    (
        SnowparkDataFrame(num_of_rows=2, num_of_cols=2),
        TestCaseMetadata(2, 2, DataFormat.SNOWPARK_OBJECT),
    ),
    # Snowpark Table:
    (
        SnowparkTable(num_of_rows=2, num_of_cols=2),
        TestCaseMetadata(2, 2, DataFormat.SNOWPARK_OBJECT),
    ),
]


def random_date() -> datetime:
    start_date = datetime.fromisoformat("2018-01-31T09:24:31.488670+00:00")
    end_date = datetime.fromisoformat("2022-01-31T09:24:31.488670+00:00")

    return (
        start_date
        + timedelta(
            # Get a random amount of seconds between `start` and `end`
            seconds=random.randint(0, int((end_date - start_date).total_seconds())),
        )
    ).replace(tzinfo=None)


class TestObject(object):
    def __str__(self):
        return "TestObject"


BASE_TYPES_DF = pd.DataFrame(
    {
        "string": [
            "a",
            "this is a very long sentence that does not contain any reasonable content.",
            "c",
            "d",
            "",
            None,
        ],
        "bool": [True, False, True, False, True, None],
        "int64": [-5, 1, 2, 3, 4, 5],
        "float64": [-0.1, 0, 0.1, 0.001, 1.1, None],
        "datetime": [
            datetime(2020, 1, 1, 0, 0, 0),
            datetime(2020, 1, 1, 0, 0, 1),
            datetime(2020, 1, 1, 0, 0, 2),
            datetime(2020, 1, 1, 0, 0, 3),
            datetime(2020, 1, 1, 0, 0, 4),
            None,
        ],
        "date": [
            date(2020, 1, 1),
            date(2020, 1, 2),
            date(2020, 1, 3),
            date(2020, 1, 4),
            date(2020, 1, 5),
            None,
        ],
        "time": [
            time(0, 0, 0),
            time(0, 0, 1),
            time(0, 0, 2),
            time(0, 0, 3),
            time(0, 0, 4),
            None,
        ],
        "empty": [None, np.nan, pd.NA, pd.NaT, None, None],
    }
)

NUMBER_TYPES_DF = pd.DataFrame(
    {
        "int64": pd.array([-5, 1, 2, 3, 4, None], dtype="Int64"),
        "int32": pd.array([-5, 1, 2, 3, 4, None], dtype="Int32"),
        "int16": pd.array([-5, 1, 2, 3, 4, None], dtype="Int16"),
        "int8": pd.array([-5, 1, 2, 3, 4, None], dtype="Int8"),
        "uint64": pd.array([1, 2, 3, 4, 5, None], dtype="UInt64"),
        "uint32": pd.array([1, 2, 3, 4, 5, None], dtype="UInt32"),
        "uint16": pd.array([1, 2, 3, 4, 5, None], dtype="UInt16"),
        "uint8": pd.array([1, 2, 3, 4, 5, None], dtype="UInt8"),
        "float64": pd.array([-0.1, 0, 0.1, 0.001, 1.1, None], dtype="float64"),
        "float32": pd.array([-0.1, 0, 0.1, 0.001, 1.1, None], dtype="float32"),
        "float16": pd.array([-0.1, 0, 0.1, 0.001, 1.1, None], dtype="float16"),
        "mixed": pd.array([1, -2, 3.1, 4, 5.0, None]),
    }
)

DATETIME_TYPES_DF = pd.DataFrame(
    {
        "datetime": [random_date() for _ in range(8)] + [None],
        "time": [random_date().time() for _ in range(8)] + [None],
        "date": [random_date().date() for _ in range(8)] + [None],
        "mixed_datetime": [
            random.choice(
                [
                    pd.Timestamp(random_date()),
                    np.datetime64("2022-03-11T17:13:00")
                    - np.random.randint(400000, 1500000),
                    pd.to_datetime(10, unit="s"),
                ]
            )
            for _ in range(8)
        ]
        + [None],
        "pd_datetime_TZ": [
            (pd.to_datetime("2022-03-11 17:41:00-05:00")) for _ in range(8)
        ]
        + [None],
        "datetime_UTC_TZ": [
            random_date().replace(tzinfo=timezone.utc) for _ in range(8)
        ]
        + [None],
        # TODO: Mixed timezones within a column will force the column to be of type object
        # It also seems to not work correctly.
        "mixed_timezones": [
            random.choice(
                [
                    random_date().replace(tzinfo=timezone.utc),
                    pd.to_datetime("2022-03-11 17:41:00-05:00"),
                    random_date(),
                ]
            )
            for _ in range(8)
        ]
        + [None],
    }
)

LIST_TYPES_DF = pd.DataFrame(
    {
        "string_list": pd.Series(
            [["a", "b", "c"], ["foo", "bar"], list(["lorem"]), [], None]
        ),
        "number_set": pd.Series([{1, 2, 3}, {2, 3}, {4, 4}, set(), None]),
        "boolean_tuple": [
            (True, False),
            (False, True, True),
            (True, True),
            tuple(),
            None,
        ],
        "dict_list": [
            [{"foo": random.randint(0, 1000), "bar": "blub"} for _ in range(2)]
            for _ in range(4)
        ]
        + [None],
        "datetime_list": [[random_date() for _ in range(2)] for _ in range(4)] + [None],
    }
)

INTERVAL_TYPES_DF = pd.DataFrame(
    {
        "int64_both": [
            pd.Interval(left=i, right=i + 1, closed="both") for i in range(5)
        ]
        + [None],
        "int64_right": [
            pd.Interval(left=i, right=i + 1, closed="right") for i in range(5)
        ]
        + [None],
        "int64_left": [
            pd.Interval(left=i, right=i + 1, closed="left") for i in range(5)
        ]
        + [None],
        "int64_neither": [
            pd.Interval(left=i, right=i + 1, closed="neither") for i in range(5)
        ]
        + [None],
        "timestamp_right_default": [
            pd.Interval(
                left=pd.Timestamp(2022, 3, 14, i),
                right=pd.Timestamp(2022, 3, 14, i + 1),
            )
            for i in range(5)
        ]
        + [None],
        "float64": [
            pd.Interval(np.random.random(), np.random.random() + 1) for _ in range(5)
        ]
        + [None],
    }
)

SPECIAL_TYPES_DF = pd.DataFrame(
    {
        "categorical": pd.Series(["a", "b", "c", "a", None]).astype("category"),
        "decimal": pd.Series(
            [Decimal("1.1"), Decimal("2.2"), Decimal("1000"), Decimal("2.212"), None]
        ),
        "bytes": pd.Series(
            [
                b"a",
                b"b",
                b"foo",
                b"bar",
                None,
            ]
        ),
        "emojis 🌈": pd.Series(["Black ⚫", "Red 🔴", "White ⚪", "Red 🔴", None]),
    }
)

UNSUPPORTED_TYPES_DF = pd.DataFrame(
    {
        "period[H]": [
            (pd.Period("2022-03-14 11:52:00", freq="H") + pd.offsets.Hour(i))
            for i in range(3)
        ],
        "period[D]": [(pd.Period(random_date().date(), freq="D")) for _ in range(3)],
        "complex": pd.Series([1 + 2j, 3 + 4j, 5 + 6 * 1j]),
        "timedelta": pd.Series(
            [pd.Timedelta("1 days"), np.timedelta64(366, "D"), pd.Timedelta("2 hours")]
        ),
        "mixed_integer": pd.Series([1, 2, "3"]),
        "mixed_types": pd.Series([2.1, "3", True]),
        "frozenset": pd.Series(
            [frozenset([1, 2]), frozenset([3, 4]), frozenset([5, 6])]
        ),
        "dicts": pd.Series([{"a": 1}, {"b": 2}, {"c": 2}]),
        "objects": pd.Series([TestObject(), TestObject(), TestObject()]),
        # TODO(lukasmasuch): Not supported, but currently leads to error
        # "mixed_types_list": pd.Series(
        #     [random.choice([1, 1.0, None, "foo"]) for _ in range(10)]
        #     for _ in range(n_rows)
        # ),
        # TODO(lukasmasuch): Sparse array is supported, but currently leads to error
        # "sparse-array": pd.Series(
        #     pd.arrays.SparseArray([random.choice([0, 1, 2]) for _ in range(n_rows)])
        # ),
    }
)
