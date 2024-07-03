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

import random
from datetime import date
from typing import NamedTuple

import numpy as np
import pandas as pd
import pyarrow as pa

from streamlit.dataframe_util import DataFormat
from tests.streamlit.pyspark_mocks import DataFrame as PysparkDataFrame
from tests.streamlit.snowpandas_mocks import DataFrame as SnowpandasDataFrame
from tests.streamlit.snowpandas_mocks import Series as SnowpandasSeries
from tests.streamlit.snowpark_mocks import DataFrame as SnowparkDataFrame
from tests.streamlit.snowpark_mocks import Table as SnowparkTable

np.random.seed(0)
random.seed(0)


class TestCaseMetadata(NamedTuple):
    expected_rows: int
    expected_cols: int
    expected_data_format: DataFormat

    # Tell pytest this is not a TestClass despite having "Test" in the name.
    __test__ = False


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
        pd.DataFrame(
            columns=["name", "type"], index=pd.RangeIndex(start=0, step=1)
        ),  # Explicitly set the range index to have the same behavior across versions
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
        {"st.number_input", "st.number_input"},  # noqa: B033
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
        SnowparkDataFrame(pd.DataFrame(np.random.randn(2, 2))),
        TestCaseMetadata(2, 2, DataFormat.SNOWPARK_OBJECT),
    ),
    # Snowpark Table:
    (
        SnowparkTable(pd.DataFrame(np.random.randn(2, 2))),
        TestCaseMetadata(2, 2, DataFormat.SNOWPARK_OBJECT),
    ),
    # Snowpark Pandas DataFrame:
    (
        SnowpandasDataFrame(pd.DataFrame(np.random.randn(2, 2))),
        TestCaseMetadata(2, 2, DataFormat.SNOWPANDAS_OBJECT),
    ),
    # Snowpark Pandas Series:
    (
        SnowpandasSeries(pd.Series(np.random.randn(2))),
        TestCaseMetadata(2, 1, DataFormat.SNOWPANDAS_OBJECT),
    ),
    # Pyspark Dataframe:
    (
        PysparkDataFrame(pd.DataFrame(np.random.randn(2, 2))),
        TestCaseMetadata(2, 2, DataFormat.PYSPARK_OBJECT),
    ),
]


class TestObject:
    def __str__(self):
        return "TestObject"
