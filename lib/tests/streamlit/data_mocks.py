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

import enum
import random
from collections import ChainMap, Counter, OrderedDict, deque
from dataclasses import dataclass
from datetime import date
from typing import NamedTuple

import numpy as np
import pandas as pd
import polars as pl
import pyarrow as pa

from streamlit.dataframe_util import DataFormat
from tests.streamlit.dask_mocks import DataFrame as DaskDataFrame
from tests.streamlit.dask_mocks import Series as DaskSeries
from tests.streamlit.modin_mocks import DataFrame as ModinDataFrame
from tests.streamlit.modin_mocks import Series as ModinSeries
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
    expected_type: type | None = None

    # Tell pytest this is not a TestClass despite having "Test" in the name.
    __test__ = False


@dataclass
class ElementDataClass:
    name: str
    is_widget: bool
    usage: float


class ElementNamedTuple(NamedTuple):
    name: str
    is_widget: bool
    usage: float


class TestObject:
    def __str__(self):
        return "TestObject"


class StrTestEnum(str, enum.Enum):
    NUMBER_INPUT = "st.number_input"
    TEXT_AREA = "st.text_area"
    TEXT_INPUT = "st.text_input"


class TestEnum(enum.Enum):
    NUMBER_INPUT = "st.number_input"
    TEXT_AREA = "st.text_area"
    TEXT_INPUT = "st.text_input"


def data_generator():
    yield "st.number_input"
    yield "st.text_area"
    yield "st.text_input"


