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

"""A bunch of useful utilities for dealing with dataframes."""

from __future__ import annotations

import contextlib
import dataclasses
import inspect
import math
import re
import warnings
from collections import ChainMap, UserDict, UserList, deque
from collections.abc import ItemsView, Iterable, Mapping, Sequence
from enum import Enum, EnumMeta, auto
from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    Protocol,
    TypeAlias,
    TypeGuard,
    TypeVar,
    Union,
    cast,
    runtime_checkable,
)

from streamlit import config, errors, logger, string_util
from streamlit.type_util import (
    CustomDict,
    dump_pydantic_sequence,
    has_callable_attr,
    is_custom_dict,
    is_dataclass_instance,
    is_list_like,
    is_namedtuple,
    is_pydantic_model,
    is_sequence_of_pydantic_models,
    is_type,
    is_version_less_than,
)

if TYPE_CHECKING:
    import numpy as np
    import pyarrow as pa
    from pandas import DataFrame, Index, Series
    from pandas.core.indexing import _iLocIndexer
    from pandas.io.formats.style import Styler

_LOGGER: Final = logger.get_logger(__name__)


# Maximum number of rows to request from an unevaluated (out-of-core) dataframe
_MAX_UNEVALUATED_DF_ROWS = 10000

_PANDAS_DATA_OBJECT_TYPE_RE: Final = re.compile(r"^pandas.*$")

_DASK_DATAFRAME: Final = "dask.dataframe.dask_expr._collection.DataFrame"
_DASK_SERIES: Final = "dask.dataframe.dask_expr._collection.Series"
_DASK_INDEX: Final = "dask.dataframe.dask_expr._collection.Index"
# Dask removed the old legacy types, to support older and newer versions
# we are still supporting the old an new types.
_DASK_DATAFRAME_LEGACY: Final = "dask.dataframe.core.DataFrame"
_DASK_SERIES_LEGACY: Final = "dask.dataframe.core.Series"
_DASK_INDEX_LEGACY: Final = "dask.dataframe.core.Index"
_DUCKDB_RELATION: Final = "_duckdb.DuckDBPyRelation"
_DUCKDB_RELATION_LEGACY: Final = "duckdb.duckdb.DuckDBPyRelation"
_MODIN_DF_TYPE_STR: Final = "modin.pandas.dataframe.DataFrame"
_MODIN_SERIES_TYPE_STR: Final = "modin.pandas.series.Series"
_PANDAS_STYLER_TYPE_STR: Final = "pandas.io.formats.style.Styler"
_POLARS_DATAFRAME: Final = "polars.dataframe.frame.DataFrame"
_POLARS_LAZYFRAME: Final = "polars.lazyframe.frame.LazyFrame"
_POLARS_SERIES: Final = "polars.series.series.Series"
_PYSPARK_DF_TYPE_STR: Final = "pyspark.sql.dataframe.DataFrame"
_PYSPARK_CONNECT_DF_TYPE_STR: Final = "pyspark.sql.connect.dataframe.DataFrame"
_SNOWPANDAS_DF_TYPE_STR: Final = "snowflake.snowpark.modin.pandas.dataframe.DataFrame"
_SNOWPANDAS_INDEX_TYPE_STR: Final = (
    "snowflake.snowpark.modin.plugin.extensions.index.Index"
)
_SNOWPANDAS_SERIES_TYPE_STR: Final = "snowflake.snowpark.modin.pandas.series.Series"
_SNOWPARK_DF_ROW_TYPE_STR: Final = "snowflake.snowpark.row.Row"
_SNOWPARK_DF_TYPE_STR: Final = "snowflake.snowpark.dataframe.DataFrame"
_SNOWPARK_TABLE_TYPE_STR: Final = "snowflake.snowpark.table.Table"
_XARRAY_DATASET_TYPE_STR: Final = "xarray.core.dataset.Dataset"
_XARRAY_DATA_ARRAY_TYPE_STR: Final = "xarray.core.dataarray.DataArray"

V_co = TypeVar(
    "V_co",
    covariant=True,  # https://peps.python.org/pep-0484/#covariance-and-contravariance
)


@runtime_checkable
class DBAPICursor(Protocol):
    """Protocol for DBAPI 2.0 Cursor objects (PEP 249).

    This is a simplified version of the DBAPI Cursor protocol
    that only contains the methods that are relevant or used for
    our DB API Integration.

    Specification: https://peps.python.org/pep-0249/
    Inspired by: https://github.com/python/typeshed/blob/main/stdlib/_typeshed/dbapi.pyi
    """

    @property
    def description(
        self,
    ) -> (
        Sequence[
            tuple[
                str,
                Any | None,
                int | None,
                int | None,
                int | None,
                int | None,
                bool | None,
            ]
        ]
        | None
    ): ...
    def fetchmany(self, size: int = ..., /) -> Sequence[Sequence[Any]]: ...
    def fetchall(self) -> Sequence[Sequence[Any]]: ...


class DataFrameGenericAlias(Protocol[V_co]):
    """Technically not a GenericAlias, but serves the same purpose in
    OptionSequence below, in that it is a type which admits DataFrame,
    but is generic. This allows OptionSequence to be a fully generic type,
    significantly increasing its usefulness.

    We can't use types.GenericAlias, as it is only available from python>=3.9,
    and isn't easily back-ported.
    """

    @property
    def iloc(self) -> _iLocIndexer: ...


class PandasCompatible(Protocol):
    """Protocol for Pandas compatible objects that have a `to_pandas` method."""

    def to_pandas(self) -> DataFrame | Series[Any]: ...


class DataframeInterchangeCompatible(Protocol):
    """Protocol for objects support the dataframe-interchange protocol.

    https://data-apis.org/dataframe-protocol/latest/index.html
    """

    def __dataframe__(self, allow_copy: bool) -> Any: ...


class ArrowStreamExportable(Protocol):
    """Protocol for objects implementing the Arrow PyCapsule Interface.

    Objects implementing this protocol can export their data as an Arrow stream
    via the C Data Interface using PyCapsules. This is the recommended way for
    cross-library Arrow data exchange, replacing the deprecated DataFrame
    Interchange Protocol.

    https://arrow.apache.org/docs/format/CDataInterface/PyCapsuleInterface.html
    """

    def __arrow_c_stream__(self, requested_schema: Any = None) -> Any: ...


OptionSequence: TypeAlias = (
    Iterable[V_co]
    | DataFrameGenericAlias[V_co]
    | PandasCompatible
    | DataframeInterchangeCompatible
    | ArrowStreamExportable
)

# Various data types supported by our dataframe processing
# used for commands like `st.dataframe`, `st.table`, `st.map`,
# st.line_chart`...
Data: TypeAlias = Union[
    "DataFrame",
    "Series[Any]",
    "Styler",
    "Index[Any]",
    "pa.Table",
    "pa.Array",
    "np.ndarray[Any, np.dtype[Any]]",
    Iterable[Any],
    "Mapping[Any, Any]",
    DBAPICursor,
    PandasCompatible,
    DataframeInterchangeCompatible,
    ArrowStreamExportable,
    CustomDict,
    None,
]


