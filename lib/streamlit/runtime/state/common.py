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

"""Functions and data structures shared by session_state.py and widgets.py"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Dict,
    Generic,
    Optional,
    Sequence,
    Tuple,
    TypeVar,
    Union,
)

from google.protobuf.message import Message
from typing_extensions import Final, TypeAlias

from streamlit import util
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Arrow_pb2 import Arrow
from streamlit.proto.Button_pb2 import Button
from streamlit.proto.CameraInput_pb2 import CameraInput
from streamlit.proto.ChatInput_pb2 import ChatInput
from streamlit.proto.Checkbox_pb2 import Checkbox
from streamlit.proto.ColorPicker_pb2 import ColorPicker
from streamlit.proto.Components_pb2 import ComponentInstance
from streamlit.proto.DateInput_pb2 import DateInput
from streamlit.proto.DownloadButton_pb2 import DownloadButton
from streamlit.proto.FileUploader_pb2 import FileUploader
from streamlit.proto.MultiSelect_pb2 import MultiSelect
from streamlit.proto.NumberInput_pb2 import NumberInput
from streamlit.proto.Radio_pb2 import Radio
from streamlit.proto.Selectbox_pb2 import Selectbox
from streamlit.proto.Slider_pb2 import Slider
from streamlit.proto.TextArea_pb2 import TextArea
from streamlit.proto.TextInput_pb2 import TextInput
from streamlit.proto.TimeInput_pb2 import TimeInput
from streamlit.type_util import ValueFieldName
from streamlit.util import HASHLIB_KWARGS

if TYPE_CHECKING:
    from builtins import ellipsis

    from streamlit.runtime.state.widgets import NoValue


# Protobuf types for all widgets.
WidgetProto: TypeAlias = Union[
    Arrow,
    Button,
    CameraInput,
    ChatInput,
    Checkbox,
    ColorPicker,
    ComponentInstance,
    DateInput,
    DownloadButton,
    FileUploader,
    MultiSelect,
    NumberInput,
    Radio,
    Selectbox,
    Slider,
    TextArea,
    TextInput,
    TimeInput,
]

GENERATED_WIDGET_ID_PREFIX: Final = "$$WIDGET_ID"


T = TypeVar("T")
T_co = TypeVar("T_co", covariant=True)


WidgetArgs: TypeAlias = Tuple[Any, ...]
WidgetKwargs: TypeAlias = Dict[str, Any]
WidgetCallback: TypeAlias = Callable[..., None]

# A deserializer receives the value from whatever field is set on the
# WidgetState proto, and returns a regular python value. A serializer
# receives a regular python value, and returns something suitable for
# a value field on WidgetState proto. They should be inverses.
WidgetDeserializer: TypeAlias = Callable[[Any, str], T]
WidgetSerializer: TypeAlias = Callable[[T], Any]


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
    callback_args: WidgetArgs | None = None
    callback_kwargs: WidgetKwargs | None = None

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
    ) -> "RegisterWidgetResult[T_co]":
        """The canonical way to construct a RegisterWidgetResult in cases
        where the true widget value could not be determined.
        """
        return cls(value=deserializer(None, ""), value_changed=False)


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


def compute_widget_id(
    element_type: str,
    user_key: str | None = None,
    **kwargs: SAFE_VALUES | Sequence[SAFE_VALUES],
) -> str:
    """Compute the widget id for the given widget. This id is stable: a given
    set of inputs to this function will always produce the same widget id output.

    Only stable, deterministic values should be used to compute widget ids. Using
    nondeterministic values as inputs can cause the resulting widget id to
    change between runs.

    The widget id includes the user_key so widgets with identical arguments can
    use it to be distinct.

    The widget id includes an easily identified prefix, and the user_key as a
    suffix, to make it easy to identify it and know if a key maps to it.
    """
    h = hashlib.new("md5", **HASHLIB_KWARGS)
    h.update(element_type.encode("utf-8"))
    # This will iterate in a consistent order when the provided arguments have
    # consistent order; dicts are always in insertion order.
    for k, v in kwargs.items():
        h.update(str(k).encode("utf-8"))
        h.update(str(v).encode("utf-8"))
    return f"{GENERATED_WIDGET_ID_PREFIX}-{h.hexdigest()}-{user_key}"


def user_key_from_widget_id(widget_id: str) -> Optional[str]:
    """Return the user key portion of a widget id, or None if the id does not
    have a user key.

    TODO This will incorrectly indicate no user key if the user actually provides
    "None" as a key, but we can't avoid this kind of problem while storing the
    string representation of the no-user-key sentinel as part of the widget id.
    """
    user_key = widget_id.split("-", maxsplit=2)[-1]
    user_key = None if user_key == "None" else user_key
    return user_key


def is_widget_id(key: str) -> bool:
    """True if the given session_state key has the structure of a widget ID."""
    return key.startswith(GENERATED_WIDGET_ID_PREFIX)


def is_keyed_widget_id(key: str) -> bool:
    """True if the given session_state key has the structure of a widget ID with a user_key."""
    return is_widget_id(key) and not key.endswith("-None")


def require_valid_user_key(key: str) -> None:
    """Raise an Exception if the given user_key is invalid."""
    if is_widget_id(key):
        raise StreamlitAPIException(
            f"Keys beginning with {GENERATED_WIDGET_ID_PREFIX} are reserved."
        )
