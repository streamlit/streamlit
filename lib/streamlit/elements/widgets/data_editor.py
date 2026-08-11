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

import inspect
import json
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    TypeAlias,
    TypeVar,
    Union,
    cast,
    overload,
)

from streamlit import dataframe_util, runtime
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
    extract_button_column_configs,
    is_type_compatible,
    marshall_column_config,
    process_config_mapping,
    register_button_column_widgets,
    update_column_config,
)
from streamlit.elements.lib.form_utils import current_form_id, is_in_form
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
from streamlit.error_util import handle_uncaught_app_exception
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Dataframe_pb2 import Dataframe as DataframeProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.exceptions import ScriptControlException
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.type_util import is_list_like, is_type
from streamlit.util import ReadOnlyAttributeDictionary, calc_hash, create_fast_hasher

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


class DataEditorState(ReadOnlyAttributeDictionary):
    """The schema for the data editor state.

    The state is stored in a read-only dictionary-like object that
    supports both key and attribute notation. Top-level assignment and
    nested dict mutation raise ``TypeError``. List fields (``added_rows``,
    ``deleted_rows``) are ordinary lists and are not frozen. Data editor
    states cannot be programmatically changed or set through Session State.

    Attributes
    ----------
    edited_rows : dict[int, dict[str, str | int | float | bool | list[str] | None]]
        A hierarchical mapping of edited cells based on row position ->
        column name -> value. Row positions refer to the original source
        dataframe before pending edits are applied.

    added_rows : list[dict[str, str | int | float | bool | list[str] | None]]
        A list of added rows, where each row is a mapping from column name to
        the cell value.

    deleted_rows : list[int]
        A list of deleted rows, where each entry is the numerical position of
        the deleted row in the original source dataframe.
    """

    edited_rows: dict[int, dict[str, str | int | float | bool | list[str] | None]]
    added_rows: list[dict[str, str | int | float | bool | list[str] | None]]
    deleted_rows: list[int]

    @overload
    def __getitem__(
        self, key: Literal["edited_rows"]
    ) -> dict[int, dict[str, str | int | float | bool | list[str] | None]]: ...

    @overload
    def __getitem__(
        self, key: Literal["added_rows"]
    ) -> list[dict[str, str | int | float | bool | list[str] | None]]: ...

    @overload
    def __getitem__(self, key: Literal["deleted_rows"]) -> list[int]: ...

    @overload
    def __getitem__(self, key: Any) -> Any: ...

    def __getitem__(self, key: Any) -> Any:
        return super().__getitem__(key)


# Signature of the optional ``commit_edits`` callback. It receives the source
# dataframe (before pending edits), the edited dataframe (with pending edits
# applied), and the read-only edit delta, and returns the new source dataframe
# for the current render.
CommitEditsCallback: TypeAlias = Callable[
    ["pd.DataFrame", "pd.DataFrame", DataEditorState], "pd.DataFrame"
]


@dataclass
class DataEditorSerde:
    """DataEditorSerde is used to serialize and deserialize the data editor state."""

    def deserialize(self, ui_value: str | None) -> DataEditorState:
        # Keep the payload as a plain dict until the end so missing-key and
        # row-key mutations below can still run before we wrap.
        data_editor_state: dict[str, Any] = (
            {
                "edited_rows": {},
                "added_rows": [],
                "deleted_rows": [],
            }
            if ui_value is None
            else json.loads(ui_value)
        )

        data_editor_state.setdefault("edited_rows", {})
        data_editor_state.setdefault("added_rows", [])
        data_editor_state.setdefault("deleted_rows", [])

        # Convert the keys (numerical row positions) to integers.
        # The keys are strings because they are serialized to JSON.
        data_editor_state["edited_rows"] = {
            int(k): v for k, v in data_editor_state["edited_rows"].items()
        }
        return DataEditorState(data_editor_state)

    def serialize(self, editing_state: DataEditorState) -> str:
        return json.dumps(editing_state, default=str)


