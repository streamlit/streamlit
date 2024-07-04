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

"""A bunch of useful utilities for dealing with types."""

from __future__ import annotations

import re
import types
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Iterable,
    Literal,
    NamedTuple,
    Protocol,
    Sequence,
    TypeVar,
    Union,
    overload,
)

from typing_extensions import TypeAlias, TypeGuard

from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    import graphviz
    import sympy
    from plotly.graph_objs import Figure
    from pydeck import Deck

    from streamlit.runtime.secrets import Secrets

T = TypeVar("T")


class SupportsStr(Protocol):
    def __str__(self) -> str: ...


@overload
def is_type(
    obj: object, fqn_type_pattern: Literal["pydeck.bindings.deck.Deck"]
) -> TypeGuard[Deck]: ...


@overload
def is_type(
    obj: object, fqn_type_pattern: Literal["plotly.graph_objs._figure.Figure"]
) -> TypeGuard[Figure]: ...


@overload
def is_type(obj: object, fqn_type_pattern: str | re.Pattern[str]) -> bool: ...


def is_type(obj: object, fqn_type_pattern: str | re.Pattern[str]) -> bool:
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


_BYTES_LIKE_TYPES: Final[tuple[type, ...]] = (
    bytes,
    bytearray,
)

BytesLike: TypeAlias = Union[bytes, bytearray]


def is_bytes_like(obj: object) -> TypeGuard[BytesLike]:
    """True if the type is considered bytes-like for the purposes of
    protobuf data marshalling.
    """
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


_PILLOW_RE: Final = re.compile(r"^PIL\..*")


def is_pillow_image(obj: object) -> bool:
    """True if input looks like a pillow image."""
    return is_type(obj, _PILLOW_RE)


def is_keras_model(obj: object) -> bool:
    """True if input looks like a Keras model."""
    return (
        is_type(obj, "keras.engine.sequential.Sequential")
        or is_type(obj, "keras.engine.training.Model")
        or is_type(obj, "tensorflow.python.keras.engine.sequential.Sequential")
        or is_type(obj, "tensorflow.python.keras.engine.training.Model")
    )


# We use a regex here to allow potential changes in the module path in the future.
_OPENAI_CHUNK_RE: Final = re.compile(r"^openai\..+\.ChatCompletionChunk$")


def is_openai_chunk(obj: object) -> bool:
    """True if input looks like an OpenAI chat completion chunk."""
    return is_type(obj, _OPENAI_CHUNK_RE)


def is_plotly_chart(obj: object) -> TypeGuard[Figure | list[Any] | dict[str, Any]]:
    """True if input looks like a Plotly chart."""
    return (
        is_type(obj, "plotly.graph_objs._figure.Figure")
        or _is_list_of_plotly_objs(obj)
        or _is_probably_plotly_dict(obj)
    )


def is_graphviz_chart(
    obj: object,
) -> TypeGuard[graphviz.Graph | graphviz.Digraph]:
    """True if input looks like a GraphViz chart."""
    return (
        # GraphViz < 0.18
        is_type(obj, "graphviz.dot.Graph")
        or is_type(obj, "graphviz.dot.Digraph")
        # GraphViz >= 0.18
        or is_type(obj, "graphviz.graphs.Graph")
        or is_type(obj, "graphviz.graphs.Digraph")
        or is_type(obj, "graphviz.sources.Source")
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
    if len(b) != 1 or b[0] is not tuple:
        return False
    f = getattr(t, "_fields", None)
    if not isinstance(f, tuple):
        return False
    return all(type(n).__name__ == "str" for n in f)


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


def is_streamlit_secrets_class(obj: object) -> TypeGuard[Secrets]:
    """True if obj is a Streamlit Secrets object."""
    return is_type(obj, "streamlit.runtime.secrets.Secrets")


def is_sequence(seq: Any) -> bool:
    """True if input looks like a sequence."""
    if isinstance(seq, str):
        return False
    try:
        len(seq)
    except Exception:
        return False
    return True


def check_python_comparable(seq: Sequence[Any]) -> None:
    """Check if the sequence elements support "python comparison".
    That means that the equality operator (==) returns a boolean value.
    Which is not True for e.g. numpy arrays and pandas series."""
    try:
        bool(seq[0] == seq[0])
    except LookupError:
        # In case of empty sequences, the check not raise an exception.
        pass
    except ValueError:
        raise StreamlitAPIException(
            "Invalid option type provided. Options must be comparable, returning a "
            f"boolean when used with *==*. \n\nGot **{type(seq[0]).__name__}**, "
            "which cannot be compared. Refactor your code to use elements of "
            "comparable types as options, e.g. use indices instead."
        )


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


def is_altair_version_less_than(v: str) -> bool:
    """Return True if the current Altair version is less than the input version.

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
    import altair as alt

    return is_version_less_than(alt.__version__, v)


def is_version_less_than(v1: str, v2: str) -> bool:
    """Return True if the v1 version string is less than the v2 version string
    based on semantic versioning.

    Raises
    ------
    InvalidVersion
        If the version strings are not valid.
    """
    from packaging import version

    return version.parse(v1) < version.parse(v2)
