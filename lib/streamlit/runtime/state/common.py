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

"""Functions and data structures shared by session_state.py and widgets.py."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Generic,
    Literal,
    TypeAlias,
    TypeGuard,
    TypeVar,
    cast,
    get_args,
)

from streamlit import util
from streamlit.errors import (
    StreamlitAPIException,
)

if TYPE_CHECKING:
    from streamlit.runtime.state.session_state import SessionState

GENERATED_ELEMENT_ID_PREFIX: Final = "$$ID"
TESTING_KEY = "$$STREAMLIT_INTERNAL_KEY_TESTING"


T = TypeVar("T")
T_co = TypeVar("T_co", covariant=True)


WidgetArgs: TypeAlias = tuple[Any, ...] | list[Any]
WidgetKwargs: TypeAlias = dict[str, Any]
WidgetCallback: TypeAlias = Callable[..., None]

# A deserializer receives the value from whatever field is set on the
# WidgetState proto, and returns a regular python value. A serializer
# receives a regular python value, and returns something suitable for
# a value field on WidgetState proto. They should be inverses.
WidgetDeserializer: TypeAlias = Callable[[Any], T]
WidgetSerializer: TypeAlias = Callable[[T], Any]

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
_ARRAY_VALUE_FIELD_NAMES: Final = frozenset(
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
    "json_trigger_value",
    "string_value",
    "trigger_value",
    "string_trigger_value",
    "chat_input_value",
]


def is_array_value_field_name(obj: object) -> TypeGuard[ArrayValueFieldName]:
    return obj in _ARRAY_VALUE_FIELD_NAMES


# Optional hook that allows a widget to customize how its value should be
# presented in `st.session_state` without altering the underlying stored value
# or callback semantics. The presenter receives the widget's base value and the
# SessionState instance in case it needs to access additional widget state.
WidgetValuePresenter: TypeAlias = Callable[[Any, "SessionState"], Any]


@dataclass(frozen=True)
class WidgetMetadata(Generic[T]):
    """Metadata associated with a single widget. Immutable."""

    id: str
    deserializer: WidgetDeserializer[T] = field(repr=False)
    serializer: WidgetSerializer[T] = field(repr=False)
    value_type: ValueFieldName

    # An optional user-code callback invoked when the widget's value changes.
    # Widget callbacks are called at the start of a script run, before the
    # body of the script is executed.
    callback: WidgetCallback | None = None

    # An optional dictionary of event names to user-code callbacks. These are
    # invoked when the corresponding widget event occurs. Callbacks are called
    # at the start of a script run, before the body of the script is executed.
    # Right now, multiple callbacks are only supported for widgets with a
    # `value_type` of `json_value` or `json_trigger_value`. The keys in this
    # dictionary should correspond to keys in the widget's JSON state.
    callbacks: dict[str, WidgetCallback] | None = None
    callback_args: WidgetArgs | None = None
    callback_kwargs: WidgetKwargs | None = None

    fragment_id: str | None = None

    # Optional presenter hook used for customizing the user-visible value in
    # st.session_state. This is intended for advanced widgets (e.g. Custom
    # Components v2) that need to synthesize a presentation-only value from
    # multiple internal widget states.
    presenter: WidgetValuePresenter | None = None

    def __repr__(self) -> str:
        return util.repr_(self)


@dataclass(frozen=True)
class RegisterWidgetResult(Generic[T_co]):
    """Result returned by the `register_widget` family of functions/methods.

    Should be usable by widget code to determine what value to return, and
    whether to update the UI.

    Parameters
    ----------
    value : T_co
        The widget's current value, or, in cases where the true widget value
        could not be determined, an appropriate fallback value.

        This value should be returned by the widget call.
    value_changed : bool
        True if the widget's value is different from the value most recently
        returned from the frontend.

        Implies an update to the frontend is needed.
    """

    value: T_co
    value_changed: bool

    @classmethod
    def failure(
        cls, deserializer: WidgetDeserializer[T_co]
    ) -> RegisterWidgetResult[T_co]:
        """The canonical way to construct a RegisterWidgetResult in cases
        where the true widget value could not be determined.
        """
        return cls(value=deserializer(None), value_changed=False)


def user_key_from_element_id(element_id: str) -> str | None:
    """Return the user key portion of a element id, or None if the id does not
    have a user key.

    TODO This will incorrectly indicate no user key if the user actually provides
    "None" as a key, but we can't avoid this kind of problem while storing the
    string representation of the no-user-key sentinel as part of the element id.
    """
    user_key: str | None = element_id.split("-", maxsplit=2)[-1]
    return None if user_key == "None" else user_key


def is_element_id(key: str) -> bool:
    """True if the given session_state key has the structure of a element ID."""
    return key.startswith(GENERATED_ELEMENT_ID_PREFIX)


def is_keyed_element_id(key: str) -> bool:
    """True if the given session_state key has the structure of a element ID
    with a user_key.
    """
    return is_element_id(key) and not key.endswith("-None")


def require_valid_user_key(key: str) -> None:
    """Raise an Exception if the given user_key is invalid."""
    if is_element_id(key):
        raise StreamlitAPIException(
            f"Keys beginning with {GENERATED_ELEMENT_ID_PREFIX} are reserved."
        )
