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
from typing import Any, Dict, Final, List, Optional, Union

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
# that are configurable by the user.
ColumnType: TypeAlias = Literal[
    "object",
    "text",
    "number",
    "checkbox",
    "select",
    "date",
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
    EMPTY = "empty"
    UNKNOWN = "unknown"


# This mapping contains all editable column types mapped to the data kinds
# that the column type is compatible for editing.
_EDITING_COMPATIBILITY_MAPPING: Final = {
    "text": [ColumnDataKind.STRING, ColumnDataKind.EMPTY],
    "number": [ColumnDataKind.INTEGER, ColumnDataKind.FLOAT, ColumnDataKind.EMPTY],
    "checkbox": [ColumnDataKind.BOOLEAN, ColumnDataKind.EMPTY],
    "select": [
        ColumnDataKind.STRING,
        ColumnDataKind.BOOLEAN,
        ColumnDataKind.INTEGER,
        ColumnDataKind.FLOAT,
        ColumnDataKind.EMPTY,
    ],
}


def is_type_compatible(column_type: ColumnType, data_kind: ColumnDataKind) -> bool:
    """Check if the column type is compatible with the underlying data kind.

    This check only applies to editable column types (e.g. number or text).
    Non-editable column types (e.g. bar_chart or image) can be configured for
    all data kinds (this might change in the future).

    Parameters
    ----------
    column_type : ColumnType
        The column type to check.

    data_kind : ColumnDataKind
        The data kind to check.

    Returns
    -------
    bool
        True if the column type is compatible with the data kind, False otherwise.
    """

    if column_type not in _EDITING_COMPATIBILITY_MAPPING:
        return True

    return data_kind in _EDITING_COMPATIBILITY_MAPPING[column_type]


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
    if pa.types.is_integer(field.type):
        return ColumnDataKind.INTEGER

    if pa.types.is_floating(field.type):
        return ColumnDataKind.FLOAT

    if pa.types.is_boolean(field.type):
        return ColumnDataKind.BOOLEAN

    if pa.types.is_string(field.type):
        return ColumnDataKind.STRING

    if pa.types.is_date(field.type):
        return ColumnDataKind.DATE

    if pa.types.is_time(field.type):
        return ColumnDataKind.TIME

    if pa.types.is_timestamp(field.type):
        return ColumnDataKind.DATETIME

    if pa.types.is_duration(field.type):
        return ColumnDataKind.TIMEDELTA

    if pa.types.is_list(field.type):
        return ColumnDataKind.LIST

    if pa.types.is_decimal(field.type):
        return ColumnDataKind.DECIMAL

    if pa.types.is_null(field.type):
        return ColumnDataKind.EMPTY

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
    if pd.api.types.is_bool_dtype(column.dtype):
        return ColumnDataKind.BOOLEAN

    if pd.api.types.is_integer_dtype(column.dtype):
        return ColumnDataKind.INTEGER

    if pd.api.types.is_float_dtype(column.dtype):
        return ColumnDataKind.FLOAT

    if pd.api.types.is_datetime64_any_dtype(column.dtype):
        return ColumnDataKind.DATETIME

    if pd.api.types.is_timedelta64_dtype(column.dtype):
        return ColumnDataKind.TIMEDELTA

    if pd.api.types.is_period_dtype(column.dtype):
        return ColumnDataKind.PERIOD

    if pd.api.types.is_interval_dtype(column.dtype):
        return ColumnDataKind.INTERVAL

    if pd.api.types.is_complex_dtype(column.dtype):
        return ColumnDataKind.COMPLEX

    if pd.api.types.is_string_dtype(column.dtype):
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

    if inferred_type == ["timedelta64", "timedelta"]:
        return ColumnDataKind.TIMEDELTA

    if inferred_type == "time":
        return ColumnDataKind.TIME

    if inferred_type == "period":
        return ColumnDataKind.PERIOD

    if inferred_type == "empty":
        return ColumnDataKind.EMPTY

    # mixed, unknown-array, categorical, mixed-integer
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
        return _determine_data_kind_via_pandas_dtype(column.dtype.categories)

    if field is not None:
        data_kind = _determine_data_kind_via_arrow(field)
        if data_kind != ColumnDataKind.UNKNOWN:
            return data_kind

    if column.dtype.name == "object":
        # If dtype is object, we need to infer the type from the column
        return _determine_data_kind_via_inferred_type(column)
    return _determine_data_kind_via_pandas_dtype(column)


DataframeSchema: TypeAlias = List[ColumnDataKind]


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
    """Configuration options for columns in `st.dataframe` and `st.data_editor`.

    Parameters
    ----------

    title: str
        The title of the column, shown at the top in the column header.
        If None, the column name is used.
    width: "small" or "medium" or "large" or None
        The display width of the column.
        If None, the column will be sized to fit its contents.
    help: str or None
        An optional tooltip that gets displayed when hovering over the column header.
    hidden: bool or None
        An optional boolean, which hides the column if set to True.
    disabled: bool or None
       An optional boolean, which disables the editing if set to True.
    required: bool or None
        If True, a cell can only be submitted by the user if it has a value.
    default: str or bool or int or float or None
        The default value in a cell when the user adds a new row.
        Defaults to None.
    type: str or None
        The type of the column. If None, the column will be inferred from the data.
    type_options: dict or None
        Additional configuration options specific to the selected column type.
    """

    title: Optional[str]
    width: Optional[ColumnWidth]
    help: Optional[str]
    hidden: Optional[bool]
    disabled: Optional[bool]
    required: Optional[bool]
    default: Optional[str | bool | int | float]
    type: Optional[ColumnType]
    type_options: Optional[Dict[str, Any]]


# A mapping of column names/IDs to column configs.
ColumnConfigMapping: TypeAlias = Dict[Union[IndexIdentifierType, str], ColumnConfig]
ColumnConfigMappingInput: TypeAlias = Dict[
    Union[IndexIdentifierType, str], Union[ColumnConfig, None, str]
]


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