class DataFormat(Enum):
    """DataFormat is used to determine the format of the data."""

    UNKNOWN = auto()
    EMPTY = auto()  # None

    COLUMN_INDEX_MAPPING = auto()  # {column: {index: value}}
    COLUMN_SERIES_MAPPING = auto()  # {column: Series(values)}
    COLUMN_VALUE_MAPPING = auto()  # {column: List[values]}
    DASK_OBJECT = auto()  # dask.dataframe.core.DataFrame, Series, Index
    DBAPI_CURSOR = auto()  # DBAPI Cursor (PEP 249)
    DUCKDB_RELATION = auto()  # DuckDB Relation
    KEY_VALUE_DICT = auto()  # {index: value}
    LIST_OF_RECORDS = auto()  # List[Dict[str, Scalar]]
    LIST_OF_ROWS = auto()  # List[List[Scalar]]
    LIST_OF_VALUES = auto()  # List[Scalar]
    MODIN_OBJECT = auto()  # Modin DataFrame, Series
    NUMPY_LIST = auto()  # np.array[Scalar]
    NUMPY_MATRIX = auto()  # np.array[List[Scalar]]
    PANDAS_ARRAY = auto()  # pd.array
    PANDAS_DATAFRAME = auto()  # pd.DataFrame
    PANDAS_INDEX = auto()  # pd.Index
    PANDAS_SERIES = auto()  # pd.Series
    PANDAS_STYLER = auto()  # pandas Styler
    POLARS_DATAFRAME = auto()  # polars.dataframe.frame.DataFrame
    POLARS_LAZYFRAME = auto()  # polars.lazyframe.frame.LazyFrame
    POLARS_SERIES = auto()  # polars.series.series.Series
    PYARROW_ARRAY = auto()  # pyarrow.Array
    PYARROW_TABLE = auto()  # pyarrow.Table
    PYSPARK_OBJECT = auto()  # pyspark.DataFrame
    SET_OF_VALUES = auto()  # Set[Scalar]
    SNOWPANDAS_OBJECT = auto()  # Snowpandas DataFrame, Series
    SNOWPARK_OBJECT = auto()  # Snowpark DataFrame, Table, List[Row]
    TUPLE_OF_VALUES = auto()  # Tuple[Scalar]
    XARRAY_DATASET = auto()  # xarray.Dataset
    XARRAY_DATA_ARRAY = auto()  # xarray.DataArray


def is_pyarrow_version_less_than(v: str) -> bool:
    """Return True if the current Pyarrow version is less than the input version.

    Parameters
    ----------
    v : str
        Version string, e.g. "0.25.0"

    Returns
    -------
    bool


    Raises
    ------
    InvalidVersion
        If the version strings are not valid.

    """
    import pyarrow as pa

    return is_version_less_than(pa.__version__, v)


# Minimum PyArrow version that supports consuming PyCapsule Interface via from_stream.
# While the PyCapsule Interface dunder methods (__arrow_c_stream__, etc.) were added in
# PyArrow 14.0.0, RecordBatchReader.from_stream() was introduced in PyArrow 15.0.0.
# https://arrow.apache.org/docs/format/CDataInterface/PyCapsuleInterface.html
_MIN_PYARROW_PYCAPSULE_VERSION: Final = "15.0.0"


def _is_arrow_pycapsule_supported() -> bool:
    """Return True if PyArrow supports the Arrow PyCapsule Interface."""
    return not is_pyarrow_version_less_than(_MIN_PYARROW_PYCAPSULE_VERSION)


def is_pandas_version_less_than(v: str) -> bool:
    """Return True if the current Pandas version is less than the input version.

    Parameters
    ----------
    v : str
        Version string, e.g. "0.25.0"

    Returns
    -------
    bool


    Raises
    ------
    InvalidVersion
        If the version strings are not valid.
    """
    import pandas as pd

    return is_version_less_than(pd.__version__, v)


def is_dataframe_like(obj: object) -> bool:
    """True if the object is a dataframe-like object.

    This does not include basic collection types like list, dict, tuple, etc.
    """

    # We exclude list and dict here since there are some cases where a list or dict is
    # considered a dataframe-like object.
    if obj is None or isinstance(obj, (tuple, set, str, bytes, int, float, bool)):
        # Basic types are not considered dataframe-like, so we can
        # return False early to avoid unnecessary checks.
        return False

    return determine_data_format(obj) in {
        DataFormat.COLUMN_SERIES_MAPPING,
        DataFormat.DASK_OBJECT,
        DataFormat.DBAPI_CURSOR,
        DataFormat.MODIN_OBJECT,
        DataFormat.NUMPY_LIST,
        DataFormat.NUMPY_MATRIX,
        DataFormat.PANDAS_ARRAY,
        DataFormat.PANDAS_DATAFRAME,
        DataFormat.PANDAS_INDEX,
        DataFormat.PANDAS_SERIES,
        DataFormat.PANDAS_STYLER,
        DataFormat.POLARS_DATAFRAME,
        DataFormat.POLARS_LAZYFRAME,
        DataFormat.POLARS_SERIES,
        DataFormat.PYARROW_ARRAY,
        DataFormat.PYARROW_TABLE,
        DataFormat.PYSPARK_OBJECT,
        DataFormat.SNOWPANDAS_OBJECT,
        DataFormat.SNOWPARK_OBJECT,
        DataFormat.XARRAY_DATASET,
        DataFormat.XARRAY_DATA_ARRAY,
    }


def is_unevaluated_data_object(obj: object) -> bool:
    """True if the object is one of the supported unevaluated data objects.

    Currently supported objects are:
    - Snowpark DataFrame / Table
    - PySpark DataFrame
    - Modin DataFrame / Series
    - Snowpandas DataFrame / Series / Index
    - Dask DataFrame / Series / Index
    - Polars LazyFrame
    - Generator functions
    - DB API 2.0 Cursor (PEP 249)
    - DuckDB Relation (Relational API)

    Unevaluated means that the data is not yet in the local memory.
    Unevaluated data objects are treated differently from other data objects by only
    requesting a subset of the data instead of loading all data into th memory
    """
    return (
        is_snowpark_data_object(obj)
        or is_pyspark_data_object(obj)
        or is_snowpandas_data_object(obj)
        or is_modin_data_object(obj)
        or is_polars_lazyframe(obj)
        or is_dask_object(obj)
        or is_duckdb_relation(obj)
        or is_dbapi_cursor(obj)
        or inspect.isgeneratorfunction(obj)
    )


def is_pandas_data_object(obj: object) -> bool:
    """True if obj is a Pandas object (e.g. DataFrame, Series, Index, Styler, ...)."""
    return is_type(obj, _PANDAS_DATA_OBJECT_TYPE_RE)


def is_snowpark_data_object(obj: object) -> bool:
    """True if obj is a Snowpark DataFrame or Table."""
    return is_type(obj, _SNOWPARK_TABLE_TYPE_STR) or is_type(obj, _SNOWPARK_DF_TYPE_STR)


def is_snowpark_row_list(obj: object) -> bool:
    """True if obj is a list of snowflake.snowpark.row.Row."""
    return (
        isinstance(obj, list)
        and len(obj) > 0
        and is_type(obj[0], _SNOWPARK_DF_ROW_TYPE_STR)
        and has_callable_attr(obj[0], "as_dict")
    )


