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

import copy
import json
from collections.abc import Mapping
from enum import Enum
from typing import TYPE_CHECKING, Final, Literal, TypeAlias

from streamlit.dataframe_util import DataFormat
from streamlit.elements.lib.column_types import ColumnConfig, ColumnType
from streamlit.elements.lib.dicttools import remove_none_values
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    import pyarrow as pa
    from pandas import DataFrame, Index, Series

    from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto


# The index identifier can be used to apply configuration options
IndexIdentifierType = Literal["_index"]
INDEX_IDENTIFIER: IndexIdentifierType = "_index"

# This is used as prefix for columns that are configured via the numerical position.
# The integer value is converted into a string key with this prefix.
# This needs to match with the prefix configured in the frontend.
_NUMERICAL_POSITION_PREFIX = "_pos:"


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


# The dataframe schema is a mapping from the name of the column
# in the underlying dataframe to the column data kind.
# The index column uses `_index` as name.
DataframeSchema: TypeAlias = dict[str, ColumnDataKind]

# This mapping contains all editable column types mapped to the data kinds
# that the column type is compatible for editing.
_EDITING_COMPATIBILITY_MAPPING: Final[dict[ColumnType, list[ColumnDataKind]]] = {
    "text": [ColumnDataKind.STRING, ColumnDataKind.EMPTY],
    "number": [
        ColumnDataKind.INTEGER,
        ColumnDataKind.FLOAT,
        ColumnDataKind.DECIMAL,
        ColumnDataKind.STRING,
        ColumnDataKind.TIMEDELTA,
        ColumnDataKind.EMPTY,
    ],
    "checkbox": [
        ColumnDataKind.BOOLEAN,
        ColumnDataKind.STRING,
        ColumnDataKind.INTEGER,
        ColumnDataKind.EMPTY,
    ],
    "selectbox": [
        ColumnDataKind.STRING,
        ColumnDataKind.BOOLEAN,
        ColumnDataKind.INTEGER,
        ColumnDataKind.FLOAT,
        ColumnDataKind.EMPTY,
    ],
    "date": [ColumnDataKind.DATE, ColumnDataKind.DATETIME, ColumnDataKind.EMPTY],
    "time": [ColumnDataKind.TIME, ColumnDataKind.DATETIME, ColumnDataKind.EMPTY],
    "datetime": [
        ColumnDataKind.DATETIME,
        ColumnDataKind.DATE,
        ColumnDataKind.TIME,
        ColumnDataKind.EMPTY,
    ],
    "link": [ColumnDataKind.STRING, ColumnDataKind.EMPTY],
    "list": [
        ColumnDataKind.LIST,
        ColumnDataKind.STRING,
        ColumnDataKind.EMPTY,
    ],
    "multiselect": [
        ColumnDataKind.LIST,
        ColumnDataKind.STRING,
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

    The column data kind refers to the shared data type of the values
    in the column (e.g. int, float, str, bool).

    Parameters
    ----------
    field : pa.Field
        The arrow field from the arrow table schema.

    Returns
    -------
    ColumnDataKind
        The data kind of the field.
    """
    import pyarrow as pa

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
    #     return ColumnDataKind.INTERVAL  # noqa: ERA001

    if pa.types.is_binary(field_type):
        return ColumnDataKind.BYTES

    if pa.types.is_struct(field_type):
        return ColumnDataKind.DICT

    return ColumnDataKind.UNKNOWN


def _determine_data_kind_via_pandas_dtype(
    column: Series | Index,
) -> ColumnDataKind:
    """Determine the data kind by using the pandas dtype.

    The column data kind refers to the shared data type of the values
    in the column (e.g. int, float, str, bool).

    Parameters
    ----------
    column : pd.Series, pd.Index
        The column for which the data kind should be determined.

    Returns
    -------
    ColumnDataKind
        The data kind of the column.
    """
    import pandas as pd

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

    if isinstance(column_dtype, pd.PeriodDtype):
        return ColumnDataKind.PERIOD

    if isinstance(column_dtype, pd.IntervalDtype):
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
    column: Series | Index,
) -> ColumnDataKind:
    """Determine the data kind by inferring it from the underlying data.

    The column data kind refers to the shared data type of the values
    in the column (e.g. int, float, str, bool).

    Parameters
    ----------
    column : pd.Series, pd.Index
        The column to determine the data kind for.

    Returns
    -------
    ColumnDataKind
        The data kind of the column.
    """
    from pandas.api.types import infer_dtype

    inferred_type = infer_dtype(column)

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

    # Unused types: mixed, unknown-array, categorical, mixed-integer

    return ColumnDataKind.UNKNOWN


def _determine_data_kind(
    column: Series | Index, field: pa.Field | None = None
) -> ColumnDataKind:
    """Determine the data kind of a column.

    The column data kind refers to the shared data type of the values
    in the column (e.g. int, float, str, bool).

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
    import pandas as pd

    if isinstance(column.dtype, pd.CategoricalDtype):
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
    data_df: DataFrame, arrow_schema: pa.Schema
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
        A mapping that contains the detected data type for the index and columns.
        The key is the column name in the underlying dataframe or ``_index`` for index columns.
    """

    dataframe_schema: DataframeSchema = {}

    # Add type of index:
    # TODO(lukasmasuch): We need to apply changes here to support multiindex.
    dataframe_schema[INDEX_IDENTIFIER] = _determine_data_kind(data_df.index)

    # Add types for all columns:
    for i, column in enumerate(data_df.items()):
        column_name, column_data = column
        dataframe_schema[column_name] = _determine_data_kind(
            column_data, arrow_schema.field(i)
        )
    return dataframe_schema


# A mapping of column names/IDs to column configs.
ColumnConfigMapping: TypeAlias = dict[IndexIdentifierType | str | int, ColumnConfig]
ColumnConfigMappingInput: TypeAlias = Mapping[
    # TODO(lukasmasuch): This should also use int here to
    # correctly type the support for positional index. However,
    # allowing int here leads mypy to complain about simple dict[str, ...]
    # as input -> which seems like a mypy bug.
    IndexIdentifierType | str,
    ColumnConfig | None | str,
]


def process_config_mapping(
    column_config: ColumnConfigMappingInput | None = None,
) -> ColumnConfigMapping:
    """Transforms a user-provided column config mapping into a valid column config mapping
    that can be used by the frontend.

    Parameters
    ----------
    column_config: dict or None
        The user-provided column config mapping.

    Returns
    -------
    dict
        The transformed column config mapping.
    """
    if column_config is None:
        return {}

    transformed_column_config: ColumnConfigMapping = {}
    for column, config in column_config.items():
        if config is None:
            transformed_column_config[column] = ColumnConfig(hidden=True)
        elif isinstance(config, str):
            transformed_column_config[column] = ColumnConfig(label=config)
        elif isinstance(config, dict):
            # Ensure that the column config objects are cloned
            # since we will apply in-place changes to it.
            transformed_column_config[column] = copy.deepcopy(config)
        else:
            raise StreamlitAPIException(
                f"Invalid column config for column `{column}`. "
                f"Expected `None`, `str` or `dict`, but got `{type(config)}`."
            )
    return transformed_column_config


def update_column_config(
    column_config_mapping: ColumnConfigMapping,
    column: str | int,
    column_config: ColumnConfig,
) -> None:
    """Updates the column config value for a single column within the mapping.

    Parameters
    ----------
    column_config_mapping : ColumnConfigMapping
        The column config mapping to update.

    column : str | int
        The column to update the config value for. This can be the column name or
        the numerical position of the column.

    column_config : ColumnConfig
        The column config to update.
    """

    if column not in column_config_mapping:
        column_config_mapping[column] = {}

    column_config_mapping[column].update(column_config)


def apply_data_specific_configs(
    columns_config: ColumnConfigMapping,
    data_format: DataFormat,
) -> None:
    """Apply data specific configurations to the provided dataframe.

    This will apply inplace changes to the dataframe and the column configurations
    depending on the data format.

    Parameters
    ----------
    columns_config : ColumnConfigMapping
        A mapping of column names/ids to column configurations.

    data_format : DataFormat
        The format of the data.
    """

    # Pandas adds a range index as default to all datastructures
    # but for most of the non-pandas data objects it is unnecessary
    # to show this index to the user. Therefore, we will hide it as default.
    if data_format in [
        DataFormat.SET_OF_VALUES,
        DataFormat.TUPLE_OF_VALUES,
        DataFormat.LIST_OF_VALUES,
        DataFormat.NUMPY_LIST,
        DataFormat.NUMPY_MATRIX,
        DataFormat.LIST_OF_RECORDS,
        DataFormat.LIST_OF_ROWS,
        DataFormat.COLUMN_VALUE_MAPPING,
        # Dataframe-like objects that don't have an index:
        DataFormat.PANDAS_ARRAY,
        DataFormat.PANDAS_INDEX,
        DataFormat.POLARS_DATAFRAME,
        DataFormat.POLARS_SERIES,
        DataFormat.POLARS_LAZYFRAME,
        DataFormat.PYARROW_ARRAY,
        DataFormat.RAY_DATASET,
    ]:
        update_column_config(columns_config, INDEX_IDENTIFIER, {"hidden": True})


def _convert_column_config_to_json(column_config_mapping: ColumnConfigMapping) -> str:
    try:
        # Ignore all None values and prefix columns specified by numerical index:
        return json.dumps(
            {
                (f"{_NUMERICAL_POSITION_PREFIX}{k!s}" if isinstance(k, int) else k): v
                for (k, v) in remove_none_values(column_config_mapping).items()
            },
            allow_nan=False,
        )
    except ValueError as ex:
        raise StreamlitAPIException(
            f"The provided column config cannot be serialized into JSON: {ex}"
        ) from ex


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

    proto.columns = _convert_column_config_to_json(column_config_mapping)
