from enum import Enum, auto
from typing import Optional, Union

import pandas as pd
import pyarrow as pa


class ColumnDataKind(Enum):
    INTEGER = auto()
    FLOAT = auto()
    DATE = auto()
    TIME = auto()
    DATETIME = auto()
    BOOLEAN = auto()
    STRING = auto()
    TIMEDELTA = auto()
    PERIOD = auto()
    INTERVAL = auto()
    BYTES = auto()
    DECIMAL = auto()
    COMPLEX = auto()
    LIST = auto()
    UNKNOWN = auto()


def _determine_data_kind_via_arrow(field: pa.Field) -> ColumnDataKind:
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

    return ColumnDataKind.UNKNOWN


def _determine_data_kind_via_pandas_dtype(
    column: Union[pd.Series, pd.Index]
) -> ColumnDataKind:
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
    column: Union[pd.Series, pd.Index]
) -> ColumnDataKind:
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

    # mixed, unknown-array, categorical, mixed-integer
    return ColumnDataKind.UNKNOWN


def _determine_data_kind(
    column: Union[pd.Series, pd.Index], field: Optional[pa.Field] = None
) -> ColumnDataKind:
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