def is_pyspark_data_object(obj: object) -> bool:
    """True if obj is a PySpark or PySpark Connect dataframe."""
    return (
        is_type(obj, _PYSPARK_DF_TYPE_STR) or is_type(obj, _PYSPARK_CONNECT_DF_TYPE_STR)
    ) and has_callable_attr(obj, "toPandas")


def is_dask_object(obj: object) -> bool:
    """True if obj is a Dask DataFrame, Series, or Index."""
    return (
        is_type(obj, _DASK_DATAFRAME)
        or is_type(obj, _DASK_DATAFRAME_LEGACY)
        or is_type(obj, _DASK_SERIES)
        or is_type(obj, _DASK_SERIES_LEGACY)
        or is_type(obj, _DASK_INDEX)
        or is_type(obj, _DASK_INDEX_LEGACY)
    )


def is_modin_data_object(obj: object) -> bool:
    """True if obj is of Modin Dataframe or Series."""
    return is_type(obj, _MODIN_DF_TYPE_STR) or is_type(obj, _MODIN_SERIES_TYPE_STR)


def is_snowpandas_data_object(obj: object) -> bool:
    """True if obj is a Snowpark Pandas DataFrame or Series."""
    return (
        is_type(obj, _SNOWPANDAS_DF_TYPE_STR)
        or is_type(obj, _SNOWPANDAS_SERIES_TYPE_STR)
        or is_type(obj, _SNOWPANDAS_INDEX_TYPE_STR)
    )


def is_polars_dataframe(obj: object) -> bool:
    """True if obj is a Polars Dataframe."""
    return is_type(obj, _POLARS_DATAFRAME)


def is_xarray_dataset(obj: object) -> bool:
    """True if obj is a Xarray Dataset."""
    return is_type(obj, _XARRAY_DATASET_TYPE_STR)


def is_xarray_data_array(obj: object) -> bool:
    """True if obj is a Xarray DataArray."""
    return is_type(obj, _XARRAY_DATA_ARRAY_TYPE_STR)


def is_polars_series(obj: object) -> bool:
    """True if obj is a Polars Series."""
    return is_type(obj, _POLARS_SERIES)


def is_polars_lazyframe(obj: object) -> bool:
    """True if obj is a Polars Lazyframe."""
    return is_type(obj, _POLARS_LAZYFRAME)


def is_pandas_styler(obj: object) -> TypeGuard[Styler]:
    """True if obj is a pandas Styler."""
    return is_type(obj, _PANDAS_STYLER_TYPE_STR)


def is_dbapi_cursor(obj: object) -> TypeGuard[DBAPICursor]:
    """True if obj looks like a DB API 2.0 Cursor.

    https://peps.python.org/pep-0249/
    """
    return isinstance(obj, DBAPICursor)


def is_duckdb_relation(obj: object) -> bool:
    """True if obj is a DuckDB relation.

    https://duckdb.org/docs/api/python/relational_api
    """

    return is_type(obj, _DUCKDB_RELATION) or is_type(obj, _DUCKDB_RELATION_LEGACY)


def _is_list_of_scalars(data: Iterable[Any]) -> bool:
    """Check if the list only contains scalar values."""
    from pandas.api.types import infer_dtype

    # Overview on all value that are interpreted as scalar:
    # https://pandas.pydata.org/docs/reference/api/pandas.api.types.is_scalar.html
    return infer_dtype(data, skipna=True) not in {"mixed", "unknown-array"}


def _iterable_to_list(
    iterable: Iterable[Any], max_iterations: int | None = None
) -> list[Any]:
    """Convert an iterable to a list.

    Parameters
    ----------
    iterable : Iterable
        The iterable to convert to a list.

    max_iterations : int or None
        The maximum number of iterations to perform. If None, all iterations are performed.

    Returns
    -------
    list
        The converted list.
    """
    if max_iterations is None:
        return list(iterable)

    result = []
    for i, item in enumerate(iterable):
        if i >= max_iterations:
            break
        result.append(item)
    return result


def _fix_column_naming(data_df: DataFrame) -> DataFrame:
    """Rename the first column to "value" if it is not named
    and if there is only one column in the dataframe.

    The default name of the first column is 0 if it is not named
    which is not very descriptive.
    """

    if len(data_df.columns) == 1 and cast("Any", data_df.columns[0]) == 0:
        # Pandas automatically names the first column with 0 if it is not named.
        # We rename it to "value" to make it more descriptive if there is only
        # one column in the dataframe.
        data_df = data_df.rename(columns={0: "value"})
    return data_df


def _dict_to_pandas_df(data: dict[Any, Any]) -> DataFrame:
    """Convert a key-value dict to a Pandas DataFrame.

    Parameters
    ----------
    data : dict
        The dict to convert to a Pandas DataFrame.

    Returns
    -------
    pandas.DataFrame
        The converted Pandas DataFrame.
    """
    import pandas as pd

    return _fix_column_naming(pd.DataFrame.from_dict(data, orient="index"))


def has_range_index(df: DataFrame) -> bool:
    """True if the dataframe has a range index."""
    from pandas import RangeIndex

    return isinstance(df.index, RangeIndex)