def _canonical_arrow_type(arrow_type: pa.DataType) -> str:
    """Return a canonical string for an Arrow type.

    The large and non-large variants of the string, binary, and list types
    (e.g. ``string`` vs ``large_string``) are indistinguishable to the data
    editor, but they can differ purely based on how pandas/pyarrow happens to
    serialize a frame (for example, adding a row can downcast ``large_string``
    to ``string``). Collapsing them to a single canonical name avoids spurious
    schema-mismatch rejections and needless widget-identity resets.
    """
    import pyarrow as pa

    if pa.types.is_string(arrow_type) or pa.types.is_large_string(arrow_type):
        return "string"
    if pa.types.is_binary(arrow_type) or pa.types.is_large_binary(arrow_type):
        return "binary"
    if pa.types.is_list(arrow_type) or pa.types.is_large_list(arrow_type):
        return f"list<{_canonical_arrow_type(arrow_type.value_type)}>"
    return str(arrow_type)


def _is_integer_like_index(index: pd.Index[Any]) -> bool:
    """True for ``RangeIndex`` and plain integer ``Index`` variants.

    On pandas < 3.0, adding a row via ``.loc`` can downcast a default
    ``RangeIndex`` to a plain integer ``Index``. Those forms are equivalent for
    editing purposes (labels may still change).
    """
    import pandas as pd

    if isinstance(index, pd.RangeIndex):
        return True
    if type(index) is pd.Index and pd.api.types.is_integer_dtype(index.dtype):
        return True
    # Legacy numeric index types (removed in newer pandas).
    return is_type(index, "pandas.core.indexes.numeric.Int64Index") or is_type(
        index, "pandas.core.indexes.numeric.UInt64Index"
    )


def _canonical_index_type_name(index: pd.Index[Any]) -> str:
    """Stable index-kind name for widget identity / compatibility checks."""
    if _is_integer_like_index(index):
        return "integer"
    return type(index).__name__


def _indexes_have_compatible_structure(
    result_index: pd.Index[Any], baseline_index: pd.Index[Any]
) -> bool:
    """True when two indexes share the same editing-compatible structure.

    Index labels may differ. ``RangeIndex`` and an equivalent integer ``Index``
    are treated as the same kind so ``return edited_df`` after a row addition
    stays valid on pandas < 3.0.
    """
    if list(result_index.names) != list(baseline_index.names):
        return False
    if type(result_index) is type(baseline_index):
        return True
    return _is_integer_like_index(result_index) and _is_integer_like_index(
        baseline_index
    )


def _is_async_callable(callback: Any) -> bool:
    """True for async functions and callable instances with async ``__call__``."""
    if inspect.iscoroutinefunction(callback):
        return True
    # ``inspect.iscoroutinefunction`` misses instances whose ``__call__`` is
    # defined with ``async def``. Walk the MRO for that method without using
    # ``getattr(..., "__call__")`` (flagged by ruff as an unreliable callable check).
    for cls in type(callback).__mro__:
        call_attr = cls.__dict__.get("__call__")
        if call_attr is not None:
            return inspect.iscoroutinefunction(call_attr)
    return False


