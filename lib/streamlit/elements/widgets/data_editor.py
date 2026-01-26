# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
from dataclasses import dataclass
from decimal import Decimal
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    TypeAlias,
    TypedDict,
    TypeVar,
    Union,
    cast,
    overload,
)

from typing_extensions import Required

from streamlit import dataframe_util
from streamlit import logger as _logger
from streamlit.deprecation_util import (
    make_deprecated_name_warning,
    show_deprecation_warning,
)
from streamlit.elements.lib.column_config_utils import (
    INDEX_IDENTIFIER,
    ColumnConfigMapping,
    ColumnConfigMappingInput,
    ColumnDataKind,
    DataframeSchema,
    apply_data_specific_configs,
    determine_dataframe_schema,
    is_type_compatible,
    marshall_column_config,
    process_config_mapping,
    update_column_config,
)
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    Width,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.pandas_styler_utils import marshall_styler
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import Key, compute_and_register_element_id, to_key
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.type_util import is_list_like, is_type
from streamlit.util import calc_md5

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping

    import numpy as np
    import pandas as pd
    import pyarrow as pa
    from pandas.io.formats.style import Styler

    from streamlit.delta_generator import DeltaGenerator

_LOGGER: Final = _logger.get_logger(__name__)

# All formats that support direct editing, meaning that these
# formats will be returned with the same type when used with data_editor.
EditableData = TypeVar(
    "EditableData",
    bound=dataframe_util.DataFrameGenericAlias[Any]
    | tuple[Any]
    | list[Any]
    | set[Any]
    | dict[str, Any],
)


# All data types supported by the data editor.
DataTypes: TypeAlias = Union[
    "pd.DataFrame",
    "pd.Series[Any]",
    "pd.Index[Any]",
    "Styler",
    "pa.Table",
    "np.ndarray[Any, np.dtype[np.float64]]",
    tuple[Any],
    list[Any],
    set[Any],
    dict[str, Any],
]


class EditingState(TypedDict, total=False):
    """
    A dictionary representing the current state of the data editor.

    Attributes
    ----------
    edited_rows : Dict[int, Dict[str, str | int | float | bool | None]]
        An hierarchical mapping of edited cells based on:
        row position -> column name -> value.

    added_rows : List[Dict[str, str | int | float | bool | None]]
        A list of added rows, where each row is a mapping from column name to
        the cell value.

    deleted_rows : List[int]
        A list of deleted rows, where each row is the numerical position of
        the deleted row.
    """

    edited_rows: Required[dict[int, dict[str, str | int | float | bool | None]]]
    added_rows: Required[list[dict[str, str | int | float | bool | None]]]
    deleted_rows: Required[list[int]]


@dataclass
class DataEditorSerde:
    """DataEditorSerde is used to serialize and deserialize the data editor state."""

    def deserialize(self, ui_value: str | None) -> EditingState:
        data_editor_state: EditingState = cast(
            "EditingState",
            {
                "edited_rows": {},
                "added_rows": [],
                "deleted_rows": [],
            }
            if ui_value is None
            else json.loads(ui_value),
        )

        # Make sure that all editing state keys are present:
        if "edited_rows" not in data_editor_state:
            data_editor_state["edited_rows"] = {}  # type: ignore[unreachable]

        if "deleted_rows" not in data_editor_state:
            data_editor_state["deleted_rows"] = []  # type: ignore[unreachable]

        if "added_rows" not in data_editor_state:
            data_editor_state["added_rows"] = []  # type: ignore[unreachable]

        # Convert the keys (numerical row positions) to integers.
        # The keys are strings because they are serialized to JSON.
        data_editor_state["edited_rows"] = {
            int(k): v for k, v in data_editor_state["edited_rows"].items()
        }
        return data_editor_state

    def serialize(self, editing_state: EditingState) -> str:
        return json.dumps(editing_state, default=str)