def convert_anything_to_pandas_df(
    data: Any,
    max_unevaluated_rows: int = _MAX_UNEVALUATED_DF_ROWS,
    ensure_copy: bool = False,
) -> DataFrame:
    """Try to convert different formats to a Pandas Dataframe.

    Parameters
    ----------
    data : dataframe-, array-, or collections-like object
        The data to convert to a Pandas DataFrame.

    max_unevaluated_rows: int
        If unevaluated data is detected this func will evaluate it,
        taking max_unevaluated_rows, defaults to 10k.

    ensure_copy: bool
        If True, make sure to always return a copy of the data. If False, it depends on
        the type of the data. For example, a Pandas DataFrame will be returned as-is.

    Returns
    -------
    pandas.DataFrame

    """
    import array

    import numpy as np
    import pandas as pd

    if isinstance(data, pd.DataFrame):
        return data.copy() if ensure_copy else data

    if isinstance(data, (pd.Series, pd.Index, pd.api.extensions.ExtensionArray)):
        return pd.DataFrame(data)

    if is_pandas_styler(data):
        return cast("pd.DataFrame", data.data.copy() if ensure_copy else data.data)  # type: ignore

    if isinstance(data, np.ndarray):
        return (
            pd.DataFrame([])
            if len(data.shape) == 0
            else _fix_column_naming(pd.DataFrame(data))
        )

    if is_polars_dataframe(data):
        data = data.clone() if ensure_copy else data
        return cast("pd.DataFrame", data.to_pandas())

    if is_polars_series(data):
        data = data.clone() if ensure_copy else data
        return cast("pd.DataFrame", data.to_pandas().to_frame())

    if is_polars_lazyframe(data):
        data = data.limit(max_unevaluated_rows).collect().to_pandas()
        if data.shape[0] == max_unevaluated_rows:
            _show_data_information(
                f"⚠️ Showing only {string_util.simplify_number(max_unevaluated_rows)} "
                "rows. Call `collect()` on the dataframe to show more."
            )
        return cast("pd.DataFrame", data)

    if is_xarray_dataset(data):
        if ensure_copy:
            data = data.copy(deep=True)
        return cast("pd.DataFrame", data.to_dataframe())

    if is_xarray_data_array(data):
        if ensure_copy:
            data = data.copy(deep=True)
        return cast("pd.DataFrame", data.to_series().to_frame())

    if is_dask_object(data):
        data = data.head(max_unevaluated_rows, compute=True)

        # Dask returns a Pandas object (DataFrame, Series, Index) when
        # executing operations like `head`.
        if isinstance(data, (pd.Series, pd.Index)):
            data = data.to_frame()

        if data.shape[0] == max_unevaluated_rows:
            _show_data_information(
                f"⚠️ Showing only {string_util.simplify_number(max_unevaluated_rows)} "
                "rows. Call `compute()` on the data object to show more."
            )
        return cast("pd.DataFrame", data)

    if is_modin_data_object(data):
        data = data.head(max_unevaluated_rows)._to_pandas()

        if isinstance(data, (pd.Series, pd.Index)):
            data = data.to_frame()

        if data.shape[0] == max_unevaluated_rows:
            _show_data_information(
                f"⚠️ Showing only {string_util.simplify_number(max_unevaluated_rows)} "
                "rows. Call `_to_pandas()` on the data object to show more."
            )
        return cast("pd.DataFrame", data)

    if is_pyspark_data_object(data):
        data = data.limit(max_unevaluated_rows).toPandas()
        if data.shape[0] == max_unevaluated_rows:
            _show_data_information(
                f"⚠️ Showing only {string_util.simplify_number(max_unevaluated_rows)} "
                "rows. Call `toPandas()` on the data object to show more."
            )
        return cast("pd.DataFrame", data)

    if is_snowpandas_data_object(data):
        data = data[:max_unevaluated_rows].to_pandas()

        if isinstance(data, (pd.Series, pd.Index)):
            data = data.to_frame()

        if data.shape[0] == max_unevaluated_rows:
            _show_data_information(
                f"⚠️ Showing only {string_util.simplify_number(max_unevaluated_rows)} "
                "rows. Call `to_pandas()` on the data object to show more."
            )
        return cast("pd.DataFrame", data)

    if is_snowpark_data_object(data):
        data = data.limit(max_unevaluated_rows).to_pandas()
        if data.shape[0] == max_unevaluated_rows:
            _show_data_information(
                f"⚠️ Showing only {string_util.simplify_number(max_unevaluated_rows)} "
                "rows. Call `to_pandas()` on the data object to show more."
            )
        return cast("pd.DataFrame", data)

    if is_duckdb_relation(data):
        data = data.limit(max_unevaluated_rows).df()
        if data.shape[0] == max_unevaluated_rows:
            _show_data_information(
                f"⚠️ Showing only {string_util.simplify_number(max_unevaluated_rows)} "
                "rows. Call `df()` on the relation to show more."
            )
        return cast("pd.DataFrame", data)

    if is_dbapi_cursor(data):
        # Based on the specification, the first item in the description is the
        # column name (if available)
        columns = (
            [d[0] if d else "" for d in data.description] if data.description else None
        )
        data = pd.DataFrame(data.fetchmany(max_unevaluated_rows), columns=columns)
        if data.shape[0] == max_unevaluated_rows:
            _show_data_information(
                f"⚠️ Showing only {string_util.simplify_number(max_unevaluated_rows)} "
                "rows. Call `fetchall()` on the Cursor to show more."
            )
        return cast("DataFrame", data)  # ty: ignore[redundant-cast]

    if is_snowpark_row_list(data):
        return pd.DataFrame([row.as_dict() for row in data])

    if is_sequence_of_pydantic_models(data):
        # Try to convert pydantic models to DataFrame. If some elements are not
        # pydantic models (mixed sequence), fall through to pandas' native handling.
        try:
            return pd.DataFrame(dump_pydantic_sequence(data))
        except AttributeError:
            pass

    if has_callable_attr(data, "to_pandas"):
        return pd.DataFrame(data.to_pandas())

    # Check for Arrow PyCapsule Interface (__arrow_c_stream__). Preferred over
    # the deprecated DataFrame Interchange Protocol for cross-library data exchange.
    # https://arrow.apache.org/docs/format/CDataInterface/PyCapsuleInterface.html
    if (
        has_callable_attr(data, "__arrow_c_stream__")
        and _is_arrow_pycapsule_supported()
    ):
        import pyarrow as pa

        try:
            table = pa.RecordBatchReader.from_stream(data).read_all()
            data_df = cast("pd.DataFrame", table.to_pandas())
            return data_df.copy() if ensure_copy else data_df
        except (pa.ArrowInvalid, pa.ArrowTypeError, pa.ArrowNotImplementedError):
            # Object exports a non-struct type (e.g., pandas Series) or has a
            # partial __arrow_c_stream__ implementation. Fall back to other methods.
            pass

    # Check for dataframe interchange protocol (deprecated, prefer PyCapsule above)
    # Only available in pandas >= 1.5.0
    # https://pandas.pydata.org/docs/whatsnew/v1.5.0.html#dataframe-interchange-protocol-implementation
    if (
        has_callable_attr(data, "__dataframe__")
        and is_pandas_version_less_than("1.5.0") is False
    ):
        # Suppress the Pandas4Warning about deprecated interchange protocol
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", "The Dataframe Interchange Protocol")
            data_df = pd.api.interchange.from_dataframe(data)
        return data_df.copy() if ensure_copy else data_df

    # Support for generator functions
    if inspect.isgeneratorfunction(data):
        data = _fix_column_naming(
            pd.DataFrame(_iterable_to_list(data(), max_iterations=max_unevaluated_rows))
        )

        if data.shape[0] == max_unevaluated_rows:
            _show_data_information(
                f"⚠️ Showing only {string_util.simplify_number(max_unevaluated_rows)} "
                "rows. Convert the data to a list to show more."
            )
        return cast("DataFrame", data)  # ty: ignore[redundant-cast]

    if isinstance(data, EnumMeta):
        # Support for enum classes
        return _fix_column_naming(pd.DataFrame([c.value for c in data]))  # type: ignore

    # Support for some list like objects
    if isinstance(data, (deque, map, array.ArrayType, UserList)):
        return _fix_column_naming(pd.DataFrame(list(data)))

    # Support for Streamlit's custom dict-like objects
    if is_custom_dict(data):
        return _dict_to_pandas_df(data.to_dict())

    # Support for named tuples
    if is_namedtuple(data):
        return _dict_to_pandas_df(data._asdict())

    # Support for dataclass instances
    if is_dataclass_instance(data):
        return _dict_to_pandas_df(dataclasses.asdict(data))

    # Support for dict-like objects
    if isinstance(data, (ChainMap, MappingProxyType, UserDict)) or is_pydantic_model(
        data
    ):
        return _dict_to_pandas_df(dict(data))

    # Try to convert to pandas.DataFrame. This will raise an error is df is not
    # compatible with the pandas.DataFrame constructor.
    try:
        return _fix_column_naming(pd.DataFrame(data))
    except ValueError as ex:
        if isinstance(data, dict):
            with contextlib.suppress(ValueError):
                # Try to use index orient as back-up to support key-value dicts
                return _dict_to_pandas_df(data)
        raise errors.StreamlitAPIException(
            f"""
Unable to convert object of type `{type(data)}` to `pandas.DataFrame`.
Offending object:
```py
{data}
```"""
        ) from ex


