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

import array
import enum
import random
from collections import (
    ChainMap,
    Counter,
    OrderedDict,
    UserDict,
    UserList,
    defaultdict,
    deque,
)
from dataclasses import dataclass
from datetime import date
from types import MappingProxyType
from typing import Any, Literal, NamedTuple, TypedDict

import numpy as np
import pandas as pd
import pyarrow as pa

from streamlit.dataframe_util import DataFormat, is_pandas_version_less_than
from tests.streamlit.data_mocks.dask_mocks import DataFrame as DaskDataFrame
from tests.streamlit.data_mocks.dask_mocks import Index as DaskIndex
from tests.streamlit.data_mocks.dask_mocks import Series as DaskSeries
from tests.streamlit.data_mocks.modin_mocks import DataFrame as ModinDataFrame
from tests.streamlit.data_mocks.modin_mocks import Series as ModinSeries
from tests.streamlit.data_mocks.pyspark_connect_mocks import (
    DataFrame as PySparkConnectDataFrame,
)
from tests.streamlit.data_mocks.pyspark_mocks import DataFrame as PySparkDataFrame
from tests.streamlit.data_mocks.ray_mocks import Dataset as RayDataset
from tests.streamlit.data_mocks.ray_mocks import (
    MaterializedDataset as RayMaterializedDataset,
)
from tests.streamlit.data_mocks.snowpandas_mocks import DataFrame as SnowpandasDataFrame
from tests.streamlit.data_mocks.snowpandas_mocks import Index as SnowpandasIndex
from tests.streamlit.data_mocks.snowpandas_mocks import Series as SnowpandasSeries
from tests.streamlit.data_mocks.snowpark_mocks import DataFrame as SnowparkDataFrame
from tests.streamlit.data_mocks.snowpark_mocks import Row as SnowparkRow
from tests.streamlit.data_mocks.snowpark_mocks import Table as SnowparkTable

np.random.seed(0)
random.seed(0)


class CaseMetadata(NamedTuple):
    # The expected number of rows
    expected_rows: int
    # The expected number of columns (doesn't include index columns)
    expected_cols: int
    # The expected data format
    expected_data_format: DataFormat
    # The expected sequence when the data is converted to a sequence
    # If None, the sequence is not checked.
    expected_sequence: list[Any]
    # The expected command used when the data is written via `st.write`
    expected_write_command: Literal[
        "markdown", "dataframe", "json", "help", "write_stream"
    ]
    # Whether the data structure is unevaluated and will be truncated
    # if it is too large.
    is_unevaluated: bool
    # The expected return type of the data when it is
    # returned from the `st.data_editor` function.
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


class ElementTypedDict(TypedDict):
    name: str
    is_widget: bool
    usage: float


class UserDictExample(UserDict):  # type: ignore
    pass


class TestObject:
    def __str__(self):
        return "TestObject"