def _parse_value(
    value: str | int | float | bool | list[str] | None,
    column_data_kind: ColumnDataKind,
) -> Any:
    """Convert a value to the correct type.

    Parameters
    ----------
    value : str | int | float | bool | list[str] | None
        The value to convert.

    column_data_kind : ColumnDataKind
        The determined data kind of the column. The column data kind refers to the
        shared data type of the values in the column (e.g. int, float, str).

    Returns
    -------
    The converted value.
    """
    if value is None:
        return None

    import pandas as pd

    try:
        if column_data_kind == ColumnDataKind.LIST:
            return list(value) if is_list_like(value) else [value]  # ty: ignore[invalid-argument-type]

        if column_data_kind == ColumnDataKind.EMPTY:
            # For empty columns, preserve the value type from the frontend.
            # If it's a list (e.g., from multiselect), return as list.
            # If it's a scalar (e.g., from number input), return as scalar.
            return list(value) if is_list_like(value) else value  # ty: ignore[invalid-argument-type]

        if column_data_kind == ColumnDataKind.STRING:
            return str(value)

        # List values aren't supported for anything else than list column data kind.
        # To make the type checker happy, we raise a TypeError here. However,
        # This isn't expected to happen.
        if isinstance(value, list):
            raise TypeError(  # noqa: TRY301
                "List values are only supported by list, string and empty columns."
            )

        if column_data_kind == ColumnDataKind.INTEGER:
            return int(value)

        if column_data_kind == ColumnDataKind.FLOAT:
            return float(value)

        if column_data_kind == ColumnDataKind.BOOLEAN:
            return bool(value)

        if column_data_kind == ColumnDataKind.DECIMAL:
            # Decimal theoretically can also be initialized via number values.
            # However, using number values here seems to cause issues with Arrow
            # serialization, once you try to render the returned dataframe.
            return Decimal(str(value))

        if column_data_kind == ColumnDataKind.TIMEDELTA:
            return pd.Timedelta(value)

        if column_data_kind in {
            ColumnDataKind.DATETIME,
            ColumnDataKind.DATE,
            ColumnDataKind.TIME,
        }:
            datetime_value = pd.Timestamp(value)

            if pd.isna(datetime_value):
                return None  # type: ignore[unreachable]

            if column_data_kind == ColumnDataKind.DATETIME:
                return datetime_value

            if column_data_kind == ColumnDataKind.DATE:
                return datetime_value.date()

            if column_data_kind == ColumnDataKind.TIME:
                return datetime_value.time()

    except (ValueError, pd.errors.ParserError, TypeError) as ex:
        _LOGGER.warning(
            "Failed to parse value %s as %s.",
            value,
            column_data_kind,
            exc_info=ex,
        )
        return None
    return value


def _apply_cell_edits(
    df: pd.DataFrame,
    edited_rows: Mapping[
        int, Mapping[str, str | int | float | bool | list[str] | None]
    ],
    dataframe_schema: DataframeSchema,
) -> None:
    """Apply cell edits to the provided dataframe (inplace).

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to apply the cell edits to.

    edited_rows : Mapping[int, Mapping[str, str | int | float | bool | None]]
        A hierarchical mapping based on row position -> column name -> value

    dataframe_schema: DataframeSchema
        The schema of the dataframe.
    """
    for row_id, row_changes in edited_rows.items():
        row_pos = int(row_id)
        for col_name, value in row_changes.items():
            if col_name == INDEX_IDENTIFIER:
                # The edited cell is part of the index
                # TODO(lukasmasuch): To support multi-index in the future:
                # use a tuple of values here instead of a single value
                old_idx_value = df.index[row_pos]
                new_idx_value = _parse_value(value, dataframe_schema[INDEX_IDENTIFIER])
                df.rename(
                    index={old_idx_value: new_idx_value},
                    inplace=True,  # noqa: PD002
                )
            else:
                col_pos = df.columns.get_loc(col_name)
                df.iat[row_pos, col_pos] = _parse_value(  # type: ignore
                    value, dataframe_schema[col_name]
                )


def _parse_added_row(
    df: pd.DataFrame,
    added_row: dict[str, Any],
    dataframe_schema: DataframeSchema,
) -> tuple[Any, list[Any]]:
    """Parse the added row into an optional index value and a list of row values."""
    index_value = None
    new_row: list[Any] = [None for _ in range(df.shape[1])]
    for col_name, value in added_row.items():
        if col_name == INDEX_IDENTIFIER:
            # TODO(lukasmasuch): To support multi-index in the future:
            # use a tuple of values here instead of a single value
            index_value = _parse_value(value, dataframe_schema[INDEX_IDENTIFIER])
        else:
            col_pos = cast("int", df.columns.get_loc(col_name))
            new_row[col_pos] = _parse_value(value, dataframe_schema[col_name])

    return index_value, new_row


