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

import json
from enum import Enum
from typing import Any, Dict, List, Optional, Union

import pandas as pd
import pyarrow as pa
from typing_extensions import Literal, TypeAlias, TypedDict

from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto

# The index identifier can be used to apply configuration options
IndexIdentifierType = Literal["index"]
INDEX_IDENTIFIER: IndexIdentifierType = "index"

# This is used as prefix for columns that are configured via the numerical position.
# The integer value is converted into a string key with this prefix.
# This needs to match with the prefix configured in the frontend.
_NUMERICAL_POSITION_PREFIX = "col:"

ColumnWidth = Literal["small", "medium", "large"]

# Type alias that represents all available column types
# which are configurable by the user.
ColumnType: TypeAlias = Literal[
    "object", "text", "number", "checkbox", "selectbox", "list"
]


# The column data kind is used to describe the type of the data within the column.
class ColumnDataKind(str, Enum):
    INTEGER = "integer"
    FLOAT = "float"
    DATE = "date"
    TIME = "time"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    STRING = "string"
    TIMEDELTA = "timedelta"
    PERIOD = "period"
    INTERVAL = "interval"
    BYTES = "bytes"
    DECIMAL = "decimal"
    COMPLEX = "complex"
    LIST = "list"
    DICT = "dict"
    EMPTY = "empty"
    UNKNOWN = "unknown"


# The dataframe schema is just a list of column data kinds
# based on the order of the columns in the underlying dataframe.
# The index column(s) are attached at the beginning of the list.
DataframeSchema: TypeAlias = List[ColumnDataKind]


def _determine_data_kind_via_arrow(field: pa.Field) -> ColumnDataKind:
    """Determine the data kind via the arrow type information.

    Parameters
    ----------

    field : pa.Field
        The arrow field from the arrow table schema.

    Returns
    -------
    ColumnDataKind
        The data kind of the field.
    """
    field_type = field.type
    if pa.types.is_integer(field_type):
        return ColumnDataKind.INTEGER

    if pa.types.is_floating(field_type):
        return ColumnDataKind.FLOAT

    if pa.types.is_boolean(field_type):
        return ColumnDataKind.BOOLEAN

    if pa.types.is_string(field_type):
        return ColumnDataKind.STRING

    if pa.types.is_date(field_type):
        return ColumnDataKind.DATE

    if pa.types.is_time(field_type):
        return ColumnDataKind.TIME

    if pa.types.is_timestamp(field_type):
        return ColumnDataKind.DATETIME

    if pa.types.is_duration(field_type):
        return ColumnDataKind.TIMEDELTA

    if pa.types.is_list(field_type):
        return ColumnDataKind.LIST

    if pa.types.is_decimal(field_type):
        return ColumnDataKind.DECIMAL

    if pa.types.is_null(field_type):
        return ColumnDataKind.EMPTY

    # Interval does not seem to work correctly:
    # if pa.types.is_interval(field_type):
    #     return ColumnDataKind.INTERVAL

    if pa.types.is_binary(field_type):
        return ColumnDataKind.BYTES

    if pa.types.is_struct(field_type):
        return ColumnDataKind.DICT

    return ColumnDataKind.UNKNOWN


def _determine_data_kind_via_pandas_dtype(
    column: pd.Series | pd.Index,
) -> ColumnDataKind:
    """Determine the data kind by using the pandas dtype.

    Parameters
    ----------
    column : pd.Series, pd.Index
        The column for which the data kind should be determined.

    Returns
    -------
    ColumnDataKind
        The data kind of the column.
    """
    column_dtype = column.dtype
    if pd.api.types.is_bool_dtype(column_dtype):
        return ColumnDataKind.BOOLEAN

    if pd.api.types.is_integer_dtype(column_dtype):
        return ColumnDataKind.INTEGER

    if pd.api.types.is_float_dtype(column_dtype):
        return ColumnDataKind.FLOAT

    if pd.api.types.is_datetime64_any_dtype(column_dtype):
        return ColumnDataKind.DATETIME

    if pd.api.types.is_timedelta64_dtype(column_dtype):
        return ColumnDataKind.TIMEDELTA

    if pd.api.types.is_period_dtype(column_dtype):
        return ColumnDataKind.PERIOD

    if pd.api.types.is_interval_dtype(column_dtype):
        return ColumnDataKind.INTERVAL

    if pd.api.types.is_complex_dtype(column_dtype):
        return ColumnDataKind.COMPLEX

    if pd.api.types.is_object_dtype(
        column_dtype
    ) is False and pd.api.types.is_string_dtype(column_dtype):
        # The is_string_dtype
        return ColumnDataKind.STRING

    return ColumnDataKind.UNKNOWN