def _downcast_large_type(arrow_type: pa.DataType) -> pa.DataType:
    """Recursively downcast a single Arrow type to its standard counterpart.

    Handles ``large_string`` -> ``string``, ``large_binary`` -> ``binary``,
    and ``large_list`` -> ``list`` (with recursive value-type downcasting).
    Returns the type unchanged if no downcasting is needed.
    """
    import pyarrow as pa

    large_type_map: dict[pa.DataType, pa.DataType] = {
        pa.large_string(): pa.string(),
        pa.large_binary(): pa.binary(),
    }

    if isinstance(arrow_type, pa.LargeListType):
        return pa.list_(_downcast_large_type(arrow_type.value_type))
    if arrow_type in large_type_map:
        return large_type_map[arrow_type]
    return arrow_type


def _downcast_large_arrow_types(table: pa.Table) -> pa.Table:
    """Downcast large Arrow types to their standard counterparts.

    Pandas 3.x defaults to StringDtype backed by ``large_string`` in Arrow.
    Third-party custom components that bundle older Arrow JS libraries cannot
    decode ``LargeUtf8`` / ``LargeBinary`` / ``LargeList`` type codes, so we
    convert them to the standard-width variants before serializing.
    """
    import pyarrow as pa

    new_fields: list[pa.Field] = []
    needs_cast = False
    for field in table.schema:
        downcast = _downcast_large_type(field.type)
        if downcast != field.type:
            new_fields.append(field.with_type(downcast))
            needs_cast = True
        else:
            new_fields.append(field)

    if not needs_cast:
        return table

    return table.cast(pa.schema(new_fields, metadata=table.schema.metadata))


def _has_large_list_type(schema: pa.Schema) -> bool:
    """Check if schema contains any large_list types (including nested)."""
    import pyarrow as pa

    def _check_type(arrow_type: pa.DataType) -> bool:
        if isinstance(arrow_type, pa.LargeListType):
            return True
        if hasattr(arrow_type, "value_type"):
            return _check_type(arrow_type.value_type)
        return False

    return any(_check_type(f.type) for f in schema)


def _downcast_large_list_schema(schema: pa.Schema) -> pa.Schema:
    """Build a new schema with large_list types downcast to list.

    Preserves field metadata and schema metadata.
    """
    import pyarrow as pa

    def _downcast_type(arrow_type: pa.DataType) -> pa.DataType:
        if isinstance(arrow_type, pa.LargeListType):
            return pa.list_(_downcast_type(arrow_type.value_type))
        return arrow_type

    new_fields = [f.with_type(_downcast_type(f.type)) for f in schema]
    return pa.schema(new_fields, metadata=schema.metadata)


def convert_arrow_table_to_arrow_bytes(table: pa.Table) -> bytes:
    """Serialize pyarrow.Table to Arrow IPC bytes.

    Parameters
    ----------
    table : pyarrow.Table
        A table to convert.

    Returns
    -------
    bytes
        The serialized Arrow IPC bytes.
    """
    try:
        table = _maybe_truncate_table(table)
    except RecursionError as err:  # pragma: no cover - defensive
        # This is a very unlikely edge case, but we want to make sure that
        # it doesn't lead to unexpected behavior.
        # If there is a recursion error, we just return the table as-is
        # which will lead to the normal message limit exceed error.
        _LOGGER.warning(
            "Recursion error while truncating Arrow table. This is not "
            "supposed to happen.",
            exc_info=err,
        )

    import pyarrow as pa

    # Downcast large_list -> list if needed (Arrow JS doesn't support large_list)
    if _has_large_list_type(table.schema):
        table = table.cast(_downcast_large_list_schema(table.schema))

    # Convert table to bytes
    sink = pa.BufferOutputStream()
    writer = pa.RecordBatchStreamWriter(sink, table.schema)
    writer.write_table(table)
    writer.close()
    return cast("bytes", sink.getvalue().to_pybytes())


def convert_pandas_df_to_arrow_bytes(
    df: DataFrame,
    *,
    downcast_large_types: bool = False,
) -> bytes:
    """Serialize pandas.DataFrame to Arrow IPC bytes.

    Parameters
    ----------
    df : pandas.DataFrame
        A dataframe to convert.

    downcast_large_types : bool
        If ``True``, downcast ``large_string``, ``large_binary``, and
        ``large_list`` Arrow types to their standard-width counterparts
        before serializing. This is needed for consumers that bundle older
        Arrow libraries which cannot decode the large type codes
        (e.g. custom components v1).

    Returns
    -------
    bytes
        The serialized Arrow IPC bytes.
    """
    import pyarrow as pa

    try:
        table = pa.Table.from_pandas(df)
    except (pa.ArrowTypeError, pa.ArrowInvalid, pa.ArrowNotImplementedError) as ex:
        _LOGGER.info(
            "Serialization of dataframe to Arrow table was unsuccessful. "
            "Applying automatic fixes for column types to make the dataframe "
            "Arrow-compatible.",
            exc_info=ex,
        )
        df = fix_arrow_incompatible_column_types(df)
        table = pa.Table.from_pandas(df)

    if downcast_large_types:
        table = _downcast_large_arrow_types(table)

    return convert_arrow_table_to_arrow_bytes(table)


def convert_arrow_bytes_to_pandas_df(source: bytes) -> DataFrame:
    """Convert Arrow bytes (IPC format) to pandas.DataFrame.

    Using this function in production needs to make sure that
    the pyarrow version >= 14.0.1, because of a critical
    security vulnerability in pyarrow < 14.0.1.

    Parameters
    ----------
    source : bytes
        A bytes object to convert.

    Returns
    -------
    pandas.DataFrame
        The converted dataframe.
    """
    import pyarrow as pa

    reader = pa.RecordBatchStreamReader(source)
    return cast("DataFrame", reader.read_pandas())


def _show_data_information(msg: str) -> None:
    """Show a message to the user with important information
    about the processed dataset.
    """
    from streamlit.delta_generator_singletons import get_dg_singleton_instance

    get_dg_singleton_instance().main_dg.caption(msg)


def _convert_polars_to_arrow_bytes(data: Any) -> bytes:
    """Convert Polars DataFrame to Arrow IPC bytes via to_arrow().

    This bypasses Pandas conversion for ~100-400x faster performance.
    """
    table = data.to_arrow()
    return convert_arrow_table_to_arrow_bytes(table)


