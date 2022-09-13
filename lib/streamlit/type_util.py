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

"""A bunch of useful utilities for dealing with types."""

from __future__ import annotations

import re
import types
from typing import (
    Any,
    Iterable,
    NamedTuple,
    Optional,
    Sequence,
    TypeVar,
    TYPE_CHECKING,
    Union,
    cast,
    overload,
    List,
)

from typing_extensions import (
    Final,
    Literal,
    Protocol,
    TypeAlias,
    TypeGuard,
    get_args,
)

import pyarrow as pa
from pandas.api.types import infer_dtype

from streamlit import errors
from streamlit import logger as _logger

if TYPE_CHECKING:
    import graphviz
    import sympy
    from pandas import DataFrame, Series, Index
    from pandas.core.indexing import _iLocIndexer
    from pandas.io.formats.style import Styler
    from plotly.graph_objs import Figure
    from pydeck import Deck

_LOGGER = _logger.get_logger("root")

# The array value field names are part of the larger set of possible value
# field names. See the explanation for said set below. The message types
# associated with these fields are distinguished by storing data in a `data`
# field in their messages, meaning they need special treatment in certain
# circumstances. Hence, they need their own, dedicated, sub-type.
ArrayValueFieldName: TypeAlias = Literal[
    "double_array_value",
    "int_array_value",
    "string_array_value",
]

# A frozenset containing the allowed values of the ArrayValueFieldName type.
# Useful for membership checking.
ARRAY_VALUE_FIELD_NAMES: Final = frozenset(
    cast(
        "tuple[ArrayValueFieldName, ...]",
        # NOTE: get_args is not recursive, so this only works as long as
        # ArrayValueFieldName remains flat.
        get_args(ArrayValueFieldName),
    )
)

# These are the possible field names that can be set in the `value` oneof-field
# of the WidgetState message (schema found in .proto/WidgetStates.proto).
# We need these as a literal type to ensure correspondence with the protobuf
# schema in certain parts of the python code.
# TODO(harahu): It would be preferable if this type was automatically derived
#  from the protobuf schema, rather than manually maintained. Not sure how to
#  achieve that, though.
ValueFieldName: TypeAlias = Literal[
    ArrayValueFieldName,
    "arrow_value",
    "bool_value",
    "bytes_value",
    "double_value",
    "file_uploader_state_value",
    "int_value",
    "json_value",
    "string_value",
    "trigger_value",
]

V_co = TypeVar(
    "V_co",
    covariant=True,  # https://peps.python.org/pep-0484/#covariance-and-contravariance
)

T = TypeVar("T")


class DataFrameGenericAlias(Protocol[V_co]):
    """Technically not a GenericAlias, but serves the same purpose in
    OptionSequence below, in that it is a type which admits DataFrame,
    but is generic. This allows OptionSequence to be a fully generic type,
    significantly increasing its usefulness.

    We can't use types.GenericAlias, as it is only available from python>=3.9,
    and isn't easily back-ported.
    """

    @property
    def iloc(self) -> _iLocIndexer:
        ...


OptionSequence: TypeAlias = Union[
    Iterable[V_co],
    DataFrameGenericAlias[V_co],
]


Key: TypeAlias = Union[str, int]

LabelVisibility = Literal["visible", "hidden", "collapsed"]

# This should really be a Protocol, but can't be, due to:
# https://github.com/python/mypy/issues/12933
# https://github.com/python/mypy/issues/13081
SupportsStr: TypeAlias = object


def is_array_value_field_name(obj: object) -> TypeGuard[ArrayValueFieldName]:
    return obj in ARRAY_VALUE_FIELD_NAMES


@overload
def is_type(
    obj: object, fqn_type_pattern: Literal["pydeck.bindings.deck.Deck"]
) -> TypeGuard[Deck]:
    ...


@overload
def is_type(
    obj: object, fqn_type_pattern: Literal["plotly.graph_objs._figure.Figure"]
) -> TypeGuard[Figure]:
    ...


@overload
def is_type(obj: object, fqn_type_pattern: Union[str, re.Pattern[str]]) -> bool:
    ...


def is_type(obj: object, fqn_type_pattern: Union[str, re.Pattern[str]]) -> bool:
    """Check type without importing expensive modules.

    Parameters
    ----------
    obj : object
        The object to type-check.
    fqn_type_pattern : str or regex
        The fully-qualified type string or a regular expression.
        Regexes should start with `^` and end with `$`.

    Example
    -------

    To check whether something is a Matplotlib Figure without importing
    matplotlib, use:

    >>> is_type(foo, 'matplotlib.figure.Figure')

    """
    fqn_type = get_fqn_type(obj)
    if isinstance(fqn_type_pattern, str):
        return fqn_type_pattern == fqn_type
    else:
        return fqn_type_pattern.match(fqn_type) is not None


