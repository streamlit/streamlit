# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from enum import Enum, EnumMeta
from typing import TYPE_CHECKING, Any, Final, TypeVar, overload

from streamlit import config, logger
from streamlit.dataframe_util import OptionSequence, convert_anything_to_list
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state.common import RegisterWidgetResult
from streamlit.type_util import (
    T,
    check_python_comparable,
)

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence

_LOGGER: Final = logger.get_logger(__name__)

_FLOAT_EQUALITY_EPSILON: Final[float] = 0.000000000005
_Value = TypeVar("_Value")


def index_(iterable: Iterable[_Value], x: _Value) -> int:
    """Return zero-based index of the first item whose value is equal to x.
    Raises a ValueError if there is no such item.

    We need a custom implementation instead of the built-in list .index() to
    be compatible with NumPy array and Pandas Series.

    Parameters
    ----------
    iterable : list, tuple, numpy.ndarray, pandas.Series
    x : Any

    Returns
    -------
    int
    """
    for i, value in enumerate(iterable):
        if x == value:
            return i
        elif isinstance(value, float) and isinstance(x, float):
            if abs(x - value) < _FLOAT_EQUALITY_EPSILON:
                return i
    raise ValueError(f"{str(x)} is not in iterable")


def check_and_convert_to_indices(
    opt: Sequence[Any], default_values: Sequence[Any] | Any | None
) -> list[int] | None:
    """Perform validation checks and return indices based on the default values."""
    if default_values is None:
        return None

    default_values = convert_anything_to_list(default_values)

    for value in default_values:
        if value not in opt:
            raise StreamlitAPIException(
                f"The default value '{value}' is not part of the options. "
                "Please make sure that every default values also exists in the options."
            )

    return [opt.index(value) for value in default_values]


def convert_to_sequence_and_check_comparable(options: OptionSequence[T]) -> Sequence[T]:
    indexable_options = convert_anything_to_list(options)
    check_python_comparable(indexable_options)
    return indexable_options


def get_default_indices(
    indexable_options: Sequence[T], default: Sequence[Any] | Any | None = None
) -> list[int]:
    default_indices = check_and_convert_to_indices(indexable_options, default)
    default_indices = default_indices if default_indices is not None else []
    return default_indices


E1 = TypeVar("E1", bound=Enum)
E2 = TypeVar("E2", bound=Enum)

_ALLOWED_ENUM_COERCION_CONFIG_SETTINGS = ("off", "nameOnly", "nameAndValue")


def _coerce_enum(from_enum_value: E1, to_enum_class: type[E2]) -> E1 | E2:
    """Attempt to coerce an Enum value to another EnumMeta.

    An Enum value of EnumMeta E1 is considered coercable to EnumType E2
    if the EnumMeta __qualname__ match and the names of their members
    match as well. (This is configurable in streamlist configs)
    """
    if not isinstance(from_enum_value, Enum):
        raise ValueError(
            f"Expected an Enum in the first argument. Got {type(from_enum_value)}"
        )
    if not isinstance(to_enum_class, EnumMeta):
        raise ValueError(
            f"Expected an EnumMeta/Type in the second argument. Got {type(to_enum_class)}"
        )
    if isinstance(from_enum_value, to_enum_class):
        return from_enum_value  # Enum is already a member, no coersion necessary

    coercion_type = config.get_option("runner.enumCoercion")
    if coercion_type not in _ALLOWED_ENUM_COERCION_CONFIG_SETTINGS:
        raise StreamlitAPIException(
            "Invalid value for config option runner.enumCoercion. "
            f"Expected one of {_ALLOWED_ENUM_COERCION_CONFIG_SETTINGS}, "
            f"but got '{coercion_type}'."
        )
    if coercion_type == "off":
        return from_enum_value  # do not attempt to coerce

    # We now know this is an Enum AND the user has configured coercion enabled.
    # Check if we do NOT meet the required conditions and log a failure message
    # if that is the case.
    from_enum_class = from_enum_value.__class__
    if (
        from_enum_class.__qualname__ != to_enum_class.__qualname__
        or (
            coercion_type == "nameOnly"
            and set(to_enum_class._member_names_) != set(from_enum_class._member_names_)
        )
        or (
            coercion_type == "nameAndValue"
            and set(to_enum_class._value2member_map_)
            != set(from_enum_class._value2member_map_)
        )
    ):
        _LOGGER.debug("Failed to coerce %s to class %s", from_enum_value, to_enum_class)
        return from_enum_value  # do not attempt to coerce

    # At this point we think the Enum is coercable, and we know
    # E1 and E2 have the same member names. We convert from E1 to E2 using _name_
    # (since user Enum subclasses can override the .name property in 3.11)
    _LOGGER.debug("Coerced %s to class %s", from_enum_value, to_enum_class)
    return to_enum_class[from_enum_value._name_]