def convert_anything_to_arrow_bytes(
    data: Any,
    max_unevaluated_rows: int = _MAX_UNEVALUATED_DF_ROWS,
) -> bytes:
    """Try to convert different formats to Arrow IPC format (bytes).

    This method tries to directly convert the input data to Arrow bytes
    for some supported formats, but falls back to conversion to a Pandas
    DataFrame and then to Arrow bytes.

    Parameters
    ----------
    data : dataframe-, array-, or collections-like object
        The data to convert to Arrow bytes.

    max_unevaluated_rows: int
        If unevaluated data is detected this func will evaluate it,
        taking max_unevaluated_rows, defaults to 10k.

    Returns
    -------
    bytes
        The serialized Arrow IPC bytes.
    """

    import pyarrow as pa

    if isinstance(data, pa.Table):
        return convert_arrow_table_to_arrow_bytes(data)

    # Fast path: Polars DataFrame - use direct Arrow conversion
    if is_polars_dataframe(data):
        try:
            return _convert_polars_to_arrow_bytes(data)
        except Exception:
            _LOGGER.debug(
                "Direct Polars→Arrow IPC failed, falling back to Pandas path",
                exc_info=True,
            )
            # Fall through to Pandas conversion

    # Fast path: Polars Series - convert to single-column DataFrame first
    if is_polars_series(data):
        try:
            return _convert_polars_to_arrow_bytes(data.to_frame())
        except Exception:
            _LOGGER.debug(
                "Direct Polars Series→Arrow IPC failed, falling back to Pandas path",
                exc_info=True,
            )
            # Fall through to Pandas conversion

    # Fast path: Polars LazyFrame - must collect first with row limit
    if is_polars_lazyframe(data):
        # Collect one extra row to detect truncation accurately
        collected = data.limit(max_unevaluated_rows + 1).collect()
        truncated = collected.height > max_unevaluated_rows
        if truncated:
            collected = collected.head(max_unevaluated_rows)
            _show_data_information(
                f"⚠️ Showing only {string_util.simplify_number(max_unevaluated_rows)} "
                "rows. Call `collect()` on the dataframe to show more."
            )
        try:
            return _convert_polars_to_arrow_bytes(collected)
        except Exception:
            _LOGGER.debug(
                "Direct Polars LazyFrame→Arrow IPC failed, falling back to Pandas path",
                exc_info=True,
            )
            # Fall through to Pandas conversion

    # Fallback: try to convert to pandas DataFrame
    # and then to Arrow bytes.
    df = convert_anything_to_pandas_df(data, max_unevaluated_rows)
    return convert_pandas_df_to_arrow_bytes(df)


def convert_anything_to_list(obj: OptionSequence[V_co]) -> list[V_co]:
    """Try to convert different formats to a list.

    If the input is a dataframe-like object, we just select the first
    column to iterate over. Non sequence-like objects and scalar types,
    will just be wrapped into a list.

    Parameters
    ----------
    obj : dataframe-, array-, or collections-like object
        The object to convert to a list.

    Returns
    -------
    list
        The converted list.
    """
    if obj is None:
        return []  # type: ignore

    if isinstance(obj, (str, int, float, bool)):
        # Wrap basic objects into a list
        return [obj]  # type: ignore[list-item] # ty: ignore[invalid-return-type]

    if isinstance(obj, EnumMeta):
        # Support for enum classes. For string enums, we return the string value
        # of the enum members. For other enums, we just return the enum member.
        return [member.value if isinstance(member, str) else member for member in obj]  # type: ignore

    if isinstance(obj, Mapping):
        return cast("list[V_co]", list(obj.keys()))

    if is_list_like(obj) and not is_snowpark_row_list(obj):
        # This also ensures that the sequence is copied to prevent
        # potential mutations to the original object.
        return list(cast("Iterable[V_co]", obj))

    # Fallback to our DataFrame conversion logic:
    try:
        # We use ensure_copy here because the return value of this function is
        # saved in a widget serde class instance to be used in later script runs,
        # and we don't want mutations to the options object passed to a
        # widget affect the widget.
        # (See https://github.com/streamlit/streamlit/issues/7534)
        data_df = convert_anything_to_pandas_df(obj, ensure_copy=True)
        # Return first column as a list:
        return (
            []
            if data_df.empty
            else cast("list[V_co]", list(data_df.iloc[:, 0].to_list()))
        )
    except errors.StreamlitAPIException:  # pragma: no cover - defensive
        # Defensive fallback: wrap the object into a list if conversion fails
        return [obj]  # type: ignore


def _maybe_truncate_table(
    table: pa.Table, truncated_rows: int | None = None
) -> pa.Table:
    """Experimental feature to automatically truncate tables that
    are larger than the maximum allowed message size. It needs to be enabled
    via the server.enableArrowTruncation config option.

    Parameters
    ----------
    table : pyarrow.Table
        A table to truncate.

    truncated_rows : int or None
        The number of rows that have been truncated so far. This is used by
        the recursion logic to keep track of the total number of truncated
        rows.

    """

    if config.get_option("server.enableArrowTruncation"):
        # This is an optimization problem: We don't know at what row
        # the perfect cut-off is to comply with the max size. But we want to figure
        # it out in as few iterations as possible. We almost always will cut out
        # more than required to keep the iterations low.

        # The maximum size allowed for protobuf messages in bytes:
        max_message_size = int(config.get_option("server.maxMessageSize") * 1e6)
        # We add 1 MB for other overhead related to the protobuf message.
        # This is a very conservative estimate, but it should be good enough.
        table_size = int(table.nbytes + 1 * 1e6)
        table_rows = table.num_rows

        if table_rows > 1 and table_size > max_message_size:
            # targeted rows == the number of rows the table should be truncated to.
            # Calculate an approximation of how many rows we need to truncate to.
            targeted_rows = math.ceil(table_rows * (max_message_size / table_size))
            # Make sure to cut out at least a couple of rows to avoid running
            # this logic too often since it is quite inefficient and could lead
            # to infinity recursions without these precautions.
            targeted_rows = math.floor(
                max(
                    min(
                        # Cut out:
                        # an additional 5% of the estimated num rows to cut out:
                        targeted_rows - math.floor((table_rows - targeted_rows) * 0.05),
                        # at least 1% of table size:
                        table_rows - (table_rows * 0.01),
                        # at least 5 rows:
                        table_rows - 5,
                    ),
                    1,  # but it should always have at least 1 row
                )
            )
            sliced_table = table.slice(0, targeted_rows)
            return _maybe_truncate_table(
                sliced_table, (truncated_rows or 0) + (table_rows - targeted_rows)
            )

        if truncated_rows:
            displayed_rows = string_util.simplify_number(table.num_rows)
            total_rows = string_util.simplify_number(table.num_rows + truncated_rows)

            if displayed_rows == total_rows:  # pragma: no cover - defensive
                # If the simplified numbers are the same,
                # we just display the exact numbers.
                displayed_rows = str(table.num_rows)
                total_rows = str(table.num_rows + truncated_rows)
            _show_data_information(
                f"⚠️ Showing {displayed_rows} out of {total_rows} "
                "rows due to data size limitations."
            )

    return table


