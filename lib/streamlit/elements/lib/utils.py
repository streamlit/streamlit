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

import hashlib
from datetime import date, datetime, time, timedelta
from enum import Enum, EnumMeta
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Iterable,
    Literal,
    Sequence,
    TypeVar,
    Union,
    overload,
)

from google.protobuf.message import Message
from typing_extensions import TypeAlias

from streamlit import config, dataframe_util, errors, logger
from streamlit.errors import StreamlitDuplicateElementId, StreamlitDuplicateElementKey
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    get_script_run_ctx,
)
from streamlit.runtime.state.common import (
    GENERATED_ELEMENT_ID_PREFIX,
    RegisterWidgetResult,
    user_key_from_element_id,
)
from streamlit.util import HASHLIB_KWARGS

if TYPE_CHECKING:
    from builtins import ellipsis

    from streamlit.runtime.state.widgets import NoValue
    from streamlit.type_util import T

_LOGGER: Final = logger.get_logger(__name__)

Key: TypeAlias = Union[str, int]

LabelVisibility: TypeAlias = Literal["visible", "hidden", "collapsed"]

PROTO_SCALAR_VALUE = Union[float, int, bool, str, bytes]
SAFE_VALUES = Union[
    date,
    time,
    datetime,
    timedelta,
    None,
    "NoValue",
    "ellipsis",
    Message,
    PROTO_SCALAR_VALUE,
]


def get_label_visibility_proto_value(
    label_visibility_string: LabelVisibility,
) -> LabelVisibilityMessage.LabelVisibilityOptions.ValueType:
    """Returns one of LabelVisibilityMessage enum constants.py based on string value."""

    if label_visibility_string == "visible":
        return LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
    elif label_visibility_string == "hidden":
        return LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN
    elif label_visibility_string == "collapsed":
        return LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED

    raise ValueError(f"Unknown label visibility value: {label_visibility_string}")


@overload
def to_key(key: None) -> None: ...


@overload
def to_key(key: Key) -> str: ...


def to_key(key: Key | None) -> str | None:
    return None if key is None else str(key)


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
        raise errors.StreamlitAPIException(
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


@overload
def maybe_coerce_enum(
    register_widget_result: RegisterWidgetResult[Enum],
    options: type[Enum],
    opt_sequence: Sequence[Any],
) -> RegisterWidgetResult[Enum]: ...


@overload
def maybe_coerce_enum(
    register_widget_result: RegisterWidgetResult[T],
    options: dataframe_util.OptionSequence[T],
    opt_sequence: Sequence[T],
) -> RegisterWidgetResult[T]: ...


def maybe_coerce_enum(register_widget_result, options, opt_sequence):
    """Maybe Coerce a RegisterWidgetResult with an Enum member value to
    RegisterWidgetResult[option] if option is an EnumType, otherwise just return
    the original RegisterWidgetResult."""

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
    options: dataframe_util.OptionSequence[T],
    opt_sequence: Sequence[T],
) -> RegisterWidgetResult[list[T]]: ...


@overload
def maybe_coerce_enum_sequence(
    register_widget_result: RegisterWidgetResult[tuple[T, T]],
    options: dataframe_util.OptionSequence[T],
    opt_sequence: Sequence[T],
) -> RegisterWidgetResult[tuple[T, T]]: ...


def maybe_coerce_enum_sequence(register_widget_result, options, opt_sequence):
    """Maybe Coerce a RegisterWidgetResult with a sequence of Enum members as value
    to RegisterWidgetResult[Sequence[option]] if option is an EnumType, otherwise just return
    the original RegisterWidgetResult."""

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


def _extract_common_class_from_iter(iterable: Iterable[Any]) -> Any:
    """Return the common class of all elements in a iterable if they share one.
    Otherwise, return None."""
    try:
        inner_iter = iter(iterable)
        first_class = type(next(inner_iter))
    except StopIteration:
        return None
    if all(type(item) is first_class for item in inner_iter):
        return first_class
    return None


def _register_element_id(element_type: str, element_id: str) -> None:
    """Register the element ID and key for the given element.

    If the element ID or key is not unique, an error is raised.

    Parameters
    ----------

    element_type : str
        The type of the element to register.

    element_id : str
        The ID of the element to register.

    Raises
    ------

    StreamlitDuplicateElementKey
        If the element key is not unique.

    StreamlitDuplicateElementID
        If the element ID is not unique.

    """
    ctx = get_script_run_ctx()
    if ctx is None or not element_id:
        return

    if user_key := user_key_from_element_id(element_id):
        if user_key not in ctx.widget_user_keys_this_run:
            ctx.widget_user_keys_this_run.add(user_key)
        else:
            raise StreamlitDuplicateElementKey(user_key)

    if element_id not in ctx.widget_ids_this_run:
        ctx.widget_ids_this_run.add(element_id)
    else:
        raise StreamlitDuplicateElementId(element_type)


def _compute_element_id(
    element_type: str,
    user_key: str | None = None,
    **kwargs: SAFE_VALUES | Iterable[SAFE_VALUES],
) -> str:
    """Compute the ID for the given element.

    This ID is stable: a given set of inputs to this function will always produce
    the same ID output. Only stable, deterministic values should be used to compute
    element IDs. Using nondeterministic values as inputs can cause the resulting
    element ID to change between runs.

    The element ID includes the user_key so elements with identical arguments can
    use it to be distinct. The element ID includes an easily identified prefix, and the
    user_key as a suffix, to make it easy to identify it and know if a key maps to it.
    """
    h = hashlib.new("md5", **HASHLIB_KWARGS)
    h.update(element_type.encode("utf-8"))
    # This will iterate in a consistent order when the provided arguments have
    # consistent order; dicts are always in insertion order.
    for k, v in kwargs.items():
        h.update(str(k).encode("utf-8"))
        h.update(str(v).encode("utf-8"))
    return f"{GENERATED_ELEMENT_ID_PREFIX}-{h.hexdigest()}-{user_key}"


def compute_and_register_element_id(
    element_type: str,
    user_key: str | None = None,
    **kwargs: SAFE_VALUES | Iterable[SAFE_VALUES],
) -> str:
    """Compute and register the ID for the given element.

    This ID is stable: a given set of inputs to this function will always produce
    the same ID output. Only stable, deterministic values should be used to compute
    element IDs. Using nondeterministic values as inputs can cause the resulting
    element ID to change between runs.

    The element ID includes the user_key so elements with identical arguments can
    use it to be distinct. The element ID includes an easily identified prefix, and the
    user_key as a suffix, to make it easy to identify it and know if a key maps to it.

    The element ID gets registered to make sure that only one ID and user-specified
    key exists at the same time. If there are duplicated IDs or keys, an error
    is raised.
    """
    element_id = _compute_element_id(element_type, user_key, **kwargs)
    _register_element_id(element_type, element_id)
    return element_id