def _assign_row_values(
    df: pd.DataFrame,
    row_label: Any,
    row_values: list[Any],
) -> None:
    """Assign values to a dataframe row via a mapping.

    This avoids numpy attempting to coerce nested sequences (e.g. lists) into
    multi-dimensional arrays when a column legitimately stores list values.
    """

    df.loc[row_label] = dict(zip(df.columns, row_values, strict=True))


def _apply_row_additions(
    df: pd.DataFrame,
    added_rows: list[dict[str, Any]],
    dataframe_schema: DataframeSchema,
) -> None:
    """Apply row additions to the provided dataframe (inplace).

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to apply the row additions to.

    added_rows : List[Dict[str, Any]]
        A list of row additions. Each row addition is a dictionary with the
        column position as key and the new cell value as value.

    dataframe_schema: DataframeSchema
        The schema of the dataframe.
    """

    if not added_rows:
        return

    import pandas as pd

    index_type: Literal["range", "integer", "other"] = "other"
    # This is only used if the dataframe has a range or integer index that can be
    # auto incremented:
    index_stop: int | None = None
    index_step: int | None = None

    if isinstance(df.index, pd.RangeIndex):
        # Extract metadata from the range index:
        index_type = "range"
        index_stop = df.index.stop
        index_step = df.index.step
    elif isinstance(df.index, pd.Index) and pd.api.types.is_integer_dtype(
        df.index.dtype
    ):
        # Get highest integer value and increment it by 1 to get unique index value.
        index_type = "integer"
        index_stop = 0 if df.index.empty else df.index.max() + 1
        index_step = 1

    for added_row in added_rows:
        index_value, new_row = _parse_added_row(df, added_row, dataframe_schema)

        if index_value is not None and index_type != "range":
            # Case 1: Non-range index with an explicitly provided index value
            # Add row using the user-provided index value.
            # This handles any type of index that cannot be auto incremented.

            # Note: this just overwrites the row in case the index value
            # already exists. In the future, it would be better to
            # require users to provide unique non-None values for the index with
            # some kind of visual indications.
            _assign_row_values(df, index_value, new_row)
            continue

        if index_stop is not None and index_step is not None:
            # Case 2: Range or integer index that can be auto incremented.
            # Add row using the next value in the sequence
            _assign_row_values(df, index_stop, new_row)
            # Increment to the next range index value
            index_stop += index_step
            continue

        # Row cannot be added -> skip it and log a warning.
        _LOGGER.warning(
            "Cannot automatically add row for the index "
            "of type %s without an explicit index value. Row addition skipped.",
            type(df.index).__name__,
        )


def _apply_row_deletions(df: pd.DataFrame, deleted_rows: list[int]) -> None:
    """Apply row deletions to the provided dataframe (inplace).

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to apply the row deletions to.

    deleted_rows : List[int]
        A list of row numbers to delete.
    """
    # Drop rows based in numeric row positions
    df.drop(df.index[deleted_rows], inplace=True)  # noqa: PD002


def _apply_dataframe_edits(
    df: pd.DataFrame,
    data_editor_state: EditingState,
    dataframe_schema: DataframeSchema,
) -> None:
    """Apply edits to the provided dataframe (inplace).

    This includes cell edits, row additions and row deletions.

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to apply the edits to.

    data_editor_state : EditingState
        The editing state of the data editor component.

    dataframe_schema: DataframeSchema
        The schema of the dataframe.
    """
    if data_editor_state.get("edited_rows"):
        _apply_cell_edits(df, data_editor_state["edited_rows"], dataframe_schema)

    if data_editor_state.get("deleted_rows"):
        _apply_row_deletions(df, data_editor_state["deleted_rows"])

    if data_editor_state.get("added_rows"):
        # The addition of new rows needs to happen after the deletion to not have
        # unexpected side-effects, like https://github.com/streamlit/streamlit/issues/8854
        _apply_row_additions(df, data_editor_state["added_rows"], dataframe_schema)