def get_fqn(the_type: type) -> str:
    """Get module.type_name for a given type."""
    return f"{the_type.__module__}.{the_type.__qualname__}"


def get_fqn_type(obj: object) -> str:
    """Get module.type_name for a given object."""
    return get_fqn(type(obj))


_PANDAS_DF_TYPE_STR: Final = "pandas.core.frame.DataFrame"
_PANDAS_INDEX_TYPE_STR: Final = "pandas.core.indexes.base.Index"
_PANDAS_SERIES_TYPE_STR: Final = "pandas.core.series.Series"
_PANDAS_STYLER_TYPE_STR: Final = "pandas.io.formats.style.Styler"
_NUMPY_ARRAY_TYPE_STR: Final = "numpy.ndarray"

_DATAFRAME_LIKE_TYPES: Final[tuple[str, ...]] = (
    _PANDAS_DF_TYPE_STR,
    _PANDAS_INDEX_TYPE_STR,
    _PANDAS_SERIES_TYPE_STR,
    _PANDAS_STYLER_TYPE_STR,
    _NUMPY_ARRAY_TYPE_STR,
)

DataFrameLike: TypeAlias = "Union[DataFrame, Index, Series, Styler]"

_DATAFRAME_COMPATIBLE_TYPES: Final[tuple[type, ...]] = (
    dict,
    list,
    type(None),
)

_DataFrameCompatible: TypeAlias = Union[dict, list, None]
DataFrameCompatible: TypeAlias = Union[_DataFrameCompatible, DataFrameLike]

_BYTES_LIKE_TYPES: Final[tuple[type, ...]] = (
    bytes,
    bytearray,
)

BytesLike: TypeAlias = Union[bytes, bytearray]


def is_dataframe(obj: object) -> TypeGuard[DataFrame]:
    return is_type(obj, _PANDAS_DF_TYPE_STR)


def is_dataframe_like(obj: object) -> TypeGuard[DataFrameLike]:
    return any(is_type(obj, t) for t in _DATAFRAME_LIKE_TYPES)


def is_dataframe_compatible(obj: object) -> TypeGuard[DataFrameCompatible]:
    """True if type that can be passed to convert_anything_to_df."""
    return is_dataframe_like(obj) or type(obj) in _DATAFRAME_COMPATIBLE_TYPES


def is_bytes_like(obj: object) -> TypeGuard[BytesLike]:
    """True if the type is considered bytes-like for the purposes of
    protobuf data marshalling."""
    return isinstance(obj, _BYTES_LIKE_TYPES)


def to_bytes(obj: BytesLike) -> bytes:
    """Converts the given object to bytes.

    Only types for which `is_bytes_like` is true can be converted; anything
    else will result in an exception.
    """
    if isinstance(obj, bytearray):
        return bytes(obj)
    elif isinstance(obj, bytes):
        return obj

    raise RuntimeError(f"{obj} is not convertible to bytes")


_SYMPY_RE: Final = re.compile(r"^sympy.*$")


def is_sympy_expession(obj: object) -> TypeGuard[sympy.Expr]:
    """True if input is a SymPy expression."""
    if not is_type(obj, _SYMPY_RE):
        return False

    try:
        import sympy

        return isinstance(obj, sympy.Expr)
    except ImportError:
        return False


_ALTAIR_RE: Final = re.compile(r"^altair\.vegalite\.v\d+\.api\.\w*Chart$")


def is_altair_chart(obj: object) -> bool:
    """True if input looks like an Altair chart."""
    return is_type(obj, _ALTAIR_RE)


def is_keras_model(obj: object) -> bool:
    """True if input looks like a Keras model."""
    return (
        is_type(obj, "keras.engine.sequential.Sequential")
        or is_type(obj, "keras.engine.training.Model")
        or is_type(obj, "tensorflow.python.keras.engine.sequential.Sequential")
        or is_type(obj, "tensorflow.python.keras.engine.training.Model")
    )


def is_plotly_chart(obj: object) -> TypeGuard[Union[Figure, list[Any], dict[str, Any]]]:
    """True if input looks like a Plotly chart."""
    return (
        is_type(obj, "plotly.graph_objs._figure.Figure")
        or _is_list_of_plotly_objs(obj)
        or _is_probably_plotly_dict(obj)
    )


