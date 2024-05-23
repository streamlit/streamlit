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

import json
from dataclasses import dataclass
from decimal import Decimal
from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    Final,
    Iterable,
    List,
    Literal,
    Mapping,
    Set,
    Tuple,
    TypedDict,
    TypeVar,
    Union,
    cast,
    overload,
)

from typing_extensions import TypeAlias

from streamlit import logger as _logger
from streamlit import type_util
from streamlit.deprecation_util import deprecate_func_name
from streamlit.elements.form import current_form_id
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
from streamlit.elements.lib.pandas_styler_utils import marshall_styler
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.runtime.state.common import compute_widget_id
from streamlit.type_util import DataFormat, DataFrameGenericAlias, Key, is_type, to_key
from streamlit.util import calc_md5

if TYPE_CHECKING:
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
    bound=Union[
        DataFrameGenericAlias[Any],  # covers DataFrame and Series
        Tuple[Any],
        List[Any],
        Set[Any],
        Dict[str, Any],
        # TODO(lukasmasuch): Add support for np.ndarray
        # but it is not possible with np.ndarray.
        # NDArray[Any] works, but is only available in numpy>1.20.
        # TODO(lukasmasuch): Add support for pa.Table typing
        # pa.Table does not work since it is a C-based class resulting in Any
    ],
)


# All data types supported by the data editor.
DataTypes: TypeAlias = Union[
    "pd.DataFrame",
    "pd.Series",
    "pd.Index",
    "Styler",
    "pa.Table",
    "np.ndarray[Any, np.dtype[np.float64]]",
    Tuple[Any],
    List[Any],
    Set[Any],
    Dict[str, Any],
]


class EditingState(TypedDict, total=False):
    """
    A dictionary representing the current state of the data editor.

    Attributes
    ----------
    edited_rows : Dict[int, Dict[str, str | int | float | bool | None]]
        An hierarchical mapping of edited cells based on: row position -> column name -> value.

    added_rows : List[Dict[str, str | int | float | bool | None]]
        A list of added rows, where each row is a mapping from column name to the cell value.

    deleted_rows : List[int]
        A list of deleted rows, where each row is the numerical position of the deleted row.
    """

    edited_rows: dict[int, dict[str, str | int | float | bool | None]]
    added_rows: list[dict[str, str | int | float | bool | None]]
    deleted_rows: list[int]


@dataclass
class DataEditorSerde:
    """DataEditorSerde is used to serialize and deserialize the data editor state."""

    def deserialize(self, ui_value: str | None, widget_id: str = "") -> EditingState:
        data_editor_state: EditingState = (
            {
                "edited_rows": {},
                "added_rows": [],
                "deleted_rows": [],
            }
            if ui_value is None
            else json.loads(ui_value)
        )

        # Make sure that all editing state keys are present:
        if "edited_rows" not in data_editor_state:
            data_editor_state["edited_rows"] = {}

        if "deleted_rows" not in data_editor_state:
            data_editor_state["deleted_rows"] = []

        if "added_rows" not in data_editor_state:
            data_editor_state["added_rows"] = []

        # Convert the keys (numerical row positions) to integers.
        # The keys are strings because they are serialized to JSON.
        data_editor_state["edited_rows"] = {
            int(k): v for k, v in data_editor_state["edited_rows"].items()
        }
        return data_editor_state

    def serialize(self, editing_state: EditingState) -> str:
        return json.dumps(editing_state, default=str)