def _is_supported_index(df_index: pd.Index[Any]) -> bool:
    """Check if the index is supported by the data editor component.

    Parameters
    ----------
    df_index : pd.Index
        The index to check.

    Returns
    -------
    bool
        True if the index is supported, False otherwise.
    """
    import pandas as pd

    return (
        type(df_index)
        in {
            pd.RangeIndex,
            pd.Index,
            pd.DatetimeIndex,
            pd.CategoricalIndex,
            # Interval type isn't editable currently:
            # pd.IntervalIndex,
            # Period type isn't editable currently:
            # pd.PeriodIndex,
        }
        # We need to check these index types without importing, since they are
        # deprecated and planned to be removed soon.
        or is_type(df_index, "pandas.core.indexes.numeric.Int64Index")
        or is_type(df_index, "pandas.core.indexes.numeric.Float64Index")
        or is_type(df_index, "pandas.core.indexes.numeric.UInt64Index")
    )


def _fix_column_headers(data_df: pd.DataFrame) -> None:
    """Fix the column headers of the provided dataframe inplace to work
    correctly for data editing.
    """
    import pandas as pd

    if isinstance(data_df.columns, pd.MultiIndex):
        # Flatten hierarchical column headers to a single level:
        data_df.columns = [
            "_".join(map(str, header)) for header in data_df.columns.to_flat_index()
        ]
    elif pd.api.types.infer_dtype(data_df.columns) != "string":
        # If the column names are not all strings, we need to convert them to strings
        # to avoid issues with editing:
        data_df.rename(
            columns={column: str(column) for column in data_df.columns},
            inplace=True,  # noqa: PD002
        )


def _check_column_names(data_df: pd.DataFrame) -> None:
    """Check if the column names in the provided dataframe are valid.

    It's not allowed to have duplicate column names or column names that are
    named ``_index``. If the column names are not valid, a ``StreamlitAPIException``
    is raised.
    """

    if data_df.columns.empty:
        return

    # Check if the column names are unique and raise an exception if not.
    # Add the names of the duplicated columns to the exception message.
    duplicated_columns = data_df.columns[data_df.columns.duplicated()]
    if len(duplicated_columns) > 0:
        raise StreamlitAPIException(
            f"All column names are required to be unique for usage with data editor. "
            f"The following column names are duplicated: {list(duplicated_columns)}. "
            f"Please rename the duplicated columns in the provided data."
        )

    # Check if the column names are not named "_index" and raise an exception if so.
    if INDEX_IDENTIFIER in data_df.columns:
        raise StreamlitAPIException(
            f"The column name '{INDEX_IDENTIFIER}' is reserved for the index column "
            f"and can't be used for data columns. Please rename the column in the "
            f"provided data."
        )


def _check_type_compatibilities(
    data_df: pd.DataFrame,
    columns_config: ColumnConfigMapping,
    dataframe_schema: DataframeSchema,
) -> None:
    """Check column type to data type compatibility.

    Iterates the index and all columns of the dataframe to check if
    the configured column types are compatible with the underlying data types.

    Parameters
    ----------
    data_df : pd.DataFrame
        The dataframe to check the type compatibilities for.

    columns_config : ColumnConfigMapping
        A mapping of column to column configurations.

    dataframe_schema : DataframeSchema
        The schema of the dataframe.

    Raises
    ------
    StreamlitAPIException
        If a configured column type is editable and not compatible with the
        underlying data type.
    """
    # TODO(lukasmasuch): Update this here to support multi-index in the future:
    indices = [(INDEX_IDENTIFIER, data_df.index)]

    for column in indices + list(data_df.items()):
        column_name = str(column[0])
        column_data_kind = dataframe_schema[column_name]

        # TODO(lukasmasuch): support column config via numerical index here?
        if column_name in columns_config:
            column_config = columns_config[column_name]
            if column_config.get("disabled") is True:
                # Disabled columns are not checked for compatibility.
                # This might change in the future.
                continue

            type_config = column_config.get("type_config")

            if type_config is None:
                continue

            configured_column_type = type_config.get("type")

            if configured_column_type is None:
                # Just a safeguard, is not expected to happen.
                continue  # type: ignore[unreachable]

            if is_type_compatible(configured_column_type, column_data_kind) is False:
                raise StreamlitAPIException(
                    f"The configured column type `{configured_column_type}` for column "
                    f"`{column_name}` is not compatible for editing the underlying "
                    f"data type `{column_data_kind}`.\n\nYou have following options to "
                    f"fix this: 1) choose a compatible type 2) disable the column "
                    f"3) convert the column into a compatible data type."
                )