def is_graphviz_chart(
    obj: object,
) -> TypeGuard[Union[graphviz.Graph, graphviz.Digraph]]:
    """True if input looks like a GraphViz chart."""
    return (
        # GraphViz < 0.18
        is_type(obj, "graphviz.dot.Graph")
        or is_type(obj, "graphviz.dot.Digraph")
        # GraphViz >= 0.18
        or is_type(obj, "graphviz.graphs.Graph")
        or is_type(obj, "graphviz.graphs.Digraph")
    )


def _is_plotly_obj(obj: object) -> bool:
    """True if input if from a type that lives in plotly.plotly_objs."""
    the_type = type(obj)
    return the_type.__module__.startswith("plotly.graph_objs")


def _is_list_of_plotly_objs(obj: object) -> TypeGuard[list[Any]]:
    if not isinstance(obj, list):
        return False
    if len(obj) == 0:
        return False
    return all(_is_plotly_obj(item) for item in obj)


def _is_probably_plotly_dict(obj: object) -> TypeGuard[dict[str, Any]]:
    if not isinstance(obj, dict):
        return False

    if len(obj.keys()) == 0:
        return False

    if any(k not in ["config", "data", "frames", "layout"] for k in obj.keys()):
        return False

    if any(_is_plotly_obj(v) for v in obj.values()):
        return True

    if any(_is_list_of_plotly_objs(v) for v in obj.values()):
        return True

    return False


def is_function(x: object) -> TypeGuard[types.FunctionType]:
    """Return True if x is a function."""
    return isinstance(x, types.FunctionType)


def is_namedtuple(x: object) -> TypeGuard[NamedTuple]:
    t = type(x)
    b = t.__bases__
    if len(b) != 1 or b[0] != tuple:
        return False
    f = getattr(t, "_fields", None)
    if not isinstance(f, tuple):
        return False
    return all(type(n).__name__ == "str" for n in f)


def is_pandas_styler(obj: object) -> TypeGuard[Styler]:
    return is_type(obj, _PANDAS_STYLER_TYPE_STR)


def is_pydeck(obj: object) -> TypeGuard[Deck]:
    """True if input looks like a pydeck chart."""
    return is_type(obj, "pydeck.bindings.deck.Deck")


def is_iterable(obj: object) -> TypeGuard[Iterable[Any]]:
    try:
        # The ignore statement here is intentional, as this is a
        # perfectly fine way of checking for iterables.
        iter(obj)  # type: ignore[call-overload]
    except TypeError:
        return False
    return True


def is_sequence(seq: Any) -> bool:
    """True if input looks like a sequence."""
    if isinstance(seq, str):
        return False
    try:
        len(seq)
    except Exception:
        return False
    return True


def convert_anything_to_df(df: Any) -> DataFrame:
    """Try to convert different formats to a Pandas Dataframe.

    Parameters
    ----------
    df : ndarray, Iterable, dict, DataFrame, Styler, pa.Table, None, dict, list, or any

    Returns
    -------
    pandas.DataFrame

    """
    # This is inefficient as the data will be converted back to Arrow
    # when marshalled to protobuf, but area/bar/line charts need
    # DataFrame magic to generate the correct output.
    if isinstance(df, pa.Table):
        return df.to_pandas()

    if is_type(df, _PANDAS_DF_TYPE_STR):
        return df

    if is_pandas_styler(df):
        return df.data

    import pandas as pd

    if is_type(df, "numpy.ndarray") and len(df.shape) == 0:
        return pd.DataFrame([])

    # Try to convert to pandas.DataFrame. This will raise an error is df is not
    # compatible with the pandas.DataFrame constructor.
    try:
        return pd.DataFrame(df)

    except ValueError:
        raise errors.StreamlitAPIException(
            """
Unable to convert object of type `%(type)s` to `pandas.DataFrame`.

Offending object:
```py
%(object)s
```"""
            % {
                "type": type(df),
                "object": df,
            }
        )


@overload
def ensure_iterable(obj: Iterable[V_co]) -> Iterable[V_co]:
    ...


@overload
def ensure_iterable(obj: DataFrame) -> Iterable[Any]:
    ...


