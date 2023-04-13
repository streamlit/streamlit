from __future__ import annotations

import datetime
import json
from enum import Enum
from typing import Any, Dict, Final, List, Optional, Union

import pandas as pd
import pyarrow as pa
from typing_extensions import Literal, TypeAlias, TypedDict

from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto

# The index identifier can be used to apply configuration options
#
IndexIdentifierType = Literal["index"]
INDEX_IDENTIFIER: IndexIdentifierType = "index"

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
    "time",
    "datetime",
    "url",
    "list",
    "image",
    "range",
    "bar_chart",
    "line_chart",
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
    UNKNOWN = "unknown"


# This mapping contains all editable column types mapped to the data kinds
# that the column type is compatible for editing.
_EDITING_COMPATIBILITY_MAPPING: Final = {
    "text": [ColumnDataKind.STRING],
    "number": [ColumnDataKind.INTEGER, ColumnDataKind.FLOAT],
    "checkbox": [ColumnDataKind.BOOLEAN],
    "select": [
        ColumnDataKind.STRING,
        ColumnDataKind.BOOLEAN,
        ColumnDataKind.INTEGER,
        ColumnDataKind.FLOAT,
    ],
    "date": [ColumnDataKind.DATE, ColumnDataKind.DATETIME],
    "time": [ColumnDataKind.TIME, ColumnDataKind.DATETIME],
    "datetime": [ColumnDataKind.DATETIME, ColumnDataKind.DATE],
    "url": [ColumnDataKind.STRING],
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
    """Configuration for a `st.dataframe` and `st.data_editor` column.

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
            (f"col:{str(k)}" if isinstance(k, int) else k): v
            for (k, v) in remove_none_values(column_config_mapping).items()
        }
    )


def NumberColumn(
    *,
    title: Optional[str] = None,
    width: Optional[ColumnWidth] = None,
    hidden: Optional[bool] = None,
    help: Optional[str] = None,
    disabled: Optional[bool] = None,
    required: Optional[bool] = None,
    default: int | float | None = None,
    min_value: int | float | None = None,
    max_value: int | float | None = None,
    format: Optional[str] = None,
    step: int | float | None = None,
) -> ColumnConfig:
    """Display a numeric input widget.

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
    default: int or float or None
        The default value in a cell when the user adds a new row.
        Defaults to None.
    min_value : int or float or None
        The minimum value that can be entered by the user.
        If None, there will be no minimum.
    max_value : int or float or None
        The maximum value that can be entered by the user.
        If None, there will be no maximum.
    format : str or None
        A printf-style format string controlling how the cell value is displayed.
    step : int or None
        TODO
    """

    return ColumnConfig(
        title=title,
        width=width,
        hidden=hidden,
        help=help,
        disabled=disabled,
        required=required,
        type="number",
        default=default,
        type_options={
            "min_value": min_value,
            "max_value": max_value,
            "format": format,
            "step": step,
        },
    )


def TextColumn(
    *,
    title: Optional[str] = None,
    width: Optional[ColumnWidth] = None,
    hidden: Optional[bool] = None,
    help: Optional[str] = None,
    disabled: Optional[bool] = None,
    required: Optional[bool] = None,
    default: Optional[str] = None,
    max_length: Optional[int] = None,
    validate: Optional[str] = None,
) -> ColumnConfig:
    """Display a text input widget.

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
        An optional boolean, which hides the column if set to True.
        If True, a cell can only be submitted by the user if it has a value.
    default: str or None
        The default value in a cell when the user adds a new row.
        Defaults to None.
    max_chars: int or None
        The maximum number of characters that can be entered by the user.
        If None, there will be no maximum.
    validate: str or None
        A regular expression that edited values should be validated against.
        If the input is invalid, it will not be submitted by the user.
    """

    return ColumnConfig(
        title=title,
        width=width,
        hidden=hidden,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type="text",
        type_options={
            "max_length": max_length,
            "validate": validate,
        },
    )


def CheckboxColumn(
    *,
    title: Optional[str] = None,
    width: Optional[ColumnWidth] = None,
    hidden: Optional[bool] = None,
    help: Optional[str] = None,
    disabled: Optional[bool] = None,
    required: Optional[bool] = None,
    default: Optional[bool] = None,
) -> ColumnConfig:
    """Display a text input widget.

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
        An optional boolean, which hides the column if set to True.
        If True, a cell can only be submitted by the user if it has a value.
    default: bool or None
        The default value in a cell when the user adds a new row.
        Defaults to None.
    """

    return ColumnConfig(
        title=title,
        width=width,
        hidden=hidden,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type="checkbox",
    )


def SelectColumn(
    *,
    title: Optional[str] = None,
    width: Optional[ColumnWidth] = None,
    hidden: Optional[bool] = None,
    help: Optional[str] = None,
    disabled: Optional[bool] = None,
    required: Optional[bool] = None,
    default: Optional[str] = None,
    options: List[str] = [],
) -> ColumnConfig:
    """Display a select widget.

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
        An optional boolean, which hides the column if set to True.
        If True, a cell can only be submitted by the user if it has a value.
    default: str or None
        The default value in a cell when the user adds a new row.
        Defaults to None.
    options: list of str
        A list of options to choose from.
    """

    return ColumnConfig(
        title=title,
        width=width,
        hidden=hidden,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type="select",
        type_options={
            "options": options,
        },
    )


def BarChartColumn(
    *,
    title: Optional[str] = None,
    width: Optional[ColumnWidth] = None,
    hidden: Optional[bool] = None,
    help: Optional[str] = None,
    y_min: int | float | None = None,
    y_max: int | float | None = None,
) -> ColumnConfig:
    """Display a bar chart.

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
    y_min: int or float or None
        The minimum value of the y-axis of the chart.
        If None, the scales will be normalized individually for each column.
    y_max: int or float or None
        The maximum value of the y-axis of the chart.
        If None, the scales will be normalized individually for each column.
    """

    return ColumnConfig(
        title=title,
        width=width,
        hidden=hidden,
        help=help,
        type="bar_chart",
        type_options={
            "y_min": y_min,
            "y_max": y_max,
        },
    )


def ImageColumn(
    *,
    title: Optional[str] = None,
    width: Optional[ColumnWidth] = None,
    hidden: Optional[bool] = None,
    help: Optional[str] = None,
):
    """Display an image.

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
    """
    return ColumnConfig(
        title=title,
        width=width,
        hidden=hidden,
        help=help,
        type="image",
    )


def DateTimeColumn(
    *,
    title: Optional[str] = None,
    width: Optional[ColumnWidth] = None,
    hidden: Optional[bool] = None,
    help: Optional[str] = None,
    disabled: Optional[bool] = None,
    required: Optional[bool] = None,
    default: Optional[datetime.datetime] = None,
    min_value: Optional[datetime.datetime] = None,
    max_value: Optional[datetime.datetime] = None,
    step: Optional[int] = None,
    timezone: Optional[str] = None,
) -> ColumnConfig:
    """Display a date and time picker widget.

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
        An optional boolean, which hides the column if set to True.
        If True, a cell can only be submitted by the user if it has a value.
    default: datetime.date or None
        The default value in a cell when the user adds a new row.
        Defaults to None.
    min_value: datetime.date or None
        The minimum date that can be entered by the user.
        If None, there will be no minimum.
    max_value: datetime.date or None
        The maximum date that can be entered by the user.
        If None, there will be no maximum.
    timezone: str or None
        The timezone of this column.
    step: int or None
        TODO
    """

    # TODO: Check if this code is correct:
    def _format_datetime(value: datetime.datetime | None) -> str | None:
        return None if value is None else value.isoformat()

    return ColumnConfig(
        title=title,
        width=width,
        hidden=hidden,
        help=help,
        disabled=disabled,
        required=required,
        default=_format_datetime(default),
        type="datetime",
        type_options={
            "min_value": _format_datetime(min_value),
            "max_value": _format_datetime(max_value),
            "step": step,
            "timezone": timezone,
        },
    )


def RangeColumn(
    *,
    title: Optional[str] = None,
    width: Optional[ColumnWidth] = None,
    hidden: Optional[bool] = None,
    help: Optional[str] = None,
    disabled: Optional[bool] = None,
    required: Optional[bool] = None,
    default: int | float | None = None,
    min_value: int | float | None = None,
    max_value: int | float | None = None,
    format: Optional[str] = None,
    step: int | float | None = None,
) -> ColumnConfig:
    """Display a numeric input widget.

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
    default: int or float or None
        The default value in a cell when the user adds a new row.
        Defaults to None.
    min_value : int or float or None
        The minimum value of the range bar.
        Defaults to 0.
    max_value : int or float or None
        The maximum value of the range bar.
        Defaults to 1.
    format : str or None
        A printf-style format string controlling how the number next to
        the range bar should be formatted.
    step: int or None
        TODO
    """

    return ColumnConfig(
        title=title,
        width=width,
        hidden=hidden,
        help=help,
        disabled=disabled,
        required=required,
        type="range",
        default=default,
        type_options={
            "min_value": min_value,
            "max_value": max_value,
            "format": format,
            "step": step,
        },
    )