SHARED_TEST_CASES = [
    # None:
    (None, TestCaseMetadata(0, 0, DataFormat.EMPTY, pd.DataFrame)),
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
    # Frozenset of strings (FrozenSet[str]):
    # Set does not have a stable order across different Python version.
    # Therefore, we are only testing this with one item.
    (
        frozenset({"st.number_input", "st.number_input"}),  # noqa: B033
        TestCaseMetadata(1, 1, DataFormat.SET_OF_VALUES, set),
    ),
    (
        frozenset(),
        TestCaseMetadata(0, 0, DataFormat.SET_OF_VALUES, set),
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
    # np.matrix:
    (
        np.matrix(
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
        TestCaseMetadata(2, 1, DataFormat.PANDAS_STYLER, pd.DataFrame),
    ),
    # Pandas Index (pd.Index):
    (
        pd.Index(["st.text_area", "st.markdown"]),
        TestCaseMetadata(2, 1, DataFormat.PANDAS_INDEX, pd.DataFrame),
    ),
    # Pyarrow Table (pyarrow.Table):
    (
        pa.Table.from_pandas(pd.DataFrame(["st.text_area", "st.markdown"])),
        TestCaseMetadata(2, 1, DataFormat.PYARROW_TABLE),
    ),
    # Pyarrow Array (pyarrow.Array):
    (
        pa.array(["st.number_input", "st.text_area", "st.text_input"]),
        TestCaseMetadata(3, 1, DataFormat.PYARROW_ARRAY),
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
        SnowparkDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        TestCaseMetadata(2, 2, DataFormat.SNOWPARK_OBJECT, pd.DataFrame),
    ),
    # Snowpark Table:
    (
        SnowparkTable(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        TestCaseMetadata(2, 2, DataFormat.SNOWPARK_OBJECT, pd.DataFrame),
    ),
    # Snowpark Pandas DataFrame:
    (
        SnowpandasDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        TestCaseMetadata(2, 2, DataFormat.SNOWPANDAS_OBJECT, pd.DataFrame),
    ),
    # Snowpark Pandas Series:
    (
        SnowpandasSeries(pd.Series(["st.text_area", "st.markdown"])),
        TestCaseMetadata(2, 1, DataFormat.SNOWPANDAS_OBJECT, pd.DataFrame),
    ),
    # Modin DataFrame:
    (
        ModinDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        TestCaseMetadata(2, 2, DataFormat.MODIN_OBJECT, pd.DataFrame),
    ),
    # Modin Series:
    (
        ModinSeries(pd.Series(["st.text_area", "st.markdown"])),
        TestCaseMetadata(2, 1, DataFormat.MODIN_OBJECT, pd.DataFrame),
    ),
    # Pyspark Dataframe:
    (
        PysparkDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        TestCaseMetadata(2, 2, DataFormat.PYSPARK_OBJECT, pd.DataFrame),
    ),
    # Dask Dataframe:
    (
        DaskDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        TestCaseMetadata(2, 2, DataFormat.DASK_OBJECT, pd.DataFrame),
    ),
    # Dask Series:
    (
        DaskSeries(pd.Series(["st.text_area", "st.markdown"])),
        TestCaseMetadata(2, 1, DataFormat.DASK_OBJECT, pd.DataFrame),
    ),
    # Range:
    (
        range(3),
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    ),
    # Dict Keys:
    (
        {
            "st.number_input": "number",
            "st.text_area": "text",
            "st.text_input": "text",
        }.keys(),
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    ),
    # Dict Values:
    (
        {
            "st.number_input": "number",
            "st.text_area": "text",
            "st.text_input": "text",
        }.values(),
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    ),
    # Dict Items:
    (
        {
            "st.number_input": "number",
            "st.text_area": "text",
            "st.text_input": "text",
        }.items(),
        TestCaseMetadata(3, 2, DataFormat.PANDAS_DATAFRAME, pd.DataFrame),
    ),
    # Counter
    (
        Counter({"st.number_input": 4, "st.text_area": 2}),
        TestCaseMetadata(2, 2, DataFormat.KEY_VALUE_DICT, dict),
    ),
    # Reversed list:
    (
        reversed(["st.number_input", "st.text_area", "st.text_input"]),
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    ),
    # OrderedDict:
    (
        OrderedDict(
            [
                ("st.number_input", "number"),
                ("st.text_area", "text"),
            ]
        ),
        TestCaseMetadata(2, 1, DataFormat.KEY_VALUE_DICT, dict),
    ),
    # Pandas Categorical (pd.Categorical):
    (
        pd.Categorical(["st.number_input", "st.text_area", "st.text_input"]),
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    ),
    # Pandas DatetimeIndex (pd.DatetimeIndex):
    (
        pd.DatetimeIndex(["1/1/2020 10:00:00+00:00", "2/1/2020 11:00:00+00:00"]),
        TestCaseMetadata(3, 1, DataFormat.PANDAS_INDEX, pd.DataFrame),
    ),
    # Pandas RangeIndex (pd.RangeIndex):
    (
        pd.RangeIndex(start=0, stop=3, step=1),
        TestCaseMetadata(3, 1, DataFormat.PANDAS_INDEX, pd.DataFrame),
    ),
    # Deque (collections.deque):
    (
        deque(["st.number_input", "st.text_area", "st.text_input"]),
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    ),
    # ChainMap (collections.ChainMap):
    (
        ChainMap(
            {"st.number_input": "number", "st.text_area": "text"},
            {"st.text_input": "text"},
        ),
        TestCaseMetadata(3, 2, DataFormat.KEY_VALUE_DICT, dict),
    ),
    # Dataclass:
    (
        ElementDataClass("st.number_input", is_widget=True, usage=0.32),
        TestCaseMetadata(3, 1, DataFormat.KEY_VALUE_DICT, dict),
    ),
    # NamedTuple:
    (
        ElementNamedTuple("st.number_input", is_widget=True, usage=0.32),
        TestCaseMetadata(3, 1, DataFormat.KEY_VALUE_DICT, dict),
    ),
    # String Enum:
    (
        StrTestEnum,
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    ),
    # Test Enum:
    (
        TestEnum,
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    ),
    # Generator Functions:
    (
        data_generator,
        TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    ),
    # Polars DataFrame:
    (
        pl.DataFrame(
            [
                {"name": "st.text_area", "type": "widget"},
                {"name": "st.markdown", "type": "element"},
            ]
        ),
        TestCaseMetadata(2, 2, DataFormat.POLARS_DATAFRAME),
    ),
    # Polars Series:
    (
        pl.Series("Foo", ["st.text_area", "st.markdown"]),
        TestCaseMetadata(2, 1, DataFormat.POLARS_SERIES),
    ),
    # Polars LazyFrame:
    (
        pl.LazyFrame(
            {
                "name": ["st.text_area", "st.markdown"],
                "type": ["widget", "element"],
            }
        ),
        TestCaseMetadata(2, 2, DataFormat.POLARS_LAZYFRAME, pl.DataFrame),
    ),
    # Map, Generator Instance, Ray Dataset,
]