def determine_arrow_column_fix(
    column: Series[Any] | Index[Any],
) -> Literal["string", "list"] | None:
    """Determine the fix needed for Arrow compatibility.

    Returns the conversion type needed for Arrow compatibility:
    - "string": convert column values to strings
    - "list": convert iterable values (e.g., frozensets, ExtensionArrays) to lists
    - None: column is already Arrow-compatible
    """
    from pandas.api.extensions import ExtensionArray
    from pandas.api.types import infer_dtype, is_dict_like, is_list_like

    if column.dtype.kind == "c":  # complex64, complex128, complex256
        return "string"

    if str(column.dtype) in {
        # These period types are not yet supported by our frontend impl.
        # See comments in Quiver.ts for more details.
        "period[B]",
        "period[N]",
        "period[ns]",
        "period[U]",
        "period[us]",
        "geometry",
    }:
        return "string"

    if column.dtype == "object":
        # The dtype of mixed type columns is always object. In pandas 3.0+, pure
        # string columns use StringDtype instead of object, so they won't enter
        # this block (and they're Arrow-compatible anyway). The actual type of
        # object dtype column values can be determined via the infer_dtype function:
        # https://pandas.pydata.org/docs/reference/api/pandas.api.types.infer_dtype.html
        inferred_type = infer_dtype(column, skipna=True)

        if inferred_type in {
            "mixed-integer",
            "complex",
        }:
            return "string"
        if inferred_type == "mixed":
            # This includes most of the more complex/custom types (objects, dicts,
            # lists, ...)
            if len(column) == 0 or not hasattr(
                column, "iloc"
            ):  # pragma: no cover - defensive
                # The column seems to be invalid, so we assume it is incompatible.
                # But this would most likely never happen since empty columns
                # cannot be mixed.
                return "string"

            # Get the first non-null value to check if it is a supported list-like type.
            # Using dropna() handles cases where early values are NaN (e.g., from reindexing).
            non_null = column.dropna()
            if len(non_null) == 0:
                return "string"
            first_value = cast("DataFrameGenericAlias[Any]", non_null).iloc[0]  # type: ignore[index] # ty: ignore[not-subscriptable]

            if not is_list_like(first_value):
                return "string"
            # dicts are list-like, but have issues in Arrow JS (see comments in
            # Quiver.ts)
            if is_dict_like(first_value):
                return "string"
            # Frozensets and ExtensionArrays (e.g. ArrowStringArray from pandas 3+)
            # are list-like but not directly serializable by PyArrow - convert to lists.
            if isinstance(first_value, (frozenset, ExtensionArray)):
                return "list"
            return None
    # We did not detect an incompatible type, so we assume it is compatible:
    return None


def fix_arrow_incompatible_column_types(
    df: DataFrame, selected_columns: list[str] | None = None
) -> DataFrame:
    """Fix column types that are not supported by Arrow table.

    This includes mixed types (e.g. mix of integers and strings)
    as well as complex numbers (complex128 type). These types will cause
    errors during conversion of the dataframe to an Arrow table.
    It is fixed by converting column values to strings or lists as appropriate.
    This is sufficient for displaying the data on the frontend.

    Parameters
    ----------
    df : pandas.DataFrame
        A dataframe to fix.

    selected_columns: List[str] or None
        A list of columns to fix. If None, all columns are evaluated.

    Returns
    -------
    The fixed dataframe.
    """
    import pandas as pd

    # Make a copy, but only initialize if necessary to preserve memory.
    df_copy: DataFrame | None = None
    for col in selected_columns or df.columns:
        fix_type = determine_arrow_column_fix(df[col])
        if fix_type is not None:
            if df_copy is None:
                df_copy = df.copy()
            if fix_type == "list":
                # Convert any iterable (except strings/bytes) to lists.
                # Non-iterable values (e.g., NaN/None) are kept as-is.
                df_copy[col] = df[col].map(
                    lambda x: (
                        list(x)
                        if isinstance(x, Iterable) and not isinstance(x, (str, bytes))
                        else x
                    )
                )
            else:
                df_copy[col] = df[col].astype("string")

    # The index can also contain mixed types
    # causing Arrow issues during conversion.
    # Skipping multi-indices since they won't return
    # the correct value from infer_dtype
    if not selected_columns and (
        not isinstance(
            df.index,
            pd.MultiIndex,
        )
        and determine_arrow_column_fix(df.index) is not None
    ):
        if df_copy is None:
            df_copy = df.copy()
        df_copy.index = df.index.astype("string")
    return df_copy if df_copy is not None else df


def determine_data_format(input_data: Any) -> DataFormat:
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

    import numpy as np
    import pandas as pd
    import pyarrow as pa

    if input_data is None:
        return DataFormat.EMPTY
    if isinstance(input_data, pd.DataFrame):
        return DataFormat.PANDAS_DATAFRAME
    if isinstance(input_data, np.ndarray):
        if len(input_data.shape) == 1:
            # For technical reasons, we need to distinguish one
            # one-dimensional numpy array from multidimensional ones.
            return DataFormat.NUMPY_LIST
        return DataFormat.NUMPY_MATRIX
    if isinstance(input_data, pa.Table):
        return DataFormat.PYARROW_TABLE
    if isinstance(input_data, pa.Array):
        return DataFormat.PYARROW_ARRAY
    if isinstance(input_data, pd.Series):
        return DataFormat.PANDAS_SERIES
    if isinstance(input_data, pd.Index):
        return DataFormat.PANDAS_INDEX
    if is_pandas_styler(input_data):
        return DataFormat.PANDAS_STYLER
    if isinstance(input_data, pd.api.extensions.ExtensionArray):
        return DataFormat.PANDAS_ARRAY
    if is_polars_series(input_data):
        return DataFormat.POLARS_SERIES
    if is_polars_dataframe(input_data):
        return DataFormat.POLARS_DATAFRAME
    if is_polars_lazyframe(input_data):
        return DataFormat.POLARS_LAZYFRAME
    if is_modin_data_object(input_data):
        return DataFormat.MODIN_OBJECT
    if is_snowpandas_data_object(input_data):
        return DataFormat.SNOWPANDAS_OBJECT
    if is_pyspark_data_object(input_data):
        return DataFormat.PYSPARK_OBJECT
    if is_xarray_dataset(input_data):
        return DataFormat.XARRAY_DATASET
    if is_xarray_data_array(input_data):
        return DataFormat.XARRAY_DATA_ARRAY
    if is_dask_object(input_data):
        return DataFormat.DASK_OBJECT
    if is_snowpark_data_object(input_data) or is_snowpark_row_list(input_data):
        return DataFormat.SNOWPARK_OBJECT
    if is_duckdb_relation(input_data):
        return DataFormat.DUCKDB_RELATION
    if is_dbapi_cursor(input_data):
        return DataFormat.DBAPI_CURSOR
    if (
        isinstance(
            input_data,
            (ChainMap, UserDict, MappingProxyType),
        )
        or is_dataclass_instance(input_data)
        or is_namedtuple(input_data)
        or is_custom_dict(input_data)
        or is_pydantic_model(input_data)
    ):
        return DataFormat.KEY_VALUE_DICT
    if isinstance(input_data, (ItemsView, enumerate)):
        return DataFormat.LIST_OF_ROWS
    if isinstance(input_data, (list, tuple, set, frozenset)):
        if _is_list_of_scalars(input_data):
            # -> one-dimensional data structure
            if isinstance(input_data, tuple):
                return DataFormat.TUPLE_OF_VALUES
            if isinstance(input_data, (set, frozenset)):
                return DataFormat.SET_OF_VALUES
            return DataFormat.LIST_OF_VALUES
        # -> Multi-dimensional data structure
        # This should always contain at least one element,
        # otherwise the values type from infer_dtype would have been empty
        first_element = next(iter(input_data))
        if isinstance(first_element, dict) or is_pydantic_model(first_element):
            return DataFormat.LIST_OF_RECORDS
        if isinstance(first_element, (list, tuple, set, frozenset)):
            return DataFormat.LIST_OF_ROWS
    elif isinstance(input_data, (dict, Mapping)):
        if not input_data:
            return DataFormat.KEY_VALUE_DICT
        if len(input_data) > 0:
            first_value = next(iter(input_data.values()))
            # In the future, we could potentially also support tight & split formats
            if isinstance(first_value, dict):
                return DataFormat.COLUMN_INDEX_MAPPING
            if isinstance(first_value, (list, tuple)):
                return DataFormat.COLUMN_VALUE_MAPPING
            if isinstance(first_value, pd.Series):
                return DataFormat.COLUMN_SERIES_MAPPING
            # Use key-value dict as fallback. However, if the values of the dict
            # contains mixed types, it will become non-editable in the frontend.
            return DataFormat.KEY_VALUE_DICT
    elif is_list_like(input_data):
        return DataFormat.LIST_OF_VALUES

    return DataFormat.UNKNOWN