def _determine_data_kind_via_inferred_type(
    column: pd.Series | pd.Index,
) -> ColumnDataKind:
    """Determine the data kind by inferring it from the underlying data.

    Parameters
    ----------
    column : pd.Series, pd.Index
        The column to determine the data kind for.

    Returns
    -------
    ColumnDataKind
        The data kind of the column.
    """

    inferred_type = pd.api.types.infer_dtype(column)

    if inferred_type == "string":
        return ColumnDataKind.STRING

    if inferred_type == "bytes":
        return ColumnDataKind.BYTES

    if inferred_type in ["floating", "mixed-integer-float"]:
        return ColumnDataKind.FLOAT

    if inferred_type == "integer":
        return ColumnDataKind.INTEGER

    if inferred_type == "decimal":
        return ColumnDataKind.DECIMAL

    if inferred_type == "complex":
        return ColumnDataKind.COMPLEX

    if inferred_type == "boolean":
        return ColumnDataKind.BOOLEAN

    if inferred_type in ["datetime64", "datetime"]:
        return ColumnDataKind.DATETIME

    if inferred_type == "date":
        return ColumnDataKind.DATE

    if inferred_type in ["timedelta64", "timedelta"]:
        return ColumnDataKind.TIMEDELTA

    if inferred_type == "time":
        return ColumnDataKind.TIME

    if inferred_type == "period":
        return ColumnDataKind.PERIOD

    if inferred_type == "interval":
        return ColumnDataKind.INTERVAL

    if inferred_type == "empty":
        return ColumnDataKind.EMPTY

    # TODO(lukasmasuch): Unused types: mixed, unknown-array, categorical, mixed-integer
    return ColumnDataKind.UNKNOWN


def _determine_data_kind(
    column: pd.Series | pd.Index, field: Optional[pa.Field] = None
) -> ColumnDataKind:
    """Determine the data kind of a column.

    Parameters
    ----------
    column : pd.Series, pd.Index
        The column to determine the data kind for.
    field : pa.Field, optional
        The arrow field from the arrow table schema.

    Returns
    -------
    ColumnDataKind
        The data kind of the column.
    """

    if pd.api.types.is_categorical_dtype(column.dtype):
        # Categorical columns can have different underlying data kinds
        # depending on the categories.
        return _determine_data_kind_via_inferred_type(column.dtype.categories)

    if field is not None:
        data_kind = _determine_data_kind_via_arrow(field)
        if data_kind != ColumnDataKind.UNKNOWN:
            return data_kind

    if column.dtype.name == "object":
        # If dtype is object, we need to infer the type from the column
        return _determine_data_kind_via_inferred_type(column)
    return _determine_data_kind_via_pandas_dtype(column)


def determine_dataframe_schema(
    data_df: pd.DataFrame, arrow_schema: pa.Schema
) -> DataframeSchema:
    """Determine the schema of a dataframe.

    Parameters
    ----------
    data_df : pd.DataFrame
        The dataframe to determine the schema of.
    arrow_schema : pa.Schema
        The Arrow schema of the dataframe.

    Returns
    -------

    DataframeSchema
        A list that contains the detected data type for the index and columns.
        It starts with the index and then contains the columns in the original order.
    """

    dataframe_schema: DataframeSchema = []

    # Add type of index:
    dataframe_schema.append(_determine_data_kind(data_df.index))

    # Add types for all columns:
    for i, column in enumerate(data_df.items()):
        _, column_data = column
        dataframe_schema.append(
            _determine_data_kind(column_data, arrow_schema.field(i))
        )
    return dataframe_schema


class ColumnConfig(TypedDict, total=False):
    width: Optional[int]
    title: Optional[str]
    type: Optional[ColumnType]
    hidden: Optional[bool]
    editable: Optional[bool]
    alignment: Optional[Literal["left", "center", "right"]]
    metadata: Optional[Dict[str, Any]]
    column: Optional[Union[str, int]]


# A mapping of column names/IDs to column configs.
ColumnConfigMapping: TypeAlias = Dict[Union[IndexIdentifierType, str], ColumnConfig]


def marshall_column_config(
    proto: ArrowProto, column_config_mapping: ColumnConfigMapping
) -> None:
    """Marshall the column config into the Arrow proto.

    Parameters
    ----------
    proto : ArrowProto
        The proto to marshall into.

    column_config_mapping : ColumnConfigMapping
        The column config to marshall.
    """

    # Ignore all None values and prefix columns specified by numerical index
    def remove_none_values(input_dict: Dict[Any, Any]) -> Dict[Any, Any]:
        new_dict = {}
        for key, val in input_dict.items():
            if isinstance(val, dict):
                val = remove_none_values(val)
            if val is not None:
                new_dict[key] = val
        return new_dict

    proto.columns = json.dumps(
        {
            (f"{_NUMERICAL_POSITION_PREFIX}{str(k)}" if isinstance(k, int) else k): v
            for (k, v) in remove_none_values(column_config_mapping).items()
        }
    )