def ensure_iterable(obj: Union[DataFrame, Iterable[V_co]]) -> Iterable[Any]:
    """Try to convert different formats to something iterable. Most inputs
    are assumed to be iterable, but if we have a DataFrame, we can just
    select the first column to iterate over. If the input is not iterable,
    a TypeError is raised.

    Parameters
    ----------
    obj : list, tuple, numpy.ndarray, pandas.Series, or pandas.DataFrame

    Returns
    -------
    iterable

    """
    if is_dataframe(obj):
        # Return first column as a pd.Series
        # The type of the elements in this column is not known up front, hence
        # the Iterable[Any] return type.
        return cast(Iterable[Any], obj.iloc[:, 0])

    if is_iterable(obj):
        return obj

    raise TypeError(
        f"Object is not an iterable and could not be converted to one. Object: {obj}"
    )


def ensure_indexable(obj: OptionSequence[V_co]) -> Sequence[V_co]:
    """Try to ensure a value is an indexable Sequence. If the collection already
    is one, it has the index method that we need. Otherwise, convert it to a list.
    """
    it = ensure_iterable(obj)
    # This is an imperfect check because there is no guarantee that an `index`
    # function actually does the thing we want.
    index_fn = getattr(it, "index", None)
    if callable(index_fn):
        return it  # type: ignore[return-value]
    else:
        return list(it)


def is_pandas_version_less_than(v: str) -> bool:
    """Return True if the current Pandas version is less than the input version.

    Parameters
    ----------
    v : str
        Version string, e.g. "0.25.0"

    Returns
    -------
    bool

    """
    import pandas as pd
    from packaging import version

    return version.parse(pd.__version__) < version.parse(v)


def pyarrow_table_to_bytes(table: pa.Table) -> bytes:
    """Serialize pyarrow.Table to bytes using Apache Arrow.

    Parameters
    ----------
    table : pyarrow.Table
        A table to convert.

    """
    sink = pa.BufferOutputStream()
    writer = pa.RecordBatchStreamWriter(sink, table.schema)
    writer.write_table(table)
    writer.close()
    return cast(bytes, sink.getvalue().to_pybytes())


def convert_mixed_columns_to_string(
    df: DataFrame, selected_columns: Optional[List[str]] = None
) -> DataFrame:
    for col in selected_columns or df.columns:
        column = df[col]
        if column.dtype == "object" and "mixed" in infer_dtype(column):
            df[col] = column.astype(str)
    return df


def data_frame_to_bytes(df: DataFrame) -> bytes:
    """Serialize pandas.DataFrame to bytes using Apache Arrow.

    Parameters
    ----------
    df : pandas.DataFrame
        A dataframe to convert.

    """
    try:
        try:
            table = pa.Table.from_pandas(df)
        except pa.ArrowTypeError:
            # Fallback: Convert all object types to string
            df = convert_mixed_columns_to_string(df)
            table = pa.Table.from_pandas(df)
        return pyarrow_table_to_bytes(table)
    except Exception as e:
        _NUMPY_DTYPE_ERROR_MESSAGE = "Could not convert dtype"
        if _NUMPY_DTYPE_ERROR_MESSAGE in str(e):
            raise errors.NumpyDtypeException(
                """
Unable to convert `numpy.dtype` to `pyarrow.DataType`.
This is likely due to a bug in Arrow (see https://issues.apache.org/jira/browse/ARROW-14087).
As a temporary workaround, you can convert the DataFrame cells to strings with `df.astype(str)`.
"""
            )
        else:
            raise errors.StreamlitAPIException(e)


def bytes_to_data_frame(source: bytes) -> DataFrame:
    """Convert bytes to pandas.DataFrame.

    Parameters
    ----------
    source : bytes
        A bytes object to convert.

    """

    reader = pa.RecordBatchStreamReader(source)
    return reader.read_pandas()


@overload
def to_key(key: None) -> None:
    ...


@overload
def to_key(key: Key) -> str:
    ...


def to_key(key: Optional[Key]) -> Optional[str]:
    if key is None:
        return None
    else:
        return str(key)


def maybe_raise_label_warnings(label: Optional[str], label_visibility: Optional[str]):
    if not label:
        _LOGGER.warning(
            "`label` got an empty value. This is discouraged for accessibility "
            "reasons and may be disallowed in the future by raising an exception. "
            "Please provide a non-empty label and hide it with label_visibility "
            "if needed."
        )
    if label_visibility not in ("visible", "hidden", "collapsed"):
        raise errors.StreamlitAPIException(
            f"Unsupported label_visibility option '{label_visibility}'. "
            f"Valid values are 'visible', 'hidden' or 'collapsed'."
        )
