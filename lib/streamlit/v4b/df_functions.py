from __future__ import annotations

from collections.abc import Iterable
from functools import wraps
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Dict,
    Iterable,
    List,
    Optional,
    Protocol,
    Type,
    TypeVar,
    cast,
    overload,
)

import pandas as pd
from typing_extensions import Literal

import streamlit as st
from streamlit.elements.arrow import Data
from streamlit.elements.data_editor import DataTypes, EditableData
from streamlit.elements.lib.column_config_utils import ColumnType, ColumnWidth
from streamlit.elements.lib.column_types_v2 import BaseColumn
from streamlit.runtime.state import WidgetArgs, WidgetCallback, WidgetKwargs
from streamlit.type_util import Key
from streamlit.v4a.column_types import (
    BarChartColumn,
    CheckboxColumn,
    DateColumn,
    DateTimeColumn,
    ImageColumn,
    LineChartColumn,
    LinkColumn,
    ListColumn,
    NumberColumn,
    RangeColumn,
    SelectColumn,
    TextColumn,
    TimeColumn,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class DataFrameMixin:
    def dataframe(
        self,
        data: Data = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        *,
        use_container_width: bool = False,
        titles: List[str | None] | Dict[str, str] | None = None,
        types: List[ColumnType | BaseColumn | None]
        | Dict[str, ColumnType | BaseColumn]
        | None = None,
        hidden: Literal["index"] | str | Iterable[str] | None = None,
        widths: List[ColumnWidth | None] | Dict[str, ColumnWidth] | None = None,
        help: List[str | None] | Dict[str, str] | None = None,
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
            This argument can only be supplied by keyword.

        titles : iterable of str or dict
            The columns titles shown at the top. Can be an iterable of one title per
            column, e.g. `("Header 1", "Header 2")`, or a dict mapping column names to
            titles, e.g. `{"col1": "Header 1", "col2": "Header 2"}`.

        types : iterable or dict
            The display types for the columns. Can be an iterable of one type per column,
            e.g. ("text", "number"), or a dict mapping column names to types, e.g.
            {"col1": "text", "col2": "number"}.
            Allowed types are "text", "number", "checkbox", "select", “list”,“datetime”,
            “date”, “time”, “url”, “image”, “line_chart”, “bar_chart”, “range” or one
            of the available column type classes from the `st.column_types` module.

        hidden :  "index", str, or iterable of str
            Which columns to hide in the table. Can be "index" to hide the index column,
            a single column name, e.g. “col1”, or an iterable of column names,
            e.g. (”col1”, “col2”).

        widths: iterable of str or dict
            The display width of the columns. Allowed values are “small”, “medium”, or
            “large”. Can be an iterable of widths per column, e.g. (”small”, “large”),
            or a dict mapping column names to widths, e.g. `{”col1”: “small”, “col2”:
            “large”}`.

        help : iterable of str or dict
            The help text shown in the column header. Can be an iterable of one help text
            per column, e.g. (”Help text 1”, “Help text 2”), or a dict mapping column
            names to help texts, e.g. {”col1”: “Help text 1”, “col2”: “Help text 2”}.
            The help text is shown as a tooltip when the user hovers over the column
            header.
        """
        return st._arrow_dataframe(
            data,
            width,
            height,
            use_container_width=use_container_width,
            titles=titles,
            types=types,
            hidden=hidden,
            widths=widths,
            help=help,
        )


class DataEditorMixin:
    @overload
    def experimental_data_editor(
        self,
        data: EditableData,
        *,
        width: Optional[int] = None,
        height: Optional[int] = None,
        use_container_width: bool = False,
        num_rows: Literal["fixed", "dynamic"] = "fixed",
        disabled: bool = False,
        key: Optional[Key] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        titles: List[str | None] | Dict[str, str] | None = None,
        types: List[ColumnType | BaseColumn | None]
        | Dict[str, ColumnType | BaseColumn]
        | None = None,
        hidden: Literal["index"] | str | Iterable[str] | None = None,
        widths: List[ColumnWidth | None] | Dict[str, ColumnWidth] | None = None,
        help: List[str | None] | Dict[str, str] | None = None,
        required: Literal["index"] | str | Iterable[str] | None = None,
        locked: Literal["index"] | str | Iterable[str] | None = None,
        default: List[str | int | float | bool | None]
        | Dict[str, str | int | float | bool | None]
        | None = None,
    ) -> EditableData:
        pass

    @overload
    def experimental_data_editor(
        self,
        data: Any,
        *,
        width: Optional[int] = None,
        height: Optional[int] = None,
        use_container_width: bool = False,
        num_rows: Literal["fixed", "dynamic"] = "fixed",
        disabled: bool = False,
        key: Optional[Key] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        titles: List[str | None] | Dict[str, str] | None = None,
        types: List[ColumnType | BaseColumn | None]
        | Dict[str, ColumnType | BaseColumn]
        | None = None,
        hidden: Literal["index"] | str | Iterable[str] | None = None,
        widths: List[ColumnWidth | None] | Dict[str, ColumnWidth] | None = None,
        help: List[str | None] | Dict[str, str] | None = None,
        required: Literal["index"] | str | Iterable[str] | None = None,
        locked: Literal["index"] | str | Iterable[str] | None = None,
        default: List[str | int | float | bool | None]
        | Dict[str, str | int | float | bool | None]
        | None = None,
    ) -> pd.DataFrame:
        pass

    def experimental_data_editor(
        self,
        data: DataTypes,
        *,
        width: Optional[int] = None,
        height: Optional[int] = None,
        use_container_width: bool = False,
        num_rows: Literal["fixed", "dynamic"] = "fixed",
        disabled: bool = False,
        key: Optional[Key] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        titles: List[str | None] | Dict[str, str] | None = None,
        types: List[ColumnType | BaseColumn | None]
        | Dict[str, ColumnType | BaseColumn]
        | None = None,
        hidden: Literal["index"] | str | Iterable[str] | None = None,
        widths: List[ColumnWidth | None] | Dict[str, ColumnWidth] | None = None,
        help: List[str | None] | Dict[str, str] | None = None,
        required: Literal["index"] | str | Iterable[str] | None = None,
        locked: Literal["index"] | str | Iterable[str] | None = None,
        default: List[str | int | float | bool | None]
        | Dict[str, str | int | float | bool | None]
        | None = None,
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

        disabled : bool
            An optional boolean which, if True, disables the data editor and prevents
            any edits. Defaults to False.

        key : str
            An optional string to use as the unique key for this widget. If this
            is omitted, a key will be generated for the widget based on its
            content. Multiple widgets of the same type may not share the same
            key.

        on_change : callable
            An optional callback invoked when this data_editor's value changes.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        titles : iterable of str or dict
            The columns titles shown at the top. Can be an iterable of one title per
            column, e.g. `("Header 1", "Header 2")`, or a dict mapping column names to
            titles, e.g. `{"col1": "Header 1", "col2": "Header 2"}`.

        types : iterable or dict
            The display types for the columns. Can be an iterable of one type per column,
            e.g. ("text", "number"), or a dict mapping column names to types, e.g.
            {"col1": "text", "col2": "number"}.
            Allowed types are "text", "number", "checkbox", "select", “list”,“datetime”,
            “date”, “time”, “url”, “image”, “line_chart”, “bar_chart”, “range” or one
            of the available column type classes from the `st.column_types` module.

        hidden :  "index", str, or iterable of str
            Which columns to hide in the table. Can be "index" to hide the index column,
            a single column name, e.g. “col1”, or an iterable of column names,
            e.g. (”col1”, “col2”).

        widths: iterable of str or dict
            The display width of the columns. Allowed values are “small”, “medium”, or
            “large”. Can be an iterable of widths per column, e.g. (”small”, “large”),
            or a dict mapping column names to widths, e.g. `{”col1”: “small”, “col2”:
            “large”}`.

        help : iterable of str or dict
            The help text shown in the column header. Can be an iterable of one help text
            per column, e.g. (”Help text 1”, “Help text 2”), or a dict mapping column
            names to help texts, e.g. {”col1”: “Help text 1”, “col2”: “Help text 2”}.
            The help text is shown as a tooltip when the user hovers over the column
            header.

        locked : "index", str, or iterable of str
            Which columns should not be editable. Can be a single column name,
            e.g. `col1`, or an iterable of column names, e.g. `(”col1”, “col2”)`.
            Use `index` to hide the index column.

        required : bool, dict, iterable of bool
            Whether a cell requires a value or can be cleared. Can be a single value
            for the entire dataframe, e.g. True, or an iterable with one value per
            column, e.g. `(True, False)`, or a dict mapping column names to values,
            e.g. `{”col1”: True, “col2”: False}`.

        default : dict or iterable
            The default value in a cell when the user adds a new row. Can be a single
            value to use for all cells, e.g. 123, or an iterable of one value per column,
            e.g. (123, “abc”), or a dict mapping column names to values,
            e.g. {”col1”: 123, “col2”: “abc”}.

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
            num_rows=num_rows,
            disabled=disabled,
            key=key,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            titles=titles,
            types=types,
            hidden=hidden,
            required=required,
            locked=locked,
            widths=widths,
            help=help,
            default=default,
        )


# Note: can use a more restrictive bound if wanted.
F = TypeVar("F", bound=Callable[..., object])


class DataframeColumnConfig(Protocol[F]):
    NumberColumn: Type[NumberColumn]
    TextColumn: Type[TextColumn]
    BarChartColumn: Type[BarChartColumn]
    CheckboxColumn: Type[CheckboxColumn]
    DateColumn: Type[DateColumn]
    DateTimeColumn: Type[DateTimeColumn]
    ImageColumn: Type[ImageColumn]
    LineChartColumn: Type[LineChartColumn]
    ListColumn: Type[ListColumn]
    RangeColumn: Type[RangeColumn]
    SelectColumn: Type[SelectColumn]
    TimeColumn: Type[TimeColumn]
    UrlColumn: Type[LinkColumn]

    __call__: F


def add_column_configs(func: F) -> DataframeColumnConfig[F]:
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)

    command = cast(DataframeColumnConfig[F], wrapper)
    command.NumberColumn = NumberColumn
    command.TextColumn = TextColumn
    command.BarChartColumn = BarChartColumn
    command.CheckboxColumn = CheckboxColumn
    command.DateColumn = DateColumn
    command.DateTimeColumn = DateTimeColumn
    command.ImageColumn = ImageColumn
    command.LineChartColumn = LineChartColumn
    command.ListColumn = ListColumn
    command.RangeColumn = RangeColumn
    command.SelectColumn = SelectColumn
    command.TimeColumn = TimeColumn
    command.UrlColumn = LinkColumn

    return command


experimental_data_editor = add_column_configs(
    DataEditorMixin().experimental_data_editor
)

dataframe = add_column_configs(DataFrameMixin().dataframe)
