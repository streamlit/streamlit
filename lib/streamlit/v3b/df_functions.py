from __future__ import annotations

from functools import wraps
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Iterable,
    Optional,
    Type,
    TypeVar,
    cast,
    overload,
)

import pandas as pd
from typing_extensions import Literal, Protocol

import streamlit as st
from streamlit.elements.arrow import Data
from streamlit.elements.data_editor import DataTypes, EditableData
from streamlit.elements.lib.column_config_utils import (
    ColumnConfigMapping,
    ColumnConfigMappingInput,
)
from streamlit.runtime.state import WidgetArgs, WidgetCallback, WidgetKwargs
from streamlit.type_util import Key
from streamlit.v3b.column_types import (
    BarChartColumn,
    CheckboxColumn,
    ColumnConfig,
    DateColumn,
    DateTimeColumn,
    ImageColumn,
    LineChartColumn,
    ListColumn,
    NumberColumn,
    RangeColumn,
    SelectColumn,
    TextColumn,
    TimeColumn,
    UrlColumn,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


# class DataFrameMixin:
def dataframe(
    data: Data = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    *,
    use_container_width: bool = False,
    hide_index: bool | None = None,
    column_config: ColumnConfigMappingInput | None = None,
) -> "DeltaGenerator":
    """Display a dataframe as an interactive table.

    Parameters
    ----------
    data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, Iterable, dict, or None
        The data to display.

        If 'data' is a pandas.Styler, it will be used to style its
        underlying DataFrame.

    width : int or None
        Desired width of the dataframe element expressed in pixels. If None, the
        width will be automatically determined.

    height : int or None
        Desired height of the dataframe element expressed in pixels. If None, the
        height will be automatically determined.

    use_container_width : bool
        If True, set the dataframe width to the width of the parent container.
        This takes precedence over the width argument.

    hide_index : bool or None
        If True, hide the index column(s). If None, the index column visibility will
        be automatically determined by the index type and input data format.

    column_order : iterable of str or None
        Defines the display order of all non-index columns. This will also influence
        which columns are visible to the user. For example: (“col2”, ”col1”) will show
        col2 in the first place followed by col1 and all other non-index columns in the
        data will be hidden. If None, the order is inherited from the original data
        structure.

    column_config : dict or None
        A mapping that allows configuration of various display aspects related to the
        table columns. Use the column name as the key or “index” to refer to the index
        and provide a configuration as the value via the st.column_config command or
        one of the available column types in the st.column_config namespace, e.g.
        `st.column_config.NumberColumn()`. Configuration options include modifying column
        titles, types, help tooltips, formatting, and more. For detailed information on
        configuring columns and available column types, visit our docs: TBD
    """
    return st._arrow_dataframe(
        data,
        width,
        height,
        use_container_width=use_container_width,
        column_config=column_config,
        hide_index=hide_index,
    )


# class DataEditorMixin:
@overload
def experimental_data_editor(
    data: EditableData,
    *,
    width: Optional[int] = None,
    height: Optional[int] = None,
    use_container_width: bool = False,
    hide_index: bool | None = None,
    column_order: Iterable[str] | None = None,
    column_config: ColumnConfigMappingInput | None = None,
    num_rows: Literal["fixed", "dynamic"] = "fixed",
    disabled: bool | Iterable[str] = False,
    key: Optional[Key] = None,
    on_change: Optional[WidgetCallback] = None,
    args: Optional[WidgetArgs] = None,
    kwargs: Optional[WidgetKwargs] = None,
) -> EditableData:
    pass


@overload
def experimental_data_editor(
    data: Any,
    *,
    width: Optional[int] = None,
    height: Optional[int] = None,
    use_container_width: bool = False,
    hide_index: bool | None = None,
    column_order: Iterable[str] | None = None,
    column_config: ColumnConfigMappingInput | None = None,
    num_rows: Literal["fixed", "dynamic"] = "fixed",
    disabled: bool | Iterable[str] = False,
    key: Optional[Key] = None,
    on_change: Optional[WidgetCallback] = None,
    args: Optional[WidgetArgs] = None,
    kwargs: Optional[WidgetKwargs] = None,
) -> pd.DataFrame:
    pass


def experimental_data_editor(
    data: DataTypes,
    *,
    width: Optional[int] = None,
    height: Optional[int] = None,
    use_container_width: bool = False,
    hide_index: bool | None = None,
    column_order: Iterable[str] | None = None,
    column_config: ColumnConfigMappingInput | None = None,
    num_rows: Literal["fixed", "dynamic"] = "fixed",
    disabled: bool | Iterable[str] = False,
    key: Optional[Key] = None,
    on_change: Optional[WidgetCallback] = None,
    args: Optional[WidgetArgs] = None,
    kwargs: Optional[WidgetKwargs] = None,
) -> DataTypes:
    """Display a data editor widget.

    Display a data editor widget that allows you to edit DataFrames and
    many other data structures in a table-like UI.

    Parameters
    ----------
    data : pandas.DataFrame, pandas.Styler, pandas.Index, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, list, set, tuple, dict, or None
        The data to edit in the data editor.

    width : int or None
        Desired width of the data editor expressed in pixels. If None, the width will
        be automatically determined.

    height : int or None
        Desired height of the data editor expressed in pixels. If None, the height will
        be automatically determined.

    use_container_width : bool
        If True, set the data editor width to the width of the parent container.
        This takes precedence over the width argument. Defaults to False.

    num_rows : "fixed" or "dynamic"
        Specifies if the user can add and delete rows in the data editor.
        If "fixed", the user cannot add or delete rows. If "dynamic", the user can
        add and delete rows in the data editor, but column sorting is disabled.
        Defaults to "fixed".

    disabled : bool or iterable of str
        Disables editing of columns. If True, the editing of all columns gets disabled.
        By providing an iterable of column names - e.g. (”col1”, “col2”) - only these
        specific columns can be disabled. By default, all columns that support editing
        will be editable.

    key : str
        An optional string to use as the unique key for this widget. If this
        is omitted, a key will be generated for the widget based on its
        content. Multiple widgets of the same type may not share the same
        key.

    hide_index : bool or None
        If True, hide the index column(s). If None, the index column visibility will
        be automatically determined by the index type and input data format.

    column_order : iterable of str or None
        Defines the display order of all non-index columns. This will also influence
        which columns are visible to the user. For example: (“col2”, ”col1”) will show
        col2 in the first place followed by col1 and all other non-index columns in the
        data will be hidden. If None, the order is inherited from the original data
        structure.

    column_config : dict or None
        A mapping that allows configuration of various display and editing aspects
        related to the table columns. Use the column name as the key or “index” to
        refer to the index and provide a configuration as the value via the
        `st.column_config` command or one of the available column types in the
        `st.column_config` namespace, e.g. `st.column_config.NumberColumn()`.
        If the provided column name doesn't exist in the data, a new empty column will
        be attached to the displayed table and returned in the edited data structure.
        Configuration options include modifying column titles, types, help tooltips,
        formatting, and more. For detailed information on configuring columns and
        available column types, visit our docs: TBD

    on_change : callable
        An optional callback invoked when this data_editor's value changes.

    args : tuple
        An optional tuple of args to pass to the callback.

    kwargs : dict
        An optional dict of kwargs to pass to the callback.

    Returns
    -------
    pd.DataFrame, pd.Styler, pyarrow.Table, np.ndarray, list, set, tuple, or dict.
        The edited data. The edited data is returned in its original data type if
        it corresponds to any of the supported return types. All other data types
        are returned as a ``pd.DataFrame``.
    """
    return st.experimental_data_editor(
        data,
        width=width,
        height=height,
        use_container_width=use_container_width,
        hide_index=hide_index,
        column_config=column_config,
        num_rows=num_rows,
        disabled=disabled,
        key=key,
        on_change=on_change,
        args=args,
        kwargs=kwargs,
        column_order=column_order,
    )


# Note: can use a more restrictive bound if wanted.
# F = TypeVar("F", bound=Callable[..., object])


# class DataframeColumnConfig(Protocol[F]):
#     BarChartColumn: Callable[..., ColumnConfig]
#     CheckboxColumn: Callable[..., ColumnConfig]
#     DateColumn: Callable[..., ColumnConfig]
#     DateTimeColumn: Callable[..., ColumnConfig]
#     ImageColumn: Callable[..., ColumnConfig]
#     LineChartColumn: Callable[..., ColumnConfig]
#     ListColumn: Callable[..., ColumnConfig]
#     NumberColumn: Callable[..., ColumnConfig]
#     RangeColumn: Callable[..., ColumnConfig]
#     SelectColumn: Callable[..., ColumnConfig]
#     TextColumn: Callable[..., ColumnConfig]
#     TimeColumn: Callable[..., ColumnConfig]
#     UrlColumn: Callable[..., ColumnConfig]

#     __call__: F


# def add_column_configs(func: F) -> DataframeColumnConfig[F]:
#     @wraps(func)
#     def wrapper(*args, **kwargs):
#         return func(*args, **kwargs)

#     command = cast(DataframeColumnConfig[F], wrapper)
#     command.NumberColumn = NumberColumn
#     command.TextColumn = TextColumn
#     command.BarChartColumn = BarChartColumn
#     command.CheckboxColumn = CheckboxColumn
#     command.DateColumn = DateColumn
#     command.DateTimeColumn = DateTimeColumn
#     command.ImageColumn = ImageColumn
#     command.LineChartColumn = LineChartColumn
#     command.ListColumn = ListColumn
#     command.RangeColumn = RangeColumn
#     command.SelectColumn = SelectColumn
#     command.TimeColumn = TimeColumn
#     command.UrlColumn = UrlColumn

#     return command


# experimental_data_editor = add_column_configs(
#     DataEditorMixin().experimental_data_editor
# )

# dataframe = add_column_configs(DataFrameMixin().dataframe)
