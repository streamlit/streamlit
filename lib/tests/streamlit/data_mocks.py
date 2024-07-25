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
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal, NamedTuple

import numpy as np
import pandas as pd

from streamlit.dataframe_util import DataFormat

np.random.seed(0)
random.seed(0)


class CaseMetadata(NamedTuple):
    expected_rows: int
    expected_cols: int
    expected_data_format: DataFormat
    expected_sequence: list[Any]
    expected_write_command: Literal["markdown", "dataframe", "json"]
    expected_type: type | None = None


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


SHARED_TEST_CASES: list[tuple[str, Any, CaseMetadata]] = [
    ("None", None, CaseMetadata(0, 0, DataFormat.EMPTY, [], "markdown", pd.DataFrame)),
    (
        "Empty list",
        [],
        CaseMetadata(0, 0, DataFormat.LIST_OF_VALUES, [], "json"),
    ),
    (
        "Empty tuple",
        (),
        CaseMetadata(0, 0, DataFormat.TUPLE_OF_VALUES, [], "markdown"),
    ),
    ("Empty dict", {}, CaseMetadata(0, 0, DataFormat.KEY_VALUE_DICT, [], "json")),
    ("Empty set", set(), CaseMetadata(0, 0, DataFormat.SET_OF_VALUES, [], "markdown")),
    (
        "Empty np.array",
        # For unknown reasons, pd.DataFrame initializes empty numpy arrays with a single column
        np.ndarray(0),
        CaseMetadata(0, 1, DataFormat.NUMPY_LIST, [], "dataframe"),
    ),
    (
        "Empty column value mapping",
        {"name": [], "type": []},
        CaseMetadata(0, 2, DataFormat.COLUMN_VALUE_MAPPING, ["name", "type"], "json"),
    ),
    (
        "Empty pd.Dataframe",
        pd.DataFrame(),
        CaseMetadata(0, 0, DataFormat.PANDAS_DATAFRAME, [], "dataframe"),
    ),
    (
        "Empty pd.Dataframe with columns",
        pd.DataFrame(
            columns=["name", "type"], index=pd.RangeIndex(start=0, step=1)
        ),  # Explicitly set the range index to have the same behavior across versions
        CaseMetadata(0, 2, DataFormat.PANDAS_DATAFRAME, [], "dataframe"),
    ),
    (
        "pd.Dataframe",
        pd.DataFrame(["st.text_area", "st.markdown"]),
        CaseMetadata(
            2,
            1,
            DataFormat.PANDAS_DATAFRAME,
            ["st.text_area", "st.markdown"],
            "dataframe",
        ),
    ),
    (
        "List[str]",
        ["st.text_area", "st.number_input", "st.text_input"],
        CaseMetadata(
            3,
            1,
            DataFormat.LIST_OF_VALUES,
            ["st.text_area", "st.number_input", "st.text_input"],
            "json",
        ),
    ),
    # (
    #     [1, 2, 3],
    #     TestCaseMetadata("List[int]", 3, 1, DataFormat.LIST_OF_VALUES, [1, 2, 3]),
    # ),
    (
        "List[int]",
        [1, 2, 3],
        CaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, [1, 2, 3], "json"),
    ),
    # (
    #     [1.1, 2.2, 3.3],
    #     TestCaseMetadata(
    #         "List[float]", 3, 1, DataFormat.LIST_OF_VALUES, [1.1, 2.2, 3.3]
    #     ),
    # ),
    (
        "List[float]",
        [1.1, 2.2, 3.3],
        CaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, [1.1, 2.2, 3.3], "json"),
    ),
    # (
    #     [True, False, True],
    #     TestCaseMetadata(
    #         "List[bool]", 3, 1, DataFormat.LIST_OF_VALUES, [True, False, True]
    #     ),
    # ),
    (
        "List[bool]",
        [True, False, True],
        CaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, [True, False, True], "json"),
    ),
    # (
    #     [None, None, None],
    #     TestCaseMetadata(
    #         "List[None]", 3, 1, DataFormat.LIST_OF_VALUES, [None, None, None]
    #     ),
    # ),
    (
        "List[None]",
        [None, None, None],
        CaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, [None, None, None], "json"),
    ),
    # (
    #     [date(2020, 1, 1), date(2020, 1, 2), date(2020, 1, 3)],
    #     TestCaseMetadata(
    #         "List[date]",
    #         3,
    #         1,
    #         DataFormat.LIST_OF_VALUES,
    #         [date(2020, 1, 1), date(2020, 1, 2), date(2020, 1, 3)],
    #     ),
    # ),
    (
        "List[date]",
        [date(2020, 1, 1), date(2020, 1, 2), date(2020, 1, 3)],
        CaseMetadata(
            3,
            1,
            DataFormat.LIST_OF_VALUES,
            [date(2020, 1, 1), date(2020, 1, 2), date(2020, 1, 3)],
            "json",
        ),
    ),
    # (
    #     # Set does not have a stable order across different Python version.
    #     # Therefore, we are only testing this with one item.
    #     {"st.number_input", "st.number_input"},
    #     TestCaseMetadata(
    #         "Set[str]", 1, 1, DataFormat.SET_OF_VALUES, {"st.number_input"}
    #     ),
    # ),
    (
        "Set[str]",
        # Set does not have a stable order across different Python version.
        # Therefore, we are only testing this with one item.
        {"st.number_input", "st.number_input"},  # noqa: B033
        CaseMetadata(1, 1, DataFormat.SET_OF_VALUES, ["st.number_input"], "markdown"),
    ),
    # (
    #     # Set does not have a stable order across different Python version.
    #     # Therefore, we are only testing this with one item.
    #     frozenset({"st.number_input", "st.number_input"}),
    #     TestCaseMetadata(
    #         "FrozenSet[str])", 1, 1, DataFormat.SET_OF_VALUES, set, {"st.number_input"}
    #     ),
    # ),
    (
        "Frozenset[str]",
        # Set does not have a stable order across different Python version.
        # Therefore, we are only testing this with one item.
        frozenset({"st.number_input", "st.number_input"}),  # noqa: B033
        CaseMetadata(
            1, 1, DataFormat.SET_OF_VALUES, ["st.number_input"], "markdown", set
        ),
    ),
    # (
    #     frozenset(),
    #     TestCaseMetadata("Empty FrozenSet", 0, 0, DataFormat.SET_OF_VALUES, set, set()),
    # ),
    (
        "Empty frozenset",
        frozenset(),
        CaseMetadata(0, 0, DataFormat.SET_OF_VALUES, [], "markdown", set),
    ),
    # (
    #     ("st.text_area", "st.number_input", "st.text_input"),
    #     TestCaseMetadata(
    #         "Tuple[str]",
    #         3,
    #         1,
    #         DataFormat.TUPLE_OF_VALUES,
    #         ["st.text_area", "st.number_input", "st.text_input"],
    #     ),
    # ),
    (
        "Tuple[str]",
        ("st.text_area", "st.number_input", "st.text_input"),
        CaseMetadata(
            3,
            1,
            DataFormat.TUPLE_OF_VALUES,
            ["st.text_area", "st.number_input", "st.text_input"],
            "markdown",
        ),
    ),
    # (
    #     np.array(["st.text_area", "st.number_input", "st.text_input"]),
    #     TestCaseMetadata("np.array[str]", 3, 1, DataFormat.NUMPY_LIST),
    # ),
    (
        "np.array[str]",
        np.array(["st.text_area", "st.number_input", "st.text_input"]),
        CaseMetadata(
            3,
            1,
            DataFormat.NUMPY_LIST,
            ["st.text_area", "st.number_input", "st.text_input"],
            "dataframe",
        ),
    ),
    # (
    #     np.array([1, 2, 3]),
    #     TestCaseMetadata("np.array[int]", 3, 1, DataFormat.NUMPY_LIST, [1, 2, 3]),
    # ),
    (
        "np.array[int]",
        np.array([1, 2, 3]),
        CaseMetadata(3, 1, DataFormat.NUMPY_LIST, [1, 2, 3], "dataframe"),
    ),
    # (
    #     np.array(
    #         [
    #             ["st.text_area", "widget"],
    #             ["st.markdown", "element"],
    #         ]
    #     ),
    #     TestCaseMetadata(
    #         "np.array[List[Scalar]]",
    #         2,
    #         2,
    #         DataFormat.NUMPY_MATRIX,
    #         ["st.text_area", "st.markdown"],
    #     ),
    # ),
    (
        "np.array[list[scalar]]",
        np.array(
            [
                ["st.text_area", "widget"],
                ["st.markdown", "element"],
            ]
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.NUMPY_MATRIX,
            ["st.text_area", "st.markdown"],
            "dataframe",
        ),
    ),
    # (
    #     np.matrix(
    #         [
    #             ["st.text_area", "widget"],
    #             ["st.markdown", "element"],
    #         ]
    #     ),
    #     TestCaseMetadata(
    #         "np.matrix", 2, 2, DataFormat.NUMPY_MATRIX, ["st.text_area", "st.markdown"]
    #     ),
    # ),
    (
        "np.matrix",
        np.matrix(
            [
                ["st.text_area", "widget"],
                ["st.markdown", "element"],
            ]
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.NUMPY_MATRIX,
            ["st.text_area", "st.markdown"],
            "dataframe",
            np.ndarray,
        ),
    ),
    # # np.array[List[str]]:
    # (
    #     np.array([["st.text_area"], ["st.number_input"], ["st.text_input"]]),
    #     TestCaseMetadata(3, 1, DataFormat.NUMPY_MATRIX),
    # ),
    (
        "np.array[list[str]]",
        np.array([["st.text_area"], ["st.number_input"], ["st.text_input"]]),
        CaseMetadata(
            3,
            1,
            DataFormat.NUMPY_MATRIX,
            ["st.text_area", "st.number_input", "st.text_input"],
            "dataframe",
        ),
    ),
    # # Pandas Series (pd.Series):
    # (
    #     pd.Series(["st.text_area", "st.number_input", "st.text_input"], name="widgets"),
    #     TestCaseMetadata(3, 1, DataFormat.PANDAS_SERIES),
    # ),
    (
        "pd.Series[str]",
        pd.Series(["st.text_area", "st.number_input", "st.text_input"], name="widgets"),
        CaseMetadata(
            3,
            1,
            DataFormat.PANDAS_SERIES,
            ["st.text_area", "st.number_input", "st.text_input"],
            "dataframe",
        ),
    ),
    # # Pandas Styler (pd.Styler):
    # (
    #     pd.DataFrame(["st.text_area", "st.markdown"]).style,
    #     TestCaseMetadata(2, 1, DataFormat.PANDAS_STYLER, pd.DataFrame),
    # ),
    (
        "Pandas Styler",
        pd.DataFrame(["st.text_area", "st.markdown"]).style,
        CaseMetadata(
            2,
            1,
            DataFormat.PANDAS_STYLER,
            ["st.text_area", "st.markdown"],
            "dataframe",
            pd.DataFrame,
        ),
    ),
    # # Pandas Index (pd.Index):
    # (
    #     pd.Index(["st.text_area", "st.markdown"]),
    #     TestCaseMetadata(2, 1, DataFormat.PANDAS_INDEX, pd.DataFrame),
    # ),
    # # Pyarrow Table (pyarrow.Table):
    # (
    #     pa.Table.from_pandas(pd.DataFrame(["st.text_area", "st.markdown"])),
    #     TestCaseMetadata(2, 1, DataFormat.PYARROW_TABLE),
    # ),
    # # Pyarrow Array (pyarrow.Array):
    # (
    #     pa.array(["st.number_input", "st.text_area", "st.text_input"]),
    #     TestCaseMetadata(3, 1, DataFormat.PYARROW_ARRAY),
    # ),
    # # List of rows (List[List[Scalar]]):
    # (
    #     [["st.text_area", "widget"], ["st.markdown", "element"]],
    #     TestCaseMetadata(2, 2, DataFormat.LIST_OF_ROWS),
    # ),
    # # List of records (List[Dict[str, Scalar]]):
    # (
    #     [
    #         {"name": "st.text_area", "type": "widget"},
    #         {"name": "st.markdown", "type": "element"},
    #     ],
    #     TestCaseMetadata(2, 2, DataFormat.LIST_OF_RECORDS),
    # ),
    # # Column-index mapping ({column: {index: value}}):
    # (
    #     {
    #         "type": {"st.text_area": "widget", "st.markdown": "element"},
    #         "usage": {"st.text_area": 4.92, "st.markdown": 47.22},
    #     },
    #     TestCaseMetadata(2, 2, DataFormat.COLUMN_INDEX_MAPPING),
    # ),
    # # Column-value mapping ({column: List[values]}}):
    # (
    #     {
    #         "name": ["st.text_area", "st.markdown"],
    #         "type": ["widget", "element"],
    #     },
    #     TestCaseMetadata(2, 2, DataFormat.COLUMN_VALUE_MAPPING),
    # ),
    # # Column-series mapping ({column: Series(values)}):
    # (
    #     {
    #         "name": pd.Series(["st.text_area", "st.markdown"], name="name"),
    #         "type": pd.Series(["widget", "element"], name="type"),
    #     },
    #     TestCaseMetadata(2, 2, DataFormat.COLUMN_SERIES_MAPPING),
    # ),
    # # Key-value dict ({index: value}):
    # (
    #     {"st.text_area": "widget", "st.markdown": "element"},
    #     TestCaseMetadata(2, 1, DataFormat.KEY_VALUE_DICT),
    # ),
    # # Snowpark DataFrame:
    # (
    #     SnowparkDataFrame(
    #         pd.DataFrame(
    #             [
    #                 {"name": "st.text_area", "type": "widget"},
    #                 {"name": "st.markdown", "type": "element"},
    #             ]
    #         )
    #     ),
    #     TestCaseMetadata(2, 2, DataFormat.SNOWPARK_OBJECT, pd.DataFrame),
    # ),
    # # Snowpark Table:
    # (
    #     SnowparkTable(
    #         pd.DataFrame(
    #             [
    #                 {"name": "st.text_area", "type": "widget"},
    #                 {"name": "st.markdown", "type": "element"},
    #             ]
    #         )
    #     ),
    #     TestCaseMetadata(2, 2, DataFormat.SNOWPARK_OBJECT, pd.DataFrame),
    # ),
    # # Snowpark Pandas DataFrame:
    # (
    #     SnowpandasDataFrame(
    #         pd.DataFrame(
    #             [
    #                 {"name": "st.text_area", "type": "widget"},
    #                 {"name": "st.markdown", "type": "element"},
    #             ]
    #         )
    #     ),
    #     TestCaseMetadata(2, 2, DataFormat.SNOWPANDAS_OBJECT, pd.DataFrame),
    # ),
    # # Snowpark Pandas Series:
    # (
    #     SnowpandasSeries(pd.Series(["st.text_area", "st.markdown"])),
    #     TestCaseMetadata(2, 1, DataFormat.SNOWPANDAS_OBJECT, pd.DataFrame),
    # ),
    # # Modin DataFrame:
    # (
    #     ModinDataFrame(
    #         pd.DataFrame(
    #             [
    #                 {"name": "st.text_area", "type": "widget"},
    #                 {"name": "st.markdown", "type": "element"},
    #             ]
    #         )
    #     ),
    #     TestCaseMetadata(2, 2, DataFormat.MODIN_OBJECT, pd.DataFrame),
    # ),
    # # Modin Series:
    # (
    #     ModinSeries(pd.Series(["st.text_area", "st.markdown"])),
    #     TestCaseMetadata(2, 1, DataFormat.MODIN_OBJECT, pd.DataFrame),
    # ),
    # # Pyspark Dataframe:
    # (
    #     PysparkDataFrame(
    #         pd.DataFrame(
    #             [
    #                 {"name": "st.text_area", "type": "widget"},
    #                 {"name": "st.markdown", "type": "element"},
    #             ]
    #         )
    #     ),
    #     TestCaseMetadata(2, 2, DataFormat.PYSPARK_OBJECT, pd.DataFrame),
    # ),
    # # Dask Dataframe:
    # (
    #     DaskDataFrame(
    #         pd.DataFrame(
    #             [
    #                 {"name": "st.text_area", "type": "widget"},
    #                 {"name": "st.markdown", "type": "element"},
    #             ]
    #         )
    #     ),
    #     TestCaseMetadata(2, 2, DataFormat.DASK_OBJECT, pd.DataFrame),
    # ),
    # # Dask Series:
    # (
    #     DaskSeries(pd.Series(["st.text_area", "st.markdown"])),
    #     TestCaseMetadata(2, 1, DataFormat.DASK_OBJECT, pd.DataFrame),
    # ),
    # # Range:
    # (
    #     range(3),
    #     TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    # ),
    # # Dict Keys:
    # (
    #     {
    #         "st.number_input": "number",
    #         "st.text_area": "text",
    #         "st.text_input": "text",
    #     }.keys(),
    #     TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    # ),
    # # Dict Values:
    # (
    #     {
    #         "st.number_input": "number",
    #         "st.text_area": "text",
    #         "st.text_input": "text",
    #     }.values(),
    #     TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    # ),
    # # Dict Items:
    # (
    #     {
    #         "st.number_input": "number",
    #         "st.text_area": "text",
    #         "st.text_input": "text",
    #     }.items(),
    #     TestCaseMetadata(3, 2, DataFormat.LIST_OF_ROWS, list),
    # ),
    # # Counter
    # (
    #     Counter({"st.number_input": 4, "st.text_area": 2}),
    #     TestCaseMetadata(2, 2, DataFormat.KEY_VALUE_DICT, dict),
    # ),
    # # OrderedDict:
    # (
    #     OrderedDict(
    #         [
    #             ("st.number_input", "number"),
    #             ("st.text_area", "text"),
    #         ]
    #     ),
    #     TestCaseMetadata(2, 1, DataFormat.KEY_VALUE_DICT, dict),
    # ),
    # # Pandas DatetimeIndex (pd.DatetimeIndex):
    # (
    #     pd.DatetimeIndex(["1/1/2020 10:00:00+00:00", "2/1/2020 11:00:00+00:00"]),
    #     TestCaseMetadata(3, 1, DataFormat.PANDAS_INDEX, pd.DataFrame),
    # ),
    # # Pandas RangeIndex (pd.RangeIndex):
    # (
    #     pd.RangeIndex(start=0, stop=3, step=1),
    #     TestCaseMetadata(3, 1, DataFormat.PANDAS_INDEX, pd.DataFrame),
    # ),
    # # Deque (collections.deque):
    # (
    #     deque(["st.number_input", "st.text_area", "st.text_input"]),
    #     TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    # ),
    # # ChainMap (collections.ChainMap):
    # (
    #     ChainMap(
    #         {"st.number_input": "number", "st.text_area": "text"},
    #         {"st.text_input": "text"},
    #     ),
    #     TestCaseMetadata(3, 2, DataFormat.KEY_VALUE_DICT, dict),
    # ),
    # # Dataclass:
    # (
    #     ElementDataClass("st.number_input", is_widget=True, usage=0.32),
    #     TestCaseMetadata(3, 1, DataFormat.KEY_VALUE_DICT, dict),
    # ),
    # # NamedTuple:
    # (
    #     ElementNamedTuple("st.number_input", is_widget=True, usage=0.32),
    #     TestCaseMetadata(3, 1, DataFormat.KEY_VALUE_DICT, dict),
    # ),
    # # String Enum:
    # (
    #     StrTestEnum,
    #     TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    # ),
    # # Test Enum:
    # (
    #     TestEnum,
    #     TestCaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, list),
    # ),
    # # Generator Functions:
    # (
    #     data_generator,
    #     TestCaseMetadata(3, 1, DataFormat.UNKNOWN),
    # ),
    # # Polars DataFrame:
    # (
    #     pl.DataFrame(
    #         [
    #             {"name": "st.text_area", "type": "widget"},
    #             {"name": "st.markdown", "type": "element"},
    #         ]
    #     ),
    #     TestCaseMetadata(2, 2, DataFormat.POLARS_DATAFRAME),
    # ),
    # # Polars Series:
    # (
    #     pl.Series(["st.number_input", "st.text_area", "st.text_input"]),
    #     TestCaseMetadata(3, 1, DataFormat.POLARS_SERIES),
    # ),
    # # Polars LazyFrame:
    # (
    #     pl.LazyFrame(
    #         {
    #             "name": ["st.text_area", "st.markdown"],
    #             "type": ["widget", "element"],
    #         }
    #     ),
    #     TestCaseMetadata(2, 2, DataFormat.POLARS_LAZYFRAME, pl.DataFrame),
    # ),
    # # xarray Dataset:
    # (
    #     xr.Dataset.from_dataframe(
    #         pd.DataFrame(
    #             {
    #                 "name": ["st.text_area", "st.markdown"],
    #                 "type": ["widget", "element"],
    #             }
    #         )
    #     ),
    #     TestCaseMetadata(2, 2, DataFormat.XARRAY_DATASET),
    # ),
    # # xarray DataArray:
    # (
    #     xr.DataArray.from_series(
    #         pd.Series(
    #             ["st.number_input", "st.text_area", "st.text_input"], name="widgets"
    #         )
    #     ),
    #     TestCaseMetadata(3, 1, DataFormat.XARRAY_DATA_ARRAY),
    # ),
    # # defaultdict:
    # (
    #     defaultdict(
    #         lambda: "Not Present",
    #         {"st.text_area": "widget", "st.markdown": "element"},
    #     ),
    #     TestCaseMetadata(2, 1, DataFormat.KEY_VALUE_DICT, dict),
    # ),
    # # Pandas Array:
    # (
    #     pd.array(["st.number_input", "st.text_area", "st.text_input"]),
    #     TestCaseMetadata(3, 1, DataFormat.PANDAS_ARRAY, pd.DataFrame),
    # ),
    # # Map, Generator Instance, Ray Dataset,
]
