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

"""A bunch of useful utilities for dealing with types."""

from __future__ import annotations

import dataclasses
import re
import types
from collections import UserList, deque
from collections.abc import (
    AsyncGenerator,
    Generator,
    ItemsView,
    Iterable,
    KeysView,
    Mapping,
    Sequence,
    ValuesView,
)
from enum import EnumMeta
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    NamedTuple,
    Protocol,
    TypeAlias,
    TypeGuard,
    overload,
)

from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    import graphviz
    import sympy
    from plotly.graph_objs import Figure
    from pydeck import Deck

    from streamlit.delta_generator import DeltaGenerator

# we define our own type here because mypy doesn't seem to support the shape type and
# reports unreachable code. When mypy supports it, we can remove this custom type.
NumpyShape: TypeAlias = tuple[int, ...]


class SupportsStr(Protocol):
    def __str__(self) -> str: ...


class SupportsReprHtml(Protocol):
    def _repr_html_(self) -> str: ...


class CustomDict(Protocol):
    """Protocol for Streamlit native custom dictionaries (e.g. session state, secrets, query params).
    that can be converted to a dict.

    All these implementations should provide a to_dict method.
    """

    def to_dict(self) -> dict[str, Any]: ...


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

    >>> is_type(foo, "matplotlib.figure.Figure")

    """
    fqn_type = get_fqn_type(obj)
    if isinstance(fqn_type_pattern, str):
        return fqn_type_pattern == fqn_type
    return fqn_type_pattern.match(fqn_type) is not None


def _is_type_instance(obj: object, type_to_check: str) -> bool:
    """Check if instance of type without importing expensive modules."""
    return type_to_check in [get_fqn(t) for t in type(obj).__mro__]


def get_object_name(obj: object) -> str:
    """Get a simplified name of the given object."""
    if hasattr(obj, "__qualname__") and isinstance(obj.__qualname__, str):
        return obj.__qualname__
    if hasattr(obj, "__name__") and isinstance(obj.__name__, str):
        return obj.__name__

    return type(obj).__qualname__


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

BytesLike: TypeAlias = bytes | bytearray


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
    if isinstance(obj, bytes):
        return obj

    raise RuntimeError(f"{obj} is not convertible to bytes")


_SYMPY_RE: Final = re.compile(r"^sympy.*$")


def is_sympy_expression(obj: object) -> TypeGuard[sympy.Expr]:
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
) -> TypeGuard[graphviz.Graph | graphviz.Digraph | graphviz.Source]:
    """True if input looks like a GraphViz chart."""
    return (
        # In GraphViz < 0.18
        is_type(obj, "graphviz.dot.Graph")
        or is_type(obj, "graphviz.dot.Digraph")
        # In GraphViz >= 0.18
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

    if any(k not in {"config", "data", "frames", "layout"} for k in obj):
        return False

    if any(_is_plotly_obj(v) for v in obj.values()):
        return True

    return bool(any(_is_list_of_plotly_objs(v) for v in obj.values()))


def is_delta_generator(obj: object) -> TypeGuard[DeltaGenerator]:
    """True if input looks like a DeltaGenerator."""

    # We are using a string here to avoid circular import warnings
    # when importing DeltaGenerator.
    return is_type(obj, "streamlit.delta_generator.DeltaGenerator")


def is_function(x: object) -> TypeGuard[types.FunctionType]:
    """Return True if x is a function."""
    return isinstance(x, types.FunctionType)


def has_callable_attr(obj: object, name: str) -> bool:
    """True if obj has the specified attribute that is callable."""
    return (
        hasattr(obj, name)
        and callable(getattr(obj, name))
        # DeltaGenerator will return a callable wrapper for any method name,
        # even if it doesn't exist.
        and not is_delta_generator(obj)
    )


def is_namedtuple(x: object) -> TypeGuard[NamedTuple]:
    """True if obj is an instance of a namedtuple."""
    return isinstance(x, tuple) and has_callable_attr(x, "_asdict")


def is_dataclass_instance(obj: object) -> bool:
    """True if obj is an instance of a dataclass."""
    # The not isinstance(obj, type) check is needed to make sure that this
    # is an instance of a dataclass and not the class itself.
    # dataclasses.is_dataclass returns True for either instance or class.
    return dataclasses.is_dataclass(obj) and not isinstance(obj, type)


def is_pydeck(obj: object) -> TypeGuard[Deck]:
    """True if input looks like a pydeck chart."""
    return is_type(obj, "pydeck.bindings.deck.Deck")


def is_pydantic_model(obj: object) -> bool:
    """True if input looks like a Pydantic model instance."""

    if isinstance(obj, type):
        # The obj is a class, but we
        # only want to check for instances
        # of Pydantic models, so we return False.
        return False

    return _is_type_instance(obj, "pydantic.main.BaseModel")


def is_sequence_of_pydantic_models(obj: object) -> TypeGuard[Sequence[Any]]:
    """True if obj is a non-empty list/tuple/set/frozenset of Pydantic model instances."""
    if not isinstance(obj, (list, tuple, set, frozenset)) or len(obj) == 0:
        return False
    first_element = next(iter(obj))
    return is_pydantic_model(first_element)


def dump_pydantic_sequence(obj: Sequence[object]) -> list[dict[str, Any]]:
    """Dump a sequence of Pydantic models to a list of dictionaries."""
    first_element = next(iter(obj))
    # Pydantic v2 uses model_dump(), v1 uses dict()
    if has_callable_attr(first_element, "model_dump"):
        # Use mode="json" to ensure proper serialization of types like Decimal
        return [item.model_dump(mode="json") for item in obj]  # type: ignore
    return [item.dict() for item in obj]  # type: ignore


def _is_from_streamlit(obj: object) -> bool:
    """True if the object is from the streamlit package."""
    return obj.__class__.__module__.startswith("streamlit")


def is_custom_dict(obj: object) -> TypeGuard[CustomDict]:
    """True if input looks like one of the Streamlit custom dictionaries."""
    return (
        isinstance(obj, Mapping)
        and _is_from_streamlit(obj)
        and has_callable_attr(obj, "to_dict")
    )


def is_iterable(obj: object) -> TypeGuard[Iterable[Any]]:
    try:
        # The ignore statement here is intentional, as this is a
        # perfectly fine way of checking for iterables.
        iter(obj)  # type: ignore[call-overload]
    except TypeError:
        return False
    return True


def is_list_like(obj: object) -> TypeGuard[Sequence[Any]]:
    """True if input looks like a list."""
    import array

    if isinstance(obj, str):
        return False

    if isinstance(obj, (list, set, tuple)):
        # Optimization to check the most common types first
        return True

    return isinstance(
        obj,
        (
            array.ArrayType,
            deque,
            EnumMeta,
            enumerate,
            frozenset,
            ItemsView,
            KeysView,
            map,
            range,
            UserList,
            ValuesView,
        ),
    )


def check_python_comparable(seq: Sequence[Any]) -> None:
    """Check if the sequence elements support "python comparison".
    That means that the equality operator (==) returns a boolean value.
    Which is not True for e.g. numpy arrays and pandas series.
    """
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


def async_generator_to_sync(
    async_gen: AsyncGenerator[Any, Any],
) -> Generator[Any, Any, Any]:
    """Convert an async generator to a synchronous generator."""
    import asyncio

    # Create a new event loop.
    # It is expected that there is no existing event loop in the user thread.
    loop = asyncio.new_event_loop()

    try:
        # Iterate over the async generator until it raises StopAsyncIteration
        while True:
            yield loop.run_until_complete(anext(async_gen))
    except StopAsyncIteration:
        # The async generator has finished
        pass
    finally:
        loop.close()