def _extract_common_class_from_iter(iterable: Iterable[Any]) -> Any:
    """Return the common class of all elements in a iterable if they share one.
    Otherwise, return None.
    """
    try:
        inner_iter = iter(iterable)
        first_class = type(next(inner_iter))
    except StopIteration:
        return None
    if all(type(item) is first_class for item in inner_iter):
        return first_class
    return None


@overload
def maybe_coerce_enum(
    register_widget_result: RegisterWidgetResult[Enum],
    options: type[Enum],
    opt_sequence: Sequence[Any],
) -> RegisterWidgetResult[Enum]: ...


@overload
def maybe_coerce_enum(
    register_widget_result: RegisterWidgetResult[T],
    options: OptionSequence[T],
    opt_sequence: Sequence[T],
) -> RegisterWidgetResult[T]: ...


def maybe_coerce_enum(register_widget_result, options, opt_sequence):
    """Maybe Coerce a RegisterWidgetResult with an Enum member value to
    RegisterWidgetResult[option] if option is an EnumType, otherwise just return
    the original RegisterWidgetResult.
    """

    # If the value is not a Enum, return early
    if not isinstance(register_widget_result.value, Enum):
        return register_widget_result

    coerce_class: EnumMeta | None
    if isinstance(options, EnumMeta):
        coerce_class = options
    else:
        coerce_class = _extract_common_class_from_iter(opt_sequence)
        if coerce_class is None:
            return register_widget_result

    return RegisterWidgetResult(
        _coerce_enum(register_widget_result.value, coerce_class),
        register_widget_result.value_changed,
    )


# slightly ugly typing because TypeVars with Generic Bounds are not supported
# (https://github.com/python/typing/issues/548)
@overload
def maybe_coerce_enum_sequence(
    register_widget_result: RegisterWidgetResult[list[T]],
    options: OptionSequence[T],
    opt_sequence: Sequence[T],
) -> RegisterWidgetResult[list[T]]: ...


@overload
def maybe_coerce_enum_sequence(
    register_widget_result: RegisterWidgetResult[tuple[T, T]],
    options: OptionSequence[T],
    opt_sequence: Sequence[T],
) -> RegisterWidgetResult[tuple[T, T]]: ...


def maybe_coerce_enum_sequence(register_widget_result, options, opt_sequence):
    """Maybe Coerce a RegisterWidgetResult with a sequence of Enum members as value
    to RegisterWidgetResult[Sequence[option]] if option is an EnumType, otherwise just return
    the original RegisterWidgetResult.
    """

    # If not all widget values are Enums, return early
    if not all(isinstance(val, Enum) for val in register_widget_result.value):
        return register_widget_result

    # Extract the class to coerce
    coerce_class: EnumMeta | None
    if isinstance(options, EnumMeta):
        coerce_class = options
    else:
        coerce_class = _extract_common_class_from_iter(opt_sequence)
        if coerce_class is None:
            return register_widget_result

    # Return a new RegisterWidgetResult with the coerced enum values sequence
    return RegisterWidgetResult(
        type(register_widget_result.value)(
            _coerce_enum(val, coerce_class) for val in register_widget_result.value
        ),
        register_widget_result.value_changed,
    )