class DataEditorMixin:
    @overload
    def data_editor(
        self,
        data: EditableData,
        *,
        width: Width = "stretch",
        height: Height | Literal["auto"] = "auto",
        use_container_width: bool | None = None,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        num_rows: Literal["fixed", "dynamic", "add", "delete"] = "fixed",
        disabled: bool | Iterable[str | int] = False,
        key: Key | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        row_height: int | None = None,
        placeholder: str | None = None,
    ) -> EditableData:
        pass

    @overload
    def data_editor(
        self,
        data: Any,
        *,
        width: Width = "stretch",
        height: Height | Literal["auto"] = "auto",
        use_container_width: bool | None = None,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        num_rows: Literal["fixed", "dynamic", "add", "delete"] = "fixed",
        disabled: bool | Iterable[str | int] = False,
        key: Key | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        row_height: int | None = None,
        placeholder: str | None = None,
    ) -> pd.DataFrame:
        pass

    @gather_metrics("data_editor")
    def data_editor(
        self,
        data: DataTypes,
        *,
        width: Width = "stretch",
        height: Height | Literal["auto"] = "auto",
        use_container_width: bool | None = None,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        num_rows: Literal["fixed", "dynamic", "add", "delete"] = "fixed",
        disabled: bool | Iterable[str | int] = False,
        key: Key | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        row_height: int | None = None,
        placeholder: str | None = None,
    ) -> DataTypes:
        """Display a data editor widget.

        The data editor widget allows you to edit dataframes and many other data structures in a table-like UI.

        Parameters
        ----------
        data : Anything supported by st.dataframe
            The data to edit in the data editor.

            .. note::
                - Styles from ``pandas.Styler`` will only be applied to non-editable columns.
                - Text and number formatting from ``column_config`` always takes
                  precedence over text and number formatting from ``pandas.Styler``.
                - If your dataframe starts with an empty column, you should set
                  the column datatype in the underlying dataframe to ensure your
                  intended datatype, especially for integers versus floats.
                - Mixing data types within a column can make the column uneditable.
                - Additionally, the following data types are not yet supported for editing:
                  ``complex``, ``tuple``, ``bytes``, ``bytearray``,
                  ``memoryview``, ``dict``, ``set``, ``frozenset``,
                  ``fractions.Fraction``, ``pandas.Interval``, and
                  ``pandas.Period``.
                - To prevent overflow in JavaScript, columns containing
                  ``datetime.timedelta`` and ``pandas.Timedelta`` values will
                  default to uneditable, but this can be changed through column
                  configuration.

        width : "stretch", "content", or int
            The width of the data editor. This can be one of the following:

            - ``"stretch"`` (default): The width of the editor matches the
              width of the parent container.
            - ``"content"``: The width of the editor matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The editor has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the editor matches the width
              of the parent container.

        height : "auto", "content", "stretch", or int
            The height of the data editor. This can be one of the following:

            - ``"auto"`` (default): Streamlit sets the height to show at most
              ten rows.
            - ``"content"``: The height of the editor matches the height of
              its content. The height is capped at 10,000 pixels to prevent
              performance issues with very large dataframes.
            - ``"stretch"``: The height of the editor expands to fill the
              available vertical space in its parent container. When multiple
              elements with stretch height are in the same container, they
              share the available vertical space evenly. The editor will
              maintain a minimum height to display up to three rows, but
              otherwise won't exceed the available height in its parent
              container.
            - An integer specifying the height in pixels: The editor has a
              fixed height.

            Vertical scrolling within the editor is enabled when the height
            does not accommodate all rows.

        use_container_width : bool
            Whether to override ``width`` with the width of the parent
            container. If this is ``True`` (default), Streamlit sets the width
            of the data editor to match the width of the parent container. If
            this is ``False``, Streamlit sets the data editor's width according
            to ``width``.

            .. deprecated::
                ``use_container_width`` is deprecated and will be removed in a
                future release. For ``use_container_width=True``, use
                ``width="stretch"``.

        hide_index : bool or None
            Whether to hide the index column(s). If ``hide_index`` is ``None``
            (default), the visibility of index columns is automatically
            determined based on the data.

        column_order : Iterable[str] or None
            The ordered list of columns to display. If this is ``None``
            (default), Streamlit displays all columns in the order inherited
            from the underlying data structure. If this is a list, the
            indicated columns will display in the order they appear within the
            list. Columns may be omitted or repeated within the list.

            For example, ``column_order=("col2", "col1")`` will display
            ``"col2"`` first, followed by ``"col1"``, and will hide all other
            non-index columns.

            ``column_order`` does not accept positional column indices and
            can't move the index column(s).

        column_config : dict or None
            Configuration to customize how columns are displayed. If this is
            ``None`` (default), columns are styled based on the underlying data
            type of each column.

            Column configuration can modify column names, visibility, type,
            width, format, editing properties like min/max, and more. If this
            is a dictionary, the keys are column names (strings) and/or
            positional column indices (integers), and the values are one of the
            following:

            - ``None`` to hide the column.
            - A string to set the display label of the column.
            - One of the column types defined under ``st.column_config``. For
              example, to show a column as dollar amounts, use
              ``st.column_config.NumberColumn("Dollar values", format="$ %d")``.
              See more info on the available column types and config options
              `here <https://docs.streamlit.io/develop/api-reference/data/st.column_config>`_.

            To configure the index column(s), use ``"_index"`` as the column
            name, or use a positional column index where ``0`` refers to the
            first index column.

        num_rows : "fixed", "dynamic", "add", or "delete"
            Specifies if the user can add and/or delete rows in the data editor.

            - ``"fixed"`` (default): The user can't add or delete rows.
            - ``"dynamic"``: The user can add and delete rows, and column
              sorting is disabled.
            - ``"add"``: The user can only add rows (no deleting), and column
              sorting is disabled.
            - ``"delete"``: The user can only delete rows (no adding), and
              column sorting remains enabled.

        disabled : bool or Iterable[str | int]
            Controls the editing of columns. This can be one of the following:

            - ``False`` (default): All columns that support editing are editable.
            - ``True``: All columns are disabled for editing.
            - An Iterable of column names and/or positional indices: The
              specified columns are disabled for editing while the remaining
              columns are editable where supported. For example,
              ``disabled=["col1", "col2"]`` will disable editing for the
              columns named "col1" and "col2".

            To disable editing for the index column(s), use ``"_index"`` as the
            column name, or use a positional column index where ``0`` refers to
            the first index column.

        key : str
            An optional string to use as the unique key for this widget. If this
            is omitted, a key will be generated for the widget based on its
            content. No two widgets may have the same key.

        on_change : callable
            An optional callback invoked when this data_editor's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        row_height : int or None
            The height of each row in the data editor in pixels. If ``row_height``
            is ``None`` (default), Streamlit will use a default row height,
            which fits one line of text.

        placeholder : str or None
            The text that should be shown for missing values. If this is
            ``None`` (default), missing values are displayed as "None". To
            leave a cell empty, use an empty string (``""``). Other common
            values are ``"null"``, ``"NaN"`` and ``"-"``.

        Returns
        -------
        pandas.DataFrame, pandas.Series, pyarrow.Table, numpy.ndarray, list, set, tuple, or dict.
            The edited data. The edited data is returned in its original data type if
            it corresponds to any of the supported return types. All other data types
            are returned as a ``pandas.DataFrame``.

        Examples
        --------
        **Example 1: Basic usage**

        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> df = pd.DataFrame(
        >>>     [
        >>>         {"command": "st.selectbox", "rating": 4, "is_widget": True},
        >>>         {"command": "st.balloons", "rating": 5, "is_widget": False},
        >>>         {"command": "st.time_input", "rating": 3, "is_widget": True},
        >>>     ]
        >>> )
        >>> edited_df = st.data_editor(df)
        >>>
        >>> favorite_command = edited_df.loc[edited_df["rating"].idxmax()]["command"]
        >>> st.markdown(f"Your favorite command is **{favorite_command}** 🎈")

        .. output::
           https://doc-data-editor.streamlit.app/
           height: 350px

        **Example 2: Allowing users to add and delete rows**

        You can allow your users to add and delete rows by setting ``num_rows``
        to "dynamic":

        >>> import streamlit as st
        >>> import pandas as pd
        >>>
        >>> df = pd.DataFrame(
        >>>     [
        >>>         {"command": "st.selectbox", "rating": 4, "is_widget": True},
        >>>         {"command": "st.balloons", "rating": 5, "is_widget": False},
        >>>         {"command": "st.time_input", "rating": 3, "is_widget": True},
        >>>     ]
        >>> )
        >>> edited_df = st.data_editor(df, num_rows="dynamic")
        >>>
        >>> favorite_command = edited_df.loc[edited_df["rating"].idxmax()]["command"]
        >>> st.markdown(f"Your favorite command is **{favorite_command}** 🎈")

        .. output::
           https://doc-data-editor1.streamlit.app/
           height: 450px

        **Example 3: Data editor configuration**

        You can customize the data editor via ``column_config``, ``hide_index``,
        ``column_order``, or ``disabled``:

        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> df = pd.DataFrame(
        >>>     [
        >>>         {"command": "st.selectbox", "rating": 4, "is_widget": True},
        >>>         {"command": "st.balloons", "rating": 5, "is_widget": False},
        >>>         {"command": "st.time_input", "rating": 3, "is_widget": True},
        >>>     ]
        >>> )
        >>> edited_df = st.data_editor(
        >>>     df,
        >>>     column_config={
        >>>         "command": "Streamlit Command",
        >>>         "rating": st.column_config.NumberColumn(
        >>>             "Your rating",
        >>>             help="How much do you like this command (1-5)?",
        >>>             min_value=1,
        >>>             max_value=5,
        >>>             step=1,
        >>>             format="%d ⭐",
        >>>         ),
        >>>         "is_widget": "Widget ?",
        >>>     },
        >>>     disabled=["command", "is_widget"],
        >>>     hide_index=True,
        >>> )
        >>>
        >>> favorite_command = edited_df.loc[edited_df["rating"].idxmax()]["command"]
        >>> st.markdown(f"Your favorite command is **{favorite_command}** 🎈")


        .. output::
           https://doc-data-editor-config.streamlit.app/
           height: 350px

        """
        # Lazy-loaded import
        import pandas as pd
        import pyarrow as pa

        key = to_key(key)

        validate_width(width, allow_content=True)
        validate_height(
            height,
            allow_content=True,
            allow_stretch=True,
            additional_allowed=["auto"],
        )

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=None,
            writes_allowed=False,
        )

        if use_container_width is not None:
            show_deprecation_warning(
                make_deprecated_name_warning(
                    "use_container_width",
                    "width",
                    "2025-12-31",
                    "For `use_container_width=True`, use `width='stretch'`. "
                    "For `use_container_width=False`, use `width='content'`.",
                    include_st_prefix=False,
                ),
                show_in_browser=False,
            )
            if use_container_width:
                width = "stretch"
            elif not isinstance(width, int):
                width = "content"

        if column_order is not None:
            column_order = list(column_order)

        column_config_mapping: ColumnConfigMapping = {}

        data_format = dataframe_util.determine_data_format(data)
        if data_format == dataframe_util.DataFormat.UNKNOWN:
            raise StreamlitAPIException(
                f"The data type ({type(data).__name__}) or format is not supported by "
                "the data editor. Please convert your data into a Pandas Dataframe or "
                "another supported data format."
            )

        # The dataframe should always be a copy of the original data
        # since we will apply edits directly to it.
        data_df = dataframe_util.convert_anything_to_pandas_df(data, ensure_copy=True)

        # Check if the index is supported.
        if not _is_supported_index(data_df.index):
            raise StreamlitAPIException(
                f"The type of the dataframe index - {type(data_df.index).__name__} - is not "
                "yet supported by the data editor."
            )

        # Check if the column names are valid and unique.
        _check_column_names(data_df)

        # Convert the user provided column config into the frontend compatible format:
        column_config_mapping = process_config_mapping(column_config)

        # Deactivate editing for columns that are not compatible with arrow
        for column_name, column_data in data_df.items():
            if dataframe_util.is_colum_type_arrow_incompatible(column_data):
                update_column_config(
                    column_config_mapping, str(column_name), {"disabled": True}
                )
                # Convert incompatible type to string
                data_df[cast("Any", column_name)] = column_data.astype("string")

        apply_data_specific_configs(column_config_mapping, data_format)

        # Fix the column headers to work correctly for data editing:
        _fix_column_headers(data_df)

        has_range_index = isinstance(data_df.index, pd.RangeIndex)

        if not has_range_index:
            # If the index is not a range index, we will configure it as required
            # since the user is required to provide a (unique) value for editing.
            update_column_config(
                column_config_mapping, INDEX_IDENTIFIER, {"required": True}
            )
            if num_rows in {"dynamic", "add"} and hide_index is True:
                _LOGGER.warning(
                    "Setting `hide_index=True` in data editor with a non-range index will not have any effect "
                    "when `num_rows` is '%s'. It is required for the user to fill in index values for "
                    "adding new rows. To hide the index, make sure to set the DataFrame "
                    "index to a range index.",
                    num_rows,
                )

        if hide_index is None and has_range_index and num_rows in {"dynamic", "add"}:
            # Temporary workaround:
            # We hide range indices if num_rows allows adding rows.
            # since the current way of handling this index during editing is a
            # bit confusing. The user can still decide to show the index by
            # setting hide_index explicitly to False.
            hide_index = True

        if hide_index is not None:
            update_column_config(
                column_config_mapping, INDEX_IDENTIFIER, {"hidden": hide_index}
            )

        # If disabled not a boolean, we assume it is a list of columns to disable.
        # This gets translated into the columns configuration:
        if not isinstance(disabled, bool):
            for column in disabled:
                update_column_config(column_config_mapping, column, {"disabled": True})

        # Convert the dataframe to an arrow table which is used as the main
        # serialization format for sending the data to the frontend.
        # We also utilize the arrow schema to determine the data kinds of every column.
        arrow_table = pa.Table.from_pandas(data_df)

        # Determine the dataframe schema which is required for parsing edited values
        # and for checking type compatibilities.
        dataframe_schema = determine_dataframe_schema(data_df, arrow_table.schema)

        # Check if all configured column types are compatible with the underlying data.
        # Throws an exception if any of the configured types are incompatible.
        _check_type_compatibilities(data_df, column_config_mapping, dataframe_schema)

        arrow_bytes = dataframe_util.convert_arrow_table_to_arrow_bytes(arrow_table)

        # We want to do this as early as possible to avoid introducing nondeterminism,
        # but it isn't clear how much processing is needed to have the data in a
        # format that will hash consistently, so we do it late here to have it
        # as close as possible to how it used to be.
        ctx = get_script_run_ctx()
        element_id = compute_and_register_element_id(
            "data_editor",
            user_key=key,
            key_as_main_identity=False,
            dg=self.dg,
            data=arrow_bytes,
            width=width,
            height=height,
            use_container_width=use_container_width,
            column_order=column_order,
            column_config_mapping=str(column_config_mapping),
            num_rows=num_rows,
            row_height=row_height,
            placeholder=placeholder,
        )

        proto = ArrowProto()
        proto.id = element_id

        if row_height:
            proto.row_height = row_height

        if column_order:
            proto.column_order[:] = column_order

        if placeholder is not None:
            proto.placeholder = placeholder

        # Only set disabled to true if it is actually true
        # It can also be a list of columns, which should result in false here.
        proto.disabled = disabled is True

        if num_rows == "dynamic":
            proto.editing_mode = ArrowProto.EditingMode.DYNAMIC
        elif num_rows == "add":
            proto.editing_mode = ArrowProto.EditingMode.ADD_ONLY
        elif num_rows == "delete":
            proto.editing_mode = ArrowProto.EditingMode.DELETE_ONLY
        else:
            proto.editing_mode = ArrowProto.EditingMode.FIXED

        proto.form_id = current_form_id(self.dg)

        if dataframe_util.is_pandas_styler(data):
            # Pandas styler will only work for non-editable/disabled columns.
            # Get first 10 chars of md5 hash of the key or delta path as styler uuid
            # and set it as styler uuid.
            # We are only using the first 10 chars to keep the uuid short since
            # it will be used for all the cells in the dataframe. Therefore, this
            # might have a significant impact on the message size. 10 chars
            # should be good enough to avoid  potential collisions in this case.
            # Even on collisions, there should not be a big issue with the
            # rendering in the data editor.
            styler_uuid = calc_md5(key or self.dg._get_delta_path_str())[:10]
            data.set_uuid(styler_uuid)  # ty: ignore[call-non-callable, possibly-missing-attribute]
            marshall_styler(proto, data, styler_uuid)

        proto.data = arrow_bytes

        marshall_column_config(proto, column_config_mapping)

        # Create layout configuration
        # For height, only include it in LayoutConfig if it's not "auto"
        # "auto" is the default behavior and doesn't need to be sent
        layout_config = LayoutConfig(
            width=width, height=height if height != "auto" else None
        )

        serde = DataEditorSerde()

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
        )

        _apply_dataframe_edits(data_df, widget_state.value, dataframe_schema)
        self.dg._enqueue("arrow_data_frame", proto, layout_config=layout_config)
        return dataframe_util.convert_pandas_df_to_data_format(data_df, data_format)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