def _compute_data_editor_signature(
    data_df: pd.DataFrame,
    data_format: dataframe_util.DataFormat,
    arrow_schema: pa.Schema,
    dataframe_schema: DataframeSchema,
    disabled: bool | Iterable[str | int],
    include_row_count: bool,
    include_index_values: bool = True,
    disabled_columns: Iterable[str | int] = (),
) -> str:
    """Compute a stable signature over the data's structure (schema), used as a
    keyed fixed-rows editor's identity so value-only changes don't reset edits.

    When ``include_index_values`` is ``False``, the index labels are excluded so
    the signature depends only on the schema. This is used for ``commit_edits``
    editors, whose committed result may legitimately change the row count and
    index labels without churning the widget identity (which would orphan the
    next edit).
    """
    import pandas as pd

    h = create_fast_hasher()

    def add_to_signature(label: str, value: object) -> None:
        # Prefix with the label and terminate with a NUL byte so distinct
        # (label, value) pairs can never hash to the same bytes.
        h.update(f"{label}:".encode())
        h.update(repr(value).encode("utf-8"))
        h.update(b"\0")

    add_to_signature("format", data_format.name)
    add_to_signature("columns", tuple(data_df.columns))
    # Canonicalize RangeIndex / integer Index so a pandas < 3.0 row-add
    # downcast does not churn the commit_edits widget identity.
    add_to_signature("index_type", _canonical_index_type_name(data_df.index))
    # Encode each index name as a (is_none, name) pair so an unnamed index
    # (None) can never collide with an index whose name is a sentinel string.
    add_to_signature(
        "index_names",
        tuple((name is None, name) for name in data_df.index.names),
    )

    if include_index_values and (
        not isinstance(data_df.index, pd.RangeIndex)
        or (
            data_df.index.start != 0
            or data_df.index.stop != len(data_df.index)
            or data_df.index.step != 1
        )
    ):
        h.update(b"index_values:")
        try:
            h.update(
                pd.util.hash_pandas_object(data_df.index, index=False)
                .to_numpy()
                .tobytes()
            )
        except TypeError:
            h.update(str(data_df.index.tolist()).encode("utf-8"))
        h.update(b"\0")

    for field in arrow_schema:
        add_to_signature(
            "field",
            (
                field.name,
                _canonical_arrow_type(field.type),
                field.nullable,
            ),
        )

    for column_name, data_kind in sorted(dataframe_schema.items()):
        add_to_signature("kind", (column_name, data_kind.value))

    if include_row_count:
        add_to_signature("rows", len(data_df))

    if disabled is True:
        add_to_signature("disabled", "all")
    elif disabled is False:
        add_to_signature("disabled", "none")
    else:
        # An empty iterable means "nothing is disabled", which is semantically
        # the same as disabled=False, so normalize it to the same signature to
        # avoid needless widget resets when toggling between the two.
        disabled_names = tuple(sorted(disabled, key=repr))
        add_to_signature("disabled", disabled_names or "none")

    # Per-column disabled state (from column_config or auto-disabled incompatible
    # columns) affects which edits are valid: disabling a column must reset
    # pending edits so the backend does not keep applying an edit for a now
    # read-only column that the frontend no longer paints.
    add_to_signature("disabled_columns", tuple(sorted(disabled_columns, key=repr)))

    return h.hexdigest()


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
    import warnings

    # Suppress pandas FutureWarning about dtype inference during concatenation.
    # When assigning to a new row via .loc[], pandas internally performs concat
    # and warns (in pandas 2.1-2.x) about changing how it handles empty/NA columns.
    # The warning is not actionable by users and was removed in pandas 3.x.
    # See: https://github.com/streamlit/streamlit/issues/14321
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="The behavior of DataFrame concatenation with empty or all-NA entries is deprecated",
            category=FutureWarning,
        )
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

            # Widget state is client-controlled, so reject duplicate index values
            # instead of letting an "added" row overwrite an existing row.
            if index_value in df.index:
                _LOGGER.warning(
                    "Cannot add row because its index value already exists. "
                    "Row addition skipped."
                )
                continue

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
    data_editor_state: DataEditorState,
    dataframe_schema: DataframeSchema,
) -> None:
    """Apply edits to the provided dataframe (inplace).

    This includes cell edits, row additions and row deletions.

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to apply the edits to.

    data_editor_state : DataEditorState
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


def _has_pending_edits(state: DataEditorState) -> bool:
    """True if the data editor state contains any pending edits.

    Pending edits are cell edits, row additions, or row deletions submitted by
    the user but not yet committed.
    """
    return bool(
        state.get("edited_rows") or state.get("added_rows") or state.get("deleted_rows")
    )


def _validate_edited_dataframe_compatibility(
    result: Any,
    *,
    baseline_df: pd.DataFrame,
    baseline_arrow_schema: pa.Schema,
    baseline_dataframe_schema: DataframeSchema,
) -> tuple[pd.DataFrame, pa.Table]:
    """Validate that a ``commit_edits`` result stays editing-compatible.

    A compatible result may change values, row count, and index labels, but must
    preserve the column order, index kind and names (``RangeIndex`` and an
    equivalent integer ``Index`` count as the same kind), the Arrow field
    types/nullability, and the parsing data kinds of the baseline dataframe.

    Returns the validated dataframe together with its Arrow table so the caller
    can reuse both without re-converting. Raises ``StreamlitAPIException`` if the
    result is incompatible.
    """
    import pandas as pd
    import pyarrow as pa

    if not isinstance(result, pd.DataFrame):
        raise StreamlitAPIException(
            "st.data_editor: commit_edits must return a pandas.DataFrame, but it "
            f"returned an object of type {type(result).__name__}."
        )

    if list(result.columns) != list(baseline_df.columns):
        raise StreamlitAPIException(
            "st.data_editor: commit_edits must preserve the column order of the "
            "source dataframe."
        )

    if not _indexes_have_compatible_structure(result.index, baseline_df.index):
        raise StreamlitAPIException(
            "st.data_editor: commit_edits must preserve the index structure (kind "
            "and names) of the source dataframe."
        )

    if not _is_supported_index(result.index):
        raise StreamlitAPIException(
            "st.data_editor: commit_edits returned a dataframe with an index type "
            f"({type(result.index).__name__}) that is not supported by the data "
            "editor."
        )

    result_arrow = pa.Table.from_pandas(result)

    def _arrow_fields(schema: pa.Schema) -> dict[str, tuple[str, bool]]:
        # Pandas materializes an unnamed Index as ``__index_level_N__``, while a
        # RangeIndex stays metadata-only. Ignore those fields so RangeIndex /
        # integer Index equivalence does not look like a schema change.
        return {
            field.name: (_canonical_arrow_type(field.type), field.nullable)
            for field in schema
            if not field.name.startswith("__index_level_")
        }

    result_fields = _arrow_fields(result_arrow.schema)
    baseline_fields = _arrow_fields(baseline_arrow_schema)
    if result_fields != baseline_fields:
        mismatched_columns = [
            f"{name!r} (expected {baseline_fields[name][0]}, got {result_fields[name][0]})"
            for name in baseline_fields
            if name in result_fields and result_fields[name] != baseline_fields[name]
        ]
        detail = (
            f" Mismatched columns: {', '.join(mismatched_columns)}."
            if mismatched_columns
            else ""
        )
        raise StreamlitAPIException(
            "st.data_editor: commit_edits must preserve the column data types and "
            f"nullability of the source dataframe.{detail}"
        )

    if (
        determine_dataframe_schema(result, result_arrow.schema)
        != baseline_dataframe_schema
    ):
        raise StreamlitAPIException(
            "st.data_editor: commit_edits must preserve the editable data kinds of "
            "the source dataframe's columns."
        )

    return result, result_arrow


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
        commit_edits: CommitEditsCallback | None = None,
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
        commit_edits: CommitEditsCallback | None = None,
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
        commit_edits: CommitEditsCallback | None = None,
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

            .. note::
                Columns omitted from ``column_order`` are hidden by default
                but can still be shown by the user via the column visibility
                menu in the table toolbar. If a column contains sensitive data
                that should not be exposed to the user, remove it from the
                data before passing it to the function.

        column_config : dict or None
            Configuration to customize how columns are displayed. If this is
            ``None`` (default), columns are styled based on the underlying data
            type of each column.

            Column configuration can modify column names, visibility, type,
            width, format, editing properties like min/max, and more. If this
            is a dictionary, the keys are column names (strings) and/or
            positional column indices (integers), and the values are one of the
            following:

            - ``None`` to hide the column. Hidden columns can still be shown
              by the user via the table toolbar.
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

        key : str, int, or None
            An optional string or integer to use as the unique key for
            the widget. If this is ``None`` (default), a key will be
            generated for the widget based on the values of the other
            parameters. No two widgets may have the same key.

            A key lets you access the widget's value via
            ``st.session_state[key]`` (read-only). For more details, see
            `Widget behavior
            <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a
            CSS class name prefixed with ``st-key-``.

            .. note::
                Assigning a key stabilizes the widget's identity and preserves
                edits across reruns when the data's *values* change. This
                applies only with ``num_rows="fixed"`` and only while the data's
                structure stays the same; edits reset when the columns, column
                types, row count, or index labels change. Edits are matched by
                row position, so use a meaningful index if edits should follow
                specific rows when the data is reordered. Omit ``key`` to reset
                all edits whenever the data changes.

                When ``commit_edits`` is set, the widget's identity is based on
                the schema only, so the row count and index labels *can* change
                (for example, from a committed result) without resetting the
                widget or orphaning the next edit.

        on_change : callable
            An optional callback invoked when this data_editor's value changes.

        commit_edits : callable or None
            An optional callback that turns the data editor into a
            transactional, commit-based editor. If this is ``None`` (default),
            the data editor behaves normally and returns the edited data.

            When ``commit_edits`` is set, Streamlit calls it during the rerun
            caused by an edit, after deserializing and applying the pending
            edits. The callback has the following signature and receives three
            positional arguments:

            .. code-block:: python

                def commit_edits(
                    source_df: pd.DataFrame,
                    edited_df: pd.DataFrame,
                    edits: DataEditorState,
                ) -> pd.DataFrame: ...

            - ``source_df`` is the normalized dataframe passed to
              ``st.data_editor`` before the pending edits are applied. Treat it
              as read-only; it is the baseline rendered if the callback fails.
            - ``edited_df`` is a copy of ``source_df`` with all pending edits
              already applied.
            - ``edits`` is the read-only ``DataEditorState`` (the same object
              returned by ``st.session_state[key]``). It supports attribute and
              item access, for example ``edits.edited_rows`` or
              ``edits["edited_rows"]``. Row positions in ``edited_rows`` and
              ``deleted_rows`` refer to ``source_df``, so you can recover row
              identity with ``source_df.iloc[row_position]``.

            The callback returns the new source dataframe for the current
            render. On a successful return, Streamlit displays the returned
            dataframe and clears the pending edits. To reject a batch without
            writing, return ``source_df`` (or another baseline); this is still a
            successful return, so the pending edits clear. If the callback
            raises an exception, Streamlit preserves the pending edits, shows the
            standard exception message, and the ``st.data_editor`` call returns
            the last committed baseline. Persisting the returned dataframe (to
            Session State, a database, or a cache) is the app's responsibility;
            the result is the baseline for the current render only.

            .. note::
                The edits are cleared on the frontend without an immediate
                rerun, so ``st.session_state[key]`` reflects the cleared state
                only on the next rerun. Within the committing run itself,
                ``st.session_state[key]`` still reports the batch that was just
                committed. Use the ``edits`` argument (not
                ``st.session_state[key]``) to inspect the committed batch inside
                the callback.

            ``commit_edits`` has the following requirements and constraints:

            - A ``key`` is required so edit state can be preserved across
              reruns.
            - It can't be combined with ``on_change``. Because ``args`` and
              ``kwargs`` are only forwarded to ``on_change``, they have no
              effect when ``commit_edits`` is set.
            - It isn't supported inside ``st.form`` or with ``pandas.Styler``
              input.
            - Async callbacks aren't supported.
            - The returned dataframe must stay editing-compatible: it may change
              values, row count, and index labels, but must preserve the column
              order, index kind and names, column data types/nullability, and
              editable data kinds of ``source_df``. Incompatible results raise a
              ``StreamlitAPIException`` and preserve the pending edits.

            .. code-block:: python
                :filename: streamlit_app.py

                import pandas as pd
                import streamlit as st

                from streamlit.typing import DataEditorState

                if "orders" not in st.session_state:
                    st.session_state.orders = load_orders()


                def persist_orders(
                    source_df: pd.DataFrame,
                    edited_df: pd.DataFrame,
                    edits: DataEditorState,
                ) -> pd.DataFrame:
                    # Reject without writing by returning the source dataframe.
                    if (edited_df["amount"] < 0).any():
                        st.toast("Amounts must be positive.", icon=":material/error:")
                        return source_df

                    for row_position in edits.deleted_rows:
                        delete_order(source_df.iloc[row_position]["id"])
                    for row_position, changes in edits.edited_rows.items():
                        update_order(source_df.iloc[row_position]["id"], changes)
                    for row in edits.added_rows:
                        insert_order(row)

                    refreshed_df = load_orders()
                    st.session_state.orders = refreshed_df
                    return refreshed_df


                st.data_editor(
                    st.session_state.orders,
                    key="orders_editor",
                    num_rows="dynamic",
                    commit_edits=persist_orders,
                )

            .. output::
               https://doc-data-editor-commit-edits.streamlit.app/
               height: 350px

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

        if commit_edits is not None:
            if key is None:
                raise StreamlitAPIException(
                    "st.data_editor: commit_edits requires a stable widget identity. "
                    "Pass a key= argument so edit state can be preserved across reruns."
                )
            if on_change is not None:
                raise StreamlitAPIException(
                    "st.data_editor: commit_edits cannot be combined with on_change. "
                    "Use commit_edits alone for transactional write-back."
                )
            if runtime.exists() and is_in_form(self.dg):
                raise StreamlitAPIException(
                    "st.data_editor: commit_edits is not supported inside forms."
                )
            if dataframe_util.is_pandas_styler(data):
                raise StreamlitAPIException(
                    "st.data_editor: commit_edits does not support pandas.Styler input."
                )
            if _is_async_callable(commit_edits):
                raise StreamlitAPIException(
                    "st.data_editor: commit_edits does not support async callbacks."
                )

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

        processed_column_config, button_columns = extract_button_column_configs(
            column_config
        )

        # Convert the user provided column config into the frontend compatible format:
        column_config_mapping = process_config_mapping(processed_column_config)

        # Deactivate editing for columns that are not compatible with arrow
        for column_name, column_data in data_df.items():
            if dataframe_util.determine_arrow_column_fix(column_data) is not None:
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
            disabled = list(disabled)
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
        # For keyed editors with a fixed number of rows, we base the widget
        # identity on the data schema (via a stable signature) instead of the
        # full data. This keeps edits alive across pure value changes.
        #
        # `commit_edits` editors use the same schema-based identity for every
        # `num_rows` mode: a successful commit can change the row count and
        # index labels, so a data-based identity would churn on the next run and
        # orphan the pending edit. The signature therefore excludes the row
        # count and index labels, depending only on the (validated, preserved)
        # schema.
        commit_edits_active = commit_edits is not None
        use_signature_identity = key is not None and (
            num_rows == "fixed" or commit_edits_active
        )
        signature_kwargs: dict[str, str] = {}
        key_as_main_identity: bool | set[str] = False
        if use_signature_identity:
            key_as_main_identity = {"data_signature", "num_rows"}
            # Columns disabled via `column_config` (or auto-disabled for
            # arrow-incompatible types) are not part of the top-level `disabled`
            # argument, so we derive them from the resolved column config to
            # keep them part of the widget identity.
            disabled_columns = [
                column
                for column, config in column_config_mapping.items()
                if config.get("disabled") is True
            ]
            signature_kwargs["data_signature"] = _compute_data_editor_signature(
                data_df=data_df,
                data_format=data_format,
                arrow_schema=arrow_table.schema,
                dataframe_schema=dataframe_schema,
                disabled=disabled,
                disabled_columns=disabled_columns,
                include_row_count=not commit_edits_active,
                include_index_values=not commit_edits_active,
            )

        element_id = compute_and_register_element_id(
            "data_editor",
            user_key=key,
            key_as_main_identity=key_as_main_identity,
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
            **signature_kwargs,
        )

        proto = DataframeProto()
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
            proto.editing_mode = DataframeProto.EditingMode.DYNAMIC
        elif num_rows == "add":
            proto.editing_mode = DataframeProto.EditingMode.ADD_ONLY
        elif num_rows == "delete":
            proto.editing_mode = DataframeProto.EditingMode.DELETE_ONLY
        else:
            proto.editing_mode = DataframeProto.EditingMode.FIXED

        proto.form_id = current_form_id(self.dg)

        proto.commit_edits = commit_edits_active

        if dataframe_util.is_pandas_styler(data):
            # Pandas styler will only work for non-editable/disabled columns.
            # Get first 10 chars of content hash of the key or delta path as styler uuid
            # and set it as styler uuid.
            # We are only using the first 10 chars to keep the uuid short since
            # it will be used for all the cells in the dataframe. Therefore, this
            # might have a significant impact on the message size. 10 chars
            # should be good enough to avoid  potential collisions in this case.
            # Even on collisions, there should not be a big issue with the
            # rendering in the data editor.
            styler_uuid = calc_hash(key or self.dg._get_delta_path_str())[:10]
            data.set_uuid(styler_uuid)  # ty: ignore[call-non-callable, unresolved-attribute]
            marshall_styler(proto.arrow_data, data, styler_uuid)

        proto.arrow_data.data = arrow_bytes

        marshall_column_config(proto, column_config_mapping)

        # Skip registration when the entire data_editor is disabled (disabled=True)
        # since button-column clicks should not fire in that case.
        if disabled is not True:
            register_button_column_widgets(
                dg=self.dg,
                proto=proto,
                button_columns=button_columns,
                ctx=ctx,
            )

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
            # `disabled` may be a list of column names for partial disabling;
            # only enforce server-side when the entire editor is disabled.
            disabled=disabled is True,
        )

        if commit_edits is None:
            # Default behavior: apply the pending edits directly to the frame we
            # render and return.
            _apply_dataframe_edits(data_df, widget_state.value, dataframe_schema)
            self.dg._enqueue("dataframe", proto, layout_config=layout_config)
            return dataframe_util.convert_pandas_df_to_data_format(data_df, data_format)

        # commit_edits mode: never apply the pending edits to the rendered or
        # returned frame. We commit a freshly submitted edit batch via the
        # callback and render its result; otherwise we render the last committed
        # baseline (`data_df`) while the frontend overlays the preserved edits.
        # `edits` is the read-only DataEditorState (identical to
        # st.session_state[key]) and must not be mutated.
        edits = widget_state.value
        # Check for pending edits first so the common no-edit render short-circuits
        # before acquiring the session state lock via `widget_changed`.
        should_commit = _has_pending_edits(edits) and (
            ctx is not None and ctx.session_state.widget_changed(proto.id)
        )

        render_df = data_df

        if should_commit:
            # Operate on a deep copy so the DataEditorState handed to the
            # callback keeps matching st.session_state[key].
            edited_df = data_df.copy(deep=True)
            _apply_dataframe_edits(edited_df, edits, dataframe_schema)
            try:
                committed_df, committed_arrow = (
                    _validate_edited_dataframe_compatibility(
                        commit_edits(data_df, edited_df, edits),
                        baseline_df=data_df,
                        baseline_arrow_schema=arrow_table.schema,
                        baseline_dataframe_schema=dataframe_schema,
                    )
                )
                # Success: render the committed frame and signal the frontend to
                # clear its pending edits. Set `clear_edits` only after the Arrow
                # serialization succeeds, so a failure there falls through to the
                # exception handler with the edits preserved (instead of telling
                # the frontend to wipe them while the baseline is rendered).
                render_df = committed_df
                proto.arrow_data.data = (
                    dataframe_util.convert_arrow_table_to_arrow_bytes(committed_arrow)
                )
                proto.clear_edits = True
            except ScriptControlException:
                # st.rerun()/st.stop() inside the callback: preserve the pending
                # edits and keep normal control flow.
                raise
            except Exception as ex:
                # A failing callback or an incompatible result preserves the
                # pending edits and surfaces the standard exception message.
                handle_uncaught_app_exception(ex)
                render_df = data_df

        self.dg._enqueue("dataframe", proto, layout_config=layout_config)
        return dataframe_util.convert_pandas_df_to_data_format(render_df, data_format)

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)