def _parse_value(
    value: str | int | float | bool | None,
    column_data_kind: ColumnDataKind,
) -> Any:
    """Convert a value to the correct type.

    Parameters
    ----------
    value : str | int | float | bool | None
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
        if column_data_kind == ColumnDataKind.STRING:
            return str(value)

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

        if column_data_kind in [
            ColumnDataKind.DATETIME,
            ColumnDataKind.DATE,
            ColumnDataKind.TIME,
        ]:
            datetime_value = pd.Timestamp(value)

            if datetime_value is pd.NaT:
                return None

            if column_data_kind == ColumnDataKind.DATETIME:
                return datetime_value

            if column_data_kind == ColumnDataKind.DATE:
                return datetime_value.date()

            if column_data_kind == ColumnDataKind.TIME:
                return datetime_value.time()

    except (ValueError, pd.errors.ParserError) as ex:
        _LOGGER.warning(
            "Failed to parse value %s as %s. Exception: %s", value, column_data_kind, ex
        )
        return None
    return value


def _apply_cell_edits(
    df: pd.DataFrame,
    edited_rows: Mapping[int, Mapping[str, str | int | float | bool | None]],
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
                df.index.values[row_pos] = _parse_value(
                    value, dataframe_schema[INDEX_IDENTIFIER]
                )
            else:
                col_pos = df.columns.get_loc(col_name)
                df.iat[row_pos, col_pos] = _parse_value(
                    value, dataframe_schema[col_name]
                )


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

    # This is only used if the dataframe has a range index:
    # There seems to be a bug in older pandas versions with RangeIndex in
    # combination with loc. As a workaround, we manually track the values here:
    range_index_stop = None
    range_index_step = None
    if isinstance(df.index, pd.RangeIndex):
        range_index_stop = df.index.stop
        range_index_step = df.index.step

    for added_row in added_rows:
        index_value = None
        new_row: list[Any] = [None for _ in range(df.shape[1])]
        for col_name in added_row.keys():
            value = added_row[col_name]
            if col_name == INDEX_IDENTIFIER:
                # TODO(lukasmasuch): To support multi-index in the future:
                # use a tuple of values here instead of a single value
                index_value = _parse_value(value, dataframe_schema[INDEX_IDENTIFIER])
            else:
                col_pos = df.columns.get_loc(col_name)
                new_row[col_pos] = _parse_value(value, dataframe_schema[col_name])
        # Append the new row to the dataframe
        if range_index_stop is not None:
            df.loc[range_index_stop, :] = new_row
            # Increment to the next range index value
            range_index_stop += range_index_step
        elif index_value is not None:
            # TODO(lukasmasuch): we are only adding rows that have a non-None index
            # value to prevent issues in the frontend component. Also, it just overwrites
            # the row in case the index value already exists in the dataframe.
            # In the future, it would be better to require users to provide unique
            # non-None values for the index with some kind of visual indications.
            df.loc[index_value, :] = new_row


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
    df.drop(df.index[deleted_rows], inplace=True)


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

    if data_editor_state.get("added_rows"):
        _apply_row_additions(df, data_editor_state["added_rows"], dataframe_schema)

    if data_editor_state.get("deleted_rows"):
        _apply_row_deletions(df, data_editor_state["deleted_rows"])


def _is_supported_index(df_index: pd.Index) -> bool:
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
        in [
            pd.RangeIndex,
            pd.Index,
            pd.DatetimeIndex,
            # Categorical index doesn't work since arrow
            # does serialize the options:
            # pd.CategoricalIndex,
            # Interval type isn't editable currently:
            # pd.IntervalIndex,
            # Period type isn't editable currently:
            # pd.PeriodIndex,
        ]
        # We need to check these index types without importing, since they are deprecated
        # and planned to be removed soon.
        or is_type(df_index, "pandas.core.indexes.numeric.Int64Index")
        or is_type(df_index, "pandas.core.indexes.numeric.Float64Index")
        or is_type(df_index, "pandas.core.indexes.numeric.UInt64Index")
    )


def _fix_column_headers(data_df: pd.DataFrame) -> None:
    """Fix the column headers of the provided dataframe inplace to work
    correctly for data editing."""
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
            inplace=True,
        )


def _check_column_names(data_df: pd.DataFrame):
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
):
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
        column_name, _ = column
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
                continue

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
        width: int | None = None,
        height: int | None = None,
        use_container_width: bool = False,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        num_rows: Literal["fixed", "dynamic"] = "fixed",
        disabled: bool | Iterable[str] = False,
        key: Key | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> EditableData:
        pass

    @overload
    def data_editor(
        self,
        data: Any,
        *,
        width: int | None = None,
        height: int | None = None,
        use_container_width: bool = False,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        num_rows: Literal["fixed", "dynamic"] = "fixed",
        disabled: bool | Iterable[str] = False,
        key: Key | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> pd.DataFrame:
        pass

    @gather_metrics("data_editor")
    def data_editor(
        self,
        data: DataTypes,
        *,
        width: int | None = None,
        height: int | None = None,
        use_container_width: bool = False,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        num_rows: Literal["fixed", "dynamic"] = "fixed",
        disabled: bool | Iterable[str] = False,
        key: Key | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> DataTypes:
        """Display a data editor widget.

        The data editor widget allows you to edit dataframes and many other data structures in a table-like UI.

        .. warning::
            When going from ``st.experimental_data_editor`` to ``st.data_editor`` in
            1.23.0, the data editor's representation in ``st.session_state`` was changed.
            The ``edited_cells`` dictionary is now called ``edited_rows`` and uses a
            different format (``{0: {"column name": "edited value"}}`` instead of
            ``{"0:1": "edited value"}``). You may need to adjust the code if your app uses
            ``st.experimental_data_editor`` in combination with ``st.session_state``.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Series, pandas.Styler, pandas.Index, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, list, set, tuple, dict, or None
            The data to edit in the data editor.

            .. note::
                - Styles from ``pandas.Styler`` will only be applied to non-editable columns.
                - Mixing data types within a column can make the column uneditable.
                - Additionally, the following data types are not yet supported for editing:
                  complex, list, tuple, bytes, bytearray, memoryview, dict, set, frozenset,
                  fractions.Fraction, pandas.Interval, and pandas.Period.
                - To prevent overflow in JavaScript, columns containing datetime.timedelta
                  and pandas.Timedelta values will default to uneditable but this can be
                  changed through column configuration.

        width : int or None
            Desired width of the data editor expressed in pixels. If ``width``
            is ``None`` (default), Streamlit sets the data editor width to fit
            its contents up to the width of the parent container. If ``width``
            is greater than the width of the parent container, Streamlit sets
            the data editor width to match the width of the parent container.

        height : int or None
            Desired height of the data editor expressed in pixels. If ``height``
            is ``None`` (default), Streamlit sets the height to show at most
            ten rows. Vertical scrolling within the data editor element is
            enabled when the height does not accomodate all rows.

        use_container_width : bool
            Whether to override ``width`` with the width of the parent
            container. If ``use_container_width`` is ``False`` (default),
            Streamlit sets the data editor's width according to ``width``. If
            ``use_container_width`` is ``True``, Streamlit sets the width of
            the data editor to match the width of the parent container.

        hide_index : bool or None
            Whether to hide the index column(s). If ``hide_index`` is ``None``
            (default), the visibility of index columns is automatically
            determined based on the data.

        column_order : Iterable of str or None
            Specifies the display order of columns. This also affects which columns are
            visible. For example, ``column_order=("col2", "col1")`` will display 'col2'
            first, followed by 'col1', and will hide all other non-index columns. If
            None (default), the order is inherited from the original data structure.

        column_config : dict or None
            Configures how columns are displayed, e.g. their title, visibility, type, or
            format, as well as editing properties such as min/max value or step.
            This needs to be a dictionary where each key is a column name and the value
            is one of:

            * ``None`` to hide the column.

            * A string to set the display label of the column.

            * One of the column types defined under ``st.column_config``, e.g.
              ``st.column_config.NumberColumn("Dollar values”, format=”$ %d")`` to show
              a column as dollar amounts. See more info on the available column types
              and config options `here <https://docs.streamlit.io/library/api-reference/data/st.column_config>`_.

            To configure the index column(s), use ``_index`` as the column name.

        num_rows : "fixed" or "dynamic"
            Specifies if the user can add and delete rows in the data editor.
            If "fixed", the user cannot add or delete rows. If "dynamic", the user can
            add and delete rows in the data editor, but column sorting is disabled.
            Defaults to "fixed".

        disabled : bool or Iterable of str
            Controls the editing of columns. If True, editing is disabled for all columns.
            If an Iterable of column names is provided (e.g., ``disabled=("col1", "col2"))``,
            only the specified columns will be disabled for editing. If False (default),
            all columns that support editing are editable.

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

        Returns
        -------
        pandas.DataFrame, pandas.Series, pyarrow.Table, numpy.ndarray, list, set, tuple, or dict.
            The edited data. The edited data is returned in its original data type if
            it corresponds to any of the supported return types. All other data types
            are returned as a ``pandas.DataFrame``.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>>
        >>> df = pd.DataFrame(
        >>>     [
        >>>        {"command": "st.selectbox", "rating": 4, "is_widget": True},
        >>>        {"command": "st.balloons", "rating": 5, "is_widget": False},
        >>>        {"command": "st.time_input", "rating": 3, "is_widget": True},
        >>>    ]
        >>> )
        >>> edited_df = st.data_editor(df)
        >>>
        >>> favorite_command = edited_df.loc[edited_df["rating"].idxmax()]["command"]
        >>> st.markdown(f"Your favorite command is **{favorite_command}** 🎈")

        .. output::
           https://doc-data-editor.streamlit.app/
           height: 350px

        You can also allow the user to add and delete rows by setting ``num_rows`` to "dynamic":

        >>> import streamlit as st
        >>> import pandas as pd
        >>>
        >>> df = pd.DataFrame(
        >>>     [
        >>>        {"command": "st.selectbox", "rating": 4, "is_widget": True},
        >>>        {"command": "st.balloons", "rating": 5, "is_widget": False},
        >>>        {"command": "st.time_input", "rating": 3, "is_widget": True},
        >>>    ]
        >>> )
        >>> edited_df = st.data_editor(df, num_rows="dynamic")
        >>>
        >>> favorite_command = edited_df.loc[edited_df["rating"].idxmax()]["command"]
        >>> st.markdown(f"Your favorite command is **{favorite_command}** 🎈")

        .. output::
           https://doc-data-editor1.streamlit.app/
           height: 450px

        Or you can customize the data editor via ``column_config``, ``hide_index``, ``column_order``, or ``disabled``:

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

        # Import here to avoid cyclic import warning
        from streamlit.elements.utils import (
            check_cache_replay_rules,
            check_callback_rules,
            check_session_state_rules,
        )

        key = to_key(key)

        check_cache_replay_rules()
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=None, key=key, writes_allowed=False)

        if column_order is not None:
            column_order = list(column_order)

        column_config_mapping: ColumnConfigMapping = {}

        data_format = type_util.determine_data_format(data)
        if data_format == DataFormat.UNKNOWN:
            raise StreamlitAPIException(
                f"The data type ({type(data).__name__}) or format is not supported by the data editor. "
                "Please convert your data into a Pandas Dataframe or another supported data format."
            )

        # The dataframe should always be a copy of the original data
        # since we will apply edits directly to it.
        data_df = type_util.convert_anything_to_df(data, ensure_copy=True)

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
        apply_data_specific_configs(
            column_config_mapping, data_df, data_format, check_arrow_compatibility=True
        )

        # Fix the column headers to work correctly for data editing:
        _fix_column_headers(data_df)
        # Temporary workaround: We hide range indices if num_rows is dynamic.
        # since the current way of handling this index during editing is a bit confusing.
        if isinstance(data_df.index, pd.RangeIndex) and num_rows == "dynamic":
            update_column_config(
                column_config_mapping, INDEX_IDENTIFIER, {"hidden": True}
            )

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

        arrow_bytes = type_util.pyarrow_table_to_bytes(arrow_table)

        # We want to do this as early as possible to avoid introducing nondeterminism,
        # but it isn't clear how much processing is needed to have the data in a
        # format that will hash consistently, so we do it late here to have it
        # as close as possible to how it used to be.
        ctx = get_script_run_ctx()
        id = compute_widget_id(
            "data_editor",
            user_key=key,
            data=arrow_bytes,
            width=width,
            height=height,
            use_container_width=use_container_width,
            column_order=column_order,
            column_config_mapping=str(column_config_mapping),
            num_rows=num_rows,
            key=key,
            form_id=current_form_id(self.dg),
            page=ctx.page_script_hash if ctx else None,
        )

        proto = ArrowProto()
        proto.id = id

        proto.use_container_width = use_container_width

        if width:
            proto.width = width
        if height:
            proto.height = height

        if column_order:
            proto.column_order[:] = column_order

        # Only set disabled to true if it is actually true
        # It can also be a list of columns, which should result in false here.
        proto.disabled = disabled is True

        proto.editing_mode = (
            ArrowProto.EditingMode.DYNAMIC
            if num_rows == "dynamic"
            else ArrowProto.EditingMode.FIXED
        )

        proto.form_id = current_form_id(self.dg)

        if type_util.is_pandas_styler(data):
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
            data.set_uuid(styler_uuid)
            marshall_styler(proto, data, styler_uuid)

        proto.data = arrow_bytes

        marshall_column_config(proto, column_config_mapping)

        serde = DataEditorSerde()

        widget_state = register_widget(
            "data_editor",
            proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        _apply_dataframe_edits(data_df, widget_state.value, dataframe_schema)
        self.dg._enqueue("arrow_data_frame", proto)
        return type_util.convert_df_to_data_format(data_df, data_format)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

    # TODO(lukasmasuch): Remove the deprecated function name after 2023-09-01:
    # Also remove the warning message in the `st.data_editor` docstring.
    experimental_data_editor = deprecate_func_name(
        gather_metrics("experimental_data_editor", data_editor),
        "experimental_data_editor",
        "2023-09-01",
        """
**Breaking change:** The data editor's representation in `st.session_state` was changed. The `edited_cells` dictionary is now called `edited_rows` and uses a
different format (`{0: {"column name": "edited value"}}` instead of
`{"0:1": "edited value"}`). You may need to adjust the code if your app uses
`st.experimental_data_editor` in combination with `st.session_state`."
""",
    )
