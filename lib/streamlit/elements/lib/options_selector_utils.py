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

from enum import Enum, EnumMeta
from typing import TYPE_CHECKING, Any, Final, TypeVar, overload

from streamlit import config, logger
from streamlit.dataframe_util import OptionSequence, convert_anything_to_list
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state import get_session_state
from streamlit.runtime.state.common import RegisterWidgetResult
from streamlit.type_util import (
    check_python_comparable,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable, Sequence

_LOGGER: Final = logger.get_logger(__name__)

_FLOAT_EQUALITY_EPSILON: Final[float] = 0.000000000005
_Value = TypeVar("_Value")
T = TypeVar("T")


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
        if (
            isinstance(value, float)
            and isinstance(x, float)
            and abs(x - value) < _FLOAT_EQUALITY_EPSILON
        ):
            return i
    raise ValueError(f"{x} is not in iterable")


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
    return default_indices if default_indices is not None else []


E1 = TypeVar("E1", bound=Enum)
E2 = TypeVar("E2", bound=Enum)

_ALLOWED_ENUM_COERCION_CONFIG_SETTINGS = ("off", "nameOnly", "nameAndValue")


def _coerce_enum(from_enum_value: E1, to_enum_class: type[E2]) -> E1 | E2:
    """Attempt to coerce an Enum value to another EnumMeta.

    An Enum value of EnumMeta E1 is considered coercible to EnumType E2
    if the EnumMeta __qualname__ match and the names of their members
    match as well. (This is configurable in streamlist configs)
    """
    if not isinstance(from_enum_value, Enum):
        raise ValueError(  # noqa: TRY004
            f"Expected an Enum in the first argument. Got {type(from_enum_value)}"
        )
    if not isinstance(to_enum_class, EnumMeta):
        raise ValueError(  # noqa: TRY004
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

    # At this point we think the Enum is coercible, and we know
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


def maybe_coerce_enum(
    register_widget_result: RegisterWidgetResult[Any],
    options: OptionSequence[Any],
    opt_sequence: Sequence[Any],
) -> RegisterWidgetResult[Any]:
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
    register_widget_result: RegisterWidgetResult[list[T] | list[T | str]],
    options: OptionSequence[T],
    opt_sequence: Sequence[T],
) -> RegisterWidgetResult[list[T] | list[T | str]]: ...


@overload
def maybe_coerce_enum_sequence(
    register_widget_result: RegisterWidgetResult[tuple[T, T]],
    options: OptionSequence[T],
    opt_sequence: Sequence[T],
) -> RegisterWidgetResult[tuple[T, T]]: ...


def maybe_coerce_enum_sequence(
    register_widget_result: RegisterWidgetResult[list[Any] | tuple[Any, ...]],
    options: OptionSequence[Any],
    opt_sequence: Sequence[Any],
) -> RegisterWidgetResult[list[Any] | tuple[Any, ...]]:
    """Maybe Coerce a RegisterWidgetResult with a sequence of Enum members as value
    to RegisterWidgetResult[Sequence[option]] if option is an EnumType, otherwise just
    return the original RegisterWidgetResult.
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


def create_mappings(
    options: Sequence[T], format_func: Callable[[T], str] = str
) -> tuple[list[str], dict[str, int]]:
    """Iterates through the options and formats them using the format_func.

    Returns a tuple of the formatted options and a mapping of the formatted options to
    the original options.
    """
    formatted_option_to_option_mapping: dict[str, int] = {}
    formatted_options: list[str] = []
    for index, option in enumerate(options):
        formatted_option = format_func(option)
        formatted_options.append(formatted_option)
        formatted_option_to_option_mapping[formatted_option] = index

    return (
        formatted_options,
        formatted_option_to_option_mapping,
    )


def validate_and_sync_value_with_options(
    current_value: T | None,
    opt: Sequence[T],
    default_index: int | None,
    key: str | int | None,
) -> tuple[T | None, bool]:
    """Validate current value against options, resetting session state if invalid.

    This function has a side-effect: if the value is not found in the options
    and a key is provided, it will update session state with the new value.

    Parameters
    ----------
    current_value
        The current widget value to validate.
    opt
        The sequence of valid options.
    default_index
        The default index to reset to if value is invalid.
    key
        The widget key for session state updates.

    Returns
    -------
    tuple[T | None, bool]
        A tuple of (validated_value, value_was_reset).
    """
    if current_value is None:
        return current_value, False

    # Check if current value is still in the new options
    try:
        index_(opt, current_value)
        return current_value, False
    except ValueError:
        # Value not in options - reset to default
        if default_index is not None and len(opt) > 0:
            new_value: T | None = opt[default_index]
        else:
            new_value = None

        if key is not None:
            # Update session_state so subsequent accesses in this run
            # return the corrected value. Use reset_state_value to avoid
            # the "cannot be modified after widget instantiated" error.
            get_session_state().reset_state_value(str(key), new_value)

        return new_value, True


def validate_and_sync_multiselect_value_with_options(
    current_values: list[T] | list[T | str],
    opt: Sequence[T],
    key: str | int | None,
) -> tuple[list[T] | list[T | str], bool]:
    """Validate multiselect values against options, syncing session state if needed.

    This function has a side-effect: if any values are filtered out and a key
    is provided, it will update session state with the filtered list.

    Unlike selectbox which resets to a default when the value is invalid,
    multiselect filters out invalid values and keeps the valid ones.

    Parameters
    ----------
    current_values
        The current list of selected values to validate.
    opt
        The sequence of valid options.
    key
        The widget key for session state updates.

    Returns
    -------
    tuple[list[T] | list[T | str], bool]
        A tuple of (validated_values, values_were_filtered).
    """
    if not current_values:
        return current_values, False

    valid_values: list[T | str] = []
    for value in current_values:
        try:
            index_(opt, value)
            valid_values.append(value)
        except ValueError:  # noqa: PERF203
            pass

    if len(valid_values) == len(current_values):
        return current_values, False

    if key is not None:
        get_session_state().reset_state_value(str(key), valid_values)

    return valid_values, True