def _unify_missing_values(df: DataFrame) -> DataFrame:
    """Unify all missing values in a DataFrame to None.

    Pandas uses a variety of values to represent missing values, including np.nan,
    NaT, None, and pd.NA. This function replaces all of these values with None,
    which is the only missing value type that is supported by all data types
    when serializing to JSON-compatible formats.
    """
    import numpy as np
    import pandas as pd

    # Replace all recognized nulls (np.nan, pd.NA, NaT) with None.
    result = df.replace([pd.NA, pd.NaT, np.nan], None)  # type: ignore[list-item] # ty: ignore[invalid-argument-type]

    # infer_objects() improves column type correctness (e.g., int instead of float,
    # string instead of object). However, in pandas 3.0+ it converts None back to
    # np.nan, which defeats the purpose of this function. Only call it for older
    # pandas versions. See: https://github.com/streamlit/streamlit/issues/14693
    if is_pandas_version_less_than("3.0.0"):
        result = result.infer_objects()

    return result


def _pandas_df_to_series(df: DataFrame) -> Series[Any]:
    """Convert a Pandas DataFrame to a Pandas Series by selecting the first column.

    Raises
    ------
    ValueError
        If the DataFrame has more than one column.
    """
    # Select first column in dataframe and create a new series based on the values
    if len(df.columns) != 1:
        raise ValueError(
            f"DataFrame is expected to have a single column but has {len(df.columns)}."
        )
    return df.iloc[:, 0]


def convert_pandas_df_to_data_format(
    df: DataFrame, data_format: DataFormat
) -> (
    DataFrame
    | Series[Any]
    | pa.Table
    | pa.Array
    | np.ndarray[Any, np.dtype[Any]]
    | tuple[Any]
    | list[Any]
    | set[Any]
    | dict[str, Any]
):
    """Convert a Pandas DataFrame to the specified data format.

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to convert.

    data_format : DataFormat
        The data format to convert to.

    Returns
    -------
    pd.DataFrame, pd.Series, pyarrow.Table, np.ndarray, xarray.Dataset,
    xarray.DataArray, polars.Dataframe, polars.Series, list, set, tuple, or dict.
        The converted dataframe.
    """

    if data_format in {
        DataFormat.EMPTY,
        DataFormat.DASK_OBJECT,
        DataFormat.DBAPI_CURSOR,
        DataFormat.DUCKDB_RELATION,
        DataFormat.MODIN_OBJECT,
        DataFormat.PANDAS_ARRAY,
        DataFormat.PANDAS_DATAFRAME,
        DataFormat.PANDAS_INDEX,
        DataFormat.PANDAS_STYLER,
        DataFormat.PYSPARK_OBJECT,
        DataFormat.SNOWPANDAS_OBJECT,
        DataFormat.SNOWPARK_OBJECT,
    }:
        return df
    if data_format == DataFormat.NUMPY_LIST:
        import numpy as np

        # It's a 1-dimensional array, so we only return
        # the first column as numpy array
        # Calling to_numpy() on the full DataFrame would result in:
        # [[1], [2]] instead of [1, 2]
        return np.ndarray(0) if df.empty else df.iloc[:, 0].to_numpy()
    if data_format == DataFormat.NUMPY_MATRIX:
        import numpy as np

        return np.ndarray(0) if df.empty else df.to_numpy()
    if data_format == DataFormat.PYARROW_TABLE:
        import pyarrow as pa

        return pa.Table.from_pandas(df)
    if data_format == DataFormat.PYARROW_ARRAY:
        import pyarrow as pa

        return pa.Array.from_pandas(_pandas_df_to_series(df))
    if data_format == DataFormat.PANDAS_SERIES:
        return _pandas_df_to_series(df)
    if data_format in {DataFormat.POLARS_DATAFRAME, DataFormat.POLARS_LAZYFRAME}:
        import polars as pl

        return pl.from_pandas(df)
    if data_format == DataFormat.POLARS_SERIES:
        import polars as pl

        return pl.from_pandas(_pandas_df_to_series(df))
    if data_format == DataFormat.XARRAY_DATASET:
        import xarray as xr  # type: ignore[import-not-found, unused-ignore]

        return xr.Dataset.from_dataframe(df)
    if data_format == DataFormat.XARRAY_DATA_ARRAY:
        import xarray as xr

        return xr.DataArray.from_series(_pandas_df_to_series(df))
    if data_format == DataFormat.LIST_OF_RECORDS:
        return _unify_missing_values(df).to_dict(orient="records")
    if data_format == DataFormat.LIST_OF_ROWS:
        # to_numpy converts the dataframe to a list of rows
        return _unify_missing_values(df).to_numpy().tolist()
    if data_format == DataFormat.COLUMN_INDEX_MAPPING:
        return _unify_missing_values(df).to_dict(orient="dict")
    if data_format == DataFormat.COLUMN_VALUE_MAPPING:
        return _unify_missing_values(df).to_dict(orient="list")
    if data_format == DataFormat.COLUMN_SERIES_MAPPING:
        return df.to_dict(orient="series")
    if data_format in {
        DataFormat.LIST_OF_VALUES,
        DataFormat.TUPLE_OF_VALUES,
        DataFormat.SET_OF_VALUES,
    }:
        df = _unify_missing_values(df)
        return_list = []
        if len(df.columns) == 1:
            #  Get the first column and convert to list
            return_list = df.iloc[:, 0].tolist()
        elif len(df.columns) >= 1:
            raise ValueError(
                "DataFrame is expected to have a single column but "
                f"has {len(df.columns)}."
            )
        if data_format == DataFormat.TUPLE_OF_VALUES:
            return tuple(return_list)
        if data_format == DataFormat.SET_OF_VALUES:
            return set(return_list)
        return return_list
    if data_format == DataFormat.KEY_VALUE_DICT:
        df = _unify_missing_values(df)
        # The key is expected to be the index -> this will return the first column
        # as a dict with index as key.
        return {} if df.empty else df.iloc[:, 0].to_dict()

    raise ValueError(f"Unsupported input data format: {data_format}")
