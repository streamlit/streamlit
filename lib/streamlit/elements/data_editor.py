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

import contextlib
import json
from dataclasses import dataclass
from enum import Enum
from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    List,
    Optional,
    Set,
    Tuple,
    TypeVar,
    Union,
    cast,
    overload,
)

import numpy as np
import pandas as pd
import pyarrow as pa
from numpy.typing import NDArray
from pandas.api.types import is_datetime64_any_dtype, is_float_dtype, is_integer_dtype
from pandas.io.formats.style import Styler
from typing_extensions import Final, Literal, TypeAlias, TypedDict

from streamlit import type_util
from streamlit.elements.arrow import marshall
from streamlit.elements.column_config import ColumnConfig, parse_column_config
from streamlit.elements.form import current_form_id
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.type_util import DataFrameGenericAlias, Key, to_key

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

_INDEX_IDENTIFIER: Final = "index"

# All formats that support direct editing, meaning that these
# formats will be returned with the same type when used with data_editor.
EditableData = TypeVar(
    "EditableData",
    bound=Union[
        DataFrameGenericAlias[Any],  # covers DataFrame and Series
        NDArray[Any],
        Tuple[Any],
        List[Any],
        Set[Any],
        Dict[str, Any],
    ],
)


# All data types supported by the data editor.
DataTypes: TypeAlias = Union[
    pd.DataFrame,
    pd.Index,
    Styler,
    pa.Table,
    NDArray[Any],
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
    edited_cells : Dict[str, str | int | float | bool | None]
        A dictionary of edited cells, where the key is the cell's row and
        column index (row:column), and the value is the new value of the cell.

    added_rows : List[Dict[str, str | int | float | bool | None]]
        A list of added rows, where each row is a dictionary of column names
        and values.

    deleted_rows : List[int]
        A list of deleted rows, where each row is the index of the deleted row.
    """

    edited_cells: Dict[str, str | int | float | bool | None]
    added_rows: List[Dict[str, str | int | float | bool | None]]
    deleted_rows: List[int]


# A mapping of column names/IDs to column configs.
ColumnConfigMapping: TypeAlias = Dict[Union[int, str], ColumnConfig]


def _marshall_column_config(
    proto: ArrowProto, columns: Optional[Dict[Union[int, str], ColumnConfig]] = None
) -> None:
    """Marshall the column config into the proto.

    Parameters
    ----------
    proto : ArrowProto
        The proto to marshall into.

    columns : Optional[ColumnConfigMapping]
        The column config to marshall.
    """
    if columns is None:
        columns = {}

    # Ignore all None values and prefix columns specified by index
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
            for (k, v) in remove_none_values(columns).items()
        }
    )


@dataclass
class DataEditorSerde:
    """DataEditorSerde is used to serialize and deserialize the data editor state."""

    def deserialize(self, ui_value: Optional[str], widget_id: str = "") -> EditingState:
        return (  # type: ignore
            {
                "edited_cells": {},
                "added_rows": [],
                "deleted_rows": [],
            }
            if ui_value is None
            else json.loads(ui_value)
        )

    def serialize(self, editing_state: EditingState) -> str:
        return json.dumps(editing_state, default=str)


class DataFormat(Enum):
    """DataFormat is used to determine the format of the data."""

    UNKNOWN = "unknown"
    PANDAS_DATAFRAME = "pands_dataframe"  # pd.DataFrame
    PANDAS_SERIES = "pandas_series"  # pd.Series
    PANDAS_INDEX = "pandas_index"  # pd.Index
    NUMPY_LIST = "numpy_list"  # np.array[Scalar]
    NUMPY_MATRIX = "numpy_matrix"  # np.array[List[Scalar]]
    PYARROW_TABLE = "pyarrow_table"  # pyarrow.Table
    SNOWPARK_OBJECT = "snowpark_object"  # Snowpark DataFrame, Table, List[Row]
    PYSPARK_OBJECT = "pyspark_object"  # pyspark.DataFrame
    PANDAS_STYLER = "pandas_styler"  # pandas Styler
    LIST_OF_RECORDS = "list_of_records"  # List[Dict[str, Scalar]]
    LIST_OF_ROWS = "list_of_rows"  # List[List[Scalar]]
    LIST_OF_VALUES = "list_of_values"  # List[Scalar]
    TUPLE_OF_VALUES = "tuple_of_values"  # Tuple[Scalar]
    SET_OF_VALUES = "set_of_values"  # Set[Scalar]
    COLUMN_INDEX_MAPPING = "column_index_mapping"  # {column: {index: value}}
    COLUMN_VALUE_MAPPING = "column_value_mapping"  # {column: List[values]}
    COLUMN_SERIES_MAPPING = "column_series_mapping"  # {column: Series(values)}
    KEY_VALUE_DICT = "key_value_dict"  # {index: value}


def _determine_data_format(input_data: Any) -> DataFormat:
    """Determine the data format of the input data.

    Parameters
    ----------
    input_data : Any
        The input data to determine the data format of.

    Returns
    -------
    DataFormat
        The data format of the input data.
    """
    if isinstance(input_data, pd.DataFrame):
        return DataFormat.PANDAS_DATAFRAME
    elif isinstance(input_data, np.ndarray):
        if len(input_data.shape) == 1:
            # For technical reasons, we need to distinguish one
            # one-dimensional numpy array from multidimensional ones.
            return DataFormat.NUMPY_LIST
        return DataFormat.NUMPY_MATRIX
    elif isinstance(input_data, pa.Table):
        return DataFormat.PYARROW_TABLE
    elif isinstance(input_data, pd.Series):
        return DataFormat.PANDAS_SERIES
    elif isinstance(input_data, pd.Index):
        return DataFormat.PANDAS_INDEX
    elif type_util.is_pandas_styler(input_data):
        return DataFormat.PANDAS_STYLER
    elif type_util.is_snowpark_data_object(input_data):
        return DataFormat.SNOWPARK_OBJECT
    elif type_util.is_pyspark_data_object(input_data):
        return DataFormat.PYSPARK_OBJECT
    elif isinstance(input_data, (list, tuple, set)):
        if type_util.is_list_of_scalars(input_data):
            # -> one-dimensional data structure
            if isinstance(input_data, tuple):
                return DataFormat.TUPLE_OF_VALUES
            if isinstance(input_data, set):
                return DataFormat.SET_OF_VALUES
            return DataFormat.LIST_OF_VALUES
        else:
            # -> Multi-dimensional data structure
            # This should always contain at least one element,
            # otherwise the values type from infer_dtype would have been empty
            first_element = next(iter(input_data))
            if isinstance(first_element, dict):
                return DataFormat.LIST_OF_RECORDS
            if isinstance(first_element, (list, tuple, set)):
                return DataFormat.LIST_OF_ROWS
    elif isinstance(input_data, dict):
        if not input_data:
            return DataFormat.KEY_VALUE_DICT
        if len(input_data) > 0:
            first_value = next(iter(input_data.values()))
            if isinstance(first_value, dict):
                return DataFormat.COLUMN_INDEX_MAPPING
            if isinstance(first_value, (list, tuple)):
                return DataFormat.COLUMN_VALUE_MAPPING
            if isinstance(first_value, pd.Series):
                return DataFormat.COLUMN_SERIES_MAPPING
            # In the future, we could potentially also support the tight & split formats here
            if type_util.is_list_of_scalars(input_data.values()):
                # Only use the key-value dict format if the values are only scalar values
                return DataFormat.KEY_VALUE_DICT
    return DataFormat.UNKNOWN


def _convert_df_to_data_format(df: pd.DataFrame, data_format: DataFormat) -> DataTypes:
    """Try to convert a dataframe to the specified data format.

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to convert.

    data_format : DataFormat
        The data format to convert to.

    Returns
    -------
    pd.DataFrame, pd.Index, Styler, pa.Table, np.ndarray, tuple, list, set, dict
        The converted dataframe.
    """
    if data_format in [
        DataFormat.PANDAS_DATAFRAME,
        DataFormat.SNOWPARK_OBJECT,
        DataFormat.PYSPARK_OBJECT,
        DataFormat.PANDAS_INDEX,
        DataFormat.PANDAS_STYLER,
    ]:
        return df
    elif data_format == DataFormat.NUMPY_LIST:
        # It's a 1-dimensional array, so we only return
        # the first column as numpy array
        # Calling to_numpy() on the full DataFrame would result in:
        # [[1], [2]] instead of [1, 2]
        return np.array([]) if df.empty else df.iloc[:, 0].to_numpy()
    elif data_format == DataFormat.NUMPY_MATRIX:
        return df.to_numpy()
    elif data_format == DataFormat.PYARROW_TABLE:
        return pa.Table.from_pandas(df)
    elif data_format == DataFormat.PANDAS_SERIES:
        # Select first column in dataframe and create a new series based on the values
        if len(df.columns) != 1:
            raise ValueError(
                f"DataFrame is expected to have a single column but has {len(df.columns)}."
            )
        return df[df.columns[0]]
    elif data_format == DataFormat.LIST_OF_RECORDS:
        return df.to_dict(orient="records")
    elif data_format == DataFormat.LIST_OF_ROWS:
        # to_numpy converts the dataframe to a list of rows
        return df.to_numpy().tolist()
    elif data_format == DataFormat.COLUMN_INDEX_MAPPING:
        return df.to_dict(orient="dict")
    elif data_format == DataFormat.COLUMN_VALUE_MAPPING:
        return df.to_dict(orient="list")
    elif data_format == DataFormat.COLUMN_SERIES_MAPPING:
        return df.to_dict(orient="series")
    elif data_format in [
        DataFormat.LIST_OF_VALUES,
        DataFormat.TUPLE_OF_VALUES,
        DataFormat.SET_OF_VALUES,
    ]:
        return_list = []
        if len(df.columns) == 1:
            #  Get the first column and convert to list
            return_list = df[df.columns[0]].tolist()
        elif len(df.columns) >= 1:
            raise ValueError(
                f"DataFrame is expected to have a single column but has {len(df.columns)}."
            )
        if data_format == DataFormat.TUPLE_OF_VALUES:
            return tuple(return_list)
        if data_format == DataFormat.SET_OF_VALUES:
            return set(return_list)
        return return_list
    elif data_format == DataFormat.KEY_VALUE_DICT:
        # The key is expected to be the index -> this will return the first column
        # as a dict with index as key.
        return dict() if df.empty else df.iloc[:, 0].to_dict()

    raise ValueError(f"Unsupported input data format: {data_format}")


def _parse_value(value: Union[str, int, float, bool, None], dtype) -> Any:
    """Convert a value to the correct type.

    Parameters
    ----------
    value : str | int | float | bool | None
        The value to convert.

    dtype
        The type of the value.

    Returns
    -------
    The converted value.
    """
    if value is None:
        return None

    # TODO(lukasmasuch): how to deal with date & time columns?

    # Datetime values try to parse the value to datetime:
    # The value is expected to be a ISO 8601 string
    if is_datetime64_any_dtype(dtype):
        return pd.to_datetime(value, errors="ignore")
    elif is_integer_dtype(dtype):
        with contextlib.suppress(ValueError):
            return int(value)
    elif is_float_dtype(dtype):
        with contextlib.suppress(ValueError):
            return float(value)
    return value


def _apply_cell_edits(
    df: pd.DataFrame, edited_cells: Dict[str, str | int | float | bool | None]
) -> None:
    """Apply cell edits to the provided dataframe (inplace).

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to apply the cell edits to.

    edited_cells : Dict[str, str | int | float | bool | None]
        A dictionary of cell edits. The keys are the cell ids in the format
        "row:column" and the values are the new cell values.

    """
    index_count = df.index.nlevels or 0

    for cell, value in edited_cells.items():
        row, col = cell.split(":")
        row, col = int(row), int(col)

        if col < index_count:
            # The edited cell is part of the index
            # To support multi-index in the future: use a tuple of values here
            # instead of a single value
            df.index.values[row] = _parse_value(value, df.index.dtype)
        else:
            # We need to subtract the number of index levels from the column index
            # to get the correct column index for pandas dataframes
            column_idx = col - index_count
            df.iat[row, column_idx] = _parse_value(
                value, df[df.columns[column_idx]].dtype
            )


def _apply_row_additions(df: pd.DataFrame, added_rows: List[Dict[str, Any]]) -> None:
    """Apply row additions to the provided dataframe (inplace).

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to apply the row additions to.

    added_rows : List[Dict[str, Any]]
        A list of row additions. Each row addition is a dictionary with the
        column index as key and the new cell value as value.
    """
    index_count = df.index.nlevels or 0
    for added_row in added_rows:
        index_value = None
        new_row: List[Any] = [None for _ in range(df.shape[1])]
        for col in added_row.keys():
            value = added_row[col]
            col_idx = int(col)
            if col_idx < index_count:
                # To support multi-index in the future: use a tuple of values here
                # instead of a single value
                index_value = _parse_value(value, df.index.dtype)
            else:
                # We need to subtract the number of index levels from the column index
                # to get the correct column index for pandas dataframes
                mapped_column = col_idx - index_count
                new_row[mapped_column] = _parse_value(
                    value, df[df.columns[mapped_column]].dtype
                )
        # Append the new row to the dataframe
        if type(df.index) == pd.RangeIndex:
            df.loc[df.index.stop, :] = new_row
        elif index_value is not None and type(df.index) == pd.Index:
            # TODO(lukasmasuch): we are only adding rows that have a non-None index
            # value to prevent issues in the frontend component. Also, it just overwrites
            # the row in case the index value already exists in the dataframe.
            # In the future, it would be better to require users to provide unique
            # non-None values for the index with some kind of visual indications.
            df.loc[index_value, :] = new_row


def _apply_row_deletions(df: pd.DataFrame, deleted_rows: List[int]) -> None:
    """Apply row deletions to the provided dataframe (inplace).

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to apply the row deletions to.

    deleted_rows : List[int]
        A list of row numbers to delete.
    """
    # Drop rows based in numeric row numbers
    df.drop(df.index[deleted_rows], inplace=True)


def _apply_dataframe_edits(df: pd.DataFrame, data_editor_state: EditingState) -> None:
    """Apply edits to the provided dataframe (inplace).
    This includes cell edits, row additions and row deletions.

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to apply the edits to.

    data_editor_state : EditingState
        The editing state of the data editor component.
    """
    if data_editor_state.get("edited_cells"):
        _apply_cell_edits(df, data_editor_state["edited_cells"])

    if data_editor_state.get("added_rows"):
        _apply_row_additions(df, data_editor_state["added_rows"])

    if data_editor_state.get("deleted_rows"):
        _apply_row_deletions(df, data_editor_state["deleted_rows"])


def _apply_data_specific_configs(
    columns_config: ColumnConfigMapping, data_df: pd.DataFrame, data_format: DataFormat
) -> None:
    """Apply data specific configurations to the provided dataframe.
    This will apply inplace changes to the dataframe and the column configurations
    depending on the data format.

    Parameters
    ----------
    columns_config : ColumnConfigMapping
        A mapping of column names/ids to column configurations.

    data_df : pd.DataFrame
        The dataframe to apply the configurations to.

    data_format : DataFormat
        The format of the data.
    """
    # Deactivate editing for columns that are not compatible with arrow
    for col in data_df.columns:
        if type_util.is_colum_type_arrow_incompatible(data_df[col]):
            if col not in columns_config:
                columns_config[col] = {}
            columns_config[col]["editable"] = False
            # Convert incompatible type to string
            data_df[col] = data_df[col].astype(str)

    # Pandas adds a range index as default to all datastructures
    # but for most of the non-pandas data objects it
    # Therefore, we will hide it as default.
    if data_format in [
        DataFormat.SET_OF_VALUES,
        DataFormat.TUPLE_OF_VALUES,
        DataFormat.LIST_OF_VALUES,
        DataFormat.NUMPY_LIST,
        DataFormat.NUMPY_MATRIX,
        DataFormat.LIST_OF_RECORDS,
        DataFormat.LIST_OF_ROWS,
        DataFormat.COLUMN_VALUE_MAPPING,
    ]:
        if _INDEX_IDENTIFIER not in columns_config:
            columns_config[_INDEX_IDENTIFIER] = {}
        columns_config[_INDEX_IDENTIFIER]["hidden"] = True

    # Rename the first column to "value" for some of the data formats
    if data_format in [
        DataFormat.SET_OF_VALUES,
        DataFormat.TUPLE_OF_VALUES,
        DataFormat.LIST_OF_VALUES,
        DataFormat.NUMPY_LIST,
        DataFormat.KEY_VALUE_DICT,
    ]:
        # Pandas automatically names the first column "0"
        # We rename it to "value" in selected cases to make it more descriptive
        data_df.rename(columns={0: "value"}, inplace=True)


class DataEditorMixin:
    @overload
    def experimental_data_editor(
        self,
        data: EditableData,
        *,
        width: Optional[int] = None,
        height: Optional[int] = None,
        use_container_width: bool = False,
        key: Optional[Key] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        columns: Optional[Union[ColumnConfigMapping, List[ColumnConfig]]] = None,
        num_rows: Literal["fixed", "dynamic"] = "fixed",
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
        key: Optional[Key] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        columns: Optional[Union[ColumnConfigMapping, List[ColumnConfig]]] = None,
        num_rows: Literal["fixed", "dynamic"] = "fixed",
    ) -> pd.DataFrame:
        pass

    # @gather_metrics("_arrow_dataframe")
    def experimental_data_editor(
        self,
        data: DataTypes,
        *,
        width: Optional[int] = None,
        height: Optional[int] = None,
        use_container_width: bool = False,
        key: Optional[Key] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        columns: Optional[Union[ColumnConfigMapping, List[ColumnConfig]]] = None,
        num_rows: Literal["fixed", "dynamic"] = "fixed",
    ) -> DataTypes:
        columns_config: ColumnConfigMapping = (
            {} if columns is None else parse_column_config(columns)
        )

        data_format = _determine_data_format(data)
        if data_format == DataFormat.UNKNOWN:
            raise StreamlitAPIException(
                f"The data type ({type(data).__name__}) or format is not supported by the data editor. "
                "Please convert your data into a Pandas Dataframe or another supported data format."
            )

        # The dataframe should always be a copy of the original data
        # since we will apply edits directly to it.
        data_df = type_util.convert_anything_to_df(data, ensure_copy=True)

        if type(data_df.index) not in [
            pd.RangeIndex,
            pd.Index,
            # TODO: both are deprecated
            # pd.Int64Index,
            # pd.Float64Index,
        ]:
            raise StreamlitAPIException(
                f"The type of the dataframe index - {type(data_df.index).__name__} - is not "
                "yet supported by the data editor."
            )

        _apply_data_specific_configs(columns_config, data_df, data_format)

        delta_path = self.dg._get_delta_path_str()
        default_uuid = str(hash(delta_path))

        proto = ArrowProto()
        proto.use_container_width = use_container_width
        if width:
            proto.width = width
        if height:
            proto.height = height

        proto.editing_mode = (
            ArrowProto.EditingMode.DYNAMIC
            if num_rows == "dynamic"
            else ArrowProto.EditingMode.FIXED
        )
        proto.form_id = current_form_id(self.dg)

        marshall(proto, data_df, default_uuid)
        _marshall_column_config(proto, columns_config)

        serde = DataEditorSerde()

        widget_state = register_widget(
            "data_editor",
            proto,
            user_key=to_key(key),
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=get_script_run_ctx(),
        )

        _apply_dataframe_edits(data_df, widget_state.value)  # type: ignore
        self.dg._enqueue("arrow_data_frame", proto)
        return _convert_df_to_data_format(data_df, data_format)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