class CustomDataframe:
    """A dummy dataframe-like class that supports the dataframe interchange protocol
    (__dataframe__ method).
    """

    def __init__(self, data: pd.DataFrame):
        self._data: pd.DataFrame = data

    def __dataframe__(self, allow_copy: bool = True):
        return self._data.__dataframe__(allow_copy=allow_copy)


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
    ###################################
    ####### Native Python Types #######
    ###################################
    (
        "None",
        None,
        CaseMetadata(0, 0, DataFormat.EMPTY, [], "markdown", False, pd.DataFrame),
    ),
    (
        "Empty list",
        [],
        CaseMetadata(0, 0, DataFormat.LIST_OF_VALUES, [], "json", False),
    ),
    (
        "Empty tuple",
        (),
        CaseMetadata(0, 0, DataFormat.TUPLE_OF_VALUES, [], "markdown", False),
    ),
    (
        "Empty dict",
        {},
        CaseMetadata(0, 0, DataFormat.KEY_VALUE_DICT, [], "json", False),
    ),
    (
        "Empty set",
        set(),
        CaseMetadata(0, 0, DataFormat.SET_OF_VALUES, [], "markdown", False),
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
            False,
        ),
    ),
    (
        "List[int]",
        [1, 2, 3],
        CaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, [1, 2, 3], "json", False),
    ),
    (
        "List[float]",
        [1.1, 2.2, 3.3],
        CaseMetadata(3, 1, DataFormat.LIST_OF_VALUES, [1.1, 2.2, 3.3], "json", False),
    ),
    (
        "List[bool]",
        [True, False, True],
        CaseMetadata(
            3, 1, DataFormat.LIST_OF_VALUES, [True, False, True], "json", False
        ),
    ),
    (
        "List[None]",
        [None, None, None],
        CaseMetadata(
            3, 1, DataFormat.LIST_OF_VALUES, [None, None, None], "json", False
        ),
    ),
    (
        "List[date]",
        [date(2020, 1, 1), date(2020, 1, 2), date(2020, 1, 3)],
        CaseMetadata(
            3,
            1,
            DataFormat.LIST_OF_VALUES,
            [date(2020, 1, 1), date(2020, 1, 2), date(2020, 1, 3)],
            "json",
            False,
        ),
    ),
    (
        "Set[str]",
        # Set does not have a stable order across different Python version.
        # Therefore, we are only testing this with one item.
        {"st.number_input", "st.number_input"},  # noqa: B033
        CaseMetadata(
            1, 1, DataFormat.SET_OF_VALUES, ["st.number_input"], "markdown", False
        ),
    ),
    (
        "Tuple[str]",
        ("st.text_area", "st.number_input", "st.text_input"),
        CaseMetadata(
            3,
            1,
            DataFormat.TUPLE_OF_VALUES,
            ["st.text_area", "st.number_input", "st.text_input"],
            "markdown",
            False,
        ),
    ),
    (
        "Frozenset[str]",
        # Set does not have a stable order across different Python version.
        # Therefore, we are only testing this with one item.
        frozenset({"st.number_input", "st.number_input"}),  # noqa: B033
        CaseMetadata(
            1,
            1,
            DataFormat.SET_OF_VALUES,
            ["st.number_input"],
            "markdown",
            False,
            set,
        ),
    ),
    (
        "Empty frozenset",
        frozenset(),
        CaseMetadata(0, 0, DataFormat.SET_OF_VALUES, [], "markdown", False, set),
    ),
    (
        "Range",
        range(3),
        CaseMetadata(
            3, 1, DataFormat.LIST_OF_VALUES, [0, 1, 2], "markdown", False, list
        ),
    ),
    (
        "Dict Keys",
        {
            "st.number_input": "number",
            "st.text_area": "text",
            "st.text_input": "text",
        }.keys(),
        CaseMetadata(
            3,
            1,
            DataFormat.LIST_OF_VALUES,
            ["st.number_input", "st.text_area", "st.text_input"],
            "json",
            False,
            list,
        ),
    ),
    (
        "Dict Values",
        {
            "st.number_input": "number",
            "st.text_area": "text",
            "st.text_input": "text",
        }.values(),
        CaseMetadata(
            3,
            1,
            DataFormat.LIST_OF_VALUES,
            ["number", "text", "text"],
            "json",
            False,
            list,
        ),
    ),
    (
        "Dict Items",
        {
            "st.number_input": "number",
            "st.text_area": "text",
            "st.text_input": "text",
        }.items(),
        CaseMetadata(
            3,
            2,
            DataFormat.LIST_OF_ROWS,
            [
                ("st.number_input", "number"),
                ("st.text_area", "text"),
                ("st.text_input", "text"),
            ],
            "json",
            False,
            list,
        ),
    ),
    (
        "collections.OrderedDict",
        OrderedDict(
            [
                ("st.number_input", "number"),
                ("st.text_area", "text"),
            ]
        ),
        CaseMetadata(
            2,
            1,
            DataFormat.KEY_VALUE_DICT,
            ["st.number_input", "st.text_area"],
            "json",
            False,
            dict,
        ),
    ),
    (
        "collections.defaultdict",
        defaultdict(
            lambda: "Not Present",
            {"st.text_area": "widget", "st.markdown": "element"},
        ),
        CaseMetadata(
            2,
            1,
            DataFormat.KEY_VALUE_DICT,
            ["st.text_area", "st.markdown"],
            "json",
            False,
            dict,
        ),
    ),
    (
        "collections.Counter",
        Counter({"st.number_input": 4, "st.text_area": 2}),
        CaseMetadata(
            2,
            1,
            DataFormat.KEY_VALUE_DICT,
            ["st.number_input", "st.text_area"],
            "json",
            False,
            dict,
        ),
    ),
    (
        "collections.deque",
        deque(["st.number_input", "st.text_area", "st.text_input"]),
        CaseMetadata(
            3,
            1,
            DataFormat.LIST_OF_VALUES,
            ["st.number_input", "st.text_area", "st.text_input"],
            "markdown",
            False,
            list,
        ),
    ),
    (
        "collections.ChainMap",
        ChainMap(
            {"st.number_input": "number", "st.text_area": "text"},
            {"st.text_input": "text"},
        ),
        CaseMetadata(
            3,
            1,
            DataFormat.KEY_VALUE_DICT,
            ["st.number_input", "st.text_area", "st.text_input"],
            "json",
            False,
            dict,
        ),
    ),
    (
        "collections.UserList",
        UserList(["st.number_input", "st.text_area", "st.text_input"]),
        CaseMetadata(
            3,
            1,
            DataFormat.LIST_OF_VALUES,
            ["st.number_input", "st.text_area", "st.text_input"],
            "json",
            False,
            list,
        ),
    ),
    (
        "Dataclass",
        ElementDataClass("st.number_input", is_widget=True, usage=0.32),
        CaseMetadata(
            3,
            1,
            DataFormat.KEY_VALUE_DICT,
            ["st.number_input", True, 0.32],
            "help",
            False,
            dict,
        ),
    ),
    (
        "TypedDict",
        ElementTypedDict(name="st.number_input", is_widget=True, usage=0.32),
        CaseMetadata(
            3,
            1,
            DataFormat.KEY_VALUE_DICT,
            ["name", "is_widget", "usage"],
            "json",
            False,
            dict,
        ),
    ),
    (
        "NamedTuple",
        ElementNamedTuple("st.number_input", is_widget=True, usage=0.32),
        CaseMetadata(
            3,
            1,
            DataFormat.KEY_VALUE_DICT,
            ["st.number_input", True, 0.32],
            "json",
            False,
            dict,
        ),
    ),
    (
        "String Enum",
        StrTestEnum,
        CaseMetadata(
            3,
            1,
            DataFormat.LIST_OF_VALUES,
            ["st.number_input", "st.text_area", "st.text_input"],
            "help",
            False,
            list,
        ),
    ),
    (
        "Enum",
        TestEnum,
        CaseMetadata(
            3,
            1,
            DataFormat.LIST_OF_VALUES,
            [TestEnum.NUMBER_INPUT, TestEnum.TEXT_AREA, TestEnum.TEXT_INPUT],
            "help",
            False,
            list,
        ),
    ),
    (
        "Generator Function",
        data_generator,
        CaseMetadata(
            3,
            1,
            DataFormat.UNKNOWN,
            ["st.number_input", "st.text_area", "st.text_input"],
            "write_stream",
            True,
        ),
    ),
    (
        "Empty column value mapping",
        {"name": [], "type": []},
        CaseMetadata(
            0, 2, DataFormat.COLUMN_VALUE_MAPPING, ["name", "type"], "json", False
        ),
    ),
    (
        "array.array",
        array.array("i", [1, 2, 3]),
        CaseMetadata(
            3, 1, DataFormat.LIST_OF_VALUES, [1, 2, 3], "markdown", False, list
        ),
    ),
    (
        "MappingProxyType",
        MappingProxyType({"st.text_area": "widget", "st.markdown": "element"}),
        CaseMetadata(
            2,
            1,
            DataFormat.KEY_VALUE_DICT,
            ["st.text_area", "st.markdown"],
            "json",
            False,
            dict,
        ),
    ),
    (
        "UserDict",
        UserDictExample({"st.text_area": "widget", "st.markdown": "element"}),
        CaseMetadata(
            2,
            1,
            DataFormat.KEY_VALUE_DICT,
            ["st.text_area", "st.markdown"],
            "json",
            False,
            dict,
        ),
    ),
    (
        "List of rows",  # List[list[scalar]]
        [["st.text_area", "widget"], ["st.markdown", "element"]],
        CaseMetadata(
            2,
            2,
            DataFormat.LIST_OF_ROWS,
            [["st.text_area", "widget"], ["st.markdown", "element"]],
            "json",
            False,
        ),
    ),
    (
        "List of records",  # List[Dict[str, Scalar]]
        [
            {"name": "st.text_area", "type": "widget"},
            {"name": "st.markdown", "type": "element"},
        ],
        CaseMetadata(
            2,
            2,
            DataFormat.LIST_OF_RECORDS,
            [
                {"name": "st.text_area", "type": "widget"},
                {"name": "st.markdown", "type": "element"},
            ],
            "json",
            False,
        ),
    ),
    (
        "Column-index mapping",  # ({column: {index: value}})
        {
            "type": {"st.text_area": "widget", "st.markdown": "element"},
            "usage": {"st.text_area": 4.92, "st.markdown": 47.22},
        },
        CaseMetadata(
            2,
            2,
            DataFormat.COLUMN_INDEX_MAPPING,
            ["type", "usage"],
            "json",
            False,
        ),
    ),
    (
        "Column-value mapping",  # ({column: List[values]}})
        {
            "name": ["st.text_area", "st.markdown"],
            "type": ["widget", "element"],
        },
        CaseMetadata(
            2,
            2,
            DataFormat.COLUMN_VALUE_MAPPING,
            ["name", "type"],
            "json",
            False,
        ),
    ),
    (
        "Column-series mapping",  # ({column: Series(values)})
        {
            "name": pd.Series(["st.text_area", "st.markdown"], name="name"),
            "type": pd.Series(["widget", "element"], name="type"),
        },
        CaseMetadata(
            2,
            2,
            DataFormat.COLUMN_SERIES_MAPPING,
            ["name", "type"],
            "dataframe",
            False,
        ),
    ),
    (
        "Key-value dict",  # ({index: value})
        {"st.text_area": "widget", "st.markdown": "element"},
        CaseMetadata(
            2,
            1,
            DataFormat.KEY_VALUE_DICT,
            ["st.text_area", "st.markdown"],
            "json",
            False,
        ),
    ),
    ###################################
    ########## Pandas Types ###########
    ###################################
    (
        "Empty pd.Dataframe",
        pd.DataFrame(),
        CaseMetadata(0, 0, DataFormat.PANDAS_DATAFRAME, [], "dataframe", False),
    ),
    (
        "Empty pd.Dataframe with columns",
        pd.DataFrame(
            columns=["name", "type"], index=pd.RangeIndex(start=0, step=1)
        ),  # Explicitly set the range index to have the same behavior across versions
        CaseMetadata(0, 2, DataFormat.PANDAS_DATAFRAME, [], "dataframe", False),
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
            False,
        ),
    ),
    (
        "pd.Series[str]",
        pd.Series(
            ["st.text_area", "st.number_input", "st.text_input"],
            name="widgets",
        ),
        CaseMetadata(
            3,
            1,
            DataFormat.PANDAS_SERIES,
            ["st.text_area", "st.number_input", "st.text_input"],
            "dataframe",
            False,
        ),
    ),
    (
        "pd.Index",
        pd.Index(["st.text_area", "st.markdown"]),
        CaseMetadata(
            2,
            1,
            DataFormat.PANDAS_INDEX,
            ["st.text_area", "st.markdown"],
            "dataframe",
            False,
            pd.DataFrame,
        ),
    ),
    (
        "Pandas Styler",
        pd.DataFrame(["st.text_area", "st.markdown"]).style,
        CaseMetadata(
            2,
            1,
            DataFormat.PANDAS_STYLER,
            ["st.text_area", "st.markdown"],
            "dataframe",
            False,
            pd.DataFrame,
        ),
    ),
    (
        "pd.array",
        pd.array(["st.number_input", "st.text_area", "st.text_input"]),
        CaseMetadata(
            3,
            1,
            DataFormat.PANDAS_ARRAY,
            ["st.number_input", "st.text_area", "st.text_input"],
            "dataframe",
            False,
            pd.DataFrame,
        ),
    ),
    (
        "pd.DatetimeIndex",
        pd.DatetimeIndex(["1/1/2020 10:00:00+00:00", "2/1/2020 11:00:00+00:00"]),
        CaseMetadata(
            2,
            1,
            DataFormat.PANDAS_INDEX,
            [
                pd.Timestamp("2020-01-01 10:00:00+0000", tz="UTC"),
                pd.Timestamp("2020-02-01 11:00:00+0000", tz="UTC"),
            ],
            "dataframe",
            False,
            pd.DataFrame,
        ),
    ),
    (
        "pd.RangeIndex",
        pd.RangeIndex(start=0, stop=3, step=1),
        CaseMetadata(
            3, 1, DataFormat.PANDAS_INDEX, [0, 1, 2], "dataframe", False, pd.DataFrame
        ),
    ),
    ###################################
    ########### Numpy Types ###########
    ###################################
    (
        "Empty np.array",
        # For unknown reasons, pd.DataFrame initializes empty numpy arrays with a single column
        np.ndarray(0),
        CaseMetadata(0, 1, DataFormat.NUMPY_LIST, [], "dataframe", False),
    ),
    (
        "np.array[str]",
        np.array(["st.text_area", "st.number_input", "st.text_input"]),
        CaseMetadata(
            3,
            1,
            DataFormat.NUMPY_LIST,
            ["st.text_area", "st.number_input", "st.text_input"],
            "dataframe",
            False,
        ),
    ),
    (
        "np.array[int]",
        np.array([1, 2, 3]),
        CaseMetadata(3, 1, DataFormat.NUMPY_LIST, [1, 2, 3], "dataframe", False),
    ),
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
            False,
        ),
    ),
    (
        "np.array[list[str]]",  # numpy matrix
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
            False,
        ),
    ),
    ###################################
    ########## Pyarrow Types ##########
    ###################################
    (
        "Pyarrow Table",
        pa.Table.from_pandas(pd.DataFrame(["st.text_area", "st.markdown"])),
        CaseMetadata(
            2,
            1,
            DataFormat.PYARROW_TABLE,
            ["st.text_area", "st.markdown"],
            "dataframe",
            False,
        ),
    ),
    (
        "Pyarrow Array",
        pa.array(["st.number_input", "st.text_area", "st.text_input"]),
        CaseMetadata(
            3,
            1,
            DataFormat.PYARROW_ARRAY,
            ["st.number_input", "st.text_area", "st.text_input"],
            "dataframe",
            False,
        ),
    ),
    ###################################
    ##### Snowflake Types (Mocks) #####
    ###################################
    (
        "Snowpark DataFrame",
        SnowparkDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.SNOWPARK_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Snowpark Table",
        SnowparkTable(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.SNOWPARK_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Snowpark Row List",
        [
            SnowparkRow({"name": "st.text_area", "type": "widget"}),
            SnowparkRow({"name": "st.markdown", "type": "element"}),
            SnowparkRow({"name": "st.text_input", "type": "text"}),
        ],
        CaseMetadata(
            3,
            2,
            DataFormat.SNOWPARK_OBJECT,
            ["st.text_area", "st.markdown", "st.text_input"],
            "dataframe",
            False,
            pd.DataFrame,
        ),
    ),
    (
        "Snowpandas DataFrame",
        SnowpandasDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.SNOWPANDAS_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Snowpandas Series",
        SnowpandasSeries(pd.Series(["st.text_area", "st.markdown"])),
        CaseMetadata(
            2,
            1,
            DataFormat.SNOWPANDAS_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Snowpandas Index",
        SnowpandasIndex(
            pd.Index(["st.text_area", "st.markdown"]),
        ),
        CaseMetadata(
            2,
            1,
            DataFormat.SNOWPANDAS_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Modin DataFrame",
        ModinDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.MODIN_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Modin Series",
        ModinSeries(pd.Series(["st.text_area", "st.markdown"])),
        CaseMetadata(
            2,
            1,
            DataFormat.MODIN_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    ###################################
    ##### External Types (Mocks) ######
    ###################################
    (
        "Pyspark DataFrame",
        PySparkDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.PYSPARK_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Pyspark Connect DataFrame",
        PySparkConnectDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.PYSPARK_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Dask DataFrame",
        DaskDataFrame(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.DASK_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Dask Series",
        DaskSeries(pd.Series(["st.text_area", "st.markdown"])),
        CaseMetadata(
            2,
            1,
            DataFormat.DASK_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Dask Index",
        DaskIndex(
            pd.Index(["st.text_area", "st.markdown"]),
        ),
        CaseMetadata(
            2,
            1,
            DataFormat.DASK_OBJECT,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Ray Dataset",
        RayDataset(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.RAY_DATASET,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
    (
        "Ray Materialized Dataset",
        RayMaterializedDataset(
            pd.DataFrame(
                [
                    {"name": "st.text_area", "type": "widget"},
                    {"name": "st.markdown", "type": "element"},
                ]
            )
        ),
        CaseMetadata(
            2,
            2,
            DataFormat.RAY_DATASET,
            ["st.text_area", "st.markdown"],
            "dataframe",
            True,
            pd.DataFrame,
        ),
    ),
]

###################################
###### Dataframe Interchange ######
###################################
if is_pandas_version_less_than("1.5.0") is False:
    SHARED_TEST_CASES.extend(
        [
            (
                "Dataframe-interchange compatible",
                CustomDataframe(
                    pd.DataFrame(
                        [
                            {"name": "st.text_area", "type": "widget"},
                            {"name": "st.markdown", "type": "element"},
                        ]
                    )
                ),
                CaseMetadata(
                    2,
                    2,
                    DataFormat.UNKNOWN,
                    ["st.text_area", "st.markdown"],
                    "dataframe",
                    False,
                    None,
                ),
            ),
        ]
    )

###################################
########### Polars Types ##########
###################################
try:
    import polars as pl

    SHARED_TEST_CASES.extend(
        [
            (
                "Polars DataFrame",
                pl.DataFrame(
                    [
                        {"name": "st.text_area", "type": "widget"},
                        {"name": "st.markdown", "type": "element"},
                    ]
                ),
                CaseMetadata(
                    2,
                    2,
                    DataFormat.POLARS_DATAFRAME,
                    ["st.text_area", "st.markdown"],
                    "dataframe",
                    False,
                ),
            ),
            (
                "Polars Series",
                pl.Series(["st.number_input", "st.text_area", "st.text_input"]),
                CaseMetadata(
                    3,
                    1,
                    DataFormat.POLARS_SERIES,
                    ["st.number_input", "st.text_area", "st.text_input"],
                    "dataframe",
                    False,
                ),
            ),
            (
                "Polars LazyFrame",
                pl.LazyFrame(
                    {
                        "name": ["st.text_area", "st.markdown"],
                        "type": ["widget", "element"],
                    }
                ),
                CaseMetadata(
                    2,
                    2,
                    DataFormat.POLARS_LAZYFRAME,
                    ["st.text_area", "st.markdown"],
                    "dataframe",
                    True,
                    pl.DataFrame,
                ),
            ),
        ]
    )
except ModuleNotFoundError:
    print("Polars not installed. Skipping Polars dataframe integration tests.")  # noqa: T201

###################################
########### Xarray Types ##########
###################################
try:
    import xarray as xr

    SHARED_TEST_CASES.extend(
        [
            (
                "Xarray Dataset",
                xr.Dataset.from_dataframe(
                    pd.DataFrame(
                        {
                            "name": ["st.text_area", "st.markdown"],
                            "type": ["widget", "element"],
                        }
                    )
                ),
                CaseMetadata(
                    2,
                    2,
                    DataFormat.XARRAY_DATASET,
                    ["name", "type"],
                    "dataframe",
                    False,
                ),
            ),
            (
                "Xarray DataArray",
                xr.DataArray.from_series(
                    pd.Series(
                        ["st.number_input", "st.text_area", "st.text_input"],
                        name="widgets",
                    )
                ),
                CaseMetadata(
                    3,
                    1,
                    DataFormat.XARRAY_DATA_ARRAY,
                    ["st.number_input", "st.text_area", "st.text_input"],
                    "dataframe",
                    False,
                ),
            ),
        ]
    )
except ModuleNotFoundError:
    print("Xarray not installed. Skipping Xarray dataframe integration tests.")  # noqa: T201

###################################
########## Pydantic Types #########
###################################
try:
    from pydantic import BaseModel

    class ElementPydanticModel(BaseModel):
        name: str
        is_widget: bool
        usage: float

    SHARED_TEST_CASES.extend(
        [
            (
                "Pydantic Model",
                ElementPydanticModel(
                    name="st.number_input", is_widget=True, usage=0.32
                ),
                CaseMetadata(
                    3,
                    1,
                    DataFormat.KEY_VALUE_DICT,
                    ["st.number_input", True, 0.32],
                    "json",
                    False,
                    dict,
                ),
            ),
        ]
    )
except ModuleNotFoundError:
    print("Pydantic not installed. Skipping Pydantic dataframe tests.")  # noqa: T201
